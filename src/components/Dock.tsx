import { useMemo, useState } from 'react'
import { api } from '../api'
import { EQ_BANDS, EQ_PRESETS } from '../audio/engine'
import { useStore } from '../store/useStore'
import type { Track } from '../types'
import { cx } from '../utils'
import { Cover } from './Cover'
import { Icon } from './Icons'
import { Lyrics } from './Lyrics'

export function Dock() {
  const open = useStore((state) => state.dockOpen)
  const tab = useStore((state) => state.dockTab)
  const setDockTab = useStore((state) => state.setDockTab)
  const toggleDock = useStore((state) => state.toggleDock)

  if (!open) return null

  return (
    <aside className="dock">
      <div className="dock-tabs">
        <button type="button" className={cx('dock-tab', tab === 'queue' && 'active')} onClick={() => setDockTab('queue')}>
          Queue
        </button>
        <button type="button" className={cx('dock-tab', tab === 'lyrics' && 'active')} onClick={() => setDockTab('lyrics')}>
          Lyrics
        </button>
        <button type="button" className={cx('dock-tab', tab === 'eq' && 'active')} onClick={() => setDockTab('eq')}>
          EQ
        </button>
        <button type="button" className="icon-btn tiny dock-close" title="Hide panel" onClick={() => toggleDock()}>
          <Icon name="x" size={14} />
        </button>
      </div>

      {tab === 'queue' && <QueueTab />}
      {tab === 'lyrics' && <LyricsTab />}
      {tab === 'eq' && <EqTab />}
    </aside>
  )
}

function LyricsTab() {
  const track = useStore((state) => state.playingTrack)
  const lyricsOn = useStore((state) => state.settings.lyrics)
  const autoLyrics = useStore((state) => state.settings.autoLyrics)
  const updateSettings = useStore((state) => state.updateSettings)
  const setView = useStore((state) => state.setView)
  const fetchLyrics = useStore((state) => state.fetchLyrics)

  return (
    <div className="dock-body lyrics-tab">
      <div className="lyrics-tab-head">
        <div>
          <p className="section-label">Lyrics</p>
          <h3 className="lyrics-tab-title">{track ? track.title : 'Nothing playing'}</h3>
          {track && <span className="lyrics-tab-artist">{track.artist}</span>}
        </div>
        <button
          type="button"
          className={cx('toggle tiny-toggle', lyricsOn && 'on')}
          title={lyricsOn ? 'Hide lyrics' : 'Show lyrics'}
          onClick={() => {
            const next = !lyricsOn
            updateSettings({ lyrics: next })
            if (next && track) void fetchLyrics(track, true)
          }}
          aria-pressed={lyricsOn}
        >
          <span />
        </button>
      </div>

      {track ? (
        <Lyrics />
      ) : (
        <div className="dock-empty">
          <Icon name="music" size={30} />
          <p>Nothing playing</p>
          <span>Start a track and its lyrics appear here.</span>
        </div>
      )}

      {track && !autoLyrics && (
        <button type="button" className="btn ghost small" onClick={() => void fetchLyrics(track, true)}>
          <Icon name="download" size={14} /> Fetch lyrics now
        </button>
      )}

      {track && (
        <button type="button" className="btn ghost small" onClick={() => setView({ kind: 'nowplaying' })}>
          <Icon name="disc" size={14} /> Open now playing
        </button>
      )}
    </div>
  )
}

function QueueTab() {
  const queue = useStore((state) => state.queue)
  const tracks = useStore((state) => state.tracks)
  const currentId = useStore((state) => state.currentId)
  const queueIndex = useStore((state) => state.queueIndex)
  const removeFromQueue = useStore((state) => state.removeFromQueue)
  const reorderQueue = useStore((state) => state.reorderQueue)
  const clearQueue = useStore((state) => state.clearQueue)
  const smartQueue = useStore((state) => state.smartQueue)
  const playTracks = useStore((state) => state.playTracks)
  const playing = useStore((state) => Boolean(state.playingTrack))

  const items = useMemo(
    () => queue.map((id) => tracks.find((track) => track.id === id)).filter((track): track is Track => Boolean(track)),
    [queue, tracks],
  )

  if (!items.length) {
    return (
      <div className="dock-empty">
        <Icon name="queue" size={32} />
        <p>Your queue is empty</p>
        <span>Tracks you queue will show up here.</span>
        {playing && (
          <button type="button" className="btn ghost small" onClick={smartQueue}>
            <Icon name="shuffle" size={14} /> Build a smart queue
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="dock-body queue-tab">
      <div className="queue-head">
        <span>
          {items.length} tracks · {queueIndex >= 0 ? `${queueIndex + 1} playing` : 'paused'}
        </span>
        <div className="queue-head-actions">
          <button type="button" className="link subtle" onClick={smartQueue} title="Add similar tracks from your library">
            Smart queue
          </button>
          <button type="button" className="link subtle" onClick={clearQueue}>
            Clear
          </button>
        </div>
      </div>
      <div className="queue-list">
        {items.map((track, index) => (
          <div
            key={`${track.id}-${index}`}
            className={cx('queue-row', track.id === currentId && 'active')}
            onClick={() => playTracks(queue, index)}
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const from = Number(event.dataTransfer.getData('text/plain'))
              if (!Number.isNaN(from)) reorderQueue(from, index)
            }}
          >
            <span className="queue-index">{track.id === currentId ? <Icon name="play" size={11} /> : index + 1}</span>
            <Cover src={track.cover} size={32} seed={track.album} alt={track.album} />
            <span className="queue-text">
              <span className="title-name">{track.title}</span>
              <span className="title-artist">{track.artist}</span>
            </span>
            <button type="button" className="icon-btn tiny" title="Remove" onClick={() => removeFromQueue(index)}>
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function EqTab() {
  const settings = useStore((state) => state.settings)
  const gains = settings.eqGains
  const preset = settings.eqPreset
  const setEqGain = useStore((state) => state.setEqGain)
  const applyEqPreset = useStore((state) => state.applyEqPreset)
  const saveEqPreset = useStore((state) => state.saveEqPreset)
  const deleteEqPreset = useStore((state) => state.deleteEqPreset)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const custom = settings.eqPresets
  const savedNames = custom.map((item) => item.name)
  const activeIsCustom = savedNames.includes(preset)

  const save = (): void => {
    const trimmed = name.trim()
    if (!trimmed) return
    saveEqPreset(trimmed)
    setName('')
    setSaving(false)
  }

  return (
    <div className="dock-body eq-tab">
      <div className="eq-head">
        <div>
          <h3>Equalizer</h3>
          <p>10-band · ±12 dB</p>
        </div>
        <select className="select small" value={preset} onChange={(event) => applyEqPreset(event.target.value)}>
          {preset === 'Custom' && <option value="Custom">Custom</option>}
          {EQ_PRESETS.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
          {custom.length > 0 && (
            <optgroup label="Saved presets">
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
        {EQ_BANDS.map((frequency, index) => (
          <div className="eq-band" key={frequency}>
            <span className="eq-value">{gains[index] > 0 ? `+${gains[index].toFixed(0)}` : gains[index].toFixed(0)}</span>
            <div className="eq-slider">
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={gains[index]}
                onChange={(event) => setEqGain(index, Number(event.target.value))}
                aria-label={`${frequency} Hz`}
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
              className="input small"
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
              <Icon name="check" size={14} /> Save
            </button>
          </>
        ) : (
          <button type="button" className="btn ghost small" onClick={() => setSaving(true)}>
            <Icon name="download" size={14} /> Save preset
          </button>
        )}
        {activeIsCustom && (
          <button
            type="button"
            className="btn ghost small"
            title="Delete this saved preset"
            onClick={() => deleteEqPreset(preset)}
          >
            <Icon name="trash" size={14} /> Delete
          </button>
        )}
        <button type="button" className="btn ghost small" onClick={() => applyEqPreset('Flat')}>
          <Icon name="refresh" size={14} /> Reset to flat
        </button>
      </div>
    </div>
  )
}
