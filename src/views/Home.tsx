import { useEffect, useMemo, useState } from 'react'
import { Cover } from '../components/Cover'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icons'
import { MediaCard } from '../components/MediaCard'
import { SongTable } from '../components/SongTable'
import { pickGreeting } from '../greetings'
import { getStore, useStore } from '../store/useStore'
import type { Track } from '../types'
import { formatTotalDuration, groupAlbums, plural, shuffleArray } from '../utils'

const APP_STARTED_AT = Date.now()

function suggestionsNow(): Track[] {
  const state = getStore()
  const recentIds = new Set(state.history.slice(0, 12).map((entry) => entry.id))
  return pickSuggestions(state.tracks, recentIds, (track) => state.stats[track.id]?.plays ?? 0)
}

function greetingNow(firstLaunch: boolean, returning: boolean, lastShownId: number | null) {
  const now = new Date()
  return pickGreeting({
    hour: now.getHours(),
    isWeekend: [0, 6].includes(now.getDay()),
    firstLaunch,
    returning,
    // A session counts as long once the app has been open and playing for an hour.
    longSession: getStore().isPlaying && now.getTime() - APP_STARTED_AT > 60 * 60 * 1000,
    lastShownId,
  })
}

/** Picks tracks you have not heard lately, favouring the least played. */
function pickSuggestions(tracks: Track[], recentIds: Set<string>, plays: (track: Track) => number): Track[] {
  const pool = tracks.filter((track) => !recentIds.has(track.id))
  const sorted = [...pool].sort((a, b) => plays(a) - plays(b))
  const cold = shuffleArray(sorted.slice(0, Math.max(24, Math.ceil(sorted.length * 0.4))))
  // Take one song per album first, so the row is not a single album.
  const seen = new Set<string>()
  const varied: Track[] = []
  const rest: Track[] = []
  for (const track of cold) {
    if (seen.has(track.album)) rest.push(track)
    else {
      seen.add(track.album)
      varied.push(track)
    }
  }
  return [...varied, ...rest].slice(0, 12)
}

export function HomeView() {
  const tracks = useStore((state) => state.tracks)
  const history = useStore((state) => state.history)
  const stats = useStore((state) => state.stats)
  const settings = useStore((state) => state.settings)
  const firstLaunchSession = useStore((state) => state.firstLaunchSession)
  const returningSession = useStore((state) => state.returningSession)
  const scanning = useStore((state) => state.scanning)
  const s = getStore()

  const byId = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks])

  const recent = useMemo(
    () =>
      history
        .map((entry) => byId.get(entry.id))
        .filter((track): track is Track => Boolean(track))
        .slice(0, 12),
    [history, byId],
  )
  const recentlyAdded = useMemo(() => [...tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, 8), [tracks])
  const topTracks = useMemo(
    () =>
      Object.entries(stats)
        .sort((a, b) => b[1].plays - a[1].plays)
        .map(([id]) => byId.get(id))
        .filter((track): track is Track => Boolean(track))
        .slice(0, 6),
    [stats, byId],
  )
  const albums = useMemo(() => groupAlbums(tracks), [tracks])
  const totalDuration = useMemo(() => tracks.reduce((sum, track) => sum + track.duration, 0), [tracks])

  // Suggestions are chosen once per visit (and when the library size changes),
  // so playing one of them does not reshuffle the row under the cursor.
  const [suggested, setSuggested] = useState<{ size: number; list: Track[] }>({ size: -1, list: [] })
  if (suggested.size !== tracks.length) {
    setSuggested({ size: tracks.length, list: suggestionsNow() })
  }

  const [greeting] = useState(() => greetingNow(firstLaunchSession, returningSession, settings.lastGreetingId ?? null))
  useEffect(() => {
    if (getStore().settings.lastGreetingId !== greeting.id) {
      getStore().updateSettings({ lastGreetingId: greeting.id })
    }
  }, [greeting.id])

  if (!tracks.length) {
    return (
      <div className="view">
        <EmptyState
          title="Your library is empty"
          actions={
            <button type="button" className="btn primary" onClick={() => void s.addFolders()} disabled={scanning}>
              <Icon name="folder" size={16} /> {scanning ? 'Scanning…' : 'Add a music folder'}
            </button>
          }
          foot="MP3 · FLAC · M4A · AAC · WAV · OGG · OPUS · WMA · AIFF"
        >
          Point MeowPlayer at a folder of music and it reads titles, artists, albums and artwork for you. You can also
          drop files or folders anywhere on this window.
        </EmptyState>
      </div>
    )
  }

  const heroCover = recent[0]?.cover ?? albums.find((album) => album.cover)?.cover

  return (
    <div className="view">
      <section className="hero">
        <div className="hero-text">
          <h1 className="hero-title">
            <span className="hero-icon" aria-hidden="true">
              {greeting.icon}
            </span>
            {greeting.text}
          </h1>
          <p className="hero-sub">
            {plural(tracks.length, 'track')} · {plural(albums.length, 'album')} · {formatTotalDuration(totalDuration)} of music
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                if (!getStore().shuffle) s.toggleShuffle()
                s.playTracks(tracks.map((track) => track.id), Math.floor(Math.random() * tracks.length))
              }}
            >
              <Icon name="shuffle" size={16} /> Shuffle everything
            </button>
            {recent[0] && (
              <button type="button" className="btn ghost" onClick={() => s.playTracks(recent.map((track) => track.id), 0)}>
                <Icon name="history" size={16} /> Pick up where you left off
              </button>
            )}
          </div>
        </div>
        <div className="hero-art">
          <Cover src={heroCover} size={176} seed="MeowPlayer" alt="" />
        </div>
      </section>

      {suggested.list.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Suggested for you</h2>
            <button type="button" className="link subtle" onClick={() => s.setView({ kind: 'songs' })}>
              Browse all songs
            </button>
          </div>
          <div className="row-scroll">
            {suggested.list.map((track, index) => (
              <MediaCard
                key={track.id}
                title={track.title}
                subtitle={track.artist}
                cover={track.cover}
                seed={track.album}
                onPlay={() => s.playTracks(suggested.list.map((item) => item.id), index)}
              />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Recently played</h2>
            <button type="button" className="link subtle" onClick={() => s.setView({ kind: 'smart', id: 'recent-played' })}>
              Show all
            </button>
          </div>
          <div className="row-scroll">
            {recent.map((track, index) => (
              <MediaCard
                key={track.id}
                title={track.title}
                subtitle={track.artist}
                cover={track.cover}
                seed={track.album}
                onPlay={() => s.playTracks(recent.map((item) => item.id), index)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="split">
        <section className="section grow">
          <div className="section-head">
            <h2>Recently added</h2>
            <button type="button" className="link subtle" onClick={() => s.setView({ kind: 'smart', id: 'recent-added' })}>
              Show all
            </button>
          </div>
          <SongTable
            tracks={recentlyAdded}
            onPlay={(index) => s.playTracks(recentlyAdded.map((track) => track.id), index)}
            showIndex={false}
          />
        </section>

        <section className="section side">
          <div className="section-head">
            <h2>Most played</h2>
            {topTracks.length > 0 && (
              <button type="button" className="link subtle" onClick={() => s.setView({ kind: 'stats' })}>
                Stats
              </button>
            )}
          </div>
          {topTracks.length === 0 && <p className="muted">Play a few songs and your favourites show up here.</p>}
          <ol className="stat-list">
            {topTracks.map((track, index) => (
              <li key={track.id}>
                <button
                  type="button"
                  className="stat-row"
                  onClick={() => s.playTracks(topTracks.map((item) => item.id), index)}
                >
                  <span className="stat-rank">{index + 1}</span>
                  <Cover src={track.cover} size={40} seed={track.album} alt="" />
                  <span className="stat-text">
                    <span className="title-name">{track.title}</span>
                    <span className="title-artist">{track.artist}</span>
                  </span>
                  <span className="stat-plays">{plural(stats[track.id]?.plays ?? 0, 'play')}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {albums.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Albums</h2>
            <button type="button" className="link subtle" onClick={() => s.setView({ kind: 'albums' })}>
              Show all
            </button>
          </div>
          <div className="row-scroll">
            {albums.slice(0, 14).map((album) => (
              <MediaCard
                key={album.key}
                title={album.album}
                subtitle={album.albumArtist}
                cover={album.cover}
                seed={album.album}
                onOpen={(art) => s.setView({ kind: 'album', id: album.key }, art)}
                onPlay={() => s.playTracks(album.tracks.map((track) => track.id), 0)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
