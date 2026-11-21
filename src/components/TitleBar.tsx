import { useEffect, useState } from 'react'
import { api } from '../api'
import { getStore, useStore } from '../store/useStore'
import { Icon } from './Icons'
import { Logo } from './Logo'

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  const canBack = useStore((state) => state.backStack.length > 0)
  const canForward = useStore((state) => state.forwardStack.length > 0)
  const search = useStore((state) => state.search)
  const inSearch = useStore((state) => state.view.kind === 'search')
  const s = getStore()

  useEffect(() => {
    void api.window.isMaximized().then(setMaximized)
    return api.window.onMaximizeChange(setMaximized)
  }, [])

  return (
    <header className="titlebar" onDoubleClick={(event) => event.target === event.currentTarget && api.window.toggleMaximize()}>
      <div className="brand">
        <span className="brand-mark">
          <Logo size={30} />
        </span>
        <span className="brand-name">MeowPlayer</span>
      </div>

      <div className="history-buttons">
        <button type="button" className="icon-btn" title="Back (Alt+←)" aria-label="Back" disabled={!canBack} onClick={s.goBack}>
          <Icon name="chevron-left" size={17} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="Forward (Alt+→)"
          aria-label="Forward"
          disabled={!canForward}
          onClick={s.goForward}
        >
          <Icon name="chevron-right" size={17} />
        </button>
      </div>

      <label className="title-search">
        <Icon name="search" size={15} />
        <input
          id="global-search"
          className="input"
          placeholder="Search songs, albums, artists"
          value={search}
          onFocus={() => !inSearch && s.setView({ kind: 'search' })}
          onChange={(event) => {
            s.setSearch(event.target.value)
            if (!inSearch) s.setView({ kind: 'search' })
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              s.setSearch('')
              event.currentTarget.blur()
            }
          }}
        />
        {search ? (
          <button type="button" className="icon-btn tiny" aria-label="Clear search" onClick={() => s.setSearch('')}>
            <Icon name="x" size={12} />
          </button>
        ) : (
          <kbd>Ctrl F</kbd>
        )}
      </label>

      <div className="titlebar-drag" />

      <div className="window-actions">
        <button type="button" className="icon-btn" title="Settings" aria-label="Settings" onClick={() => s.setSettingsOpen(true)}>
          <Icon name="settings" size={16} />
        </button>
        <button type="button" className="icon-btn" title="Mini player" aria-label="Mini player" onClick={s.showMiniPlayer}>
          <Icon name="pip" size={15} />
        </button>
        <span className="window-divider" />
        <button type="button" className="icon-btn win" title="Minimize" aria-label="Minimize" onClick={() => api.window.minimize()}>
          <Icon name="minimize" size={15} />
        </button>
        <button
          type="button"
          className="icon-btn win"
          title={maximized ? 'Restore' : 'Maximize'}
          aria-label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => api.window.toggleMaximize()}
        >
          {maximized ? <Icon name="collapse" size={14} /> : <Icon name="maximize" size={13} />}
        </button>
        <button type="button" className="icon-btn win close" title="Close" aria-label="Close" onClick={() => api.window.close()}>
          <Icon name="x" size={16} />
        </button>
      </div>
    </header>
  )
}
