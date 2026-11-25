import { api } from '../api'
import type { SessionState } from '../types'
import type { AppState } from './state'

/**
 * Saving is split by top-level key: a like only sends the favourites list, a
 * volume change only the settings, instead of the whole library every time.
 */
export type PersistKey =
  | 'tracks'
  | 'playlists'
  | 'favorites'
  | 'stats'
  | 'history'
  | 'settings'
  | 'session'
  | 'tagOverrides'
  | 'listenLog'
  | 'playLog'

let getState: (() => AppState) | null = null
const dirty = new Set<PersistKey>()
let timer: number | null = null

export function bindPersistence(get: () => AppState): void {
  getState = get
}

export function sessionOf(s: AppState): SessionState {
  const transient = new Set(s.transientIds)
  return {
    trackId: s.playingTrack && !transient.has(s.playingTrack.id) ? s.playingTrack.id : null,
    queue: s.queue.filter((id) => !transient.has(id)),
    queueIndex: s.queueIndex,
    position: s.time,
  }
}

function payload(key: PersistKey, s: AppState): unknown {
  switch (key) {
    case 'tracks': {
      if (!s.transientIds.length) return s.tracks
      const transient = new Set(s.transientIds)
      return s.tracks.filter((track) => !transient.has(track.id))
    }
    case 'session':
      return sessionOf(s)
    default:
      return s[key]
  }
}

export function flushPersist(): void {
  if (timer) {
    window.clearTimeout(timer)
    timer = null
  }
  if (!getState || !dirty.size) return
  const s = getState()
  const patch: Record<string, unknown> = {}
  for (const key of dirty) patch[key] = payload(key, s)
  dirty.clear()
  void api.store.save(patch)
}

/** Marks keys as changed; they are written together after a short pause. */
export function persist(...keys: PersistKey[]): void {
  for (const key of keys) dirty.add(key)
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(flushPersist, 600)
}

window.addEventListener('beforeunload', flushPersist)
