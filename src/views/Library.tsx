import { useMemo, useState } from 'react'
import { Cover } from '../components/Cover'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icons'
import { MediaCard } from '../components/MediaCard'
import { SongTable, type SortKey, type SortState } from '../components/SongTable'
import { getStore, useStore } from '../store/useStore'
import type { Track } from '../types'
import {
  colorFor,
  cx,
  folderName,
  formatTotalDuration,
  groupAlbums,
  groupArtists,
  groupFolders,
  groupGenres,
  isByArtist,
  isInFolder,
  matches,
  plural,
  splitAlbumKey,
} from '../utils'
import { DetailHeader, PlayButtons, ViewHeader } from './common'

const total = (tracks: Track[]): number => tracks.reduce((sum, track) => sum + track.duration, 0)

/** Sorts tracks for the song tables. */
export function sortTracks(tracks: Track[], sort: SortState, plays: (id: string) => number = () => 0): Track[] {
  const sorted = [...tracks].sort((a, b) => {
    switch (sort.key) {
      case 'artist':
        return a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) || (a.trackNo ?? 0) - (b.trackNo ?? 0)
      case 'album':
        return a.album.localeCompare(b.album) || (a.discNo ?? 0) - (b.discNo ?? 0) || (a.trackNo ?? 0) - (b.trackNo ?? 0)
      case 'added':
        return a.addedAt - b.addedAt
      case 'duration':
        return a.duration - b.duration
      case 'plays':
        return plays(a.id) - plays(b.id)
      default:
        return a.title.localeCompare(b.title)
    }
  })
  return sort.desc ? sorted.reverse() : sorted
}

/* --------------------------------- songs --------------------------------- */

const SORT_OPTIONS: { value: SortKey; label: string; desc: boolean }[] = [
  { value: 'title', label: 'Title', desc: false },
  { value: 'artist', label: 'Artist', desc: false },
  { value: 'album', label: 'Album', desc: false },
  { value: 'added', label: 'Date added', desc: true },
  { value: 'duration', label: 'Length', desc: false },
  { value: 'plays', label: 'Most played', desc: true },
]

export function SongsView() {
  const tracks = useStore((state) => state.tracks)
  const stats = useStore((state) => state.stats)
  const hideDuplicates = useStore((state) => state.settings.hideDuplicates)
  const [sort, setSort] = useState<SortState>({ key: 'title', desc: false })
  const [filter, setFilter] = useState('')
  const s = getStore()

  const visible = useMemo(() => {
    let source = tracks
    if (hideDuplicates) {
      const seen = new Set<string>()
      source = tracks.filter((track) => {
        const key = `${track.title.toLowerCase()}\u0000${track.artist.toLowerCase()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }
    const filtered = filter ? source.filter((track) => matches(filter, track.title, track.artist, track.album, track.genre)) : source
    return sortTracks(filtered, sort, (id) => stats[id]?.plays ?? 0)
  }, [tracks, filter, sort, hideDuplicates, stats])

  const ids = useMemo(() => visible.map((track) => track.id), [visible])
  const onSort = (key: SortKey): void =>
    setSort((current) =>
      current.key === key ? { key, desc: !current.desc } : { key, desc: SORT_OPTIONS.find((o) => o.value === key)?.desc ?? false },
    )

  if (!tracks.length) {
    return (
      <div className="view">
        <ViewHeader eyebrow="Library" title="Songs" />
        <EmptyState
          title="No songs yet"
          actions={
            <button type="button" className="btn primary" onClick={() => void s.addFolders()}>
              <Icon name="folder" size={16} /> Add a music folder
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="view">
      <ViewHeader
        eyebrow="Library"
        title="Songs"
        sub={`${plural(visible.length, 'song')} · ${formatTotalDuration(total(visible))}`}
        actions={<PlayButtons ids={ids} />}
      />

      <div className="toolbar">
        <label className="input-wrap">
          <Icon name="search" size={15} />
          <input
            className="input"
            placeholder="Filter by title, artist, album or genre"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          {filter && (
            <button type="button" className="icon-btn tiny" onClick={() => setFilter('')} aria-label="Clear filter">
              <Icon name="x" size={12} />
            </button>
          )}
        </label>
        <div className="sort-group">
          <span className="muted small">Sort by</span>
          <select
            className="select"
            value={sort.key}
            aria-label="Sort by"
            onChange={(event) => {
              const key = event.target.value as SortKey
              setSort({ key, desc: SORT_OPTIONS.find((o) => o.value === key)?.desc ?? false })
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-btn"
            title={sort.desc ? 'Descending' : 'Ascending'}
            aria-label={sort.desc ? 'Sort descending' : 'Sort ascending'}
            onClick={() => setSort({ ...sort, desc: !sort.desc })}
          >
            <Icon name="sort" size={16} />
          </button>
        </div>
      </div>

      <SongTable
        tracks={visible}
        onPlay={(index) => s.playTracks(ids, index)}
        sort={sort}
        onSort={onSort}
        emptyLabel="No songs match that filter"
      />
    </div>
  )
}

/* --------------------------------- albums -------------------------------- */

export function AlbumsView() {
  const tracks = useStore((state) => state.tracks)
  const albums = useMemo(() => groupAlbums(tracks), [tracks])
  const s = getStore()

  return (
    <div className="view">
      <ViewHeader eyebrow="Library" title="Albums" sub={plural(albums.length, 'album')} />
      {albums.length === 0 ? (
        <EmptyState title="No albums yet">Add a music folder and your albums appear here.</EmptyState>
      ) : (
        <div className="card-grid">
          {albums.map((album) => (
            <MediaCard
              key={album.key}
              title={album.album}
              subtitle={`${album.albumArtist}${album.year ? ` · ${album.year}` : ''}`}
              cover={album.cover}
              seed={album.album}
              onOpen={(art) => s.setView({ kind: 'album', id: album.key }, art)}
              onPlay={() => s.playTracks(album.tracks.map((track) => track.id), 0)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function AlbumDetail({ id }: { id: string }) {
  const tracks = useStore((state) => state.tracks)
  const favorites = useStore((state) => state.favorites)
  const album = useMemo(() => groupAlbums(tracks).find((item) => item.key === id), [tracks, id])
  const s = getStore()

  if (!album) {
    return (
      <div className="view">
        <EmptyState title="Album not found">It may have been removed in the last rescan.</EmptyState>
      </div>
    )
  }

  const ids = album.tracks.map((track) => track.id)
  const info = splitAlbumKey(album.key)
  const allLiked = ids.every((trackId) => favorites.includes(trackId))
  const discs = new Set(album.tracks.map((track) => track.discNo ?? 1)).size

  return (
    <div className="view detail-view">
      <DetailHeader
        back={{ label: 'Albums', onClick: () => s.setView({ kind: 'albums' }) }}
        eyebrow="Album"
        title={album.album}
        plainTitle={album.album}
        cover={album.cover}
        onPlay={() => s.playTracks(ids, 0)}
        meta={
          <>
            <button type="button" className="link strong" onClick={() => s.setView({ kind: 'artist', id: info.albumArtist })}>
              {info.albumArtist}
            </button>
            {album.year ? ` · ${album.year}` : ''} · {plural(album.tracks.length, 'song')}
            {discs > 1 ? ` · ${discs} discs` : ''} · {formatTotalDuration(album.duration)}
          </>
        }
        actions={
          <PlayButtons
            ids={ids}
            extra={
              <>
                <button type="button" className="btn ghost" onClick={() => s.addToQueue(ids)}>
                  <Icon name="queue" size={15} /> Queue
                </button>
                <button type="button" className={cx('btn ghost', allLiked && 'liked')} onClick={() => s.setLiked(ids, !allLiked)}>
                  <Icon name={allLiked ? 'heart' : 'heart-outline'} size={15} /> {allLiked ? 'Liked' : 'Like all'}
                </button>
              </>
            }
          />
        }
      />
      <SongTable tracks={album.tracks} onPlay={(index) => s.playTracks(ids, index)} showAlbum={false} />
    </div>
  )
}

/* -------------------------------- artists -------------------------------- */

export function ArtistsView() {
  const tracks = useStore((state) => state.tracks)
  const artists = useMemo(() => groupArtists(tracks), [tracks])
  const s = getStore()

  return (
    <div className="view">
      <ViewHeader eyebrow="Library" title="Artists" sub={plural(artists.length, 'artist')} />
      {artists.length === 0 ? (
        <EmptyState title="No artists yet">Add a music folder and your artists appear here.</EmptyState>
      ) : (
        <div className="card-grid artists">
          {artists.map((artist) => (
            <MediaCard
              key={artist.name}
              circle
              title={artist.name}
              subtitle={`${plural(artist.albums, 'album')} · ${plural(artist.tracks.length, 'song')}`}
              cover={artist.tracks.find((track) => track.cover)?.cover}
              seed={artist.name}
              onOpen={(art) => s.setView({ kind: 'artist', id: artist.name }, art)}
              onPlay={() => s.playTracks(artist.tracks.map((track) => track.id), 0)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ArtistDetail({ id }: { id: string }) {
  const tracks = useStore((state) => state.tracks)
  const stats = useStore((state) => state.stats)
  const s = getStore()

  // Album artists ("Various Artists", or the main artist on a "feat." track) count too.
  const artistTracks = useMemo(() => tracks.filter((track) => isByArtist(track, id)), [tracks, id])
  const albums = useMemo(() => groupAlbums(artistTracks), [artistTracks])
  const popular = useMemo(
    () =>
      [...artistTracks]
        .sort((a, b) => (stats[b.id]?.plays ?? 0) - (stats[a.id]?.plays ?? 0) || a.title.localeCompare(b.title))
        .slice(0, 8),
    [artistTracks, stats],
  )

  if (!artistTracks.length) {
    return (
      <div className="view">
        <EmptyState title="Artist not found">It may have been removed in the last rescan.</EmptyState>
      </div>
    )
  }

  const ids = artistTracks.map((track) => track.id)
  const hasPlays = popular.some((track) => (stats[track.id]?.plays ?? 0) > 0)

  return (
    <div className="view detail-view">
      <DetailHeader
        back={{ label: 'Artists', onClick: () => s.setView({ kind: 'artists' }) }}
        eyebrow="Artist"
        title={id}
        plainTitle={id}
        circle
        cover={artistTracks.find((track) => track.cover)?.cover}
        onPlay={() => s.playTracks(ids, 0)}
        meta={`${plural(artistTracks.length, 'song')} · ${plural(albums.length, 'album')} · ${formatTotalDuration(total(artistTracks))}`}
        actions={<PlayButtons ids={ids} />}
      />

      <section className="section">
        <div className="section-head">
          <h2>{hasPlays ? 'Popular' : 'Songs'}</h2>
        </div>
        <SongTable
          tracks={popular}
          onPlay={(index) => s.playTracks(popular.map((track) => track.id), index)}
          extra={hasPlays ? { label: 'Plays', render: (track) => plural(stats[track.id]?.plays ?? 0, 'play') } : undefined}
        />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Albums</h2>
        </div>
        <div className="card-grid">
          {albums.map((album) => (
            <MediaCard
              key={album.key}
              title={album.album}
              subtitle={album.year ? String(album.year) : plural(album.tracks.length, 'song')}
              cover={album.cover}
              seed={album.album}
              onOpen={(art) => s.setView({ kind: 'album', id: album.key }, art)}
              onPlay={() => s.playTracks(album.tracks.map((track) => track.id), 0)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

/* --------------------------------- genres -------------------------------- */

export function GenresView() {
  const tracks = useStore((state) => state.tracks)
  const genres = useMemo(() => groupGenres(tracks), [tracks])
  const s = getStore()

  return (
    <div className="view">
      <ViewHeader eyebrow="Library" title="Genres" sub={plural(genres.length, 'genre')} />
      {genres.length === 0 ? (
        <EmptyState title="No genres yet">Genre tags from your files show up here.</EmptyState>
      ) : (
        <div className="genre-grid">
          {genres.map((genre) => (
            <button
              key={genre.name}
              type="button"
              className="genre-card"
              style={{ ['--genre' as string]: colorFor(genre.name) }}
              onClick={() => s.setView({ kind: 'genre', id: genre.name })}
            >
              <span className="genre-name">{genre.name}</span>
              <span className="genre-count">
                {plural(genre.tracks.length, 'song')} · {formatTotalDuration(total(genre.tracks))}
              </span>
              <Cover src={genre.tracks.find((track) => track.cover)?.cover} size={64} seed={genre.name} alt="" className="genre-art" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function GenreDetail({ id }: { id: string }) {
  const tracks = useStore((state) => state.tracks)
  const items = useMemo(() => tracks.filter((track) => (track.genre?.trim() || 'Unknown genre') === id), [tracks, id])
  const ids = items.map((track) => track.id)
  const s = getStore()

  return (
    <div className="view">
      <button type="button" className="link back" onClick={() => s.setView({ kind: 'genres' })}>
        <Icon name="arrow-left" size={15} /> Genres
      </button>
      <ViewHeader
        eyebrow="Genre"
        title={id}
        sub={`${plural(items.length, 'song')} · ${formatTotalDuration(total(items))}`}
        actions={<PlayButtons ids={ids} />}
      />
      <SongTable tracks={items} onPlay={(index) => s.playTracks(ids, index)} />
    </div>
  )
}

/* -------------------------------- folders -------------------------------- */

const separatorFor = (folderPath: string): string => (folderPath.includes('\\') ? '\\' : '/')

/** Immediate subfolders of a folder that actually contain library tracks. */
function subfoldersOf(tracks: Track[], root: string): { name: string; path: string; tracks: Track[] }[] {
  const sep = separatorFor(root)
  const base = root.replace(/[\\/]+$/, '')
  const map = new Map<string, Track[]>()
  for (const track of tracks) {
    if (!isInFolder(track.path, base)) continue
    const rest = track.path.slice(base.length).replace(/^[\\/]+/, '')
    const index = rest.search(/[\\/]/)
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
  const groups = useMemo(() => groupFolders(tracks, folders), [tracks, folders])
  const [renaming, setRenaming] = useState<{ path: string; value: string } | null>(null)
  const s = getStore()
  const labelFor = (path: string): string => aliases[path] ?? folderName(path)

  const commitRename = (): void => {
    if (!renaming) return
    s.renameFolder(renaming.path, renaming.value)
    setRenaming(null)
  }

  return (
    <div className="view">
      <ViewHeader
        eyebrow="Library"
        title="Folders"
        sub={`${plural(groups.length, 'folder')} · ${plural(folders.length, 'scan location')}`}
        actions={
          <button type="button" className="btn ghost" onClick={() => void s.addFolders()}>
            <Icon name="plus" size={15} /> Add folder
          </button>
        }
      />

      {groups.length === 0 ? (
        <EmptyState title="No music folders yet">Add a folder and MeowPlayer keeps it in sync.</EmptyState>
      ) : (
        <div className="folder-grid">
          {groups.map((group) => {
            const subfolders = subfoldersOf(group.tracks, group.path)
            const isRoot = folders.includes(group.path)
            return (
              <div key={group.path} className="folder-card">
                <button
                  type="button"
                  className="folder-card-main"
                  onClick={() => s.setView({ kind: 'folder', id: group.path })}
                  title={group.path}
                >
                  <span className="folder-art" style={{ ['--folder' as string]: colorFor(group.path) }}>
                    <Icon name={subfolders.length > 1 ? 'folders' : 'folder'} size={22} />
                  </span>
                  <span className="folder-text">
                    <span className="media-title">{labelFor(group.path)}</span>
                    <span className="media-sub truncate">{group.path}</span>
                    <span className="media-sub">
                      {plural(group.tracks.length, 'song')} · {formatTotalDuration(total(group.tracks))}
                      {subfolders.length > 1 ? ` · ${subfolders.length} subfolders` : ''}
                    </span>
                  </span>
                </button>
                <div className="folder-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Play folder"
                    aria-label="Play folder"
                    onClick={() => s.playTracks(group.tracks.map((track) => track.id), 0)}
                  >
                    <Icon name="play" size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Rename"
                    aria-label="Rename folder"
                    onClick={() => setRenaming({ path: group.path, value: labelFor(group.path) })}
                  >
                    <Icon name="edit" size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Add to playlist"
                    aria-label="Add folder to playlist"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect()
                      s.setContextMenu({ x: rect.left - 200, y: rect.bottom + 6, trackIds: group.tracks.map((track) => track.id) })
                    }}
                  >
                    <Icon name="more-horizontal" size={15} />
                  </button>
                  {isRoot && (
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Remove from library"
                      aria-label="Remove folder from library"
                      onClick={() => void s.removeFolder(group.path)}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {renaming && (
        <div className="modal-backdrop" onPointerDown={() => setRenaming(null)}>
          <div className="modal glass-panel small-modal" role="dialog" aria-modal="true" onPointerDown={(event) => event.stopPropagation()}>
            <header className="modal-head">
              <h2>Rename folder</h2>
            </header>
            <div className="modal-body">
              <input
                className="input boxed"
                autoFocus
                value={renaming.value}
                onChange={(event) => setRenaming({ ...renaming, value: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitRename()
                  if (event.key === 'Escape') setRenaming(null)
                }}
              />
              <p className="help">Only the name shown in MeowPlayer changes. The folder on disk stays as it is.</p>
            </div>
            <footer className="modal-footer">
              <button type="button" className="btn ghost" onClick={() => setRenaming(null)}>
                Cancel
              </button>
              <button type="button" className="btn primary" onClick={commitRename}>
                Save
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}

export function FolderDetail({ id }: { id: string }) {
  const tracks = useStore((state) => state.tracks)
  const aliases = useStore((state) => state.settings.folderAliases)
  const items = useMemo(() => tracks.filter((track) => isInFolder(track.path, id)), [tracks, id])
  const subfolders = useMemo(() => subfoldersOf(items, id), [items, id])
  const ids = items.map((track) => track.id)
  const s = getStore()

  return (
    <div className="view">
      <button type="button" className="link back" onClick={() => s.setView({ kind: 'folders' })}>
        <Icon name="arrow-left" size={15} /> Folders
      </button>
      <ViewHeader
        eyebrow="Folder"
        title={aliases[id] ?? folderName(id)}
        sub={`${plural(items.length, 'song')} · ${formatTotalDuration(total(items))}`}
        actions={<PlayButtons ids={ids} />}
      />
      <p className="path-line" title={id}>
        {id}
      </p>
      {subfolders.length > 0 && (
        <div className="chip-row">
          {subfolders.map((sub) => (
            <button
              key={sub.path}
              type="button"
              className="chip"
              title={sub.path}
              onClick={() => s.setView({ kind: 'folder', id: sub.path })}
            >
              <Icon name="folder" size={13} />
              <span className="truncate">{sub.name}</span>
              <span className="count">{sub.tracks.length}</span>
            </button>
          ))}
        </div>
      )}
      <SongTable tracks={items} onPlay={(index) => s.playTracks(ids, index)} />
    </div>
  )
}
