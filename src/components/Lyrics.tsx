import { useEffect, useRef } from 'react'
import { getStore, useStore } from '../store/useStore'
import { activeLyricIndex, cx, lyricProgress } from '../utils'
import { Icon } from './Icons'
import { Logo } from './Logo'

interface LyricsProps {
  /** Large "stage" type for the now playing screen. */
  stage?: boolean
  className?: string
}

/** How long a manual scroll pauses the automatic follow, in ms. */
const MANUAL_PAUSE = 4000

export function Lyrics({ stage, className }: LyricsProps) {
  const lyrics = useStore((state) => state.lyrics)
  const time = useStore((state) => state.time)
  const enabled = useStore((state) => state.settings.lyrics)
  const autoLyrics = useStore((state) => state.settings.autoLyrics)
  const track = useStore((state) => state.playingTrack)
  const listRef = useRef<HTMLDivElement | null>(null)
  const lineRefs = useRef<Array<HTMLParagraphElement | null>>([])
  const manualUntil = useRef(0)
  const active = activeLyricIndex(lyrics.synced, time)
  const progress = lyricProgress(lyrics.synced, active, time)

  // Scroll the lyrics box itself (scrollIntoView would drag the whole view along).
  useEffect(() => {
    const list = listRef.current
    if (!list || Date.now() < manualUntil.current) return
    const line = lineRefs.current[Math.max(0, active)]
    if (!line) return
    const target = line.offsetTop - list.clientHeight * 0.38 + line.clientHeight / 2
    const top = Math.max(0, Math.min(target, list.scrollHeight - list.clientHeight))
    if (Math.abs(list.scrollTop - top) > 2) list.scrollTo({ top, behavior: 'smooth' })
  }, [active, lyrics.trackId])

  const markManual = (): void => {
    manualUntil.current = Date.now() + MANUAL_PAUSE
  }

  const empty = (content: React.ReactNode, action?: React.ReactNode) => (
    <div className={cx('lyrics-empty', stage && 'stage', className)}>
      <span className="lyrics-cat">
        <Logo size={stage ? 40 : 30} />
      </span>
      {content}
      {action}
    </div>
  )

  if (!track) return empty(<p>Play something to see its lyrics.</p>)
  if (!enabled) return empty(<p>Lyrics are turned off.</p>)

  const fetchNow = (label: string) => (
    <button type="button" className="btn ghost small" onClick={() => void getStore().fetchLyrics(track, true)}>
      <Icon name="refresh" size={13} /> {label}
    </button>
  )

  if (lyrics.loading) {
    return (
      <div className={cx('lyrics-empty', stage && 'stage', className)}>
        <span className="spinner" />
        <p>Looking up lyrics…</p>
      </div>
    )
  }

  if (lyrics.trackId !== track.id) {
    return empty(<p>{autoLyrics ? 'No lyrics loaded yet.' : 'Lyrics are fetched on request.'}</p>, fetchNow('Fetch lyrics'))
  }

  if (lyrics.synced.length) {
    return (
      <div
        className={cx('lyrics synced', stage && 'stage', className)}
        ref={listRef}
        onWheel={markManual}
        onPointerDown={markManual}
      >
        {lyrics.synced.map((line, index) => {
          const distance = Math.abs(index - active)
          return (
            <p
              key={`${line.time}-${index}`}
              ref={(node) => {
                lineRefs.current[index] = node
              }}
              className={cx(
                'lyric-line',
                index === active && 'active',
                index < active && 'past',
                !line.text && 'gap',
                distance > 0 && distance <= 3 && `near-${distance}`,
              )}
              style={index === active ? ({ '--progress': `${(progress * 100).toFixed(1)}%` } as React.CSSProperties) : undefined}
              onClick={() => {
                manualUntil.current = 0
                getStore().seek(line.time)
              }}
              title="Jump here"
            >
              {line.text || <span className="gap-dots" aria-label="Instrumental">• • •</span>}
            </p>
          )
        })}
      </div>
    )
  }

  if (lyrics.plain) {
    return (
      <div className={cx('lyrics plain', stage && 'stage', className)}>
        {lyrics.plain.split(/\r?\n/).map((line, index) =>
          line.trim() ? (
            <p key={index} className="lyric-line">
              {line}
            </p>
          ) : (
            <p key={index} className="lyric-break" />
          ),
        )}
      </div>
    )
  }

  return empty(<p>{lyrics.error ?? 'No lyrics for this track.'}</p>, fetchNow('Try again'))
}
