import { useRef, useState } from 'react'
import { useClock, useDismiss } from '../hooks'
import { getStore, selectIsTransient, useStore } from '../store/useStore'
import { albumKey, cx, formatTime } from '../utils'
import { Cover } from './Cover'
import { Icon } from './Icons'
import { LikeButton } from './LikeButton'
import { OutputPicker } from './OutputPicker'
import { PlaylistPicker } from './PlaylistPicker'
import { Slider } from './Slider'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]
const SLEEP_OPTIONS = [15, 30, 45, 60, 90]

type Menu = 'rate' | 'sleep' | 'playlist' | null

/** A button plus its popover; clicks inside never close it, clicks outside do. */
function MenuAnchor({
  open,
  onClose,
  trigger,
  children,
  align = 'right',
}: {
  open: boolean
  onClose: () => void
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useDismiss(ref, open, onClose)
  return (
    <div className="menu-anchor" ref={ref}>
      {trigger}
      {open && <div className={cx('popover', align === 'left' && 'align-left')}>{children}</div>}
    </div>
  )
}

function SleepCustom({ onSet }: { onSet: (minutes: number) => void }) {
  const [value, setValue] = useState('')
  const submit = (): void => {
    const minutes = Math.round(Number(value))
    if (minutes > 0 && minutes <= 720) onSet(minutes)
  }
  return (
    <div className="popover-custom">
      <input
        className="input"
        type="number"
        min={1}
        max={720}
        placeholder="Minutes"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && submit()}
      />
      <button type="button" className="btn ghost small" onClick={submit}>
        Set
      </button>
    </div>
  )
}

export function PlayerBar() {
  const track = useStore((state) => state.playingTrack)
  const transient = useStore(selectIsTransient)
  const isPlaying = useStore((state) => state.isPlaying)
  const time = useStore((state) => state.time)
  const duration = useStore((state) => state.duration)
  const volume = useStore((state) => state.volume)
  const muted = useStore((state) => state.muted)
  const shuffle = useStore((state) => state.shuffle)
  const repeat = useStore((state) => state.repeat)
  const rate = useStore((state) => state.rate)
  const amplify = useStore((state) => state.settings.amplify)
  const dockTab = useStore((state) => state.dockTab)
  const dockOpen = useStore((state) => state.dockOpen)
  const view = useStore((state) => state.view)
  const sleepMode = useStore((state) => state.sleepMode)
  const sleepUntil = useStore((state) => state.sleepUntil)
  const now = useClock(15_000)

  const s = getStore()
  const [menu, setMenu] = useState<Menu>(null)
  const close = (): void => setMenu(null)
  const toggle = (next: Exclude<Menu, null>) => () => setMenu(menu === next ? null : next)

  const maxVolume = amplify ? 1.5 : 1
  const shownVolume = muted ? 0 : volume
  const sleepLabel =
    sleepMode === 'track'
      ? 'End of track'
      : sleepUntil
        ? `${Math.max(1, Math.ceil((sleepUntil - now) / 60000))} min`
        : null

  return (
    <footer className="playerbar">
      <div className="player-left">
        <button
          type="button"
          className="player-art"
          title="Open now playing"
          onClick={(event) => s.setView({ kind: 'nowplaying' }, event.currentTarget.querySelector('.cover'))}
          disabled={!track}
        >
          <Cover src={track?.cover} size={56} seed={track?.album ?? 'MeowPlayer'} alt={track?.album ?? ''} />
        </button>
        <div className="player-meta">
          <span className="player-title" title={track?.title}>
            {track?.title ?? 'Nothing playing'}
          </span>
          {track ? (
            <span className="player-sub">
              <button type="button" className="link" onClick={() => s.setView({ kind: 'artist', id: track.artist })}>
                {track.artist}
              </button>
              <span className="dot">·</span>
              <button type="button" className="link" onClick={() => s.setView({ kind: 'album', id: albumKey(track) })}>
                {track.album}
              </button>
            </span>
          ) : (
            <span className="player-sub">Pick a song to start</span>
          )}
        </div>
        {track && (
          <div className="player-actions">
            <LikeButton trackId={track.id} />
            <MenuAnchor
              open={menu === 'playlist'}
              onClose={close}
              align="left"
              trigger={
                <button
                  type="button"
                  className={cx('icon-btn', menu === 'playlist' && 'on')}
                  title="Add to playlist"
                  aria-label="Add to playlist"
                  onClick={toggle('playlist')}
                >
                  <Icon name="plus" size={18} />
                </button>
              }
            >
              <PlaylistPicker trackIds={[track.id]} onDone={close} />
            </MenuAnchor>
            {transient && (
              <button
                type="button"
                className="btn ghost small"
                title="Add this file to your library"
                onClick={() => s.addToLibrary([track.id])}
              >
                <Icon name="plus" size={13} /> Library
              </button>
            )}
          </div>
        )}
      </div>

      <div className="player-center">
        <div className="transport">
          <button
            type="button"
            className={cx('icon-btn', shuffle && 'on')}
            title={shuffle ? 'Shuffle on' : 'Shuffle off'}
            aria-pressed={shuffle}
            onClick={s.toggleShuffle}
          >
            <Icon name="shuffle" size={17} />
          </button>
          <button type="button" className="icon-btn" title="Previous" aria-label="Previous" onClick={s.prev}>
            <Icon name="prev" size={18} />
          </button>
          <button
            type="button"
            className={cx('play-btn', isPlaying && 'playing')}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={s.togglePlay}
          >
            <span className="play-icon play">
              <Icon name="play" size={20} />
            </span>
            <span className="play-icon pause">
              <Icon name="pause" size={20} />
            </span>
          </button>
          <button type="button" className="icon-btn" title="Next" aria-label="Next" onClick={() => s.next()}>
            <Icon name="next" size={18} />
          </button>
          <button
            type="button"
            className={cx('icon-btn', repeat !== 'off' && 'on')}
            title={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat off'}
            onClick={s.cycleRepeat}
          >
            <Icon name={repeat === 'one' ? 'repeat1' : 'repeat'} size={17} />
          </button>
        </div>

        <div className="scrubber">
          <span className="time">{formatTime(time)}</span>
          <Slider
            className="seek"
            label="Seek"
            value={Math.min(time, duration || 0)}
            max={Math.max(1, duration)}
            step={1}
            format={formatTime}
            onCommit={(value) => s.seek(value)}
            disabled={!track}
          />
          <span className="time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        {sleepLabel && (
          <button type="button" className="pill sleep-pill" title="Sleep timer" onClick={toggle('sleep')}>
            <Icon name="moon" size={12} /> {sleepLabel}
          </button>
        )}

        <MenuAnchor
          open={menu === 'rate'}
          onClose={close}
          trigger={
            <button
              type="button"
              className={cx('chip small rate-chip', rate !== 1 && 'on')}
              title="Playback speed"
              onClick={toggle('rate')}
            >
              {rate}×
            </button>
          }
        >
          <p className="popover-title">Playback speed</p>
          {RATES.map((value) => (
            <button
              key={value}
              type="button"
              className={cx('popover-item', rate === value && 'active')}
              onClick={() => {
                s.setRate(value)
                close()
              }}
            >
              <span>{value === 1 ? 'Normal' : `${value}×`}</span>
              {rate === value && <Icon name="check" size={14} />}
            </button>
          ))}
        </MenuAnchor>

        <MenuAnchor
          open={menu === 'sleep'}
          onClose={close}
          trigger={
            <button
              type="button"
              className={cx('icon-btn', sleepMode !== 'off' && 'on')}
              title="Sleep timer"
              aria-label="Sleep timer"
              onClick={toggle('sleep')}
            >
              <Icon name="moon" size={17} />
            </button>
          }
        >
          <p className="popover-title">Sleep timer</p>
          {SLEEP_OPTIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className="popover-item"
              onClick={() => {
                s.setSleep('time', minutes)
                close()
              }}
            >
              <span>{minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes > 60 ? 's' : ''}`}</span>
            </button>
          ))}
          <SleepCustom
            onSet={(minutes) => {
              s.setSleep('time', minutes)
              close()
            }}
          />
          <button
            type="button"
            className={cx('popover-item', sleepMode === 'track' && 'active')}
            onClick={() => {
              s.setSleep('track')
              close()
            }}
          >
            <span>End of current track</span>
          </button>
          {sleepMode !== 'off' && (
            <button
              type="button"
              className="popover-item danger"
              onClick={() => {
                s.setSleep('off')
                close()
              }}
            >
              <span>Turn off timer</span>
            </button>
          )}
        </MenuAnchor>

        <OutputPicker />

        <button
          type="button"
          className={cx('icon-btn', dockOpen && dockTab === 'lyrics' && 'on')}
          title="Lyrics"
          aria-label="Lyrics"
          onClick={() => s.toggleDock('lyrics')}
        >
          <Icon name="lyrics" size={17} />
        </button>
        <button
          type="button"
          className={cx('icon-btn', dockOpen && dockTab === 'queue' && 'on')}
          title="Queue"
          aria-label="Queue"
          onClick={() => s.toggleDock('queue')}
        >
          <Icon name="queue" size={17} />
        </button>
        <button
          type="button"
          className={cx('icon-btn', dockOpen && dockTab === 'eq' && 'on')}
          title="Equalizer"
          aria-label="Equalizer"
          onClick={() => s.toggleDock('eq')}
        >
          <Icon name="sliders" size={17} />
        </button>

        <div className="volume">
          <button
            type="button"
            className="icon-btn"
            title={muted ? 'Unmute' : 'Mute'}
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={s.toggleMute}
          >
            <Icon name={shownVolume === 0 ? 'volume-mute' : 'volume'} size={17} />
          </button>
          <Slider
            className="volume-slider"
            label="Volume"
            value={shownVolume}
            max={maxVolume}
            step={0.01}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(value) => s.setVolume(value)}
          />
        </div>

        <button
          type="button"
          className={cx('icon-btn', view.kind === 'nowplaying' && 'on')}
          title="Now playing"
          aria-label="Now playing"
          onClick={() => s.setView({ kind: 'nowplaying' })}
        >
          <Icon name="disc" size={17} />
        </button>
        <button type="button" className="icon-btn" title="Mini player" aria-label="Mini player" onClick={s.showMiniPlayer}>
          <Icon name="pip" size={16} />
        </button>
      </div>
    </footer>
  )
}
