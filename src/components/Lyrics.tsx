import { useEffect, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import { getStore, useStore } from '../store/useStore'
import type { LyricsLine } from '../types'
import { activeLyricIndex, cx, isRtl, lyricProgress } from '../utils'
import { Icon } from './Icons'
import { Logo } from './Logo'

interface LyricsProps {
  /** Large "stage" type for the now playing screen. */
  stage?: boolean
  className?: string
}

/** How long a manual scroll pauses the automatic follow, in ms. */
const MANUAL_PAUSE = 4000

/**
 * Follows playback every frame using the audio element's own clock (the store
 * only hears about the position a few times a second, which made the highlight
 * lag). React re-renders only when the current line changes; the fill of the
 * current line is written straight to its style.
 */
function useActiveLine(lines: LyricsLine[], lineRefs: React.RefObject<Array<HTMLElement | null>>): number {
  const isPlaying = useStore((state) => state.isPlaying)
  const time = useStore((state) => state.time)
  const [live, setActive] = useState(-1)

  useEffect(() => {
    if (!isPlaying || !lines.length) return
    let frame = 0
    let current = -2
    let lastWrite = 0
    let lastValue = ''
    const tick = (stamp: number): void => {
      frame = requestAnimationFrame(tick)
      // About 30 updates a second is smooth for a colour fill and far cheaper than every frame on a 165 Hz screen.
      if (stamp - lastWrite < 32) return
      lastWrite = stamp
      const now = engine.currentTime
      const index = activeLyricIndex(lines, now)
      if (index !== current) {
        current = index
        setActive(index)
      }
      const value = `${Math.round(lyricProgress(lines, index, now) * 200) / 2}%`
      const node = lineRefs.current?.[index]
      if (node && value !== lastValue) {
        lastValue = value
        node.style.setProperty('--progress', value)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, lines, lineRefs])

  // While paused (or after a seek) the store position is exact enough.
  return isPlaying ? live : activeLyricIndex(lines, time)
}

function SyncedLyrics({ lines, stage, className, trackId }: { lines: LyricsLine[]; stage?: boolean; className?: string; trackId: string }) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const lineRefs = useRef<Array<HTMLElement | null>>([])
  const manualUntil = useRef(0)
  const active = useActiveLine(lines, lineRefs)

  // A new song starts at the top.
  useEffect(() => {
    manualUntil.current = 0
    listRef.current?.scrollTo({ top: 0 })
  }, [trackId])

  // Keep the current line a little above the middle. Scrolling the list itself
  // (not scrollIntoView) keeps the rest of the page still.
  useEffect(() => {
    const list = listRef.current
    if (!list || Date.now() < manualUntil.current) return
    const line = lineRefs.current[active]
    if (!line) {
      if (active < 0) list.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const target = line.offsetTop - list.clientHeight * 0.38 + line.clientHeight / 2
    const top = Math.max(0, Math.min(target, list.scrollHeight - list.clientHeight))
    if (Math.abs(list.scrollTop - top) > 2) list.scrollTo({ top, behavior: 'smooth' })
  }, [active])

  const markManual = (): void => {
    manualUntil.current = Date.now() + MANUAL_PAUSE
  }

  return (
    <div
      className={cx('lyrics synced', stage && 'stage', className)}
      ref={listRef}
      onWheel={markManual}
      onPointerDown={markManual}
    >
      {lines.map((line, index) => {
        const rtl = isRtl(line.text)
        return (
          <p
            key={`${line.time}-${index}`}
            ref={(node) => {
              lineRefs.current[index] = node
            }}
            dir={rtl ? 'rtl' : 'ltr'}
            className={cx(
              'lyric-line',
              index === active && 'active',
              index < active && 'past',
              !line.text && 'gap',
              rtl && 'rtl',
              Math.abs(index - active) <= 2 && index !== active && `near-${Math.abs(index - active)}`,
            )}
            onClick={() => {
              manualUntil.current = 0
              getStore().seek(line.time)
            }}
            title="Jump here"
          >
            {line.text ? (
              <span className="lyric-text">{line.text}</span>
            ) : (
              <span className="gap-dots" aria-label="Instrumental break">
                • • •
              </span>
            )}
          </p>
        )
      })}
    </div>
  )
}

export function Lyrics({ stage, className }: LyricsProps) {
  const lyrics = useStore((state) => state.lyrics)
  const enabled = useStore((state) => state.settings.lyrics)
  const autoLyrics = useStore((state) => state.settings.autoLyrics)
  const track = useStore((state) => state.playingTrack)

  const empty = (content: React.ReactNode, action?: React.ReactNode, icon?: React.ReactNode) => (
    <div className={cx('lyrics-empty', stage && 'stage', className)}>
      <span className="lyrics-cat">{icon ?? <Logo size={stage ? 40 : 30} />}</span>
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

  if (lyrics.instrumental) {
    return empty(
      <p className="instrumental-label">Instrumental</p>,
      undefined,
      <Icon name="music" size={stage ? 34 : 26} />,
    )
  }

  if (lyrics.synced.length) {
    return <SyncedLyrics lines={lyrics.synced} stage={stage} className={className} trackId={track.id} />
  }

  if (lyrics.plain) {
    return (
      <div className={cx('lyrics plain', stage && 'stage', className)}>
        {lyrics.plain.split(/\r?\n/).map((line, index) =>
          line.trim() ? (
            <p key={index} className={cx('lyric-line', isRtl(line) && 'rtl')} dir={isRtl(line) ? 'rtl' : 'ltr'}>
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
