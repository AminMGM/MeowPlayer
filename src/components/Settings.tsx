import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import { ACCENTS } from '../store/defaults'
import type { SettingsTab } from '../store/useStore'
import { getStore, useStore } from '../store/useStore'
import type { CloseBehavior, NormalizeMode, ThemeName, VisualizerStyle } from '../types'
import { cx, plural } from '../utils'
import { Icon } from './Icons'
import { Logo } from './Logo'
import updateLogo from '../../assets/update-logo.svg'

const formatSize = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'playback', label: 'Playback', icon: 'play' },
  { id: 'lyrics', label: 'Lyrics', icon: 'lyrics' },
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'system', label: 'System', icon: 'monitor' },
  { id: 'about', label: 'About', icon: 'info' },
]

const THEMES: { id: ThemeName; label: string; note: string }[] = [
  { id: 'system', label: 'System', note: 'Follows Windows' },
  { id: 'graphite', label: 'Graphite', note: 'Cool grey glass' },
  { id: 'light', label: 'Light', note: 'Paper glass' },
  { id: 'cherry', label: 'Cherry', note: 'Deep wine glass' },
  { id: 'navy', label: 'Navy', note: 'Midnight glass' },
]

const SCALES: { value: number; label: string }[] = [
  { value: 0, label: 'Auto' },
  { value: 0.9, label: 'Compact' },
  { value: 1, label: 'Default' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Extra large' },
]

const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / pause'],
  ['← →', 'Seek 5 seconds'],
  ['Ctrl ← →', 'Previous / next track'],
  ['↑ ↓', 'Volume'],
  ['M', 'Mute'],
  ['S', 'Shuffle'],
  ['R', 'Repeat'],
  ['L', 'Like the current track'],
  ['Ctrl F', 'Search'],
  ['Alt ← →', 'Back / forward'],
  ['Enter', 'Play the selected song'],
  ['Esc', 'Close menus and panels'],
]

/* ------------------------------ building blocks ----------------------------- */

function Row({ label, help, children, stacked }: { label: string; help?: ReactNode; children: ReactNode; stacked?: boolean }) {
  return (
    <div className={cx('setting-row', stacked && 'stacked')}>
      <div className="setting-text">
        <span className="setting-label">{label}</span>
        {help && <span className="setting-help">{help}</span>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={cx('toggle', on && 'on')}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  )
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={cx('segment', value === option.value && 'active')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="settings-group">
      {title && <h3>{title}</h3>}
      <div className="settings-card">{children}</div>
    </section>
  )
}

/* --------------------------------- panes --------------------------------- */

function Appearance() {
  const settings = useStore((state) => state.settings)
  const update = useStore((state) => state.updateSettings)
  const customAccent = !ACCENTS.some((accent) => accent.color === settings.accent)

  return (
    <>
      <Group title="Theme">
        <div className="theme-grid">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={cx('theme-card', settings.gradient === theme.id && 'active')}
              onClick={() => update({ gradient: theme.id })}
              aria-pressed={settings.gradient === theme.id}
            >
              <span className={cx('theme-preview', `preview-${theme.id}`)}>
                <i />
                <i />
                <i />
              </span>
              <span className="theme-name">{theme.label}</span>
              <span className="theme-note">{theme.note}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group title="Colour">
        <Row label="Accent colour" help={settings.albumTheming ? 'Used when the current track has no artwork.' : undefined}>
          <div className="swatches">
            {ACCENTS.map((accent) => (
              <button
                key={accent.color}
                type="button"
                className={cx('swatch', settings.accent === accent.color && 'active')}
                style={{ background: accent.color }}
                title={accent.name}
                aria-label={accent.name}
                onClick={() => update({ accent: accent.color })}
              />
            ))}
            <label className={cx('swatch custom', customAccent && 'active')} title="Custom colour">
              <input
                type="color"
                value={settings.accent}
                onChange={(event) => update({ accent: event.target.value })}
                aria-label="Custom accent colour"
              />
              <Icon name="plus" size={12} />
            </label>
          </div>
        </Row>
        <Row label="Colour from album art" help="Tint the accent from the cover of the current track.">
          <Toggle label="Colour from album art" on={settings.albumTheming} onChange={(value) => update({ albumTheming: value })} />
        </Row>
        <Row label="Artwork backdrop" help="Show the current cover, softly blurred, behind the interface.">
          <Toggle label="Artwork backdrop" on={settings.ambientArt} onChange={(value) => update({ ambientArt: value })} />
        </Row>
      </Group>

      <Group title="Layout">
        <Row label="Interface size" help="Auto sizes the interface to the window and your display.">
          <Segmented value={settings.uiScale} options={SCALES} onChange={(value) => update({ uiScale: value })} />
        </Row>
        <Row label="Glass blur" help={`${settings.blur}px`}>
          <input
            type="range"
            className="range"
            min={0}
            max={64}
            step={1}
            value={settings.blur}
            style={{ ['--fill' as string]: `${(settings.blur / 64) * 100}%` }}
            onChange={(event) => update({ blur: Number(event.target.value) })}
            aria-label="Glass blur"
          />
        </Row>
        <Row label="Animations" help="Page transitions, drifting light and other motion.">
          <Toggle label="Animations" on={settings.animations} onChange={(value) => update({ animations: value })} />
        </Row>
      </Group>

      <Group title="Visualizer">
        <Row label="Spectrum visualizer" help="The live spectrum on the now playing screen.">
          <Toggle label="Spectrum visualizer" on={settings.visualizer} onChange={(value) => update({ visualizer: value })} />
        </Row>
        <Row label="Style">
          <Segmented<VisualizerStyle>
            value={settings.visualizerStyle}
            options={[
              { value: 'filament', label: 'Filament' },
              { value: 'aurora', label: 'Aurora' },
              { value: 'ribbon', label: 'Ribbon' },
              { value: 'bars', label: 'Bars' },
            ]}
            onChange={(value) => update({ visualizerStyle: value })}
          />
        </Row>
      </Group>
    </>
  )
}

function Playback() {
  const settings = useStore((state) => state.settings)
  const update = useStore((state) => state.updateSettings)

  return (
    <>
      <Group title="Transitions">
        <Row label="Crossfade" help={settings.crossfade > 0 ? `${settings.crossfade} s blend between tracks` : 'Off'}>
          <input
            type="range"
            className="range"
            min={0}
            max={12}
            step={1}
            value={settings.crossfade}
            style={{ ['--fill' as string]: `${(settings.crossfade / 12) * 100}%` }}
            onChange={(event) => update({ crossfade: Number(event.target.value) })}
            aria-label="Crossfade length"
          />
        </Row>
        <Row label="Gapless playback" help="Buffer the next track so albums play without a pause between songs.">
          <Toggle label="Gapless playback" on={settings.gapless} onChange={(value) => update({ gapless: value })} />
        </Row>
      </Group>

      <Group title="Sound">
        <Row label="Volume normalisation" help="Even out loudness using the ReplayGain tags in your files.">
          <Segmented<NormalizeMode>
            value={settings.normalize}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'track', label: 'Track' },
              { value: 'album', label: 'Album' },
            ]}
            onChange={(value) => update({ normalize: value })}
          />
        </Row>
        <Row label="Volume boost to 150%" help="Lets the volume slider go past 100% for quiet recordings.">
          <Toggle label="Volume boost" on={settings.amplify} onChange={(value) => update({ amplify: value })} />
        </Row>
        <Row label="Equalizer" help="10-band EQ with presets, saved automatically.">
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              const s = getStore()
              s.setDockTab('eq')
              s.setSettingsOpen(false)
            }}
          >
            <Icon name="sliders" size={14} /> Open equalizer
          </button>
        </Row>
      </Group>

      <Group title="Behaviour">
        <Row label="Track-change notifications" help="A Windows notification when a new track starts in the background.">
          <Toggle
            label="Track-change notifications"
            on={settings.notifications}
            onChange={(value) => update({ notifications: value })}
          />
        </Row>
        <Row label="When closing the window">
          <select
            className="select"
            value={settings.closeBehavior}
            onChange={(event) => update({ closeBehavior: event.target.value as CloseBehavior })}
          >
            <option value="ask">Ask every time</option>
            <option value="tray">Keep playing in the tray</option>
            <option value="quit">Quit MeowPlayer</option>
          </select>
        </Row>
        <Row label="Pause when the PC sleeps or locks" help="Always on, so music never plays to an empty room.">
          <span className="pill">On</span>
        </Row>
      </Group>
    </>
  )
}

function Lyrics() {
  const settings = useStore((state) => state.settings)
  const update = useStore((state) => state.updateSettings)
  const download = useStore((state) => state.lyricsDownload)
  const trackCount = useStore((state) => state.tracks.length)
  const s = getStore()
  const [db, setDb] = useState<{ songs: number; bytes: number } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const reload = (): void => void api.lyrics.stats().then(setDb)

  // Refresh the size after a library download finishes.
  useEffect(() => {
    if (!download.running) void api.lyrics.stats().then(setDb)
  }, [download.running])

  return (
    <>
      <Group>
        <Row label="Show lyrics" help="Synced lyrics from LRCLIB, matched by title, artist and length.">
          <Toggle label="Show lyrics" on={settings.lyrics} onChange={(value) => update({ lyrics: value })} />
        </Row>
        <Row label="Look up lyrics automatically" help="Fetch lyrics as each track starts. When off, use Fetch lyrics in the panel.">
          <Toggle
            label="Look up lyrics automatically"
            on={settings.autoLyrics}
            onChange={(value) => update({ autoLyrics: value })}
          />
        </Row>
        <Row label="Lyric line in the mini player">
          <Toggle label="Lyric line in the mini player" on={settings.miniLyrics} onChange={(value) => update({ miniLyrics: value })} />
        </Row>
      </Group>

      <Group title="Offline lyrics">
        <Row
          label="Download lyrics for the whole library"
          stacked
          help={
            download.running
              ? `Downloading ${download.done} of ${download.total}…`
              : download.total > 0
                ? `Last run: ${download.total - download.failed} found, ${download.failed} without lyrics.`
                : 'Fetches lyrics for every track so they work offline. Songs already saved are skipped.'
          }
        >
          {download.running ? (
            <>
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={download.total} aria-valuenow={download.done}>
                <span style={{ width: `${download.total ? (download.done / download.total) * 100 : 0}%` }} />
              </div>
              <button type="button" className="btn ghost small" onClick={s.cancelLyricsDownload}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="btn ghost small" onClick={() => void s.downloadAllLyrics()} disabled={!trackCount}>
              <Icon name="download" size={14} /> Download all
            </button>
          )}
        </Row>
        <Row
          label="Lyrics database"
          help={
            db
              ? db.songs
                ? `${plural(db.songs, 'song')} saved · ${formatSize(db.bytes)} on this PC`
                : 'Nothing saved yet.'
              : 'Measuring…'
          }
        >
          <button
            type="button"
            className={cx('btn ghost small', confirmClear && 'danger')}
            disabled={!db?.songs || download.running}
            onClick={async () => {
              if (!confirmClear) {
                setConfirmClear(true)
                window.setTimeout(() => setConfirmClear(false), 4000)
                return
              }
              await api.lyrics.clear()
              setConfirmClear(false)
              reload()
              void s.fetchLyrics(null)
              s.showToast('Lyrics database removed', { kind: 'info' })
            }}
          >
            <Icon name="trash" size={14} /> {confirmClear ? 'Click again to remove' : 'Remove'}
          </button>
        </Row>
      </Group>
    </>
  )
}

function Library() {
  const settings = useStore((state) => state.settings)
  const update = useStore((state) => state.updateSettings)
  const tracks = useStore((state) => state.tracks.length)
  const scanning = useStore((state) => state.scanning)
  const progress = useStore((state) => state.scanProgress)
  const [confirmClear, setConfirmClear] = useState(false)
  const s = getStore()

  useEffect(() => {
    if (!confirmClear) return
    const timer = window.setTimeout(() => setConfirmClear(false), 4000)
    return () => window.clearTimeout(timer)
  }, [confirmClear])

  return (
    <>
      <Group title="Music folders">
        <div className="folder-list">
          {settings.folders.length === 0 && <p className="setting-help pad">No folders yet. Add the folders that hold your music.</p>}
          {settings.folders.map((folder) => (
            <div className="folder-row" key={folder}>
              <Icon name="folder" size={15} />
              <span className="truncate grow" title={folder}>
                {folder}
              </span>
              <button
                type="button"
                className="icon-btn tiny"
                title="Remove folder"
                aria-label={`Remove ${folder}`}
                onClick={() => void s.removeFolder(folder)}
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="setting-actions">
          <button type="button" className="btn ghost small" onClick={() => void s.addFolders()}>
            <Icon name="plus" size={14} /> Add folder
          </button>
          <button type="button" className="btn ghost small" onClick={() => void s.rescan()} disabled={scanning}>
            <Icon name="refresh" size={14} /> {scanning ? `Scanning ${progress.done}/${progress.total || '…'}` : 'Rescan'}
          </button>
          <span className="setting-help push">{plural(tracks, 'track')}</span>
        </div>
      </Group>

      <Group title="Options">
        <Row label="Watch folders for changes" help="New, changed and deleted files show up without a manual rescan.">
          <Toggle label="Watch folders" on={settings.watchFolders} onChange={(value) => update({ watchFolders: value })} />
        </Row>
        <Row
          label="Type to search"
          help="On Songs, Albums, Artists, Genres and Liked songs, just start typing to filter the page."
        >
          <Toggle label="Type to search" on={settings.typeToSearch} onChange={(value) => update({ typeToSearch: value })} />
        </Row>
        <Row label="Hide duplicate tracks" help="In Songs, show one copy of tracks with the same title and artist.">
          <Toggle label="Hide duplicates" on={settings.hideDuplicates} onChange={(value) => update({ hideDuplicates: value })} />
        </Row>
        <Row
          label="Fix song info"
          help="Finds better titles, artists, albums and missing artwork. You review every change before it is written."
        >
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              s.setSettingsOpen(false)
              s.setMetaFix('all')
            }}
          >
            <Icon name="wand" size={14} /> Fix song info…
          </button>
        </Row>
        <Row label="Clear library" help="Forgets every indexed track. Playlists, likes and your files are kept.">
          <button
            type="button"
            className={cx('btn ghost small', confirmClear && 'danger')}
            onClick={() => {
              if (!confirmClear) {
                setConfirmClear(true)
                return
              }
              s.clearLibrary()
              setConfirmClear(false)
              s.showToast('Library cleared', { kind: 'info' })
            }}
          >
            <Icon name="trash" size={14} /> {confirmClear ? 'Click again to confirm' : 'Clear library'}
          </button>
        </Row>
      </Group>
    </>
  )
}

const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 MB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

/** Available, downloading (only the changed parts), ready to install, or failed. */
function UpdateCard() {
  const info = useStore((state) => state.update)
  const s = getStore()
  if (!info) return null
  const { status, progress } = info

  const title =
    status === 'downloaded'
      ? `MeowPlayer ${info.version} is ready to install`
      : status === 'downloading'
        ? `Downloading MeowPlayer ${info.version}`
        : `MeowPlayer ${info.version} is available`

  const help =
    status === 'downloaded'
      ? 'Restart now, or it installs the next time you quit MeowPlayer. Windows asks for permission.'
      : status === 'downloading'
        ? 'Only the parts that changed are downloaded. You can keep listening meanwhile.'
        : status === 'error'
          ? info.error ?? 'The download failed.'
          : `You have ${info.current}.`

  return (
    <div className={cx('update-card', status)}>
      <div className="update-head">
        <img className="update-logo" src={updateLogo} alt="" draggable={false} />
        <div>
          <span className="setting-label">{title}</span>
          <span className={cx('setting-help', status === 'error' && 'error-text')}>{help}</span>
        </div>
      </div>

      {status === 'downloading' && (
        <div className="update-progress">
          <div
            className="progress wide"
            role="progressbar"
            aria-label="Download progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress?.percent ?? 0)}
          >
            <span style={{ width: `${progress?.percent ?? 0}%` }} />
          </div>
          <span className="update-progress-text">
            {progress && progress.total
              ? `${formatBytes(progress.transferred)} of ${formatBytes(progress.total)}${
                  progress.bytesPerSecond ? ` · ${formatBytes(progress.bytesPerSecond)}/s` : ''
                }`
              : 'Starting…'}
          </span>
        </div>
      )}

      {info.notes && status !== 'downloading' && <p className="update-notes">{info.notes}</p>}

      <div className="setting-actions">
        {status === 'downloaded' ? (
          <button type="button" className="btn primary small" onClick={() => void s.installUpdate()}>
            <Icon name="refresh" size={14} /> Restart to update
          </button>
        ) : status === 'downloading' ? null : (
          <button type="button" className="btn primary small" onClick={() => void s.downloadUpdate()}>
            <Icon name="download" size={14} />{' '}
            {status === 'error' ? 'Try again' : info.canSelfUpdate ? 'Download update' : 'Get the update'}
          </button>
        )}
        {status === 'available' && (
          <button type="button" className="btn ghost small" onClick={() => void s.snoozeUpdate(7)}>
            Remind me in a week
          </button>
        )}
        <button type="button" className="btn ghost small" onClick={() => void api.updates.openRelease(info.pageUrl)}>
          Release notes
        </button>
      </div>
    </div>
  )
}

function System() {
  const settings = useStore((state) => state.settings)
  const update = useStore((state) => state.updateSettings)
  const info = useStore((state) => state.update)
  const checking = useStore((state) => state.checkingUpdate)
  const version = useStore((state) => state.version)
  const s = getStore()

  const exportSettings = async (): Promise<void> => {
    const ok = await api.ui.exportSettings(JSON.stringify(getStore().settings, null, 2))
    if (ok) s.showToast('Settings exported')
  }
  const importSettings = async (): Promise<void> => {
    const data = await api.ui.importSettings()
    if (!data) {
      s.showToast('That file is not a MeowPlayer settings export', { kind: 'error' })
      return
    }
    s.importSettings(data)
  }

  return (
    <>
      <Group title="Updates">
        <Row label="Check for updates automatically" help="MeowPlayer asks GitHub for the latest release shortly after launch.">
          <Toggle label="Check for updates" on={settings.updateCheck} onChange={(value) => update({ updateCheck: value })} />
        </Row>
        {info?.available ? (
          <UpdateCard />
        ) : (
          <Row label={`Version ${version}`} help="You are on the latest version unless a check says otherwise.">
            <button type="button" className="btn ghost small" onClick={() => void s.checkUpdates(true)} disabled={checking}>
              <Icon name="refresh" size={14} /> {checking ? 'Checking…' : 'Check now'}
            </button>
          </Row>
        )}
      </Group>

      <Group title="Windows">
        <Row label="Default music player" help="Opens Windows Settings, where you can pick MeowPlayer for audio files.">
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              void api.ui.openDefaultApps()
              s.showToast('Choose MeowPlayer in Windows default apps', { kind: 'info' })
            }}
          >
            <Icon name="external" size={14} /> Open Windows settings
          </button>
        </Row>
      </Group>

      <Group title="Backup and diagnostics">
        <Row label="Settings backup" help="Your preferences as a JSON file. Folders and devices stay on this PC.">
          <div className="button-row">
            <button type="button" className="btn ghost small" onClick={() => void exportSettings()}>
              Export
            </button>
            <button type="button" className="btn ghost small" onClick={() => void importSettings()}>
              Import
            </button>
          </div>
        </Row>
        <Row label="Crash log" help="Kept on this PC only. Attach it when you report a bug.">
          <button
            type="button"
            className="btn ghost small"
            onClick={async () => {
              const path = await api.ui.logPath()
              if (path) await api.revealFile(path)
            }}
          >
            <Icon name="folder" size={14} /> Show crash log
          </button>
        </Row>
      </Group>

      <Group title="Keyboard shortcuts">
        <div className="shortcut-grid">
          {SHORTCUTS.map(([key, action]) => (
            <div className="shortcut" key={key}>
              <kbd>{key}</kbd>
              <span>{action}</span>
            </div>
          ))}
        </div>
      </Group>
    </>
  )
}

function About() {
  const version = useStore((state) => state.version)
  return (
    <div className="about">
      <span className="about-logo">
        <Logo size={64} />
      </span>
      <h2>MeowPlayer</h2>
      <p className="setting-help">Version {version}</p>
      <p className="about-text">A frosted-glass music player for your local library on Windows.</p>
      <div className="button-row center">
        <button
          type="button"
          className="btn ghost small"
          onClick={() => void api.openExternal('https://github.com/AminMGM/MeowPlayer')}
        >
          <Icon name="external" size={14} /> Source code
        </button>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => void api.openExternal('https://github.com/AminMGM/MeowPlayer/issues')}
        >
          <Icon name="alert" size={14} /> Report a problem
        </button>
      </div>
      <p className="about-credit">
        Made with ♥ by{' '}
        <button type="button" className="link accent" onClick={() => void api.openExternal('https://github.com/AminMGM')}>
          AminMGM
        </button>
        <br />
        Lyrics by <span className="muted">LRCLIB</span> · MIT License
      </p>
    </div>
  )
}

/* --------------------------------- modal --------------------------------- */

export function Settings() {
  const open = useStore((state) => state.settingsOpen)
  const tab = useStore((state) => state.settingsTab)
  const setOpen = useStore((state) => state.setSettingsOpen)

  if (!open) return null
  const close = (): void => setOpen(false)

  return (
    <div className="modal-backdrop" onPointerDown={close}>
      <div
        className="modal glass-panel settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <nav className="settings-nav" aria-label="Settings sections">
          <p className="settings-title">Settings</p>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx('settings-tab', tab === item.id && 'active')}
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => setOpen(true, item.id)}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="settings-main">
          <header className="settings-head">
            <h2>{TABS.find((item) => item.id === tab)?.label}</h2>
            <button type="button" className="icon-btn" title="Close" aria-label="Close settings" onClick={close}>
              <Icon name="x" size={17} />
            </button>
          </header>
          <div className="settings-body" key={tab}>
            {tab === 'appearance' && <Appearance />}
            {tab === 'playback' && <Playback />}
            {tab === 'lyrics' && <Lyrics />}
            {tab === 'library' && <Library />}
            {tab === 'system' && <System />}
            {tab === 'about' && <About />}
          </div>
        </div>
      </div>
    </div>
  )
}
