import { useMemo, useState } from 'react'
import { api } from '../api'
import { useClock } from '../hooks'
import { computeStreak, listenedIn, playsIn, STREAK_MINUTES, type StatsRange } from '../stats'
import { Cover } from '../components/Cover'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icons'
import { MediaCard } from '../components/MediaCard'
import { TypeSearchPill, useTypeToSearch } from '../components/TypeSearch'
import { SongTable } from '../components/SongTable'
import { getStore, useStore } from '../store/useStore'
import type { SmartList, Track } from '../types'
import { albumKey, cx, dayKey, formatTotalDuration, groupAlbums, groupArtists, matches, plural } from '../utils'
import { DetailHeader, PlayButtons, ViewHeader } from './common'

const total = (tracks: Track[]): number => tracks.reduce((sum, track) => sum + track.duration, 0)

/* ------------------------------- playlists ------------------------------- */

export function PlaylistsView() {
  const playlists = useStore((state) => state.playlists)
  const tracks = useStore((state) => state.tracks)
  const [name, setName] = useState('')
  const s = getStore()
  const byId = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks])

  const create = (): void => {
    const id = s.createPlaylist(name || `Playlist ${playlists.length + 1}`)
    setName('')
    s.setView({ kind: 'playlist', id })
  }

  return (
    <div className="view">
      <ViewHeader
        eyebrow="Collection"
        title="Playlists"
        sub={plural(playlists.length, 'playlist')}
        actions={
          <>
            <button type="button" className="btn ghost" onClick={() => s.setSpotifyImportOpen(true)}>
              <Icon name="link" size={15} /> From Spotify
            </button>
            <button type="button" className="btn ghost" onClick={() => void s.importPlaylistFile()}>
              <Icon name="download" size={15} /> Import .m3u
            </button>
          </>
        }
      />

      <div className="toolbar">
        <label className="input-wrap">
          <Icon name="playlist" size={15} />
          <input
            className="input"
            placeholder="Name a new playlist"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && create()}
          />
        </label>
        <button type="button" className="btn primary" onClick={create}>
          <Icon name="plus" size={15} /> Create
        </button>
      </div>

      {playlists.length === 0 ? (
        <EmptyState title="No playlists yet">Create one above, or use Add to playlist on any song.</EmptyState>
      ) : (
        <div className="card-grid">
          {playlists.map((playlist) => {
            const cover = playlist.cover ?? playlist.trackIds.map((id) => byId.get(id)?.cover).find(Boolean) ?? null
            return (
              <MediaCard
                key={playlist.id}
                title={playlist.name}
                subtitle={plural(playlist.trackIds.length, 'song')}
                cover={cover}
                seed={playlist.name}
                onOpen={(art) => s.setView({ kind: 'playlist', id: playlist.id }, art)}
                onPlay={
                  playlist.trackIds.length
                    ? () => s.playTracks(playlist.trackIds.filter((id) => byId.has(id)), 0)
                    : undefined
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export function PlaylistDetail({ id }: { id: string }) {
  const playlist = useStore((state) => state.playlists.find((item) => item.id === id))
  const tracks = useStore((state) => state.tracks)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const s = getStore()

  // Rows keep the position they have in the stored playlist, so reordering and
  // removing work even when some of its tracks are no longer in the library.
  const rows = useMemo(() => {
    if (!playlist) return []
    const byId = new Map(tracks.map((track) => [track.id, track]))
    return playlist.trackIds
      .map((trackId, index) => ({ track: byId.get(trackId), index }))
      .filter((row): row is { track: Track; index: number } => Boolean(row.track))
  }, [playlist, tracks])

  if (!playlist) {
    return (
      <div className="view">
        <EmptyState title="Playlist not found">It may have been deleted.</EmptyState>
      </div>
    )
  }

  const list = rows.map((row) => row.track)
  const ids = list.map((track) => track.id)
  const missing = playlist.trackIds.length - rows.length
  const cover = playlist.cover ?? list.find((track) => track.cover)?.cover ?? null

  const chooseCover = async (): Promise<void> => {
    const image = await api.library.pickImage()
    if (!image) return
    s.setPlaylistCover(playlist.id, image)
    s.showToast('Playlist cover updated')
  }
  const rename = (): void => {
    s.renamePlaylist(playlist.id, draft)
    setEditing(false)
  }

  return (
    <div className="view detail-view">
      <DetailHeader
        back={{ label: 'Playlists', onClick: () => s.setView({ kind: 'playlists' }) }}
        eyebrow="Playlist"
        plainTitle={playlist.name}
        title={
          editing ? (
            <input
              className="detail-title-input"
              value={draft}
              autoFocus
              aria-label="Playlist name"
              onChange={(event) => setDraft(event.target.value)}
              onBlur={rename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') rename()
                if (event.key === 'Escape') setEditing(false)
              }}
            />
          ) : (
            <span
              className="editable"
              title="Double-click to rename"
              onDoubleClick={() => {
                setDraft(playlist.name)
                setEditing(true)
              }}
            >
              {playlist.name}
            </span>
          )
        }
        cover={cover}
        onPlay={() => ids.length && s.playTracks(ids, 0)}
        renderCover={(art) => (
          <button type="button" className="detail-cover-btn" onClick={() => void chooseCover()} title="Change cover">
            {art}
            <span className="detail-cover-edit">
              <Icon name="image" size={15} /> Change cover
            </span>
          </button>
        )}
        meta={
          <>
            {plural(list.length, 'song')} · {formatTotalDuration(total(list))}
            {missing > 0 ? ` · ${missing} missing from the library` : ''}
          </>
        }
        actions={
          <PlayButtons
            ids={ids}
            extra={
              <>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setDraft(playlist.name)
                    setEditing(true)
                  }}
                >
                  <Icon name="edit" size={15} /> Rename
                </button>
                <button type="button" className="btn ghost" onClick={() => void s.exportPlaylistFile(playlist.id)}>
                  <Icon name="external" size={15} /> Export
                </button>
                <button
                  type="button"
                  className={cx('btn ghost', confirmDelete && 'danger')}
                  onClick={() => {
                    if (confirmDelete) s.deletePlaylist(playlist.id)
                    else {
                      setConfirmDelete(true)
                      window.setTimeout(() => setConfirmDelete(false), 4000)
                    }
                  }}
                >
                  <Icon name="trash" size={15} /> {confirmDelete ? 'Click again to delete' : 'Delete'}
                </button>
              </>
            }
          />
        }
      />

      <SongTable
        tracks={list}
        onPlay={(index) => s.playTracks(ids, index)}
        reorder={(from, to) => s.reorderPlaylist(playlist.id, rows[from].index, rows[to].index)}
        onRemove={(indices) => {
          // Remove from the end so earlier positions stay valid.
          const stored = indices.map((index) => rows[index]?.index).filter((index) => index !== undefined)
          for (const index of stored.sort((a, b) => b - a)) s.removeFromPlaylist(playlist.id, index)
        }}
        emptyLabel="Add songs with the ⋯ menu or by right-clicking any song"
      />
      {list.length > 1 && <p className="muted small note">Drag songs to reorder. Select several with Ctrl or Shift.</p>}
    </div>
  )
}

/* --------------------------------- liked --------------------------------- */

export function FavoritesView() {
  const favorites = useStore((state) => state.favorites)
  const tracks = useStore((state) => state.tracks)
  const s = getStore()
  const [query, setQuery] = useTypeToSearch()
  const allLiked = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]))
    return [...favorites]
      .reverse()
      .map((id) => byId.get(id))
      .filter((track): track is Track => Boolean(track))
  }, [favorites, tracks])
  const liked = useMemo(
    () =>
      query ? allLiked.filter((track) => matches(query, track.title, track.artist, track.album, track.genre)) : allLiked,
    [allLiked, query],
  )
  const ids = liked.map((track) => track.id)

  return (
    <div className="view">
      <ViewHeader
        eyebrow="Collection"
        title="Liked songs"
        sub={`${plural(liked.length, 'song')} · ${formatTotalDuration(total(liked))}`}
        actions={<PlayButtons ids={ids} />}
      />
      <TypeSearchPill query={query} count={liked.length} onClear={() => setQuery('')} />
      {allLiked.length === 0 ? (
        <EmptyState title="No liked songs yet">Tap the heart on any song (or press L while it plays) to keep it here.</EmptyState>
      ) : (
        <SongTable tracks={liked} onPlay={(index) => s.playTracks(ids, index)} emptyLabel="No liked songs match" />
      )}
    </div>
  )
}

/* ---------------------------- smart playlists ---------------------------- */

function relativeTime(at: number | undefined, now: number): string {
  if (!at) return ''
  const minutes = Math.round((now - at) / 60000)
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return formatDate(at)
}

const formatDate = (at: number): string => new Date(at).toLocaleDateString()

/** The last `count` days ending today, oldest first. */
function lastDays(now: number, count: number, log: Record<string, number>) {
  const out: { key: string; label: string; seconds: number }[] = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const key = dayKey(date.getTime())
    out.push({
      key,
      label: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      seconds: log[key] ?? 0,
    })
  }
  return out
}

const SMART: Record<SmartList, { title: string; sub: string }> = {
  'recent-added': { title: 'Recently added', sub: 'The newest 100 songs in your library' },
  'most-played': { title: 'Most played', sub: 'Your 100 most played songs' },
  'recent-played': { title: 'Recently played', sub: 'The last songs you listened to' },
}

export function SmartView({ id }: { id: SmartList }) {
  const tracks = useStore((state) => state.tracks)
  const stats = useStore((state) => state.stats)
  const history = useStore((state) => state.history)
  const s = getStore()

  const list = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]))
    if (id === 'recent-added') return [...tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, 100)
    if (id === 'most-played') {
      return Object.entries(stats)
        .filter(([, entry]) => entry.plays > 0)
        .sort((a, b) => b[1].plays - a[1].plays)
        .map(([trackId]) => byId.get(trackId))
        .filter((track): track is Track => Boolean(track))
        .slice(0, 100)
    }
    return history
      .map((entry) => byId.get(entry.id))
      .filter((track): track is Track => Boolean(track))
      .slice(0, 100)
  }, [id, tracks, stats, history])

  const ids = list.map((track) => track.id)
  const info = SMART[id]
  const now = useClock(60_000)

  return (
    <div className="view">
      <ViewHeader
        eyebrow="Smart playlist"
        title={info.title}
        sub={`${info.sub} · ${plural(list.length, 'song')}`}
        actions={<PlayButtons ids={ids} />}
      />
      {list.length === 0 ? (
        <EmptyState title="Nothing here yet">This list fills up by itself as you add and play music.</EmptyState>
      ) : (
        <SongTable
          tracks={list}
          onPlay={(index) => s.playTracks(ids, index)}
          extra={
            id === 'most-played'
              ? { label: 'Plays', render: (track) => plural(stats[track.id]?.plays ?? 0, 'play') }
              : id === 'recent-played'
                ? { label: 'Last played', render: (track) => relativeTime(stats[track.id]?.lastPlayed, now) }
                : { label: 'Added', render: (track) => formatDate(track.addedAt) }
          }
        />
      )}
    </div>
  )
}

/* --------------------------------- stats --------------------------------- */

const formatListen = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours) return `${hours} h ${minutes} min`
  return `${minutes} min`
}

interface ChartBar {
  key: string
  label: string
  seconds: number
}

/** The last 12 months as listening totals, for the all-time chart. */
function lastMonths(now: number, log: Record<string, number>): ChartBar[] {
  const months: ChartBar[] = []
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(now)
    date.setDate(1)
    date.setMonth(date.getMonth() - i)
    const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const seconds = Object.entries(log)
      .filter(([key]) => key.startsWith(prefix))
      .reduce((sum, [, value]) => sum + value, 0)
    months.push({ key: prefix, label: date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }), seconds })
  }
  return months
}

const RANGES: { id: StatsRange; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All time' },
]

function ListeningChart({ log, range }: { log: Record<string, number>; range: StatsRange }) {
  const [hover, setHover] = useState<number | null>(null)
  const today = useClock(60 * 60_000)
  const bars = useMemo(
    () => (range === 'all' ? lastMonths(today, log) : lastDays(today, range === '7d' ? 7 : 30, log)),
    [today, log, range],
  )

  const floor = range === 'all' ? 60 * 60 * 5 : 60 * 30
  const max = Math.max(floor, ...bars.map((bar) => bar.seconds))
  const step = max > 60 * 3600 ? 3600 * 20 : max > 10 * 3600 ? 3600 * 5 : max > 3 * 3600 ? 3600 : max > 3600 ? 1800 : 900
  const lines: number[] = []
  for (let value = step; value <= max; value += step) lines.push(value)
  const title =
    range === 'all' ? 'Hours listened per month' : `Minutes listened, last ${range === '7d' ? '7' : '30'} days`

  return (
    <figure className="chart">
      <figcaption className="chart-title">{title}</figcaption>
      <div className="chart-plot" onPointerLeave={() => setHover(null)}>
        {lines.map((value) => (
          <div key={value} className="chart-grid" style={{ bottom: `${(value / max) * 100}%` }}>
            <span>{value >= 3600 ? `${value / 3600} h` : `${value / 60} m`}</span>
          </div>
        ))}
        <div className={cx('chart-bars', bars.length <= 12 && 'wide')}>
          {bars.map((bar, index) => (
            <div
              key={bar.key}
              className={cx('chart-col', hover === index && 'hover')}
              onPointerEnter={() => setHover(index)}
              aria-label={`${bar.label}: ${formatListen(bar.seconds)}`}
              role="img"
            >
              <span className="chart-bar" style={{ height: `${Math.max(bar.seconds ? 2 : 0, (bar.seconds / max) * 100)}%` }} />
            </div>
          ))}
        </div>
        {hover !== null && bars[hover] && (
          <div className="chart-tip" style={{ left: `${((hover + 0.5) / bars.length) * 100}%` }}>
            <strong>{formatListen(bars[hover].seconds)}</strong>
            <span>{bars[hover].label}</span>
          </div>
        )}
      </div>
      <div className="chart-axis">
        <span>{bars[0].label}</span>
        <span>{range === 'all' ? 'This month' : 'Today'}</span>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.key}>
              <th scope="row">{bar.label}</th>
              <td>{Math.round(bar.seconds / 60)} minutes</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/** A Duolingo-style streak: days in a row with at least a few minutes of music. */
function StreakCard({ log }: { log: Record<string, number> }) {
  const today = useClock(60_000)
  const streak = useMemo(() => computeStreak(log, today), [log, today])
  const message = streak.today
    ? streak.current > 1
      ? 'Streak extended today. See you tomorrow!'
      : 'Day one done. Come back tomorrow to start a streak.'
    : streak.current > 0
      ? `Listen for ${STREAK_MINUTES} minutes today to keep your streak.`
      : `Listen for ${STREAK_MINUTES} minutes today to start a streak.`

  return (
    <section className={cx('streak-card', streak.today && 'lit', !streak.today && streak.current > 0 && 'at-risk')}>
      <div className="streak-flame" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="44" height="44">
          <path
            className="flame-outer"
            d="M12 2.5c.6 3.2 3.4 4.6 4.7 7.4 1.6 3.5-.2 9.6-4.7 9.6S5.6 15.9 6.9 12.5c.6-1.6 1.8-2.4 2.3-4 .4 1.4 1.3 2.2 2.1 2.6-.4-2.9.1-6.1.7-8.6z"
          />
          <path className="flame-inner" d="M12 12.2c.4 1.6 1.9 2.3 1.9 4 0 1.4-.9 2.5-1.9 2.5s-2-1-2-2.4c0-1.5 1.5-2.3 2-4.1z" />
        </svg>
      </div>
      <div className="streak-text">
        <span className="streak-count">
          {streak.current} day{streak.current === 1 ? '' : 's'}
        </span>
        <span className="streak-label">listening streak · best {streak.best}</span>
        <span className="streak-message">{message}</span>
      </div>
      <ol className="streak-week" aria-label="The last seven days">
        {streak.week.map((day) => (
          <li key={day.key} className={cx(day.done && 'done', day.isToday && 'today')} title={day.key}>
            <span className="streak-dot" />
            <span className="streak-day">{day.label}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function RankList({
  title,
  items,
}: {
  title: string
  items: { key: string; label: string; sub: string; value: number; cover?: string | null; onClick: () => void }[]
}) {
  const max = Math.max(1, ...items.map((item) => item.value))
  return (
    <section className="rank-card">
      <h2>{title}</h2>
      {items.length === 0 && <p className="muted small">Nothing yet.</p>}
      <ol className="rank-list">
        {items.map((item, index) => (
          <li key={item.key}>
            <button type="button" className="rank-row" onClick={item.onClick}>
              <span className="stat-rank">{index + 1}</span>
              <Cover src={item.cover} size={34} seed={item.label} alt="" />
              <span className="rank-text">
                <span className="title-name">{item.label}</span>
                <span className="rank-meter">
                  <span style={{ width: `${(item.value / max) * 100}%` }} />
                </span>
              </span>
              <span className="rank-value">{item.sub}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function StatsView() {
  const tracks = useStore((state) => state.tracks)
  const stats = useStore((state) => state.stats)
  const listenLog = useStore((state) => state.listenLog)
  const playLog = useStore((state) => state.playLog)
  const [range, setRange] = useState<StatsRange>('30d')
  const s = getStore()
  const today = useClock(60 * 60_000)

  const summary = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]))
    // All time uses the running totals (which include plays from before 2.2);
    // 7 and 30 days come from the dated play log.
    const perTrack =
      range === 'all'
        ? new Map(Object.entries(stats).map(([id, entry]) => [id, entry.plays]))
        : playsIn(playLog, range, today)
    let plays = 0
    const played: { track: Track; plays: number }[] = []
    for (const [id, count] of perTrack) {
      plays += count
      const track = byId.get(id)
      if (track && count > 0) played.push({ track, plays: count })
    }
    const artistPlays = new Map<string, { plays: number; cover: string | null }>()
    const albumPlays = new Map<string, { plays: number; cover: string | null; album: string }>()
    const genrePlays = new Map<string, number>()
    for (const { track, plays: count } of played) {
      const artist = artistPlays.get(track.artist) ?? { plays: 0, cover: track.cover }
      artist.plays += count
      artistPlays.set(track.artist, artist)
      const key = albumKey(track)
      const album = albumPlays.get(key) ?? { plays: 0, cover: track.cover, album: track.album }
      album.plays += count
      albumPlays.set(key, album)
      if (track.genre) genrePlays.set(track.genre, (genrePlays.get(track.genre) ?? 0) + count)
    }
    const skipped = Object.entries(stats)
      .filter(([id, entry]) => (entry.skips ?? 0) > 0 && byId.has(id))
      .sort((a, b) => (b[1].skips ?? 0) - (a[1].skips ?? 0))
      .slice(0, 6)
      .map(([id, entry]) => ({ track: byId.get(id) as Track, skips: entry.skips ?? 0 }))
    return {
      plays,
      listened: listenedIn(listenLog, range, today),
      distinct: played.length,
      artists: [...artistPlays.entries()].sort((a, b) => b[1].plays - a[1].plays).slice(0, 6),
      albums: [...albumPlays.entries()].sort((a, b) => b[1].plays - a[1].plays).slice(0, 6),
      genres: [...genrePlays.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      songs: played.sort((a, b) => b.plays - a.plays).slice(0, 6),
      skipped,
    }
  }, [tracks, stats, listenLog, playLog, range, today])

  const libraryArtists = useMemo(() => groupArtists(tracks).length, [tracks])
  const libraryAlbums = useMemo(() => groupAlbums(tracks).length, [tracks])
  const hasHistory = Object.keys(stats).length > 0 || Object.keys(listenLog).length > 0

  if (!hasHistory) {
    return (
      <div className="view">
        <ViewHeader eyebrow="Insights" title="Listening stats" />
        <EmptyState title="No listening history yet">Play some music and your stats build up here.</EmptyState>
      </div>
    )
  }

  const rangeLabel = range === '7d' ? 'in the last 7 days' : range === '30d' ? 'in the last 30 days' : 'all time'

  return (
    <div className="view">
      <ViewHeader
        eyebrow="Insights"
        title="Listening stats"
        sub="Counted on this PC only. A song counts as played after 10 seconds."
        actions={
          <div className="segmented" role="radiogroup" aria-label="Period">
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={range === item.id}
                className={cx('segment', range === item.id && 'active')}
                onClick={() => setRange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />

      <StreakCard log={listenLog} />

      <div className="stat-tiles">
        <div className="stat-tile">
          <span className="stat-label">Listening time</span>
          <span className="stat-number">{formatListen(summary.listened)}</span>
          <span className="stat-note">{rangeLabel}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Plays</span>
          <span className="stat-number">{summary.plays.toLocaleString()}</span>
          <span className="stat-note">{plural(summary.distinct, 'different song')}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Library</span>
          <span className="stat-number">{tracks.length.toLocaleString()}</span>
          <span className="stat-note">
            {plural(libraryArtists, 'artist')} · {plural(libraryAlbums, 'album')} · {formatTotalDuration(total(tracks))}
          </span>
        </div>
      </div>

      <ListeningChart log={listenLog} range={range} />

      {summary.plays === 0 && range !== 'all' ? (
        <p className="muted note">No plays counted {rangeLabel} yet.</p>
      ) : (
        <div className="rank-grid">
          <RankList
            title="Top songs"
            items={summary.songs.map(({ track, plays }) => ({
              key: track.id,
              label: track.title,
              sub: plural(plays, 'play'),
              value: plays,
              cover: track.cover,
              onClick: () => s.setView({ kind: 'album', id: albumKey(track) }),
            }))}
          />
          <RankList
            title="Top artists"
            items={summary.artists.map(([name, entry]) => ({
              key: name,
              label: name,
              sub: plural(entry.plays, 'play'),
              value: entry.plays,
              cover: entry.cover,
              onClick: () => s.setView({ kind: 'artist', id: name }),
            }))}
          />
          <RankList
            title="Top albums"
            items={summary.albums.map(([key, entry]) => ({
              key,
              label: entry.album,
              sub: plural(entry.plays, 'play'),
              value: entry.plays,
              cover: entry.cover,
              onClick: () => s.setView({ kind: 'album', id: key }),
            }))}
          />
          <RankList
            title="Top genres"
            items={summary.genres.map(([name, plays]) => ({
              key: name,
              label: name,
              sub: plural(plays, 'play'),
              value: plays,
              onClick: () => s.setView({ kind: 'genre', id: name }),
            }))}
          />
          {summary.skipped.length > 0 && (
            <RankList
              title="Most skipped"
              items={summary.skipped.map(({ track, skips }) => ({
                key: track.id,
                label: track.title,
                sub: plural(skips, 'skip'),
                value: skips,
                cover: track.cover,
                onClick: () => s.setView({ kind: 'album', id: albumKey(track) }),
              }))}
            />
          )}
        </div>
      )}
    </div>
  )
}

/* --------------------------------- search -------------------------------- */

export function SearchView() {
  const search = useStore((state) => state.search)
  const tracks = useStore((state) => state.tracks)
  const playlists = useStore((state) => state.playlists)
  const [showAll, setShowAll] = useState(false)
  const s = getStore()

  const results = useMemo(() => {
    if (!search.trim()) return null
    const byId = new Map(tracks.map((track) => [track.id, track]))
    return {
      songs: tracks.filter((track) => matches(search, track.title, track.artist, track.album, track.genre)),
      albums: groupAlbums(tracks).filter((album) => matches(search, album.album, album.albumArtist)),
      artists: groupArtists(tracks).filter((artist) => matches(search, artist.name)),
      playlists: playlists
        .filter((playlist) => matches(search, playlist.name))
        .map((playlist) => ({
          playlist,
          cover: playlist.cover ?? playlist.trackIds.map((id) => byId.get(id)?.cover).find(Boolean) ?? null,
        })),
    }
  }, [search, tracks, playlists])

  if (!results) {
    return (
      <div className="view">
        <ViewHeader eyebrow="Search" title="Find anything" sub="Type in the search box at the top to search songs, albums, artists and playlists." />
        <EmptyState title="What would you like to hear?" compact>
          Try a song title, an artist, an album or a genre.
        </EmptyState>
      </div>
    )
  }

  const count = results.songs.length + results.albums.length + results.artists.length + results.playlists.length
  const songs = showAll ? results.songs : results.songs.slice(0, 50)
  const songIds = results.songs.map((track) => track.id)

  return (
    <div className="view">
      <ViewHeader eyebrow="Search" title={`“${search}”`} sub={plural(count, 'result')} />

      {count === 0 && <EmptyState title="Nothing matched" compact>Check the spelling, or try fewer words.</EmptyState>}

      {results.artists.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Artists</h2>
          </div>
          <div className="row-scroll">
            {results.artists.slice(0, 12).map((artist) => (
              <MediaCard
                key={artist.name}
                circle
                title={artist.name}
                subtitle={plural(artist.tracks.length, 'song')}
                cover={artist.tracks.find((track) => track.cover)?.cover}
                onOpen={(art) => s.setView({ kind: 'artist', id: artist.name }, art)}
              />
            ))}
          </div>
        </section>
      )}

      {results.albums.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Albums</h2>
          </div>
          <div className="row-scroll">
            {results.albums.slice(0, 16).map((album) => (
              <MediaCard
                key={album.key}
                title={album.album}
                subtitle={album.albumArtist}
                cover={album.cover}
                onOpen={(art) => s.setView({ kind: 'album', id: album.key }, art)}
                onPlay={() => s.playTracks(album.tracks.map((track) => track.id), 0)}
              />
            ))}
          </div>
        </section>
      )}

      {results.playlists.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Playlists</h2>
          </div>
          <div className="row-scroll">
            {results.playlists.map(({ playlist, cover }) => (
              <MediaCard
                key={playlist.id}
                title={playlist.name}
                subtitle={plural(playlist.trackIds.length, 'song')}
                cover={cover}
                onOpen={(art) => s.setView({ kind: 'playlist', id: playlist.id }, art)}
              />
            ))}
          </div>
        </section>
      )}

      {results.songs.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Songs · {results.songs.length}</h2>
            <button type="button" className="link subtle" onClick={() => s.playTracks(songIds, 0)}>
              Play all
            </button>
          </div>
          <SongTable tracks={songs} onPlay={(index) => s.playTracks(songIds, index)} />
          {results.songs.length > songs.length && (
            <button type="button" className="btn ghost show-more" onClick={() => setShowAll(true)}>
              Show all {results.songs.length} songs
            </button>
          )}
        </section>
      )}
    </div>
  )
}
