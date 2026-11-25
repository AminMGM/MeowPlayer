import { useEffect, useState } from 'react'
import { api } from '../api'
import type { MiniState } from '../types'
import { cx, formatTime } from '../utils'
import { Cover } from './Cover'
import { Icon } from './Icons'
import { Slider } from './Slider'

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
  lyricsOn: true,
  shuffle: false,
  repeat: 'off',
}

/** The floating always-on-top mini player window. */
export function MiniWindow() {
  const [state, setState] = useState<MiniState>(EMPTY)

  useEffect(() => {
    document.documentElement.classList.add('mini-root')
    void api.mini.requestState().then((value) => {
      if (value) setState(value as MiniState)
    })
    return api.mini.onState((value) => setState(value as MiniState))
  }, [])

  // Zoom is shared with the main window; undo it so this fixed-size window fits.
  useEffect(() => {
    const apply = (): void => {
      const zoom = api.ui.getZoom() || 1
      document.documentElement.style.zoom = String(1 / zoom)
    }
    apply()
    const timer = window.setInterval(apply, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === ' ') {
        event.preventDefault()
        api.mini.command('playpause')
      }
      if (event.key === 'ArrowRight') api.mini.command('next')
      if (event.key === 'ArrowLeft') api.mini.command('prev')
      if (event.key === 'Escape') api.mini.command('expand')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const lyric = state.lyricsOn ? state.lyric : null

  return (
    <div className="mini-shell">
      <div className="mini-card">
        {state.cover && <div className="mini-backdrop" style={{ backgroundImage: `url("${state.cover}")` }} />}
        <div className="mini-drag" />

        <div className="mini-header">
          <button
            type="button"
            className="mini-cover-btn"
            title="Open MeowPlayer"
            aria-label="Open MeowPlayer"
            onClick={() => api.mini.command('expand')}
          >
            <Cover src={state.cover} size={52} seed={state.album || 'MeowPlayer'} alt="" />
          </button>
          <div className="mini-text">
            <span className="mini-title" title={state.title}>
              {state.title}
            </span>
            <span className="mini-artist">{state.artist}</span>
          </div>
          <div className="mini-window-actions">
            {state.trackId && (
              <button
                type="button"
                className={cx('icon-btn tiny like-btn', state.liked && 'liked')}
                title={state.liked ? 'Remove from Liked' : 'Add to Liked'}
                aria-label={state.liked ? 'Remove from Liked' : 'Add to Liked'}
                onClick={() => api.mini.command('like')}
              >
                <Icon name={state.liked ? 'heart' : 'heart-outline'} size={15} />
              </button>
            )}
            <button
              type="button"
              className="icon-btn tiny"
              title="Back to the full player"
              aria-label="Back to the full player"
              onClick={() => api.mini.command('expand')}
            >
              <Icon name="expand" size={13} />
            </button>
          </div>
        </div>

        {lyric && (
          <div className="mini-lyric-row">
            <span className="mini-lyric" title={lyric} dir="auto">
              {lyric}
            </span>
          </div>
        )}

        <div className="mini-controls">
          <button
            type="button"
            className={cx('icon-btn tiny', state.lyricsOn && 'on')}
            title={state.lyricsOn ? 'Hide the lyric line' : 'Show the lyric line'}
            aria-pressed={state.lyricsOn}
            onClick={() => api.mini.command('toggleMiniLyrics')}
          >
            <Icon name="lyrics" size={14} />
          </button>
          <button
            type="button"
            className={cx('icon-btn tiny', state.shuffle && 'on')}
            title={state.shuffle ? 'Shuffle on' : 'Shuffle off'}
            aria-label="Shuffle"
            aria-pressed={state.shuffle}
            onClick={() => api.mini.command('shuffle')}
          >
            <Icon name="shuffle" size={14} />
          </button>
          <button type="button" className="icon-btn" title="Previous" aria-label="Previous" onClick={() => api.mini.command('prev')}>
            <Icon name="prev" size={16} />
          </button>
          <button
            type="button"
            className="play-btn small"
            title={state.playing ? 'Pause' : 'Play'}
            aria-label={state.playing ? 'Pause' : 'Play'}
            onClick={() => api.mini.command('playpause')}
          >
            <Icon name={state.playing ? 'pause' : 'play'} size={16} />
          </button>
          <button type="button" className="icon-btn" title="Next" aria-label="Next" onClick={() => api.mini.command('next')}>
            <Icon name="next" size={16} />
          </button>
          <button
            type="button"
            className={cx('icon-btn tiny', state.repeat !== 'off' && 'on')}
            title={state.repeat === 'one' ? 'Repeat one' : state.repeat === 'all' ? 'Repeat all' : 'Repeat off'}
            aria-label="Repeat"
            onClick={() => api.mini.command('repeat')}
          >
            <Icon name={state.repeat === 'one' ? 'repeat1' : 'repeat'} size={14} />
          </button>
          {state.external ? (
            <button
              type="button"
              className="mini-chip"
              title="Add this file to your library"
              onClick={() => api.mini.command('addToLibrary')}
            >
              <Icon name="plus" size={11} /> Add
            </button>
          ) : (
            <span className="mini-spacer" />
          )}
        </div>

        <div className="mini-progress">
          <span className="time">{formatTime(state.time)}</span>
          <Slider
            className="seek"
            label="Seek"
            value={Math.min(state.time, state.duration || 0)}
            max={Math.max(1, state.duration)}
            format={formatTime}
            onCommit={(value) => api.mini.command(`seek:${value.toFixed(1)}`)}
            disabled={!state.trackId}
          />
          <span className="time">{formatTime(state.duration)}</span>
        </div>
      </div>
    </div>
  )
}
