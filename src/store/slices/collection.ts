import type { Playlist } from '../../types'
import { dayKey, uid } from '../../utils'
import { persist } from '../persist'
import type { CollectionSlice, Slice } from '../state'

const dedupe = (ids: string[]): string[] => [...new Set(ids)]

const updatePlaylist = (playlists: Playlist[], id: string, change: (playlist: Playlist) => Playlist): Playlist[] =>
  playlists.map((playlist) => (playlist.id === id ? { ...change(playlist), updatedAt: Date.now() } : playlist))

export const createCollectionSlice: Slice<CollectionSlice> = (set, get) => ({
  playlists: [],
  favorites: [],
  stats: {},
  history: [],
  listenLog: {},
  playLog: [],

  toggleLike: (id) => {
    const liked = get().favorites.includes(id)
    get().setLiked([id], !liked)
  },

  setLiked: (ids, liked) => {
    const current = get().favorites
    const favorites = liked
      ? dedupe([...current, ...ids])
      : current.filter((id) => !ids.includes(id))
    set({ favorites })
    persist('favorites')
  },

  createPlaylist: (name, trackIds = []) => {
    const playlist: Playlist = {
      id: uid(),
      name: name.trim() || 'New playlist',
      cover: null,
      trackIds: dedupe(trackIds),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set({ playlists: [...get().playlists, playlist] })
    persist('playlists')
    return playlist.id
  },

  renamePlaylist: (id, name) => {
    set({ playlists: updatePlaylist(get().playlists, id, (p) => ({ ...p, name: name.trim() || p.name })) })
    persist('playlists')
  },

  setPlaylistCover: (id, cover) => {
    set({ playlists: updatePlaylist(get().playlists, id, (p) => ({ ...p, cover })) })
    persist('playlists')
  },

  deletePlaylist: (id) => {
    const all = get().playlists
    const index = all.findIndex((playlist) => playlist.id === id)
    const removed = all[index]
    if (!removed) return
    set({ playlists: all.filter((playlist) => playlist.id !== id) })
    const view = get().view
    if (view.kind === 'playlist' && view.id === id) get().setView({ kind: 'playlists' })
    persist('playlists')
    get().showToast(`Deleted "${removed.name}"`, {
      kind: 'info',
      action: {
        label: 'Undo',
        run: () => {
          const playlists = [...get().playlists]
          playlists.splice(Math.min(index, playlists.length), 0, removed)
          set({ playlists })
          persist('playlists')
        },
      },
    })
  },

  addToPlaylist: (playlistId, ids) => {
    const playlist = get().playlists.find((item) => item.id === playlistId)
    if (!playlist) return
    const fresh = ids.filter((id) => !playlist.trackIds.includes(id))
    set({
      playlists: updatePlaylist(get().playlists, playlistId, (p) => ({ ...p, trackIds: dedupe([...p.trackIds, ...ids]) })),
    })
    persist('playlists')
    if (!fresh.length) get().showToast(`Already in ${playlist.name}`, { kind: 'info' })
    else get().showToast(fresh.length > 1 ? `Added ${fresh.length} tracks to ${playlist.name}` : `Added to ${playlist.name}`)
  },

  removeFromPlaylist: (playlistId, index) => {
    set({
      playlists: updatePlaylist(get().playlists, playlistId, (p) => ({
        ...p,
        trackIds: p.trackIds.filter((_, i) => i !== index),
      })),
    })
    persist('playlists')
  },

  reorderPlaylist: (playlistId, from, to) => {
    set({
      playlists: get().playlists.map((playlist) => {
        if (playlist.id !== playlistId) return playlist
        const length = playlist.trackIds.length
        if (from === to || from < 0 || to < 0 || from >= length || to >= length) return playlist
        const ids = [...playlist.trackIds]
        const [moved] = ids.splice(from, 1)
        ids.splice(to, 0, moved)
        return { ...playlist, trackIds: ids, updatedAt: Date.now() }
      }),
    })
    persist('playlists')
  },

  recordPlay: (track) => {
    const now = Date.now()
    const stats = { ...get().stats }
    const entry = stats[track.id] ?? { plays: 0, lastPlayed: 0 }
    stats[track.id] = { ...entry, plays: entry.plays + 1, lastPlayed: now }
    const history = [{ id: track.id, at: now }, ...get().history.filter((item) => item.id !== track.id)].slice(0, 500)
    // Dated plays power the 7- and 30-day stats; about 20 000 plays is years of listening.
    const playLog = [...get().playLog, { id: track.id, at: now }].slice(-20000)
    set({ stats, history, playLog })
    persist('stats', 'history', 'playLog')
  },

  recordSkip: (trackId) => {
    const stats = { ...get().stats }
    const entry = stats[trackId] ?? { plays: 0, lastPlayed: 0 }
    stats[trackId] = { ...entry, skips: (entry.skips ?? 0) + 1 }
    set({ stats })
    persist('stats')
  },

  addListenTime: (seconds) => {
    if (!(seconds > 0)) return
    const key = dayKey()
    const log = { ...get().listenLog, [key]: (get().listenLog[key] ?? 0) + seconds }
    // Keep about a year of daily totals.
    const days = Object.keys(log).sort()
    for (const old of days.slice(0, Math.max(0, days.length - 400))) delete log[old]
    set({ listenLog: log })
    persist('listenLog')
  },
})
