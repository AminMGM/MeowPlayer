import { api } from '../../api'
import { engine } from '../../audio/engine'
import type { TagEdit, Track } from '../../types'
import { plural } from '../../utils'
import { persist } from '../persist'
import type { LibrarySlice, Slice } from '../state'

/** Applies tag edits that live only in MeowPlayer (the file could not be written). */
export function applyOverride(track: Track, edit: TagEdit | undefined): Track {
  if (!edit) return track
  const next = { ...track }
  if (edit.title) next.title = edit.title
  if (edit.artist) next.artist = edit.artist
  if (edit.albumArtist) next.albumArtist = edit.albumArtist
  if (edit.album) next.album = edit.album
  if (edit.genre !== undefined) next.genre = edit.genre
  if (edit.year !== undefined) next.year = edit.year
  return next
}

export const createLibrarySlice: Slice<LibrarySlice> = (set, get) => ({
  ready: false,
  tracks: [],
  transientIds: [],
  tagOverrides: {},
  scanning: false,
  scanProgress: { done: 0, total: 0 },

  addFolders: async () => {
    const picked = await api.library.pickFolders()
    if (!picked.length) return
    const folders = [...new Set([...get().settings.folders, ...picked])]
    get().updateSettings({ folders })
    await get().rescan()
  },

  rescan: async (opts = {}) => {
    const { settings, scanning } = get()
    if (scanning) return
    if (!settings.folders.length) {
      if (!opts.quiet) get().showToast('Add a music folder first', { kind: 'info' })
      return
    }

    set({ scanning: true, scanProgress: { done: 0, total: 0 } })
    try {
      const transient = new Set(get().transientIds)
      const library = get().tracks.filter((track) => !transient.has(track.id))
      const known: Record<string, number> = {}
      // Tracks scanned before 2.2 have no thumbnail yet; leaving them out makes the scan re-read them.
      for (const track of library) if (track.mtime && 'thumb' in track) known[track.path] = track.mtime

      const result = await api.library.scan(settings.folders, known)
      const kept = new Set(result.kept)
      const previous = new Map(library.map((track) => [track.path, track]))
      const overrides = get().tagOverrides

      const keptTracks = library.filter((track) => kept.has(track.path))
      const freshTracks = result.tracks.map((track) => {
        const old = previous.get(track.path)
        return applyOverride(old ? { ...track, addedAt: old.addedAt } : track, overrides[track.path])
      })
      // Transient tracks that are now inside a library folder become library tracks.
      const merged = [...keptTracks, ...freshTracks]
      const mergedIds = new Set(merged.map((track) => track.id))
      const stillTransient = get().tracks.filter((track) => transient.has(track.id) && !mergedIds.has(track.id))

      const added = freshTracks.filter((track) => !previous.has(track.path)).length
      const removed = library.length - keptTracks.length - (freshTracks.length - added)

      set({
        tracks: [...merged, ...stillTransient],
        transientIds: stillTransient.map((track) => track.id),
        scanning: false,
      })
      persist('tracks')

      // Keep the playing track object in sync with any re-read tags.
      const playing = get().playingTrack
      if (playing) {
        const updated = merged.find((track) => track.id === playing.id)
        if (updated && updated !== playing) set({ playingTrack: updated })
      }

      void api.library.pruneCovers(
        merged.flatMap((track) => [track.cover, track.thumb]).filter((url): url is string => Boolean(url)),
      )

      if (!opts.quiet) get().showToast(`Library updated: ${plural(merged.length, 'track')}`)
      else if (added || removed > 0) {
        const parts = [added ? `${plural(added, 'new track')}` : '', removed > 0 ? `${removed} removed` : '']
        get().showToast(`Library refreshed: ${parts.filter(Boolean).join(', ')}`, { kind: 'info' })
      }
    } catch (err) {
      set({ scanning: false })
      get().showToast(err instanceof Error ? err.message : 'Scan failed', { kind: 'error' })
    }
  },

  removeFolder: async (folder) => {
    const folders = get().settings.folders.filter((item) => item !== folder)
    get().updateSettings({ folders })
    if (folders.length) await get().rescan({ quiet: true })
    else get().clearLibrary()
  },

  clearLibrary: () => {
    engine.stop()
    set({
      tracks: [],
      transientIds: [],
      queue: [],
      queueIndex: -1,
      originalQueue: [],
      playingTrack: null,
      isPlaying: false,
      time: 0,
      duration: 0,
    })
    persist('tracks', 'session')
    get().watchLibrary()
  },

  importPlaylistFile: async () => {
    const result = await api.library.importM3u()
    if (!result) return
    const byPath = new Map(get().tracks.map((track) => [track.path.toLowerCase(), track]))
    const ids = result.paths
      .map((file) => byPath.get(file.toLowerCase())?.id)
      .filter((id): id is string => Boolean(id))
    if (!ids.length) {
      get().showToast('None of the tracks in that playlist are in your library', { kind: 'error' })
      return
    }
    const id = get().createPlaylist(result.name, ids)
    get().setView({ kind: 'playlist', id })
    const missing = result.paths.length - ids.length
    get().showToast(`Imported ${plural(ids.length, 'track')}${missing ? `, ${missing} not found` : ''}`)
  },

  exportPlaylistFile: async (playlistId) => {
    const playlist = get().playlists.find((item) => item.id === playlistId)
    if (!playlist) return
    const byId = new Map(get().tracks.map((track) => [track.id, track]))
    const entries = playlist.trackIds
      .map((id) => byId.get(id))
      .filter((track): track is Track => Boolean(track))
      .map((track) => ({ path: track.path, duration: track.duration, title: track.title, artist: track.artist }))
    if (await api.library.exportM3u(playlist.name, entries)) get().showToast('Playlist exported')
  },

  ingestPaths: async (paths) => {
    const clean = paths.filter(Boolean)
    if (!clean.length) return
    try {
      const found = await api.library.ingest(clean)
      if (!found.length) {
        get().showToast('There is no playable audio in that drop', { kind: 'error' })
        return
      }
      const known = new Map(get().tracks.map((track) => [track.path, track]))
      const additions = found.filter((track) => !known.has(track.path))
      // Dropped files play straight away but stay out of the saved library
      // until the user chooses to add them.
      if (additions.length) {
        set({
          tracks: [...get().tracks, ...additions],
          transientIds: [...get().transientIds, ...additions.map((track) => track.id)],
        })
      }
      const ids = found.map((track) => known.get(track.path)?.id ?? track.id)
      get().playTracks(ids, 0)
      if (additions.length) {
        const newIds = additions.map((track) => track.id)
        get().showToast(`Playing ${plural(additions.length, 'dropped track')}`, {
          kind: 'info',
          action: { label: 'Add to library', run: () => get().addToLibrary(newIds) },
        })
      }
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : 'Could not read those files', { kind: 'error' })
    }
  },

  openFiles: async (paths) => {
    const target = paths.find(Boolean)
    if (!target) return
    try {
      const probed = await api.library.probe(target)
      if (!probed) {
        get().showToast('That file cannot be played', { kind: 'error' })
        return
      }
      const inLibrary = get().tracks.find((track) => track.path === probed.path)
      if (!inLibrary) {
        set({ tracks: [...get().tracks, probed], transientIds: [...get().transientIds, probed.id] })
      }
      get().playTracks([inLibrary?.id ?? probed.id], 0)
      api.mini.show()
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : 'Could not open that file', { kind: 'error' })
    }
  },

  addToLibrary: (ids) => {
    const remove = new Set(ids)
    if (!get().transientIds.some((id) => remove.has(id))) return
    set({ transientIds: get().transientIds.filter((id) => !remove.has(id)) })
    persist('tracks', 'session')
    get().showToast(ids.length > 1 ? `Added ${ids.length} tracks to your library` : 'Added to your library')
  },

  applyMetaFixes: async (proposals, onProgress) => {
    const byId = new Map(get().tracks.map((track) => [track.id, track]))
    const updated = new Map<string, Track>()
    let failed = 0
    let done = 0
    for (const proposal of proposals) {
      const track = byId.get(proposal.id)
      if (track) {
        const result = await api.meta.apply(track.path, proposal.changes, proposal.coverUrl)
        if (result.track) updated.set(track.id, { ...result.track, id: track.id, addedAt: track.addedAt })
        else failed += 1
      }
      done += 1
      onProgress?.(done)
    }
    if (updated.size) {
      const playing = get().playingTrack
      set({
        tracks: get().tracks.map((item) => updated.get(item.id) ?? item),
        playingTrack: playing ? (updated.get(playing.id) ?? playing) : playing,
      })
      persist('tracks')
    }
    return { fixed: updated.size, failed }
  },

  updateTrack: async (id, edit) => {
    const track = get().tracks.find((item) => item.id === id)
    if (!track) return
    const result = await api.library.writeTags(track.path, edit)

    let next: Track
    const overrides = { ...get().tagOverrides }
    if (result.track) {
      next = { ...result.track, id: track.id, addedAt: track.addedAt }
      delete overrides[track.path]
      get().showToast('Saved to the file')
    } else {
      // The file is read-only or its format cannot be tagged: keep the edit in
      // MeowPlayer so it survives rescans.
      overrides[track.path] = { ...overrides[track.path], ...edit }
      next = applyOverride(track, edit)
      get().showToast(`Saved in MeowPlayer only. ${result.error ?? ''}`.trim(), { kind: 'info' })
    }

    const playing = get().playingTrack
    set({
      tracks: get().tracks.map((item) => (item.id === id ? next : item)),
      tagOverrides: overrides,
      playingTrack: playing?.id === id ? next : playing,
    })
    persist('tracks', 'tagOverrides')
  },

  watchLibrary: () => {
    const { settings } = get()
    api.library.watch(settings.watchFolders ? settings.folders : [])
  },
})
