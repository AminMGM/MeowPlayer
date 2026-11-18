import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import type { Track } from '../types'
import {
  albumKey,
  colorFor,
  cx,
  folderName,
  formatTotalDuration,
  groupFolders,
  groupGenres,
  shuffleArray,
} from '../utils'
import { Cover } from './Cover'
import { Icon } from './Icons'
import { OutputPicker } from './OutputPicker'
import { SongTable } from './SongTable'
import { Visualizer } from './Visualizer'

/* ------------------------------ Folders ------------------------------ */

const separatorFor = (folderPath: string): string => (folderPath.includes('\\') ? '\\' : '/')

/** Immediate subfolders of a folder that actually contain library tracks. */
function subfoldersOf(tracks: Track[], root: string): { name: string; path: string; tracks: Track[] }[] {
  const sep = separatorFor(root)
  const base = root.replace(/[\\/]+$/, '')
  const map = new Map<string, Track[]>()

  for (const track of tracks) {
    if (!track.path.toLowerCase().startsWith(base.toLowerCase())) continue
    const rest = track.path.slice(base.length).replace(/^[\\/]+/, '')
    const index = rest.indexOf(sep)
    if (index < 1) continue
    const name = rest.slice(0, index)
    const list = map.get(name)
    if (list) list.push(track)
    else map.set(name, [track])
  }

  return [...map.entries()]
    .map(([name, list]) => ({ name, path: `${base}${sep}${name}`, tracks: list }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

export function FoldersView() {
  const tracks = useStore((state) => state.tracks)
  const folders = useStore((state) => state.settings.folders)
  const aliases = useStore((state) => state.settings.folderAliases)
  const playlists = useStore((state) => state.playlists)
  const addFolders = useStore((state) => state.addFolders)
  const playTracks = useStore((state) => state.playTracks)
  const setView = useStore((state) => state.setView)
  const removeFolder = useStore((state) => state.removeFolder)
  const renameFolder = useStore((state) => state.renameFolder)
  const addToPlaylist = useStore((state) => state.addToPlaylist)
  const createPlaylist = useStore((state) => state.createPlaylist)
  const showToast = useStore((state) => state.showToast)

  const groups = useMemo(() => groupFolders(tracks, folders), [tracks, folders])

  const [menu, setMenu] = useState<{ path: string; x: number; y: number } | null>(null)
  const [playlistPicker, setPlaylistPicker] = useState(false)
  const [renaming, setRenaming] = useState<{ path: string; value: string } | null>(null)

  const labelFor = (path: string): string => aliases?.[path] ?? folderName(path)
  const closeMenu = (): void => {
    setMenu(null)
    setPlaylistPicker(false)
  }

  const commitRename = (): void => {
    if (!renaming) return
    renameFolder(renaming.path, renaming.value)
    setRenaming(null)
    showToast('Folder renamed')
  }

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="detail-eyebrow">Library</p>
          <h1 className="view-title">Folders</h1>
          <p className="view-sub">{groups.length} folders · {folders.length} scan locations</p>
        </div>
        <div className="view-actions">
          <button type="button" className="btn ghost" onClick={() => void addFolders()}>
            <Icon name="plus" size={15} /> Add folder
          </button>
        </div>
      </header>

      {groups.length === 0 ? (
        <p className="muted">No music folders yet — add one to get started.</p>
      ) : (
        <div className="folder-grid">
          {groups.map((group) => {
            const subfolders = subfoldersOf(group.tracks, group.path)
            const multi = subfolders.length > 1
            return (
              <div key={group.path} className="folder-card">
                <button
                  type="button"
                  className="folder-card-main"
                  onClick={() => setView({ kind: 'folder', id: group.path })}
                  title={group.path}
                >
                  <span className="folder-art" style={{ background: `linear-gradient(140deg, ${colorFor(group.path)}66, transparent)` }}>
                    <Icon name={multi ? 'folders' : 'folder'} size={22} />
                  </span>
                  <span className="folder-text">
                    <span className="media-title">{labelFor(group.path)}</span>
                    <span className="media-sub truncate">{group.path}</span>
                    <span className="media-sub">
                      {group.tracks.length} tracks · {formatTotalDuration(group.tracks.reduce((sum, t) => sum + t.duration, 0))}
                      {multi ? ` · ${subfolders.length} subfolders` : ''}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Play folder"
                  onClick={() => playTracks(group.tracks.map((track) => track.id), 0)}
                >
                  <Icon name="play" size={15} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Folder options"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect()
                    setPlaylistPicker(false)
                    setMenu({
                      path: group.path,
                      x: Math.min(rect.left - 170, window.innerWidth - 250),
                      y: Math.min(rect.bottom + 6, window.innerHeight - 300),
                    })
                  }}
                >
                  <Icon name="more-horizontal" size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {menu && (
        <>
          <div className="context-backdrop" onMouseDown={closeMenu} onContextMenu={(event) => event.preventDefault()} />
          <div className="context-menu glass" style={{ left: Math.max(8, menu.x), top: Math.max(8, menu.y) }}>
            <div className="context-head">
              <span className="title-name truncate">{labelFor(menu.path)}</span>
              <span className="title-artist truncate">{menu.path}</span>
            </div>
            <button
              type="button"
              className="context-item"
              onClick={() => {
                setRenaming({ path: menu.path, value: labelFor(menu.path) })
                closeMenu()
              }}
            >
              <Icon name="edit" size={15} /> Rename folder
            </button>
            {!playlistPicker ? (
              <button type="button" className="context-item" onClick={() => setPlaylistPicker(true)}>
                <Icon name="playlist" size={15} /> Add to playlist
                <span className="context-chevron">
                  <Icon name="chevron-right" size={13} />
                </span>
              </button>
            ) : (
              <div className="context-sub">
                {playlists.length === 0 && <p className="context-hint">No playlists yet</p>}
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    type="button"
                    className="context-item"
                    onClick={() => {
                      const group = groups.find((item) => item.path === menu.path)
                      if (group) addToPlaylist(playlist.id, group.tracks.map((track) => track.id))
                      closeMenu()
                    }}
                  >
                    <Icon name="playlist" size={14} /> <span className="truncate">{playlist.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="context-item accent"
                  onClick={() => {
                    const group = groups.find((item) => item.path === menu.path)
                    const id = createPlaylist(`Playlist ${playlists.length + 1}`, group?.tracks.map((track) => track.id) ?? [])
                    setView({ kind: 'playlist', id })
                    closeMenu()
                  }}
                >
                  <Icon name="plus" size={14} /> New playlist
                </button>
              </div>
            )}
            <div className="context-sep" />
            <button
              type="button"
              className="context-item danger"
              onClick={() => {
                void removeFolder(menu.path)
                closeMenu()
              }}
            >
              <Icon name="trash" size={15} /> Remove from library
            </button>
          </div>
        </>
      )}

      {renaming && (
        <div className="modal-backdrop" onMouseDown={() => setRenaming(null)}>
          <div className="modal glass" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h2>Rename folder</h2>
            </div>
            <div className="modal-body">
              <p className="setting-help truncate">{renaming.path}</p>
              <input
                className="input"
                autoFocus
                value={renaming.value}
                onChange={(event) => setRenaming({ ...renaming, value: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitRename()
                  if (event.key === 'Escape') setRenaming(null)
                }}
              />
              <p className="setting-help">Only the name shown in MeowPlayer changes — the folder on disk is left alone.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn ghost" onClick={() => setRenaming(null)}>
                Cancel
              </button>
              <button type="button" className="btn primary" onClick={commitRename}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function FolderDetail({ id }: { id: string }) {
  const tracks = useStore((state) => state.tracks)
  const aliases = useStore((state) => state.settings.folderAliases)
  const playTracks = useStore((state) => state.playTracks)
  const setView = useStore((state) => state.setView)

  const items = useMemo(() => tracks.filter((track) => track.path.startsWith(id)), [tracks, id])
  const ids = items.map((track) => track.id)
  const subfolders = useMemo(() => subfoldersOf(items, id), [items, id])

  return (
    <div className="view">
      <button type="button" className="link back" onClick={() => setView({ kind: 'folders' })}>
        <Icon name="arrow-left" size={15} /> Folders
      </button>

      <header className="view-head">
        <div>
          <p className="detail-eyebrow">Folder</p>
          <h1 className="view-title">{aliases?.[id] ?? folderName(id)}</h1>
          <p className="view-sub truncate">
            {id} · {items.length} tracks ·{' '}
            {formatTotalDuration(items.reduce((sum, track) => sum + track.duration, 0))}
          </p>
        </div>
        <div className="view-actions">
          <button type="button" className="btn primary" onClick={() => ids.length && playTracks(ids, 0)}>
            <Icon name="play" size={15} /> Play
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => ids.length && playTracks(shuffleArray(ids), 0)}
          >
            <Icon name="shuffle" size={15} /> Shuffle
          </button>
        </div>
      </header>

      {subfolders.length > 0 && (
        <div className="subfolder-strip">
          {subfolders.map((sub) => (
            <button
              key={sub.path}
              type="button"
              className="chip subfolder-chip"
              title={sub.path}
              onClick={() => setView({ kind: 'folder', id: sub.path })}
            >
              <Icon name="folder" size={13} />
              <span className="truncate">{sub.name}</span>
              <span className="chip-count">{sub.tracks.length}</span>
            </button>
          ))}
        </div>
      )}

      <SongTable tracks={items} onPlay={(index) => playTracks(ids, index)} />
    </div>
  )
}

/* ------------------------------ Genres ------------------------------ */

export function GenresView() {
  const tracks = useStore((state) => state.tracks)
  const setView = useStore((state) => state.setView)
  const genres = useMemo(() => groupGenres(tracks), [tracks])

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="detail-eyebrow">Library</p>
          <h1 className="view-title">Genres</h1>
          <p className="view-sub">{genres.length} genres</p>
        </div>
      </header>

      {genres.length === 0 ? (
        <p className="muted">No genre tags found in your files.</p>
      ) : (
        <div className="genre-grid">
          {genres.map((genre) => (
            <button
              key={genre.name}
              type="button"
              className="genre-card"
              style={{ ['--genre' as string]: colorFor(genre.name) }}
              onClick={() => setView({ kind: 'genre', id: genre.name })}
            >
              <span className="genre-name">{genre.name}</span>
              <span className="genre-count">
                {genre.tracks.length} tracks · {formatTotalDuration(genre.tracks.reduce((sum, t) => sum + t.duration, 0))}
              </span>
              <Cover src={genre.tracks[0]?.cover} size={56} seed={genre.name} alt={genre.name} className="genre-art" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function GenreDetail({ id }: { id: string }) {
  const tracks = useStore((state) => state.tracks)
  const playTracks = useStore((state) => state.playTracks)
  const setView = useStore((state) => state.setView)

  const items = useMemo(
    () => tracks.filter((track) => (track.genre?.trim() || 'Unknown genre') === id),
    [tracks, id],
  )
  const ids = items.map((track) => track.id)

  return (
    <div className="view">
      <button type="button" className="link back" onClick={() => setView({ kind: 'genres' })}>
        <Icon name="arrow-left" size={15} /> Genres
      </button>

      <header className="view-head">
        <div>
          <p className="detail-eyebrow">Genre</p>
          <h1 className="view-title">{id}</h1>
          <p className="view-sub">
            {items.length} tracks · {formatTotalDuration(items.reduce((sum, track) => sum + track.duration, 0))}
          </p>
        </div>
        <div className="view-actions">
          <button type="button" className="btn primary" onClick={() => ids.length && playTracks(ids, 0)}>
            <Icon name="play" size={15} /> Play
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => ids.length && playTracks(shuffleArray(ids), 0)}
          >
            <Icon name="shuffle" size={15} /> Shuffle
          </button>
        </div>
      </header>

      <SongTable tracks={items} onPlay={(index) => playTracks(ids, index)} />
    </div>
  )
}

/* ---------------------------- Now playing ---------------------------- */

export function NowPlayingView() {
  const track = useStore((state) => state.playingTrack)
  const isPlaying = useStore((state) => state.isPlaying)
  const favorites = useStore((state) => state.favorites)
  const toggleLike = useStore((state) => state.toggleLike)
  const setView = useStore((state) => state.setView)
  const queue = useStore((state) => state.queue)
  const tracks = useStore((state) => state.tracks)
  const playTracks = useStore((state) => state.playTracks)
  const queueIndex = useStore((state) => state.queueIndex)

  const upNext = useMemo(() => {
    const map = new Map(tracks.map((item) => [item.id, item]))
    return queue
      .slice(queueIndex + 1, queueIndex + 6)
      .map((id) => map.get(id))
      .filter((item): item is Track => Boolean(item))
  }, [queue, queueIndex, tracks])

  if (!track) {
    return (
      <div className="view">
        <div className="empty-state glass-soft">
          <span className="empty-icon">
            <Icon name="headphones" size={32} />
          </span>
          <h1>Nothing playing</h1>
          <p>Pick a song and the now playing stage fills up with artwork, lyrics and the live spectrum.</p>
          <div className="empty-actions">
            <button type="button" className="btn primary" onClick={() => setView({ kind: 'songs' })}>
              <Icon name="music" size={15} /> Browse songs
            </button>
          </div>
        </div>
      </div>
    )
  }

  const liked = favorites.includes(track.id)

  return (
    <div className="view now-stage">
      <div className="now-stage-art">
        <Cover src={track.cover} size={340} seed={track.album} alt={track.album} className="stage-cover" />

        {upNext.length > 0 && (
          <div className="upnext stage-upnext">
            <p className="section-label">Up next</p>
            {upNext.map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                type="button"
                className="stat-row"
                onClick={() => playTracks(queue, queueIndex + 1 + index)}
              >
                <Cover src={item.cover} size={34} seed={item.album} alt={item.album} />
                <span className="stat-text">
                  <span className="title-name">{item.title}</span>
                  <span className="title-artist">{item.artist}</span>
                </span>
                <Icon name="play" size={13} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="now-stage-info">
        <p className="detail-eyebrow">Now playing</p>
        <h1 className="detail-title">{track.title}</h1>
        <p className="detail-meta">
          <button type="button" className="link" onClick={() => setView({ kind: 'artist', id: track.artist })}>
            {track.artist}
          </button>
          {' · '}
          <button
            type="button"
            className="link"
            onClick={() => setView({ kind: 'album', id: albumKey(track) })}
          >
            {track.album}
          </button>
          {track.year ? ` · ${track.year}` : ''}
        </p>

        <div className="stage-actions">
          <button
            type="button"
            className={cx('btn ghost', liked && 'liked')}
            onClick={() => toggleLike(track.id)}
          >
            <Icon name="heart" size={15} /> {liked ? 'Liked' : 'Like'}
          </button>
          <OutputPicker />
          {track.genre && (
            <button type="button" className="chip" onClick={() => setView({ kind: 'genre', id: track.genre })}>
              {track.genre}
            </button>
          )}
        </div>

        <Visualizer height={92} bars={48} />
      </div>
    </div>
  )
}
