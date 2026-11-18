import { useEffect, useRef, useState } from 'react'
import { useStore, selectCurrentTrack } from '../store/useStore'
import { cx, formatTime } from '../utils'
import { Cover } from './Cover'
import { Icon } from './Icons'
import { OutputPicker } from './OutputPicker'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]
const SLEEP_OPTIONS = [15, 30, 45, 60]

function sleepMenuCustom(
  value: string,
  onChange: (value: string) => void,
  onSet: (minutes: number) => void,
) {
  return (
    <div className="popover-custom">
      <input
        className="input"
        type="number"
        min={1}
        max={720}
        placeholder="Custom minutes"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            const minutes = Math.round(Number(value))
            if (minutes > 0) onSet(minutes)
          }
        }}
      />
      <button
        type="button"
        className="btn ghost small"
        onClick={() => {
          const minutes = Math.round(Number(value))
          if (minutes > 0) onSet(minutes)
        }}
      >
        Set
      </button>
    </div>
  )
}

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const handler = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  return ref
}

export function PlayerBar() {
  const track = useStore(selectCurrentTrack)
  const external = useStore((state) => state.external)
  const isPlaying = useStore((state) => state.isPlaying)
  const time = useStore((state) => state.time)
  const duration = useStore((state) => state.duration)
  const volume = useStore((state) => state.volume)
  const muted = useStore((state) => state.muted)
  const shuffle = useStore((state) => state.shuffle)
  const repeat = useStore((state) => state.repeat)
  const rate = useStore((state) => state.rate)
  const favorites = useStore((state) => state.favorites)
  const playlists = useStore((state) => state.playlists)
  const amplify = useStore((state) => state.settings.amplify)
  const dockTab = useStore((state) => state.dockTab)
  const dockOpen = useStore((state) => state.dockOpen)
  const view = useStore((state) => state.view)
  const sleepMode = useStore((state) => state.sleepMode)
  const sleepUntil = useStore((state) => state.sleepUntil)

  const togglePlay = useStore((state) => state.togglePlay)
  const next = useStore((state) => state.next)
  const prev = useStore((state) => state.prev)
  const seek = useStore((state) => state.seek)
  const setVolume = useStore((state) => state.setVolume)
  const toggleMute = useStore((state) => state.toggleMute)
  const toggleShuffle = useStore((state) => state.toggleShuffle)
  const cycleRepeat = useStore((state) => state.cycleRepeat)
  const setRate = useStore((state) => state.setRate)
  const toggleLike = useStore((state) => state.toggleLike)
  const toggleDock = useStore((state) => state.toggleDock)
  const showMiniPlayer = useStore((state) => state.showMiniPlayer)
  const setSleep = useStore((state) => state.setSleep)
  const setView = useStore((state) => state.setView)
  const addToPlaylist = useStore((state) => state.addToPlaylist)
  const createPlaylist = useStore((state) => state.createPlaylist)
  const addExternalToLibrary = useStore((state) => state.addExternalToLibrary)

  const [menu, setMenu] = useState<'rate' | 'sleep' | 'playlist' | null>(null)
  const [sleepCustom, setSleepCustom] = useState('45')
  const menuRef = useOutsideClose(() => setMenu(null))

  const liked = track ? favorites.includes(track.id) : false
  const progress = duration > 0 ? Math.min(1, time / duration) : 0
  const remaining = Math.max(0, duration - time)
  const maxVolume = amplify ? 1.5 : 1

  const sleepLabel =
    sleepMode === 'track'
      ? 'track end'
      : sleepUntil
        ? `${Math.max(0, Math.ceil((sleepUntil - Date.now()) / 60000))}m`
        : null

  return (
    <footer className="playerbar">
      <div className="player-left">
        <Cover src={track?.cover} size={54} seed={track?.album ?? 'MeowPlayer'} alt={track?.album ?? ''} />
        <div className="player-meta">
          <span className="player-title">{track?.title ?? 'Nothing playing'}</span>
          {track ? (
            <button type="button" className="player-artist link" onClick={() => setView({ kind: 'artist', id: track.artist })}>
              {track.artist}
            </button>
          ) : (
            <span className="player-artist">Pick a song to start</span>
          )}
        </div>
        {track && (
          <div className="player-likes">
            <button
              type="button"
              className={cx('icon-btn', liked && 'liked')}
              title={liked ? 'Remove from Liked' : 'Add to Liked'}
              onClick={() => toggleLike(track.id)}
            >
              <Icon name="heart" size={17} />
            </button>

            <div className="menu-anchor">
              <button
                type="button"
                className={cx('icon-btn', menu === 'playlist' && 'on')}
                title="Add to playlist"
                onClick={() => setMenu(menu === 'playlist' ? null : 'playlist')}
              >
                <Icon name="plus" size={18} />
              </button>
              {menu === 'playlist' && (
                <div className="popover playlist-popover">
                  <p className="popover-title">Add to playlist</p>
                  {playlists.length === 0 && <p className="popover-note">No playlists yet</p>}
                  {playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      type="button"
                      className="popover-item"
                      onClick={() => {
                        addToPlaylist(playlist.id, [track.id])
                        setMenu(null)
                      }}
                    >
                      <span className="truncate">{playlist.name}</span>
                      <span className="popover-count">{playlist.trackIds.length}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="popover-item accent"
                    onClick={() => {
                      const id = createPlaylist(`Playlist ${playlists.length + 1}`, [track.id])
                      setView({ kind: 'playlist', id })
                      setMenu(null)
                    }}
                  >
                    <Icon name="plus" size={14} />
                    <span>New playlist</span>
                  </button>
                </div>
              )}
            </div>

            {external && (
              <button
                type="button"
                className="btn ghost small add-library-btn"
                title="Add this file to your library"
                onClick={addExternalToLibrary}
              >
                <Icon name="plus" size={13} /> Library
              </button>
            )}
          </div>
        )}
      </div>

      <div className="player-center">
        <div className="transport">
          <button type="button" className={cx('icon-btn', shuffle && 'on')} title="Shuffle" onClick={toggleShuffle}>
            <Icon name="shuffle" size={17} />
          </button>
          <button type="button" className="icon-btn" title="Previous" onClick={() => prev()}>
            <Icon name="prev" size={18} />
          </button>
          <button type="button" className="play-btn" title={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
            <Icon name={isPlaying ? 'pause' : 'play'} size={20} />
          </button>
          <button type="button" className="icon-btn" title="Next" onClick={() => next()}>
            <Icon name="next" size={18} />
          </button>
          <button
            type="button"
            className={cx('icon-btn', repeat !== 'off' && 'on')}
            title={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat off'}
            onClick={cycleRepeat}
          >
            <Icon name={repeat === 'one' ? 'repeat1' : 'repeat'} size={17} />
          </button>
        </div>

        <div className="scrubber">
          <span className="time">{formatTime(time)}</span>
          <div className="range-wrap">
            <div className="range-fill" style={{ width: `${progress * 100}%` }} />
            <input
              className="range"
              type="range"
              min={0}
              max={Math.max(1, duration || 1)}
              step={0.5}
              value={Math.min(time, duration || 0)}
              onChange={(event) => seek(Number(event.target.value))}
              aria-label="Seek"
            />
          </div>
          <span className="time">-{formatTime(remaining)}</span>
        </div>
      </div>

      <div className="player-right" ref={menuRef}>
        <div className="menu-anchor">
          <button
            type="button"
            className={cx('chip small', rate !== 1 && 'on')}
            title="Playback speed"
            onClick={() => setMenu(menu === 'rate' ? null : 'rate')}
          >
            {rate}×
          </button>
          {menu === 'rate' && (
            <div className="popover">
              <p className="popover-title">Playback speed</p>
              {RATES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cx('popover-item', rate === value && 'active')}
                  onClick={() => {
                    setRate(value)
                    setMenu(null)
                  }}
                >
                  <span>{value}×</span>
                  {rate === value && <Icon name="check" size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="menu-anchor">
          <button
            type="button"
            className={cx('icon-btn', sleepMode !== 'off' && 'on')}
            title="Sleep timer"
            onClick={() => setMenu(menu === 'sleep' ? null : 'sleep')}
          >
            <Icon name="moon" size={17} />
          </button>
          {menu === 'sleep' && (
            <div className="popover">
              <p className="popover-title">Sleep timer</p>
              {SLEEP_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className="popover-item"
                  onClick={() => {
                    setSleep('time', minutes)
                    setMenu(null)
                  }}
                >
                  <span>{minutes} minutes</span>
                </button>
              ))}
              {sleepMenuCustom(sleepCustom, setSleepCustom, (minutes) => {
                setSleep('time', minutes)
                setMenu(null)
              })}
              <button
                type="button"
                className="popover-item"
                onClick={() => {
                  setSleep('track')
                  setMenu(null)
                }}
              >
                <span>End of current track</span>
              </button>
              <button
                type="button"
                className="popover-item"
                onClick={() => {
                  setSleep('off')
                  setMenu(null)
                }}
              >
                <span>Off</span>
              </button>
            </div>
          )}
        </div>

        <OutputPicker />

        <button
          type="button"
          className={cx('icon-btn', dockOpen && dockTab === 'eq' && 'on')}
          title="Equalizer"
          onClick={() => toggleDock('eq')}
        >
          <Icon name="sliders" size={17} />
        </button>

        <button
          type="button"
          className={cx('icon-btn', dockOpen && dockTab === 'queue' && 'on')}
          title="Queue"
          onClick={() => toggleDock('queue')}
        >
          <Icon name="queue" size={17} />
        </button>

        <div className="volume">
          <button type="button" className="icon-btn" title={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
            <Icon name={muted || volume === 0 ? 'volume-mute' : 'volume'} size={17} />
          </button>
          <div className="range-wrap narrow">
            <div className="range-fill" style={{ width: `${(muted ? 0 : volume / maxVolume) * 100}%` }} />
            <input
              className="range"
              type="range"
              min={0}
              max={maxVolume}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              title={`${Math.round((muted ? 0 : volume) * 100)}%`}
              aria-label="Volume"
            />
          </div>
          {amplify && <span className="volume-value">{Math.round((muted ? 0 : volume) * 100)}%</span>}
        </div>

        <button
          type="button"
          className={cx('icon-btn', view.kind === 'nowplaying' && 'on')}
          title="Now playing"
          onClick={() => setView({ kind: 'nowplaying' })}
        >
          <Icon name="disc" size={17} />
        </button>

        <button type="button" className="icon-btn" title="Mini player" onClick={showMiniPlayer}>
          <Icon name="pip" size={16} />
        </button>

        {sleepLabel && <span className="pill subtle sleep-pill">zZ {sleepLabel}</span>}
      </div>
    </footer>
  )
}
