import { useEffect, useState } from 'react'
import { api } from '../api'
import type { MiniState } from '../types'
import { cx, formatTime } from '../utils'
import { Cover } from './Cover'
import { Icon } from './Icons'

const EMPTY: MiniState = {
  trackId: null,
  title: 'Nothing playing',
  artist: 'MeowPlayer',
  album: '',
  cover: null,
  playing: false,
  time: 0,
  duration: 0,
  liked: false,
  external: false,
  lyric: null,
}

export function MiniWindow() {
  const [state, setState] = useState<MiniState>(EMPTY)
  const [lyricsOn, setLyricsOn] = useState(true)

  useEffect(() => {
    void api.mini.requestState().then((value) => {
      if (value) setState(value as MiniState)
    })
    return api.mini.onState((value) => setState(value as MiniState))
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === ' ') {
        event.preventDefault()
        api.mini.command('playpause')
      }
      if (event.key === 'ArrowRight') api.mini.command('next')
      if (event.key === 'ArrowLeft') api.mini.command('prev')
      if (event.key === 'Escape') api.mini.command('hideMini')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const progress = state.duration > 0 ? Math.min(1, state.time / state.duration) : 0
  const lyric = lyricsOn ? state.lyric : null

  return (
    <div className="mini-shell">
      <div className="mini-card">
        <div className="mini-inner">
          <button
            type="button"
            className="mini-cover-btn"
            title="Open MeowPlayer"
            onClick={() => api.mini.command('expand')}
          >
            <Cover src={state.cover} size={94} seed={state.album || 'MeowPlayer'} alt={state.album} />
            <span className={cx('mini-cover-play', state.playing && 'playing')}>
              <Icon name={state.playing ? 'pause' : 'play'} size={15} />
            </span>
          </button>

          <div className="mini-text">
            <span className="mini-title">{state.title}</span>
            <span className="mini-artist">{state.artist}</span>
            <span className="mini-time">
              {formatTime(state.time)} / {formatTime(state.duration)}
            </span>
          </div>

          <div className="mini-controls">
            {state.external && (
              <button
                type="button"
                className="mini-chip"
                title="Add this file to your library"
                onClick={() => api.mini.command('addToLibrary')}
              >
                <Icon name="plus" size={12} /> Add
              </button>
            )}
            <button type="button" className="icon-btn" title="Previous" onClick={() => api.mini.command('prev')}>
              <Icon name="prev" size={15} />
            </button>
            <button
              type="button"
              className="play-btn small"
              title={state.playing ? 'Pause' : 'Play'}
              onClick={() => api.mini.command('playpause')}
            >
              <Icon name={state.playing ? 'pause' : 'play'} size={16} />
            </button>
            <button type="button" className="icon-btn" title="Next" onClick={() => api.mini.command('next')}>
              <Icon name="next" size={15} />
            </button>
            <button
              type="button"
              className={cx('icon-btn', lyricsOn && 'on')}
              title={lyricsOn ? 'Hide the lyric line' : 'Show the lyric line'}
              onClick={() => {
                const next = !lyricsOn
                setLyricsOn(next)
                api.mini.command('toggleMiniLyrics')
              }}
            >
              <Icon name="music" size={14} />
            </button>
            <button
              type="button"
              className="icon-btn"
              title="Back to the full player"
              onClick={() => api.mini.command('expand')}
            >
              <Icon name="expand" size={14} />
            </button>
          </div>
        </div>

        <div className={cx('mini-lyric-row', !lyric && 'empty')}>
          <span className="mini-lyric" title={lyric ?? undefined}>
            {lyric ?? ''}
          </span>
        </div>

        <div className="mini-progress">
          <div style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  )
}
