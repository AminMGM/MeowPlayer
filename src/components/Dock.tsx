import { useMemo, useState } from 'react'
import { EQ_BANDS, EQ_PRESETS } from '../audio/engine'
import { getStore, useStore } from '../store/useStore'
import type { Track } from '../types'
import { cx, formatTime, formatTotalDuration, plural } from '../utils'
import { Cover } from './Cover'
import { Icon } from './Icons'
import { Lyrics } from './Lyrics'

const TABS = [
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'queue', label: 'Queue' },
  { id: 'eq', label: 'Equalizer' },
] as const

export function Dock() {
  const open = useStore((state) => state.dockOpen)
  const tab = useStore((state) => state.dockTab)
  const setDockTab = useStore((state) => state.setDockTab)
  const toggleDock = useStore((state) => state.toggleDock)

  if (!open) return null

  return (
    <aside className="dock" aria-label="Side panel">
      <div className="dock-tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={cx('dock-tab', tab === item.id && 'active')}
            onClick={() => setDockTab(item.id)}
          >
            {item.label}
          </button>
        ))}
        <button type="button" className="icon-btn tiny dock-close" title="Hide panel" aria-label="Hide panel" onClick={() => toggleDock()}>
          <Icon name="x" size={14} />
        </button>
      </div>

      {tab === 'queue' && <QueueTab />}
      {tab === 'lyrics' && <LyricsTab />}
      {tab === 'eq' && <EqTab />}
    </aside>
  )
}

/* --------------------------------- lyrics -------------------------------- */

function LyricsTab() {
  const track = useStore((state) => state.playingTrack)
  return (
    <div className="dock-body lyrics-tab">
      {track && (
        <div className="lyrics-tab-head">
          <Cover src={track.cover} size={44} seed={track.album} alt="" />
          <div className="title-text">
            <span className="title-name">{track.title}</span>
            <span className="title-artist">{track.artist}</span>
          </div>
        </div>
      )}
      <Lyrics />
    </div>
  )
}

/* --------------------------------- queue --------------------------------- */

interface Entry {
  track: Track
  index: number
}

function QueueRow({ entry, current, dragging, onDragStart, onDrop }: {
  entry: Entry
  current?: boolean
  dragging: number | null
  onDragStart: (index: number) => void
  onDrop: (index: number) => void
}) {
  const s = getStore()
  const { track, index } = entry
  return (
    <div
      className={cx('queue-row', current && 'active', dragging === index && 'dragging')}
      role="button"
      tabIndex={0}
      onClick={() => s.jump(index)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') s.jump(index)
        if (event.key === 'Delete') s.removeFromQueue(index)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        s.setContextMenu({ x: event.clientX, y: event.clientY, trackIds: [track.id] })
      }}
      draggable={!current}
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-meowplayer-queue', String(index))
        onDragStart(index)
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('application/x-meowplayer-queue')) event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDrop(index)
      }}
    >
      <Cover src={track.cover} size={36} seed={track.album} alt="" />
      <span className="queue-text">
        <span className="title-name">{track.title}</span>
        <span className="title-artist">{track.artist}</span>
      </span>
      {current ? (
        <span className="mini-bars" aria-label="Now playing">
          <i />
          <i />
          <i />
        </span>
      ) : (
        <>
          <span className="queue-time">{formatTime(track.duration)}</span>
          <button
            type="button"
            className="icon-btn tiny queue-remove"
            title="Remove from queue"
            aria-label={`Remove ${track.title} from the queue`}
            onClick={(event) => {
              event.stopPropagation()
              s.removeFromQueue(index)
            }}
          >
            <Icon name="x" size={13} />
          </button>
        </>
      )}
    </div>
  )
}

function QueueTab() {
  const queue = useStore((state) => state.queue)
  const queueIndex = useStore((state) => state.queueIndex)
  const tracks = useStore((state) => state.tracks)
  const playing = useStore((state) => state.playingTrack)
  const [dragging, setDragging] = useState<number | null>(null)
  const [showPlayed, setShowPlayed] = useState(false)
  const s = getStore()

  const { current, upNext, played } = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]))
    const entries = queue
      .map((id, index) => ({ track: byId.get(id), index }))
      .filter((entry): entry is Entry => Boolean(entry.track))
    return {
      current: entries.find((entry) => entry.index === queueIndex) ?? null,
      upNext: entries.filter((entry) => entry.index > queueIndex),
      played: entries.filter((entry) => entry.index < queueIndex),
    }
  }, [queue, queueIndex, tracks])

  const drop = (to: number): void => {
    if (dragging !== null && dragging !== to) s.reorderQueue(dragging, to)
    setDragging(null)
  }

  if (!current && !upNext.length) {
    return (
      <div className="dock-empty">
        <Icon name="queue" size={30} />
        <p>Your queue is empty</p>
        <span>Play an album or playlist, or use Add to queue on any song.</span>
        {playing && (
          <button type="button" className="btn ghost small" onClick={s.smartQueue}>
            <Icon name="sparkle" size={14} /> Build a smart queue
          </button>
        )}
      </div>
    )
  }

  const remaining = upNext.reduce((sum, entry) => sum + entry.track.duration, 0)

  return (
    <div className="dock-body queue-tab">
      {current && (
        <section>
          <p className="section-label">Now playing</p>
          <QueueRow entry={current} current dragging={dragging} onDragStart={setDragging} onDrop={drop} />
        </section>
      )}

      <section>
        <div className="queue-head">
          <p className="section-label">
            Up next{upNext.length ? ` · ${plural(upNext.length, 'track')} · ${formatTotalDuration(remaining)}` : ''}
          </p>
          <div className="queue-head-actions">
            <button type="button" className="link subtle" onClick={s.smartQueue} title="Add similar tracks from your library">
              <Icon name="sparkle" size={12} /> Smart
            </button>
            {upNext.length > 0 && (
              <button type="button" className="link subtle" onClick={s.clearQueue}>
                Clear
              </button>
            )}
          </div>
        </div>
        {upNext.length === 0 ? (
          <p className="muted small">Nothing queued after this track.</p>
        ) : (
          <div className="queue-list">
            {upNext.map((entry) => (
              <QueueRow key={`${entry.track.id}-${entry.index}`} entry={entry} dragging={dragging} onDragStart={setDragging} onDrop={drop} />
            ))}
          </div>
        )}
      </section>

      {played.length > 0 && (
        <section>
          <button type="button" className="queue-history-toggle" onClick={() => setShowPlayed((value) => !value)}>
            <Icon name={showPlayed ? 'chevron-down' : 'chevron-right'} size={13} />
            Played earlier · {played.length}
          </button>
          {showPlayed && (
            <div className="queue-list played">
              {played.map((entry) => (
                <QueueRow key={`${entry.track.id}-${entry.index}`} entry={entry} dragging={dragging} onDragStart={setDragging} onDrop={drop} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

/* ---------------------------------- EQ ----------------------------------- */

function EqTab() {
  const gains = useStore((state) => state.settings.eqGains)
  const preset = useStore((state) => state.settings.eqPreset)
  const custom = useStore((state) => state.settings.eqPresets)
  const s = getStore()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const activeIsCustom = custom.some((item) => item.name === preset)
  const save = (): void => {
    if (!name.trim()) return
    s.saveEqPreset(name)
    setName('')
    setSaving(false)
  }

  // A smooth curve through the band gains, drawn behind the sliders.
  const curve = gains
    .map((gain, index) => {
      const x = (index / (gains.length - 1)) * 100
      const y = 50 - (gain / 12) * 44
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <div className="dock-body eq-tab">
      <div className="eq-head">
        <div>
          <h3>Equalizer</h3>
          <p>10 bands · ±12 dB</p>
        </div>
        <select className="select small" value={preset} onChange={(event) => s.applyEqPreset(event.target.value)} aria-label="Preset">
          {preset === 'Custom' && <option value="Custom">Custom</option>}
          <optgroup label="Presets">
            {EQ_PRESETS.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </optgroup>
          {custom.length > 0 && (
            <optgroup label="Saved">
              {custom.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div className="eq-bands">
        <svg className="eq-curve" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="50" x2="100" y2="50" />
          <path d={curve} />
        </svg>
        {EQ_BANDS.map((frequency, index) => (
          <div className="eq-band" key={frequency}>
            <span className="eq-value">{gains[index] > 0 ? `+${gains[index]}` : gains[index]}</span>
            <div className="eq-slider">
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={gains[index]}
                onChange={(event) => s.setEqGain(index, Number(event.target.value))}
                onDoubleClick={() => s.setEqGain(index, 0)}
                aria-label={`${frequency} Hz`}
                title="Double-click to reset"
              />
            </div>
            <span className="eq-freq">{frequency >= 1000 ? `${frequency / 1000}k` : frequency}</span>
          </div>
        ))}
      </div>

      <div className="eq-save">
        {saving ? (
          <>
            <input
              className="input boxed small"
              autoFocus
              placeholder="Preset name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') save()
                if (event.key === 'Escape') setSaving(false)
              }}
            />
            <button type="button" className="btn primary small" disabled={!name.trim()} onClick={save}>
              Save
            </button>
          </>
        ) : (
          <button type="button" className="btn ghost small" onClick={() => setSaving(true)}>
            <Icon name="plus" size={14} /> Save preset
          </button>
        )}
        {activeIsCustom && !saving && (
          <button type="button" className="btn ghost small" onClick={() => s.deleteEqPreset(preset)}>
            <Icon name="trash" size={14} /> Delete
          </button>
        )}
        {!saving && (
          <button type="button" className="btn ghost small" onClick={() => s.applyEqPreset('Flat')}>
            <Icon name="refresh" size={14} /> Reset
          </button>
        )}
      </div>
    </div>
  )
}
