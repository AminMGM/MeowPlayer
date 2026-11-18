import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import type { View } from '../types'
import { cx } from '../utils'
import { Icon } from './Icons'

const NAV: { key: string; label: string; icon: string; view: View }[] = [
  { key: 'nowplaying', label: 'Now playing', icon: 'disc', view: { kind: 'nowplaying' } },
  { key: 'home', label: 'Home', icon: 'home', view: { kind: 'home' } },
  { key: 'songs', label: 'Songs', icon: 'music', view: { kind: 'songs' } },
  { key: 'albums', label: 'Albums', icon: 'disc', view: { kind: 'albums' } },
  { key: 'artists', label: 'Artists', icon: 'mic', view: { kind: 'artists' } },
  { key: 'folders', label: 'Folders', icon: 'folder', view: { kind: 'folders' } },
  { key: 'genres', label: 'Genres', icon: 'sliders', view: { kind: 'genres' } },
  { key: 'favorites', label: 'Liked', icon: 'heart', view: { kind: 'favorites' } },
]

export function Sidebar() {
  const view = useStore((state) => state.view)
  const setView = useStore((state) => state.setView)
  const playlists = useStore((state) => state.playlists)
  const tracks = useStore((state) => state.tracks)
  const favorites = useStore((state) => state.favorites)
  const addFolders = useStore((state) => state.addFolders)
  const createPlaylist = useStore((state) => state.createPlaylist)
  const setSettingsOpen = useStore((state) => state.setSettingsOpen)
  const scanning = useStore((state) => state.scanning)
  const scanProgress = useStore((state) => state.scanProgress)
  const collapsed = useStore((state) => state.settings.collapsedSidebar)
  const updateSettings = useStore((state) => state.updateSettings)

  const activeKey = useMemo(() => {
    if (view.kind === 'album') return 'albums'
    if (view.kind === 'artist') return 'artists'
    if (view.kind === 'playlist' || view.kind === 'playlists') return 'playlists'
    if (view.kind === 'folder' || view.kind === 'folders') return 'folders'
    if (view.kind === 'genre' || view.kind === 'genres') return 'genres'
    return view.kind
  }, [view])

  return (
    <aside className={cx('sidebar', collapsed && 'collapsed')}>
      <div className="sidebar-head">
        {!collapsed && <span>Library</span>}
        <button
          type="button"
          className="icon-btn tiny collapse-btn"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => updateSettings({ collapsedSidebar: !collapsed })}
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={14} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item) => (
          <button
            key={item.key}
            type="button"
            className={cx('nav-item', activeKey === item.key && 'active')}
            title={collapsed ? item.label : undefined}
            onClick={() => setView(item.view)}
          >
            <Icon name={item.icon} size={17} />
            {!collapsed && <span className="nav-label">{item.label}</span>}
            {!collapsed && item.key === 'favorites' && favorites.length > 0 && (
              <span className="nav-count">{favorites.length}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-section-head">
          {!collapsed && <span>Playlists</span>}
          <button
            type="button"
            className="icon-btn tiny"
            title="New playlist"
            onClick={() => {
              const id = createPlaylist(`Playlist ${playlists.length + 1}`)
              setView({ kind: 'playlist', id })
            }}
          >
            <Icon name="plus" size={14} />
          </button>
        </div>
        <div className="sidebar-playlists">
          {playlists.length === 0 && !collapsed && <p className="sidebar-hint">No playlists yet.</p>}
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              className={cx('nav-item small', view.kind === 'playlist' && view.id === playlist.id && 'active')}
              title={playlist.name}
              onClick={() => setView({ kind: 'playlist', id: playlist.id })}
            >
              {playlist.cover ? (
                <img className="nav-cover" src={playlist.cover} alt="" draggable={false} />
              ) : (
                <Icon name="playlist" size={15} />
              )}
              {!collapsed && <span className="truncate">{playlist.name}</span>}
              {!collapsed && <span className="nav-count">{playlist.trackIds.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <button type="button" className="nav-item small" title="Add music" onClick={() => void addFolders()}>
          <Icon name="folder" size={15} />
          {!collapsed && (
            <span>{scanning ? `${scanProgress.done}/${scanProgress.total || '…'}` : 'Add music'}</span>
          )}
        </button>
        <button
          type="button"
          className="nav-item small"
          title="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Icon name="settings" size={15} />
          {!collapsed && <span>Settings</span>}
        </button>
        {!collapsed && (
          <p className="sidebar-credit">
            {tracks.length.toLocaleString()} tracks{tracks.length > 0 ? ' · local' : ''}
          </p>
        )}
      </div>
    </aside>
  )
}
