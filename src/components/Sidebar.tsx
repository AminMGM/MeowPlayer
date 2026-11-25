import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMediaQuery } from '../hooks'
import { getStore, useStore } from '../store/useStore'
import type { SmartList, Track, View } from '../types'
import { cx } from '../utils'
import { Cover } from './Cover'
import { Icon } from './Icons'

interface NavItem {
  key: string
  label: string
  icon: string
  view: View
}

const LIBRARY: NavItem[] = [
  { key: 'home', label: 'Home', icon: 'home', view: { kind: 'home' } },
  { key: 'nowplaying', label: 'Now playing', icon: 'disc', view: { kind: 'nowplaying' } },
  { key: 'songs', label: 'Songs', icon: 'music', view: { kind: 'songs' } },
  { key: 'albums', label: 'Albums', icon: 'library', view: { kind: 'albums' } },
  { key: 'artists', label: 'Artists', icon: 'mic', view: { kind: 'artists' } },
  { key: 'genres', label: 'Genres', icon: 'tag', view: { kind: 'genres' } },
  { key: 'folders', label: 'Folders', icon: 'folder', view: { kind: 'folders' } },
]

const SMART: { key: string; id: SmartList; label: string; icon: string }[] = [
  { key: 'smart-recent-added', id: 'recent-added', label: 'Recently added', icon: 'sparkle' },
  { key: 'smart-most-played', id: 'most-played', label: 'Most played', icon: 'star' },
  { key: 'smart-recent-played', id: 'recent-played', label: 'Recently played', icon: 'history' },
]

function activeKeyOf(view: View): string {
  switch (view.kind) {
    case 'album':
      return 'albums'
    case 'artist':
      return 'artists'
    case 'folder':
      return 'folders'
    case 'genre':
      return 'genres'
    case 'playlist':
      return `playlist-${view.id}`
    case 'smart':
      return `smart-${view.id}`
    default:
      return view.kind
  }
}

export function Sidebar() {
  const view = useStore((state) => state.view)
  const playlists = useStore((state) => state.playlists)
  const tracks = useStore((state) => state.tracks)
  const favorites = useStore((state) => state.favorites.length)
  const scanning = useStore((state) => state.scanning)
  const scanProgress = useStore((state) => state.scanProgress)
  const pinnedCollapsed = useStore((state) => state.settings.collapsedSidebar)
  // Narrow windows tuck the sidebar away without changing the saved preference.
  const narrow = useMediaQuery('(max-width: 960px)')
  const collapsed = pinnedCollapsed || narrow
  const s = getStore()

  const navRef = useRef<HTMLElement | null>(null)
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null)
  const activeKey = activeKeyOf(view)

  // The highlight is one element that glides to the active item.
  useLayoutEffect(() => {
    const nav = navRef.current
    const target = nav?.querySelector<HTMLElement>(`[data-nav="${CSS.escape(activeKey)}"]`)
    if (!nav || !target) {
      setPill(null)
      return
    }
    setPill({ top: target.offsetTop, height: target.offsetHeight })
  }, [activeKey, collapsed, playlists.length])

  const firstCover = useMemo(() => {
    const byId = new Map<string, Track>(tracks.map((track) => [track.id, track]))
    const map = new Map<string, string | null>()
    for (const playlist of playlists) {
      const cover = playlist.trackIds.map((id) => byId.get(id)?.cover).find(Boolean) ?? null
      map.set(playlist.id, cover)
    }
    return map
  }, [playlists, tracks])

  const item = (key: string, label: string, icon: string | React.ReactNode, onClick: () => void, count?: number, size = 17) => (
    <button
      key={key}
      type="button"
      data-nav={key}
      className={cx('nav-item', activeKey === key && 'active')}
      title={collapsed ? label : undefined}
      aria-current={activeKey === key ? 'page' : undefined}
      onClick={onClick}
    >
      {typeof icon === 'string' ? <Icon name={icon} size={size} filledAlt={activeKey === key} /> : icon}
      {!collapsed && <span className="nav-label">{label}</span>}
      {!collapsed && count !== undefined && count > 0 && <span className="nav-count">{count}</span>}
    </button>
  )

  return (
    <aside className={cx('sidebar', collapsed && 'collapsed')} aria-label="Library">
      <nav className="sidebar-scroll" ref={navRef}>
        {pill && <span className="nav-pill" style={{ transform: `translateY(${pill.top}px)`, height: pill.height }} />}

        <div className="sidebar-section">
          {!collapsed && <p className="sidebar-heading">Library</p>}
          {LIBRARY.map((nav) => item(nav.key, nav.label, nav.icon, () => s.setView(nav.view)))}
          {item('favorites', 'Liked songs', 'heart', () => s.setView({ kind: 'favorites' }), favorites)}
        </div>

        <div className="sidebar-section">
          {!collapsed && <p className="sidebar-heading">Smart playlists</p>}
          {SMART.map((smart) =>
            item(smart.key, smart.label, smart.icon, () => s.setView({ kind: 'smart', id: smart.id }), undefined, 16),
          )}
          {item('stats', 'Listening stats', 'chart', () => s.setView({ kind: 'stats' }), undefined, 16)}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-heading-row">
            {!collapsed && (
              <button type="button" className="sidebar-heading link-like" onClick={() => s.setView({ kind: 'playlists' })}>
                Playlists
              </button>
            )}
            <button
              type="button"
              className="icon-btn tiny"
              title="New playlist"
              aria-label="New playlist"
              onClick={() => {
                const id = s.createPlaylist(`Playlist ${playlists.length + 1}`)
                s.setView({ kind: 'playlist', id })
              }}
            >
              <Icon name="plus" size={14} />
            </button>
          </div>
          {playlists.length === 0 && !collapsed && <p className="sidebar-hint">Your playlists show up here.</p>}
          {playlists.map((playlist) =>
            item(
              `playlist-${playlist.id}`,
              playlist.name,
              <Cover src={playlist.cover ?? firstCover.get(playlist.id)} size={22} seed={playlist.name} alt="" />,
              () => s.setView({ kind: 'playlist', id: playlist.id }),
              playlist.trackIds.length,
            ),
          )}
        </div>
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="nav-item" title="Add music" onClick={() => void s.addFolders()}>
          <Icon name={scanning ? 'refresh' : 'folder'} size={16} className={cx(scanning && 'spin')} />
          {!collapsed && (
            <span className="nav-label">
              {scanning ? `Scanning ${scanProgress.done}/${scanProgress.total || '…'}` : 'Add music'}
            </span>
          )}
        </button>
        {!narrow && (
          <button
            type="button"
            className="icon-btn tiny collapse-btn"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => s.updateSettings({ collapsedSidebar: !pinnedCollapsed })}
          >
            <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={14} />
          </button>
        )}
      </div>
    </aside>
  )
}
