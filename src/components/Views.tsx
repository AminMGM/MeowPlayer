import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { pickGreeting } from '../greetings'
import { useStore } from '../store/useStore'
import type { Track } from '../types'
import {
  albumKey,
  cx,
  formatTotalDuration,
  groupAlbums,
  groupArtists,
  matches,
  shuffleArray,
  splitAlbumKey,
} from '../utils'
import { Cover } from './Cover'
import { Icon } from './Icons'
import { SongTable } from './SongTable'
import { FolderDetail, FoldersView, GenreDetail, GenresView, NowPlayingView } from './LibraryExtras'

const APP_STARTED_AT = Date.now()

export function ViewRouter() {
  const view = useStore((state) => state.view)

  switch (view.kind) {
    case 'songs':
      return <SongsView />
    case 'albums':
      return <AlbumsView />
    case 'album':
      return <AlbumDetail id={view.id} />
    case 'artists':
      return <ArtistsView />
    case 'artist':
      return <ArtistDetail id={view.id} />
    case 'playlists':
      return <PlaylistsView />
    case 'playlist':
      return <PlaylistDetail id={view.id} />
    case 'favorites':
      return <FavoritesView />
    case 'search':
      return <SearchView />
    case 'folders':
      return <FoldersView />
    case 'folder':
      return <FolderDetail id={view.id} />
    case 'genres':
      return <GenresView />
    case 'genre':
      return <GenreDetail id={view.id} />
    case 'nowplaying':
      return <NowPlayingView />
    default:
      return <HomeView />
  }
}

/* ------------------------------- Home ------------------------------- */

function HomeView() {
  const tracks = useStore((state) => state.tracks)
  const history = useStore((state) => state.history)
  const stats = useStore((state) => state.stats)
  const playlists = useStore((state) => state.playlists)
  const addFolders = useStore((state) => state.addFolders)
  const playTracks = useStore((state) => state.playTracks)
  const setView = useStore((state) => state.setView)
  const rescan = useStore((state) => state.rescan)
  const scanning = useStore((state) => state.scanning)

  const settings = useStore((state) => state.settings)
  const updateSettings = useStore((state) => state.updateSettings)
  const firstLaunchSession = useStore((state) => state.firstLaunchSession)
  const returningSession = useStore((state) => state.returningSession)
  const isPlaying = useStore((state) => state.isPlaying)

  const recent = useMemo(() => {
    const map = new Map(tracks.map((track) => [track.id, track]))
    return history
      .map((entry) => map.get(entry.id))
      .filter((track): track is Track => Boolean(track))
      .slice(0, 8)
  }, [history, tracks])

  const recentlyAdded = useMemo(
    () => [...tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, 10),
    [tracks],
  )

  const topTracks = useMemo(() => {
    const map = new Map(tracks.map((track) => [track.id, track]))
    return Object.entries(stats)
      .sort((a, b) => b[1].plays - a[1].plays)
      .map(([id]) => map.get(id))
      .filter((track): track is Track => Boolean(track))
      .slice(0, 6)
  }, [stats, tracks])

  const albums = useMemo(() => groupAlbums(tracks).slice(0, 12), [tracks])

  // Picked once per Home screen load, so re-renders never reshuffle the greeting.
  const [greeting] = useState(() =>
    pickGreeting({
      hour: new Date().getHours(),
      isWeekend: [0, 6].includes(new Date().getDay()),
      firstLaunch: firstLaunchSession,
      returning: returningSession,
      // A session counts as long once this window has been open and playing for an hour.
      longSession: isPlaying && Date.now() - APP_STARTED_AT > 60 * 60 * 1000,
      lastShownId: settings.lastGreetingId ?? null,
    }),
  )

  useEffect(() => {
    if (settings.lastGreetingId !== greeting.id) updateSettings({ lastGreetingId: greeting.id })
    // Only remember the greeting that this Home screen picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greeting.id])

  const suggested = useMemo(() => {
    const recentIds = new Set(history.slice(0, 12).map((entry) => entry.id))
    const pool = tracks.filter((track) => !recentIds.has(track.id))
    const plays = (track: Track): number => stats[track.id]?.plays ?? 0
    const sorted = [...pool].sort((a, b) => plays(a) - plays(b) || a.title.localeCompare(b.title))
    const cold = sorted.slice(0, Math.max(10, Math.ceil(sorted.length * 0.4)))
    return shuffleArray(cold).slice(0, 10)
  }, [history, stats, tracks])

  if (!tracks.length) {
    return (
      <div className="view">
        <div className="empty-state glass-soft">
          <span className="empty-icon">
            <Icon name="headphones" size={34} />
          </span>
          <h1>Your library is empty</h1>
          <p>
            Point MeowPlayer at a folder of music and it will read titles, artists, albums and artwork automatically.
          </p>
          <div className="empty-actions">
            <button type="button" className="btn primary" onClick={() => void addFolders()}>
              <Icon name="folder" size={16} /> Add music folder
            </button>
          </div>
          <p className="empty-foot">MP3 · FLAC · M4A · AAC · WAV · OGG · OPUS · WMA · AIFF</p>
        </div>
      </div>
    )
  }

  return (
    <div className="view">
      <div className="hero glass-soft">
        <div>
          <h1 className="hero-title hero-greeting">
            <span className="hero-greeting-icon" aria-hidden="true">
              {greeting.icon}
            </span>
            {greeting.text}
          </h1>
          <p className="hero-sub">
            {tracks.length.toLocaleString()} tracks · {groupAlbums(tracks).length} albums ·{' '}
            {formatTotalDuration(tracks.reduce((sum, track) => sum + track.duration, 0))} of listening
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => playTracks(shuffleArray(tracks.map((track) => track.id)), 0)}
            >
              <Icon name="shuffle" size={16} /> Shuffle everything
            </button>
            <button type="button" className="btn ghost" onClick={() => void rescan()} disabled={scanning}>
              <Icon name="refresh" size={16} /> {scanning ? 'Scanning…' : 'Rescan library'}
            </button>
          </div>
        </div>
        <div className="hero-art">
          <Cover src={recent[0]?.cover ?? albums[0]?.cover} size={168} seed="MeowPlayer" alt="Featured" />
        </div>
      </div>

      {suggested.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Suggested from your library</h2>
            <button type="button" className="link subtle" onClick={() => setView({ kind: 'songs' })}>
              Browse all
            </button>
          </div>
          <div className="row-scroll">
            {suggested.map((track) => (
              <button
                key={track.id}
                type="button"
                className="media-card"
                onClick={() => playTracks(suggested.map((item) => item.id), suggested.indexOf(track))}
              >
                <div className="media-art">
                  <Cover src={track.cover} size={148} seed={track.album} alt={track.album} />
                  <span className="card-play">
                    <Icon name="play" size={16} />
                  </span>
                </div>
                <span className="media-title">{track.title}</span>
                <span className="media-sub">{track.artist}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Recently played</h2>
          </div>
          <div className="row-scroll">
            {recent.map((track) => (
              <button
                key={track.id}
                type="button"
                className="media-card"
                onClick={() => playTracks(recent.map((item) => item.id), recent.indexOf(track))}
              >
                <div className="media-art">
                  <Cover src={track.cover} size={148} seed={track.album} alt={track.album} />
                  <span className="card-play">
                    <Icon name="play" size={16} />
                  </span>
                </div>
                <span className="media-title">{track.title}</span>
                <span className="media-sub">{track.artist}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="split">
        <section className="section grow">
          <div className="section-head">
            <h2>Recently added</h2>
            <button type="button" className="link subtle" onClick={() => setView({ kind: 'songs' })}>
              Show all
            </button>
          </div>
          <SongTable
            tracks={recentlyAdded}
            onPlay={(index) => playTracks(recentlyAdded.map((track) => track.id), index)}
            showIndex={false}
            showAlbum
          />
        </section>

        <section className="section side">
          <div className="section-head">
            <h2>Most played</h2>
          </div>
          {topTracks.length === 0 && <p className="muted">Play something to build your stats.</p>}
          {topTracks.map((track, index) => (
            <button
              key={track.id}
              type="button"
              className="stat-row"
              onClick={() => playTracks(topTracks.map((item) => item.id), index)}
            >
              <span className="stat-rank">{index + 1}</span>
              <Cover src={track.cover} size={38} seed={track.album} alt={track.album} />
              <span className="stat-text">
                <span className="title-name">{track.title}</span>
                <span className="title-artist">{track.artist}</span>
              </span>
              <span className="stat-plays">{stats[track.id]?.plays ?? 0}×</span>
            </button>
          ))}

          {playlists.length > 0 && (
            <>
              <div className="section-head tight">
                <h2>Playlists</h2>
              </div>
              {playlists.slice(0, 5).map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className="stat-row"
                  onClick={() => setView({ kind: 'playlist', id: playlist.id })}
                >
                  <span className="stat-rank">
                    <Icon name="playlist" size={15} />
                  </span>
                  <span className="stat-text">
                    <span className="title-name">{playlist.name}</span>
                    <span className="title-artist">{playlist.trackIds.length} tracks</span>
                  </span>
                </button>
              ))}
            </>
          )}
        </section>
      </div>

      {albums.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Albums</h2>
            <button type="button" className="link subtle" onClick={() => setView({ kind: 'albums' })}>
              Show all
            </button>
          </div>
          <div className="row-scroll">
            {albums.map((album) => (
              <button
                key={album.key}
                type="button"
                className="media-card"
                onClick={() => setView({ kind: 'album', id: album.key })}
              >
                <div className="media-art">
                  <Cover src={album.cover} size={148} seed={album.album} alt={album.album} />
                </div>
                <span className="media-title">{album.album}</span>
                <span className="media-sub">{album.albumArtist}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/* ------------------------------- Songs ------------------------------- */

type SortKey = 'title' | 'artist' | 'album' | 'added' | 'duration'

function SongsView() {
  const tracks = useStore((state) => state.tracks)
  const playTracks = useStore((state) => state.playTracks)
  const setView = useStore((state) => state.setView)
  const hideDuplicates = useStore((state) => state.settings.hideDuplicates)
  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [descending, setDescending] = useState(false)
  const [filter, setFilter] = useState('')

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
    const filtered = filter
      ? source.filter((track) => matches(filter, track.title, track.artist, track.album, track.genre))
      : source
    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'artist':
          return a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album)
        case 'album':
          return a.album.localeCompare(b.album) || (a.trackNo ?? 0) - (b.trackNo ?? 0)
        case 'added':
          return a.addedAt - b.addedAt
        case 'duration':
          return a.duration - b.duration
        default:
          return a.title.localeCompare(b.title)
      }
    })
    return descending ? sorted.reverse() : sorted
  }, [tracks, filter, sortKey, descending, hideDuplicates])

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="detail-eyebrow">Library</p>
          <h1 className="view-title">Songs</h1>
          <p className="view-sub">
            {visible.length.toLocaleString()} tracks · {formatTotalDuration(visible.reduce((sum, t) => sum + t.duration, 0))}
          </p>
        </div>
        <div className="view-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => visible.length && playTracks(visible.map((track) => track.id), 0)}
          >
            <Icon name="play" size={15} /> Play all
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => visible.length && playTracks(shuffleArray(visible.map((track) => track.id)), 0)}
          >
            <Icon name="shuffle" size={15} /> Shuffle
          </button>
          <button type="button" className="btn ghost" onClick={() => setView({ kind: 'search' })}>
            <Icon name="search" size={15} /> Search
          </button>
        </div>
      </header>

      <div className="toolbar">
        <div className="input-wrap">
          <Icon name="search" size={16} />
          <input
            className="input"
            placeholder="Filter songs, artists, albums…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          {filter && (
            <button type="button" className="icon-btn tiny" onClick={() => setFilter('')} title="Clear">
              <Icon name="x" size={13} />
            </button>
          )}
        </div>
        <div className="sort-group">
          <select className="select small" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
            <option value="title">Title</option>
            <option value="artist">Artist</option>
            <option value="album">Album</option>
            <option value="added">Date added</option>
            <option value="duration">Duration</option>
          </select>
          <button
            type="button"
            className={cx('icon-btn', descending && 'on')}
            title={descending ? 'Descending' : 'Ascending'}
            onClick={() => setDescending(!descending)}
          >
            <Icon name="sort" size={16} />
          </button>
        </div>
      </div>

      <SongTable
        tracks={visible}
        onPlay={(index) => playTracks(visible.map((track) => track.id), index)}
        emptyLabel={filter ? 'No songs match that filter' : 'Add a music folder to fill your library'}
      />
    </div>
  )
}

/* ------------------------------- Albums ------------------------------- */

function AlbumsView() {
  const tracks = useStore((state) => state.tracks)
  const playTracks = useStore((state) => state.playTracks)
  const setView = useStore((state) => state.setView)
  const albums = useMemo(() => groupAlbums(tracks), [tracks])

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="detail-eyebrow">Library</p>
          <h1 className="view-title">Albums</h1>
          <p className="view-sub">{albums.length} albums</p>
        </div>
      </header>

      {albums.length === 0 ? (
        <p className="muted">No albums yet — import some music first.</p>
      ) : (
        <div className="card-grid">
          {albums.map((album) => (
            <div
              key={album.key}
              className="media-card card"
              role="button"
              tabIndex={0}
              onClick={() => setView({ kind: 'album', id: album.key })}
              onKeyDown={(event) => event.key === 'Enter' && setView({ kind: 'album', id: album.key })}
            >
              <div className="media-art">
                <Cover src={album.cover} size={168} seed={album.album} alt={album.album} />
                <button
                  type="button"
                  className="card-play"
                  title="Play album"
                  onClick={(event) => {
                    event.stopPropagation()
                    playTracks(album.tracks.map((track) => track.id), 0)
                  }}
                >
                  <Icon name="play" size={16} />
                </button>
              </div>
              <span className="media-title">{album.album}</span>
              <span className="media-sub">
                {album.albumArtist} · {album.tracks.length} tracks
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AlbumDetail({ id }: { id: string }) {
  const tracks = useStore((state) => state.tracks)
  const playTracks = useStore((state) => state.playTracks)
  const addToQueue = useStore((state) => state.addToQueue)
  const toggleLike = useStore((state) => state.toggleLike)
  const setView = useStore((state) => state.setView)
  const album = useMemo(() => groupAlbums(tracks).find((item) => item.key === id), [tracks, id])

  if (!album) return <p className="muted">Album not found.</p>

  const ids = album.tracks.map((track) => track.id)
  const info = splitAlbumKey(album.key)

  return (
    <div className="view">
      <button type="button" className="link back" onClick={() => setView({ kind: 'albums' })}>
        <Icon name="arrow-left" size={15} /> Albums
      </button>

      <header className="detail-head">
        <Cover src={album.cover} size={196} seed={album.album} alt={album.album} className="detail-cover" />
        <div className="detail-info">
          <p className="detail-eyebrow">Album</p>
          <h1 className="detail-title">{album.album}</h1>
          <p className="detail-meta">
            <button type="button" className="link" onClick={() => setView({ kind: 'artist', id: info.albumArtist })}>
              {info.albumArtist}
            </button>
            {album.year ? ` · ${album.year}` : ''} · {album.tracks.length} tracks · {formatTotalDuration(album.duration)}
          </p>
          <div className="detail-actions">
            <button type="button" className="btn primary" onClick={() => playTracks(ids, 0)}>
              <Icon name="play" size={15} /> Play
            </button>
            <button type="button" className="btn ghost" onClick={() => playTracks(shuffleArray(ids), 0)}>
              <Icon name="shuffle" size={15} /> Shuffle
            </button>
            <button type="button" className="btn ghost" onClick={() => addToQueue(ids)}>
              <Icon name="queue" size={15} /> Queue
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => ids.forEach((trackId) => !useStore.getState().favorites.includes(trackId) && toggleLike(trackId))}
            >
              <Icon name="heart" size={15} /> Like all
            </button>
          </div>
        </div>
      </header>

      <SongTable tracks={album.tracks} onPlay={(index) => playTracks(ids, index)} />
    </div>
  )
}

/* ------------------------------- Artists ------------------------------- */

function ArtistsView() {
  const tracks = useStore((state) => state.tracks)
  const setView = useStore((state) => state.setView)
  const artists = useMemo(() => groupArtists(tracks), [tracks])

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="detail-eyebrow">Library</p>
          <h1 className="view-title">Artists</h1>
          <p className="view-sub">{artists.length} artists</p>
        </div>
      </header>

      {artists.length === 0 ? (
        <p className="muted">No artists yet.</p>
      ) : (
        <div className="card-grid tight">
          {artists.map((artist) => (
            <button
              key={artist.name}
              type="button"
              className="artist-card"
              onClick={() => setView({ kind: 'artist', id: artist.name })}
            >
              <Cover src={artist.tracks[0]?.cover} size={104} seed={artist.name} alt={artist.name} circle />
              <span className="media-title">{artist.name}</span>
              <span className="media-sub">{artist.albums} albums · {artist.tracks.length} tracks</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ArtistDetail({ id }: { id: string }) {
  const tracks = useStore((state) => state.tracks)
  const playTracks = useStore((state) => state.playTracks)
  const setView = useStore((state) => state.setView)

  const artistTracks = useMemo(() => tracks.filter((track) => track.artist === id), [tracks, id])
  const albums = useMemo(() => groupAlbums(artistTracks), [artistTracks])
  const top = useMemo(
    () => [...artistTracks].sort((a, b) => b.duration - a.duration).slice(0, 6),
    [artistTracks],
  )

  if (!artistTracks.length) return <p className="muted">Artist not found.</p>

  return (
    <div className="view">
      <button type="button" className="link back" onClick={() => setView({ kind: 'artists' })}>
        <Icon name="arrow-left" size={15} /> Artists
      </button>

      <header className="detail-head artist-head">
        <Cover src={artistTracks[0]?.cover} size={186} seed={id} alt={id} circle />
        <div className="detail-info">
          <p className="detail-eyebrow">Artist</p>
          <h1 className="detail-title">{id}</h1>
          <p className="detail-meta">
            {artistTracks.length} tracks · {albums.length} albums ·{' '}
            {formatTotalDuration(artistTracks.reduce((sum, track) => sum + track.duration, 0))}
          </p>
          <div className="detail-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => playTracks(shuffleArray(artistTracks.map((track) => track.id)), 0)}
            >
              <Icon name="shuffle" size={15} /> Shuffle artist
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => playTracks(artistTracks.map((track) => track.id), 0)}
            >
              <Icon name="play" size={15} /> Play all
            </button>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="section-head">
          <h2>Popular</h2>
        </div>
        <SongTable tracks={top} onPlay={(index) => playTracks(top.map((track) => track.id), index)} showIndex={false} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Albums</h2>
        </div>
        <div className="row-scroll">
          {albums.map((album) => (
            <button
              key={album.key}
              type="button"
              className="media-card"
              onClick={() => setView({ kind: 'album', id: album.key })}
            >
              <div className="media-art">
                <Cover src={album.cover} size={140} seed={album.album} alt={album.album} />
              </div>
              <span className="media-title">{album.album}</span>
              <span className="media-sub">{album.year ?? `${album.tracks.length} tracks`}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ------------------------------- Playlists ------------------------------- */

function PlaylistsView() {
  const playlists = useStore((state) => state.playlists)
  const createPlaylist = useStore((state) => state.createPlaylist)
  const setView = useStore((state) => state.setView)
  const importPlaylistFile = useStore((state) => state.importPlaylistFile)
  const allTracks = useStore((state) => state.tracks)
  const [name, setName] = useState('')

  const trackMap = useMemo(() => new Map(allTracks.map((track) => [track.id, track])), [allTracks])

  const create = (): void => {
    const id = createPlaylist(name || `Playlist ${playlists.length + 1}`)
    setName('')
    setView({ kind: 'playlist', id })
  }

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="detail-eyebrow">Collection</p>
          <h1 className="view-title">Playlists</h1>
          <p className="view-sub">{playlists.length} playlists</p>
        </div>
        <div className="view-actions">
          <button type="button" className="btn ghost" onClick={() => void importPlaylistFile()}>
            <Icon name="download" size={15} /> Import .m3u
          </button>
        </div>
      </header>

      <div className="toolbar">
        <div className="input-wrap">
          <Icon name="playlist" size={16} />
          <input
            className="input"
            placeholder="Name a new playlist…"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && create()}
          />
        </div>
        <button type="button" className="btn primary" onClick={create}>
          <Icon name="plus" size={15} /> Create
        </button>
      </div>

      {playlists.length === 0 ? (
        <p className="muted">Create a playlist or import an .m3u file.</p>
      ) : (
        <div className="card-grid">
          {playlists.map((playlist) => {
            const covers = playlist.trackIds
              .map((trackId) => trackMap.get(trackId)?.cover ?? null)
              .filter((cover): cover is string => Boolean(cover))
              .slice(0, 1)
            return (
              <button
                key={playlist.id}
                type="button"
                className="media-card card"
                onClick={() => setView({ kind: 'playlist', id: playlist.id })}
              >
                <div className="media-art">
                  <Cover src={playlist.cover ?? covers[0]} size={168} seed={playlist.name} alt={playlist.name} />
                  <span className="card-badge">{playlist.trackIds.length} tracks</span>
                </div>
                <span className="media-title">{playlist.name}</span>
                <span className="media-sub">Playlist</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PlaylistDetail({ id }: { id: string }) {
  const playlist = useStore((state) => state.playlists.find((item) => item.id === id))
  const tracks = useStore((state) => state.tracks)
  const playTracks = useStore((state) => state.playTracks)
  const reorderPlaylist = useStore((state) => state.reorderPlaylist)
  const removeFromPlaylist = useStore((state) => state.removeFromPlaylist)
  const renamePlaylist = useStore((state) => state.renamePlaylist)
  const deletePlaylist = useStore((state) => state.deletePlaylist)
  const exportPlaylistFile = useStore((state) => state.exportPlaylistFile)
  const setPlaylistCover = useStore((state) => state.setPlaylistCover)
  const showToast = useStore((state) => state.showToast)
  const setView = useStore((state) => state.setView)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(playlist?.name ?? '')

  const tracksInPlaylist = useMemo(() => {
    if (!playlist) return []
    const map = new Map(tracks.map((track) => [track.id, track]))
    return playlist.trackIds.map((trackId) => map.get(trackId)).filter((track): track is Track => Boolean(track))
  }, [playlist, tracks])

  if (!playlist) return <p className="muted">Playlist not found.</p>

  const ids = playlist.trackIds.filter((trackId) => tracks.some((track) => track.id === trackId))
  const cover = playlist.cover ?? tracksInPlaylist.find((track) => track.cover)?.cover ?? null
  const total = tracksInPlaylist.reduce((sum, track) => sum + track.duration, 0)

  const chooseCover = async (): Promise<void> => {
    try {
      const image = await api.library.pickImage()
      if (!image) return
      setPlaylistCover(playlist.id, image)
      showToast('Playlist cover updated')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not set that image')
    }
  }

  return (
    <div className="view">
      <button type="button" className="link back" onClick={() => setView({ kind: 'playlists' })}>
        <Icon name="arrow-left" size={15} /> Playlists
      </button>

      <header className="detail-head">
        <button type="button" className="detail-cover-btn" onClick={() => void chooseCover()} title="Change cover image">
          <Cover src={cover} size={196} seed={playlist.name} alt={playlist.name} className="detail-cover" />
          <span className="detail-cover-edit">
            <Icon name="image" size={15} /> Change cover
          </span>
        </button>
        <div className="detail-info">
          <p className="detail-eyebrow">Playlist</p>
          {editing ? (
            <input
              className="detail-title-input"
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => {
                renamePlaylist(playlist.id, draft)
                setEditing(false)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  renamePlaylist(playlist.id, draft)
                  setEditing(false)
                }
                if (event.key === 'Escape') setEditing(false)
              }}
            />
          ) : (
            <h1 className="detail-title" onDoubleClick={() => { setDraft(playlist.name); setEditing(true) }}>
              {playlist.name}
            </h1>
          )}
          <p className="detail-meta">
            {ids.length} tracks · {formatTotalDuration(total)}
          </p>
          <div className="detail-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => ids.length && playTracks(ids, 0)}
              disabled={!ids.length}
            >
              <Icon name="play" size={15} /> Play
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => ids.length && playTracks(shuffleArray(ids), 0)}
              disabled={!ids.length}
            >
              <Icon name="shuffle" size={15} /> Shuffle
            </button>
            <button type="button" className="btn ghost" onClick={() => setEditing(true)}>
              <Icon name="settings" size={15} /> Rename
            </button>
            <button type="button" className="btn ghost" onClick={() => void chooseCover()}>
              <Icon name="image" size={15} /> Cover
            </button>
            <button type="button" className="btn ghost" onClick={() => void exportPlaylistFile(playlist.id)}>
              <Icon name="download" size={15} /> Export
            </button>
            <button type="button" className="btn ghost danger" onClick={() => deletePlaylist(playlist.id)}>
              <Icon name="trash" size={15} /> Delete
            </button>
          </div>
        </div>
      </header>

      <SongTable
        tracks={tracksInPlaylist}
        onPlay={(index) => playTracks(ids, index)}
        reorder={(from, to) => reorderPlaylist(playlist.id, from, to)}
        onRemove={(trackId) => removeFromPlaylist(playlist.id, trackId)}
        emptyLabel="Add songs from your library with the ⋯ menu"
      />
      {tracksInPlaylist.length > 0 && <p className="muted small-note">Drag rows to reorder this playlist.</p>}
    </div>
  )
}

function FavoritesView() {
  const favorites = useStore((state) => state.favorites)
  const tracks = useStore((state) => state.tracks)
  const playTracks = useStore((state) => state.playTracks)

  const liked = useMemo(() => {
    const map = new Map(tracks.map((track) => [track.id, track]))
    return favorites.map((trackId) => map.get(trackId)).filter((track): track is Track => Boolean(track))
  }, [favorites, tracks])

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="detail-eyebrow">Collection</p>
          <h1 className="view-title">Liked songs</h1>
          <p className="view-sub">
            {liked.length} tracks · {formatTotalDuration(liked.reduce((sum, track) => sum + track.duration, 0))}
          </p>
        </div>
        <div className="view-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => liked.length && playTracks(liked.map((track) => track.id), 0)}
          >
            <Icon name="play" size={15} /> Play
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => liked.length && playTracks(shuffleArray(liked.map((track) => track.id)), 0)}
          >
            <Icon name="shuffle" size={15} /> Shuffle
          </button>
        </div>
      </header>

      <SongTable
        tracks={liked}
        onPlay={(index) => playTracks(liked.map((track) => track.id), index)}
        emptyLabel="Tap the heart on any song to keep it here"
      />
    </div>
  )
}

/* ------------------------------- Search ------------------------------- */

function SearchView() {
  const search = useStore((state) => state.search)
  const setSearch = useStore((state) => state.setSearch)
  const tracks = useStore((state) => state.tracks)
  const playlists = useStore((state) => state.playlists)
  const playTracks = useStore((state) => state.playTracks)
  const setView = useStore((state) => state.setView)

  const songs = useMemo(
    () => (search ? tracks.filter((track) => matches(search, track.title, track.artist, track.album, track.genre)) : []),
    [search, tracks],
  )
  const albums = useMemo(() => {
    if (!search) return []
    return groupAlbums(tracks).filter((album) => matches(search, album.album, album.albumArtist))
  }, [search, tracks])
  const artists = useMemo(() => {
    if (!search) return []
    return groupArtists(tracks).filter((artist) => matches(search, artist.name))
  }, [search, tracks])
  const foundPlaylists = useMemo(
    () => (search ? playlists.filter((playlist) => matches(search, playlist.name)) : []),
    [search, playlists],
  )

  const total = songs.length + albums.length + artists.length + foundPlaylists.length

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="detail-eyebrow">Search</p>
          <h1 className="view-title">Find anything</h1>
          <p className="view-sub">{search ? `${total} results for “${search}”` : 'Songs, albums, artists and playlists'}</p>
        </div>
      </header>

      <div className="search-hero">
        <div className="input-wrap large">
          <Icon name="search" size={20} />
          <input
            className="input"
            placeholder="Search your library…"
            value={search}
            autoFocus
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {!search && <p className="muted">Start typing to search across your whole library.</p>}

      {albums.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Albums</h2>
          </div>
          <div className="card-grid">
            {albums.slice(0, 8).map((album) => (
              <button
                key={album.key}
                type="button"
                className="media-card card"
                onClick={() => setView({ kind: 'album', id: album.key })}
              >
                <div className="media-art">
                  <Cover src={album.cover} size={148} seed={album.album} alt={album.album} />
                </div>
                <span className="media-title">{album.album}</span>
                <span className="media-sub">{album.albumArtist}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {artists.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Artists</h2>
          </div>
          <div className="row-scroll">
            {artists.slice(0, 10).map((artist) => (
              <button
                key={artist.name}
                type="button"
                className="media-card"
                onClick={() => setView({ kind: 'artist', id: artist.name })}
              >
                <div className="media-art">
                  <Cover src={artist.tracks[0]?.cover} size={128} seed={artist.name} alt={artist.name} circle />
                </div>
                <span className="media-title">{artist.name}</span>
                <span className="media-sub">Artist</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {foundPlaylists.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Playlists</h2>
          </div>
          <div className="row-scroll">
            {foundPlaylists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                className="media-card"
                onClick={() => setView({ kind: 'playlist', id: playlist.id })}
              >
                <div className="media-art">
                  <Cover size={128} seed={playlist.name} alt={playlist.name} />
                </div>
                <span className="media-title">{playlist.name}</span>
                <span className="media-sub">{playlist.trackIds.length} tracks</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {songs.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Songs</h2>
            <button
              type="button"
              className="link subtle"
              onClick={() => playTracks(songs.map((track) => track.id), 0)}
            >
              Play all {songs.length}
            </button>
          </div>
          <SongTable
            tracks={songs.slice(0, 100)}
            onPlay={(index) => playTracks(songs.map((track) => track.id), index)}
            showIndex={false}
          />
        </section>
      )}

      {search && total === 0 && <p className="muted">Nothing matched that search.</p>}
    </div>
  )
}
