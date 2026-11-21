import { create } from 'zustand'
import { engine } from '../audio/engine'
import type { Track } from '../types'
import { bindPersistence } from './persist'
import { createCollectionSlice } from './slices/collection'
import { createLibrarySlice } from './slices/library'
import { createLyricsSlice } from './slices/lyrics'
import { createPlaybackSlice } from './slices/playback'
import { createSettingsSlice } from './slices/settings'
import { createUiSlice } from './slices/ui'
import type { AppState } from './state'

export type { AppState, SettingsTab } from './state'
export { DEFAULT_SETTINGS } from './defaults'

export const useStore = create<AppState>()((...args) => ({
  ...createUiSlice(...args),
  ...createLibrarySlice(...args),
  ...createPlaybackSlice(...args),
  ...createCollectionSlice(...args),
  ...createLyricsSlice(...args),
  ...createSettingsSlice(...args),
}))

bindPersistence(useStore.getState)

/** The store's actions and current state, for event handlers (not for rendering). */
export const getStore = (): AppState => useStore.getState()

/* ------------------------- engine → store wiring ------------------------- */

let lastTime = 0
let pendingListen = 0

engine.callbacks = {
  time: (time, duration) => {
    const state = useStore.getState()
    // Count real listening time for the stats page (seeks are not listening).
    const delta = time - lastTime
    lastTime = time
    if (state.isPlaying && delta > 0 && delta < 1.5) {
      pendingListen += delta / Math.max(0.5, state.rate)
      if (pendingListen >= 15) {
        state.addListenTime(pendingListen)
        pendingListen = 0
      }
    }
    useStore.setState(state.duration === duration ? { time } : { time, duration })
  },
  duration: (duration) => useStore.setState({ duration }),
  ended: () => useStore.getState().next(true),
  transition: () => useStore.getState().next(true),
  preload: () => useStore.getState().preloadNext(),
  play: () => useStore.setState({ isPlaying: true }),
  pause: () => {
    useStore.setState({ isPlaying: false })
    if (pendingListen > 0) {
      useStore.getState().addListenTime(pendingListen)
      pendingListen = 0
    }
    useStore.getState().saveSession()
  },
  error: (message) => {
    useStore.setState({ isPlaying: false })
    useStore.getState().showToast(message, { kind: 'error' })
  },
}

/* -------------------------------- selectors ------------------------------ */

export const selectCurrentTrack = (state: AppState): Track | null => state.playingTrack

export const selectIsTransient = (state: AppState): boolean =>
  Boolean(state.playingTrack && state.transientIds.includes(state.playingTrack.id))
