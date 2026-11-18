import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { activeLyricIndex, cx } from '../utils'
import { Icon } from './Icons'

interface LyricsProps {
  compact?: boolean
  className?: string
}

/** How long a manual scroll pauses the automatic follow, in ms. */
const MANUAL_PAUSE = 5000

export function Lyrics({ compact, className }: LyricsProps) {
  const lyrics = useStore((state) => state.lyrics)
  const time = useStore((state) => state.time)
  const enabled = useStore((state) => state.settings.lyrics)
  const listRef = useRef<HTMLDivElement | null>(null)
  const lineRefs = useRef<Array<HTMLParagraphElement | null>>([])
  const manualUntil = useRef(0)
  const active = activeLyricIndex(lyrics.synced, time)

  /**
   * Scrolls the lyrics box itself instead of calling scrollIntoView, which walks
   * up to the nearest scrollable ancestor and yanks the whole view/sidebar with
   * it — that was what broke the layout while a track was playing.
   */
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    if (Date.now() < manualUntil.current) return

    const line = lineRefs.current[active]
    if (!line) return

    const target = line.offsetTop - list.clientHeight / 2 + line.clientHeight / 2
    const top = Math.max(0, Math.min(target, list.scrollHeight - list.clientHeight))
    if (Math.abs(list.scrollTop - top) < 2) return

    list.scrollTo({ top, behavior: 'smooth' })
  }, [active, lyrics.trackId])

  const markManual = (): void => {
    manualUntil.current = Date.now() + MANUAL_PAUSE
  }

  if (!enabled) {
    return (
      <div className={cx('lyrics empty', className)}>
        <Icon name="music" size={16} />
        <span>Lyrics are turned off in settings</span>
      </div>
    )
  }

  if (lyrics.loading) {
    return (
      <div className={cx('lyrics empty', className)}>
        <span className="lyrics-spinner" />
        <span>Looking up lyrics…</span>
      </div>
    )
  }

  if (lyrics.synced.length) {
    return (
      <div
        className={cx('lyrics', compact && 'compact', className)}
        ref={listRef}
        onWheel={markManual}
        onTouchMove={markManual}
      >
        {lyrics.synced.map((line, index) => (
          <p
            key={`${line.time}-${index}`}
            ref={(node) => {
              lineRefs.current[index] = node
            }}
            className={cx('lyric-line', index === active && 'active')}
            onClick={() => {
              manualUntil.current = Date.now() + MANUAL_PAUSE
            }}
          >
            {line.text}
          </p>
        ))}
      </div>
    )
  }

  if (lyrics.plain) {
    return (
      <div className={cx('lyrics', compact && 'compact', className)}>
        {lyrics.plain.split(/\r?\n/).map((line, index) =>
          line.trim() ? (
            <p key={index} className="lyric-line">
              {line}
            </p>
          ) : null,
        )}
      </div>
    )
  }

  return (
    <div className={cx('lyrics empty', className)}>
      <Icon name="music" size={16} />
      <span>{lyrics.error ?? 'No lyrics for this track yet'}</span>
    </div>
  )
}
