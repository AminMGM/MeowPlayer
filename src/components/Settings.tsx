import { useState } from 'react'
import { api } from '../api'
import { DEFAULT_SETTINGS, useStore } from '../store/useStore'
import type { CloseBehavior, Settings as SettingsShape } from '../types'
import { cx } from '../utils'
import { Icon } from './Icons'
import updateLogo from '../../assets/meowdownlaod-logo.svg'

const ACCENTS = ['#1f1f1f', '#b04356', '#e6a3ae', '#a3b7c9', '#5f7385']
const GRADIENTS: { id: string; label: string }[] = [
  { id: 'mono', label: 'Graphite' },
  { id: 'light', label: 'Light' },
  { id: 'cherry', label: 'Cherry' },
  { id: 'navy', label: 'Navy' },
]

export function Settings() {
  const open = useStore((state) => state.settingsOpen)
  const setSettingsOpen = useStore((state) => state.setSettingsOpen)
  const settings = useStore((state) => state.settings)
  const updateSettings = useStore((state) => state.updateSettings)
  const addFolders = useStore((state) => state.addFolders)
  const removeFolder = useStore((state) => state.removeFolder)
  const rescan = useStore((state) => state.rescan)
  const clearLibrary = useStore((state) => state.clearLibrary)
  const tracks = useStore((state) => state.tracks)
  const scanning = useStore((state) => state.scanning)
  const scanProgress = useStore((state) => state.scanProgress)
  const setDockTab = useStore((state) => state.setDockTab)
  const showToast = useStore((state) => state.showToast)
  const version = useStore((state) => state.version)
  const update = useStore((state) => state.update)
  const checkingUpdate = useStore((state) => state.checkingUpdate)
  const checkUpdates = useStore((state) => state.checkUpdates)
  const installUpdate = useStore((state) => state.installUpdate)
  const snoozeUpdate = useStore((state) => state.snoozeUpdate)
  const lyricsDownload = useStore((state) => state.lyricsDownload)
  const downloadAllLyrics = useStore((state) => state.downloadAllLyrics)
  const cancelLyricsDownload = useStore((state) => state.cancelLyricsDownload)
  const [confirmClear, setConfirmClear] = useState(false)

  const exportSettings = async (): Promise<void> => {
    const ok = await api.ui.exportSettings(JSON.stringify(settings, null, 2))
    showToast(ok ? 'Settings exported' : 'Export cancelled')
  }

  const importSettings = async (): Promise<void> => {
    const data = await api.ui.importSettings()
    if (!data || typeof data !== 'object') {
      showToast('That file is not a MeowPlayer settings export')
      return
    }
    const patch: Record<string, unknown> = {}
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (key in data) patch[key] = (data as Record<string, unknown>)[key]
    }
    updateSettings(patch as Partial<SettingsShape>)
    showToast('Settings imported')
  }

  if (!open) return null

  const folders = settings.folders

  return (
    <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <div>
            <p className="detail-eyebrow">MeowPlayer</p>
            <h2>Settings</h2>
          </div>
          <button type="button" className="icon-btn" title="Close" onClick={() => setSettingsOpen(false)}>
            <Icon name="x" size={17} />
          </button>
        </header>

        <div className="modal-body">
          <section className="settings-group">
            <h3>Appearance</h3>

            <div className="setting-row">
              <div>
                <span className="setting-label">Accent colour</span>
                <span className="setting-help">Cool greys drive the highlights and the spectrum.</span>
              </div>
              <div className="swatches">
                {ACCENTS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cx('swatch', settings.accent === color && 'active')}
                    style={{ background: color }}
                    title={color}
                    onClick={() => updateSettings({ accent: color })}
                  />
                ))}
              </div>
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Theme</span>
                <span className="setting-help">Graphite is the default; Light, Cherry and Navy recolour the shell.</span>
              </div>
              <div className="segmented">
                {GRADIENTS.map((gradient) => (
                  <button
                    key={gradient.id}
                    type="button"
                    className={cx('segment', settings.gradient === gradient.id && 'active')}
                    onClick={() => updateSettings({ gradient: gradient.id })}
                  >
                    {gradient.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Glass blur</span>
                <span className="setting-help">{settings.blur}px backdrop blur</span>
              </div>
              <input
                type="range"
                className="range wide"
                min={0}
                max={64}
                step={1}
                value={settings.blur}
                onChange={(event) => updateSettings({ blur: Number(event.target.value) })}
              />
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Theme from album art</span>
                <span className="setting-help">Recolour the accent from the cover of the current track.</span>
              </div>
              <button
                type="button"
                className={cx('toggle', settings.albumTheming && 'on')}
                onClick={() => updateSettings({ albumTheming: !settings.albumTheming })}
                aria-pressed={settings.albumTheming}
              >
                <span />
              </button>
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Ambient animation</span>
                <span className="setting-help">Slow drifting light behind the interface.</span>
              </div>
              <button
                type="button"
                className={cx('toggle', settings.animations && 'on')}
                onClick={() => updateSettings({ animations: !settings.animations })}
                aria-pressed={settings.animations}
              >
                <span />
              </button>
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Spectrum visualizer</span>
                <span className="setting-help">Draw the live spectrum in the now playing views.</span>
              </div>
              <button
                type="button"
                className={cx('toggle', settings.visualizer && 'on')}
                onClick={() => updateSettings({ visualizer: !settings.visualizer })}
                aria-pressed={settings.visualizer}
              >
                <span />
              </button>
            </div>
          </section>

          <section className="settings-group">
            <h3>Playback</h3>

            <div className="setting-row">
              <div>
                <span className="setting-label">Track-change notifications</span>
                <span className="setting-help">Show a Windows notification when a new track starts while the app is in the background.</span>
              </div>
              <button
                type="button"
                className={cx('toggle', settings.notifications && 'on')}
                onClick={() => updateSettings({ notifications: !settings.notifications })}
                aria-pressed={settings.notifications}
              >
                <span />
              </button>
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Pause when the PC sleeps</span>
                <span className="setting-help">Playback pauses when Windows sleeps or locks the screen.</span>
              </div>
              <span className="setting-help muted">Always on</span>
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Crossfade</span>
                <span className="setting-help">
                  {settings.crossfade > 0 ? `${settings.crossfade}s blend between tracks` : 'Off — tracks change instantly'}
                </span>
              </div>
              <input
                type="range"
                className="range wide accent-range"
                min={0}
                max={12}
                step={1}
                value={settings.crossfade}
                style={{ ['--fill' as string]: `${(settings.crossfade / 12) * 100}%` }}
                onChange={(event) => updateSettings({ crossfade: Number(event.target.value) })}
              />
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Volume boost up to 150%</span>
                <span className="setting-help">
                  Extends the volume slider past 100% with extra gain. Off by default.
                </span>
              </div>
              <button
                type="button"
                className={cx('toggle', settings.amplify && 'on')}
                onClick={() => updateSettings({ amplify: !settings.amplify })}
                aria-pressed={settings.amplify}
              >
                <span />
              </button>
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Automatic lyrics</span>
                <span className="setting-help">Synced lyrics from LRCLIB, matched by title, artist and length.</span>
              </div>
              <button
                type="button"
                className={cx('toggle', settings.lyrics && 'on')}
                onClick={() => updateSettings({ lyrics: !settings.lyrics })}
                aria-pressed={settings.lyrics}
              >
                <span />
              </button>
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Download lyrics automatically</span>
                <span className="setting-help">
                  Fetch and cache lyrics as each track starts. Turn this off to download only when you ask.
                </span>
              </div>
              <button
                type="button"
                className={cx('toggle', settings.autoLyrics && 'on')}
                onClick={() => {
                  const next = !settings.autoLyrics
                  updateSettings({ autoLyrics: next })
                  // Turning it on means "give me lyrics for everything", not just the next track.
                  if (next) void downloadAllLyrics()
                }}
                aria-pressed={settings.autoLyrics}
              >
                <span />
              </button>
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Lyrics for the whole library</span>
                <span className="setting-help">
                  {lyricsDownload.running
                    ? `Downloading ${lyricsDownload.done} of ${lyricsDownload.total} tracks…`
                    : lyricsDownload.total > 0
                      ? `Last run: ${lyricsDownload.total - lyricsDownload.failed} found, ${lyricsDownload.failed} without lyrics.`
                      : 'Fetch lyrics for every track now and cache them for offline use.'}
                </span>
                {lyricsDownload.running && (
                  <div
                    className="lyrics-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={lyricsDownload.total}
                    aria-valuenow={lyricsDownload.done}
                  >
                    <span
                      style={{
                        width: `${
                          lyricsDownload.total ? (lyricsDownload.done / lyricsDownload.total) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                )}
              </div>
              {lyricsDownload.running ? (
                <button type="button" className="btn ghost" onClick={cancelLyricsDownload}>
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void downloadAllLyrics()}
                  disabled={!tracks.length}
                >
                  <Icon name="download" size={15} /> Download all
                </button>
              )}
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Interface scale</span>
                <span className="setting-help">Enlarge the whole interface for HiDPI screens or easier reading.</span>
              </div>
              <div className="segmented">
                {[
                  { value: 0.9, label: 'Compact' },
                  { value: 1, label: 'Default' },
                  { value: 1.15, label: 'Large' },
                  { value: 1.3, label: 'Extra' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cx('segment', settings.uiScale === option.value && 'active')}
                    onClick={() => updateSettings({ uiScale: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Visualizer style</span>
                <span className="setting-help">Bars, or one of the three flowing line styles.</span>
              </div>
              <div className="segmented">
                {(['bars', 'ribbon', 'aurora', 'filament'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={cx('segment', settings.visualizerStyle === option && 'active')}
                    onClick={() => updateSettings({ visualizerStyle: option })}
                  >
                    {option === 'bars' ? 'Bars' : option === 'ribbon' ? 'Ribbon' : option === 'aurora' ? 'Aurora' : 'Filament'}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Equalizer</span>
                <span className="setting-help">10-band EQ with presets, saved automatically.</span>
              </div>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => {
                  setDockTab('eq')
                  setSettingsOpen(false)
                }}
              >
                <Icon name="sliders" size={14} /> Open
              </button>
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">When closing the window</span>
                <span className="setting-help">The close button asks what to do — change it here at any time.</span>
              </div>
              <select
                className="select small"
                value={settings.closeBehavior}
                onChange={(event) => updateSettings({ closeBehavior: event.target.value as CloseBehavior })}
              >
                <option value="ask">Ask every time</option>
                <option value="tray">Minimize to tray</option>
                <option value="quit">Quit MeowPlayer</option>
              </select>
            </div>

            <div className="setting-row">
              <div>
                <span className="setting-label">Default music player</span>
                <span className="setting-help">
                  Windows asks you to confirm. Installer registers mp3, flac, m4a, wav, ogg and more.
                </span>
              </div>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => {
                  void api.ui.openDefaultApps()
                  showToast('Choose MeowPlayer in Windows default apps')
                }}
              >
                <Icon name="external" size={14} /> Open Windows settings
              </button>
            </div>
          </section>

          <section className="settings-group">
            <h3>Library</h3>
            <div className="folder-list">
              {folders.length === 0 && <p className="muted">No folders added yet.</p>}
              {folders.map((folder) => (
                <div className="folder-row" key={folder}>
                  <Icon name="folder" size={15} />
                  <span className="truncate" title={folder}>
                    {folder}
                  </span>
                  <button
                    type="button"
                    className="icon-btn tiny"
                    title="Remove folder"
                    onClick={() => void removeFolder(folder)}
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="setting-actions">
              <button type="button" className="btn ghost small" onClick={() => void addFolders()}>
                <Icon name="plus" size={14} /> Add folder
              </button>
              <button type="button" className="btn ghost small" onClick={() => void rescan()} disabled={scanning}>
                <Icon name="refresh" size={14} /> {scanning ? `${scanProgress.done}/${scanProgress.total || '…'}` : 'Rescan'}
              </button>
              <button
                type="button"
                className={cx('btn ghost small', confirmClear && 'danger')}
                onClick={() => {
                  if (!confirmClear) {
                    setConfirmClear(true)
                    window.setTimeout(() => setConfirmClear(false), 4000)
                    return
                  }
                  clearLibrary()
                  setConfirmClear(false)
                  showToast('Library cleared')
                }}
              >
                <Icon name="trash" size={14} /> {confirmClear ? 'Tap again to confirm' : 'Clear library'}
              </button>
            </div>
            <div className="setting-row">
              <div>
                <span className="setting-label">Hide duplicate tracks</span>
                <span className="setting-help">
                  In Songs, show only the first copy of tracks with the same title and artist.
                </span>
              </div>
              <button
                type="button"
                className={cx('toggle', settings.hideDuplicates && 'on')}
                onClick={() => updateSettings({ hideDuplicates: !settings.hideDuplicates })}
                aria-pressed={settings.hideDuplicates}
              >
                <span />
              </button>
            </div>
            <p className="setting-help">{tracks.length.toLocaleString()} tracks indexed on this PC.</p>
          </section>

          <section className="settings-group">
            <h3>Backup and diagnostics</h3>
            <div className="setting-actions">
              <button type="button" className="btn ghost small" onClick={() => void exportSettings()}>
                <Icon name="download" size={14} /> Export settings
              </button>
              <button type="button" className="btn ghost small" onClick={() => void importSettings()}>
                <Icon name="download" size={14} /> Import settings
              </button>
              <button
                type="button"
                className="btn ghost small"
                onClick={async () => {
                  const path = await api.ui.logPath()
                  if (path) await api.revealFile(path)
                  else showToast('No crash log yet')
                }}
              >
                <Icon name="folder" size={14} /> Crash log
              </button>
            </div>
            <p className="setting-help">Settings are a plain JSON file. The crash log stays on this PC.</p>
          </section>

          <section className="settings-group">
            <h3>Updates</h3>
            <div className="setting-row">
              <div>
                <span className="setting-label">Check for updates automatically</span>
                <span className="setting-help">MeowPlayer asks GitHub for the latest release shortly after launch.</span>
              </div>
              <button
                type="button"
                className={cx('toggle', settings.updateCheck && 'on')}
                onClick={() => updateSettings({ updateCheck: !settings.updateCheck })}
                aria-pressed={settings.updateCheck}
              >
                <span />
              </button>
            </div>

            {update?.available ? (
              <div className="update-card">
                <div className="update-head">
                  <img className="update-logo" src={updateLogo} alt="" draggable={false} />
                  <div>
                    <span className="setting-label">MeowPlayer {update.version} is available</span>
                    <span className="setting-help">You are on {update.current}.</span>
                  </div>
                </div>
                {update.notes && <p className="update-notes">{update.notes}</p>}
                <div className="setting-actions">
                  <button type="button" className="btn primary small" onClick={() => void installUpdate()}>
                    <Icon name="download" size={14} /> Install update
                  </button>
                  <button type="button" className="btn ghost small" onClick={() => void snoozeUpdate(7)}>
                    Hide for 7 days
                  </button>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => void api.updates.openRelease(update.pageUrl)}
                  >
                    Release notes
                  </button>
                </div>
              </div>
            ) : (
              <div className="setting-actions">
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => void checkUpdates(true)}
                  disabled={checkingUpdate}
                >
                  <Icon name="refresh" size={14} /> {checkingUpdate ? 'Checking…' : 'Check now'}
                </button>
                <span className="setting-help">Version {version}</span>
              </div>
            )}
          </section>

          <section className="settings-group">
            <h3>Keyboard shortcuts</h3>
            <div className="shortcut-grid">
              {[
                ['Space', 'Play / pause'],
                ['← →', 'Seek 5 s'],
                ['Ctrl ← →', 'Previous / next'],
                ['↑ ↓', 'Volume'],
                ['M', 'Mute'],
                ['S', 'Shuffle'],
                ['R', 'Repeat'],
                ['F', 'Like track'],
                ['Ctrl F', 'Search'],
                ['Esc', 'Close panels'],
              ].map(([key, action]) => (
                <div className="shortcut" key={key}>
                  <kbd>{key}</kbd>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </section>

          <p className="modal-footer">
            MeowPlayer {version} - Made with &lt;3 by AminMGM
          </p>
        </div>
      </div>
    </div>
  )
}
