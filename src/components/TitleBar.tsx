import { useEffect, useState } from 'react'
import { api } from '../api'
import { useStore } from '../store/useStore'
import { Icon } from './Icons'
import { Logo } from './Logo'

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  const setSettingsOpen = useStore((state) => state.setSettingsOpen)
  const showMiniPlayer = useStore((state) => state.showMiniPlayer)
  const scanning = useStore((state) => state.scanning)

  useEffect(() => {
    void api.window.isMaximized().then(setMaximized)
    return api.window.onMaximizeChange(setMaximized)
  }, [])

  return (
    <header className="titlebar">
      <div className="brand">
        <span className="brand-mark">
          <Logo size={39} />
        </span>
        <span className="brand-name">MeowPlayer</span>
        {scanning && <span className="pill subtle">scanning…</span>}
      </div>

      <div className="titlebar-drag" />

      <div className="window-actions">
        <button type="button" className="icon-btn" title="Settings" onClick={() => setSettingsOpen(true)}>
          <Icon name="settings" size={16} />
        </button>
        <button type="button" className="icon-btn" title="Mini player" onClick={showMiniPlayer}>
          <Icon name="collapse" size={15} />
        </button>
        <span className="window-divider" />
        <button type="button" className="icon-btn win" title="Minimize" onClick={() => api.window.minimize()}>
          <Icon name="minimize" size={15} />
        </button>
        <button
          type="button"
          className="icon-btn win"
          title={maximized ? 'Restore' : 'Maximize'}
          onClick={() => api.window.toggleMaximize()}
        >
          {maximized ? <Icon name="collapse" size={14} /> : <Icon name="maximize" size={13} />}
        </button>
        <button type="button" className="icon-btn win close" title="Close" onClick={() => api.window.close()}>
          <Icon name="x" size={16} />
        </button>
      </div>
    </header>
  )
}
