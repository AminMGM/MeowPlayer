import { flushSync } from 'react-dom'
import { api } from '../../api'
import type { View } from '../../types'
import type { Slice, UiSlice } from '../state'

let toastSeq = 0
const toastTimers = new Map<number, number>()

const sameView = (a: View, b: View): boolean =>
  a.kind === b.kind && ('id' in a ? a.id : null) === ('id' in b ? b.id : null)

type ViewTransitionDocument = Document & { startViewTransition?: (cb: () => void) => unknown }

/**
 * Runs a view change inside a View Transition when the browser supports it
 * and animations are on. The element that was clicked (an album cover, say)
 * is tagged so it morphs into the matching artwork on the next page.
 */
function transition(update: () => void, source?: HTMLElement | null): void {
  const doc = document as ViewTransitionDocument
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const animated = document.documentElement.dataset.animations !== 'off'
  if (!doc.startViewTransition || reduced || !animated) {
    update()
    return
  }
  if (source) source.style.viewTransitionName = 'hero-art'
  doc.startViewTransition(() => {
    if (source) source.style.viewTransitionName = ''
    flushSync(update)
  })
}

export const createUiSlice: Slice<UiSlice> = (set, get) => ({
  view: { kind: 'home' },
  backStack: [],
  forwardStack: [],
  search: '',
  dockTab: 'lyrics',
  dockOpen: true,
  settingsOpen: false,
  settingsTab: 'appearance',
  contextMenu: null,
  toasts: [],
  tagEditId: null,
  miniVisible: false,

  setView: (view, source) => {
    const current = get().view
    if (sameView(current, view)) {
      set({ contextMenu: null })
      return
    }
    transition(
      () =>
        set({
          view,
          contextMenu: null,
          backStack: [...get().backStack, current].slice(-40),
          forwardStack: [],
        }),
      source,
    )
  },

  goBack: () => {
    const stack = get().backStack
    const previous = stack[stack.length - 1]
    if (!previous) return
    transition(() =>
      set({
        view: previous,
        backStack: stack.slice(0, -1),
        forwardStack: [get().view, ...get().forwardStack].slice(0, 40),
        contextMenu: null,
      }),
    )
  },

  goForward: () => {
    const [nextView, ...rest] = get().forwardStack
    if (!nextView) return
    transition(() =>
      set({ view: nextView, forwardStack: rest, backStack: [...get().backStack, get().view], contextMenu: null }),
    )
  },

  setSearch: (search) => set({ search }),
  setDockTab: (tab) => set({ dockTab: tab, dockOpen: true }),
  toggleDock: (tab) => {
    const { dockOpen, dockTab } = get()
    if (tab && tab !== dockTab) set({ dockOpen: true, dockTab: tab })
    else set({ dockOpen: !dockOpen })
  },
  setSettingsOpen: (open, tab) => set(tab ? { settingsOpen: open, settingsTab: tab } : { settingsOpen: open }),
  showMiniPlayer: () => api.mini.show(),
  setContextMenu: (menu) => set({ contextMenu: menu }),

  showToast: (message, opts = {}) => {
    const id = ++toastSeq
    const toast = { id, message, kind: opts.kind ?? 'success', action: opts.action }
    // Identical messages replace each other instead of stacking up.
    const others = get().toasts.filter((item) => item.message !== message).slice(-2)
    set({ toasts: [...others, toast] })
    const duration = opts.duration ?? (opts.action ? 6000 : 3200)
    toastTimers.set(id, window.setTimeout(() => get().dismissToast(id), duration))
  },

  dismissToast: (id) => {
    const timer = toastTimers.get(id)
    if (timer) window.clearTimeout(timer)
    toastTimers.delete(id)
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) })
  },

  setTagEdit: (id) => set({ tagEditId: id }),
})
