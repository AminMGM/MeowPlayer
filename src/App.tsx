import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { engine } from './audio/engine'
import { Ambient } from './components/Ambient'
import { Dock } from './components/Dock'
import { Icon } from './components/Icons'
import { Logo } from './components/Logo'
import { MiniWindow } from './components/MiniPlayer'
import { Overlays } from './components/Overlays'
import { PlayerBar } from './components/PlayerBar'
import { Sidebar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { useMediaQuery } from './hooks'
import { flushPersist } from './store/persist'
import { getStore, selectIsTransient, useStore } from './store/useStore'
import type { CloseBehavior, DockTab, MiniState } from './types'
import { activeLyricIndex, applyAccent, extractAccent } from './utils'
import { ViewRouter } from './views'

export default function App() {
  if (window.location.hash.startsWith('#mini')) return <MiniWindow />
  return <MainApp />
}

/* ------------------------------- helpers ------------------------------- */

function drawThumbarIcon(kind: 'play' | 'pause' | 'prev' | 'next'): string {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  if (kind === 'play') {
    ctx.moveTo(10, 6)
    ctx.lineTo(25, 16)
    ctx.lineTo(10, 26)
  } else if (kind === 'pause') {
    ctx.rect(10, 7, 4.5, 18)
    ctx.rect(18, 7, 4.5, 18)
  } else if (kind === 'prev') {
    ctx.moveTo(23, 7)
    ctx.lineTo(11, 16)
    ctx.lineTo(23, 25)
    ctx.rect(8, 7, 2.5, 18)
  } else {
    ctx.moveTo(9, 7)
    ctx.lineTo(21, 16)
    ctx.lineTo(9, 25)
    ctx.rect(21.5, 7, 2.5, 18)
  }
  ctx.fill()
  return canvas.toDataURL('image/png')
}

/** The Windows media overlay only shows real image URLs, so local artwork is inlined. */
async function toArtworkUrl(cover: string | null): Promise<string | null> {
  if (!cover) return null
  if (/^(data:|https?:)/.test(cover)) return cover
  try {
    const blob = await (await fetch(cover)).blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** "Auto" interface size: scale with the window, rounded so it does not jitter. */
function autoZoom(): number {
  const width = window.outerWidth || 1360
  const height = window.outerHeight || 880
  const factor = Math.min(width / 1440, height / 900)
  return Math.round(Math.min(1.3, Math.max(0.85, factor)) * 20) / 20
}

/* -------------------------------- app ---------------------------------- */

function MainApp() {
  const ready = useStore((state) => state.ready)
  const settings = useStore((state) => state.settings)
  const playingTrack = useStore((state) => state.playingTrack)
  const isPlaying = useStore((state) => state.isPlaying)
  const sleepUntil = useStore((state) => state.sleepUntil)
  const viewKind = useStore((state) => state.view.kind)
  const narrow = useMediaQuery('(max-width: 1100px)')
  const [dragging, setDragging] = useState(false)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const dragDepth = useRef(0)

  /* ---- startup and main-process events ---- */
  useEffect(() => {
    void getStore().init()

    const offCommand = api.onPlayerCommand((command) => {
      const store = getStore()
      if (command === 'playpause') store.togglePlay()
      else if (command === 'next') store.next()
      else if (command === 'prev') store.prev()
      else if (command === 'stop') {
        store.pause()
        store.seek(0)
      } else if (command === 'addToLibrary' && store.playingTrack) store.addToLibrary([store.playingTrack.id])
      else if (command === 'like' && store.playingTrack) store.toggleLike(store.playingTrack.id)
      else if (command === 'toggleMiniLyrics') store.updateSettings({ miniLyrics: !store.settings.miniLyrics })
      else if (command.startsWith('seek:')) store.seek(Number(command.slice(5)) || 0)
    })
    const offFiles = api.onOpenFiles((paths) => void getStore().openFiles(paths))
    const offUpdate = api.updates.onAvailable((info) => {
      useStore.setState({ update: info })
      if (info?.available) {
        getStore().showToast(`MeowPlayer ${info.version} is available`, {
          kind: 'info',
          action: { label: 'Details', run: () => getStore().setSettingsOpen(true, 'system') },
        })
      }
    })
    const offUpdateStatus = api.updates.onStatus((info) => {
      const previous = getStore().update?.status
      useStore.setState({ update: info })
      if (info.status === 'downloaded' && previous !== 'downloaded') {
        // "Ready to install" replaces the earlier "is available" message.
        useStore.setState({ toasts: getStore().toasts.filter((toast) => !toast.message.endsWith('is available')) })
        getStore().showToast(`MeowPlayer ${info.version} is ready to install`, {
          kind: 'success',
          duration: 12000,
          action: { label: 'Restart now', run: () => void getStore().installUpdate() },
        })
      }
    })
    // The close dialog's "remember my choice" lands here so the next save keeps it.
    const offClose = api.ui.onCloseBehavior((value) => {
      const store = getStore()
      if (store.settings.closeBehavior !== value) store.updateSettings({ closeBehavior: value as CloseBehavior })
    })
    const offPause = api.onSystemPause(() => getStore().pause())
    const offMini = api.mini.onVisibility((visible) => useStore.setState({ miniVisible: visible }))
    void api.mini.isVisible().then((visible) => useStore.setState({ miniVisible: visible }))

    return () => {
      offCommand()
      offFiles()
      offUpdate()
      offUpdateStatus()
      offClose()
      offPause()
      offMini()
      flushPersist()
    }
  }, [])

  /* ---- side panel follows the window size ---- */
  // Narrow windows fold the right panel away; widening brings it back if it
  // was only closed for lack of room.
  const dockAutoClosed = useRef(false)
  useEffect(() => {
    const s = getStore()
    if (narrow && s.dockOpen) {
      dockAutoClosed.current = true
      useStore.setState({ dockOpen: false })
    } else if (!narrow && dockAutoClosed.current) {
      dockAutoClosed.current = false
      useStore.setState({ dockOpen: true })
    }
  }, [narrow])

  /* ---- now playing already shows lyrics, so the panel shows the queue ---- */
  const tabBeforeNowPlaying = useRef<DockTab | null>(null)
  useEffect(() => {
    const s = getStore()
    if (viewKind === 'nowplaying') {
      if (s.dockTab === 'lyrics') {
        tabBeforeNowPlaying.current = 'lyrics'
        useStore.setState({ dockTab: 'queue' })
      }
    } else if (tabBeforeNowPlaying.current) {
      if (s.dockTab === 'queue') useStore.setState({ dockTab: tabBeforeNowPlaying.current })
      tabBeforeNowPlaying.current = null
    }
  }, [viewKind])

  /* ---- theme, blur, animations ---- */
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => setSystemDark(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const theme = settings.gradient === 'system' ? (systemDark ? 'graphite' : 'light') : settings.gradient
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.animations = settings.animations ? 'on' : 'off'
    root.style.setProperty('--blur', `${settings.blur}px`)
    api.ui.trayPrefs({ closeBehavior: settings.closeBehavior })
  }, [theme, settings.animations, settings.blur, settings.closeBehavior])

  /* ---- accent, optionally from the cover ---- */
  useEffect(() => {
    const cover = playingTrack?.cover
    if (!settings.albumTheming || !cover) {
      applyAccent(settings.accent)
      return
    }
    let cancelled = false
    void extractAccent(cover).then((color) => {
      if (!cancelled) applyAccent(color ?? settings.accent)
    })
    return () => {
      cancelled = true
    }
  }, [settings.albumTheming, settings.accent, playingTrack?.cover])

  /* ---- interface size ---- */
  useEffect(() => {
    if (settings.uiScale > 0) {
      api.ui.setZoom(settings.uiScale)
      return
    }
    let frame = 0
    const apply = (): void => {
      frame = 0
      api.ui.setZoom(autoZoom())
    }
    apply()
    const onResize = (): void => {
      if (!frame) frame = requestAnimationFrame(apply)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [settings.uiScale])

  /* ---- taskbar thumbnail buttons ---- */
  useEffect(() => {
    if (api.platform !== 'win32') return
    const icons = {
      play: drawThumbarIcon('play'),
      pause: drawThumbarIcon('pause'),
      prev: drawThumbarIcon('prev'),
      next: drawThumbarIcon('next'),
    }
    if (Object.values(icons).every(Boolean)) api.ui.thumbar(icons)
  }, [])

  useEffect(() => {
    if (api.platform === 'win32') api.ui.thumbarState(isPlaying)
  }, [isPlaying])

  /* ---- mini player sync, only while it is on screen ---- */
  useEffect(() => {
    const build = (): MiniState | null => {
      const s = getStore()
      const track = s.playingTrack
      if (!track) return null
      const index = activeLyricIndex(s.lyrics.synced, s.time)
      const line = s.lyrics.trackId === track.id ? s.lyrics.synced[index]?.text : null
      return {
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        cover: track.cover,
        playing: s.isPlaying,
        time: s.time,
        duration: s.duration || track.duration,
        liked: s.favorites.includes(track.id),
        external: selectIsTransient(s),
        lyric: line?.trim() ? line : null,
        lyricsOn: s.settings.miniLyrics,
      }
    }
    let timer = 0
    let last = ''
    const send = (): void => {
      const state = build()
      if (!state) return
      const json = JSON.stringify(state)
      if (json === last) return
      last = json
      api.mini.broadcast(state)
    }
    const sync = (visible: boolean): void => {
      window.clearInterval(timer)
      if (visible) {
        send()
        timer = window.setInterval(send, 350)
      }
    }
    sync(getStore().miniVisible)
    const unsubscribe = useStore.subscribe((state, previous) => {
      if (state.miniVisible !== previous.miniVisible) sync(state.miniVisible)
      // Keep the cached state fresh for the next time the mini window opens.
      else if (
        !state.miniVisible &&
        (state.playingTrack !== previous.playingTrack || state.isPlaying !== previous.isPlaying)
      ) {
        const next = build()
        if (next) api.mini.broadcast(next)
      }
    })
    return () => {
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [])

  /* ---- periodic session save while playing ---- */
  useEffect(() => {
    if (!isPlaying) return
    const timer = window.setInterval(() => getStore().saveSession(), 10_000)
    return () => window.clearInterval(timer)
  }, [isPlaying])

  /* ---- Windows media overlay (MediaSession) ---- */
  useEffect(() => {
    const session = navigator.mediaSession
    if (!session) return
    if (!playingTrack) {
      session.metadata = null
      return
    }
    let cancelled = false
    void toArtworkUrl(playingTrack.cover).then((artwork) => {
      if (cancelled) return
      try {
        session.metadata = new MediaMetadata({
          title: playingTrack.title,
          artist: playingTrack.artist,
          album: playingTrack.album,
          artwork: artwork
            ? [{ src: artwork, sizes: '512x512', type: artwork.startsWith('data:image/png') ? 'image/png' : 'image/jpeg' }]
            : [],
        })
      } catch (err) {
        console.warn('[media] could not publish metadata', err)
      }
    })
    return () => {
      cancelled = true
    }
  }, [playingTrack])

  useEffect(() => {
    const session = navigator.mediaSession
    if (!session) return
    // Explicit play and pause: a toggle here could start music when asked to pause.
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => getStore().resume()],
      ['pause', () => getStore().pause()],
      ['stop', () => getStore().pause()],
      ['nexttrack', () => getStore().next()],
      ['previoustrack', () => getStore().prev()],
      [
        'seekto',
        (details) => {
          if (typeof details.seekTime === 'number') getStore().seek(details.seekTime)
        },
      ],
    ]
    for (const [action, handler] of handlers) session.setActionHandler(action, handler)
    return () => {
      for (const [action] of handlers) session.setActionHandler(action, null)
    }
  }, [])

  useEffect(() => {
    const session = navigator.mediaSession
    if (!session) return
    session.playbackState = isPlaying ? 'playing' : 'paused'
    const update = (): void => {
      const { duration, time, rate } = getStore()
      if (!duration) return
      try {
        session.setPositionState({ duration, position: Math.min(time, duration), playbackRate: rate })
      } catch {
        /* invalid while loading */
      }
    }
    update()
    const timer = window.setInterval(update, 2000)
    return () => window.clearInterval(timer)
  }, [isPlaying, playingTrack])

  /* ---- sleep timer ---- */
  useEffect(() => {
    if (!sleepUntil) return
    const finish = (): void => {
      useStore.setState({ sleepUntil: null, sleepMode: 'off' })
      getStore().showToast('Sleep timer stopped playback', { kind: 'info' })
    }
    const timer = window.setInterval(() => {
      const remaining = sleepUntil - Date.now()
      if (remaining > 15_000) return
      // Fade the last seconds out instead of cutting the music off.
      window.clearInterval(timer)
      if (!getStore().isPlaying) finish()
      else engine.fadeOut(Math.max(0.5, remaining / 1000), finish)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [sleepUntil])

  /* ---- track-change notifications ---- */
  const notifiedTrack = useRef<string | null>(null)
  useEffect(() => {
    if (!settings.notifications || !playingTrack || !isPlaying) return
    if (notifiedTrack.current === playingTrack.id) return
    notifiedTrack.current = playingTrack.id
    if (document.hasFocus()) return
    void api.ui.notify({ title: playingTrack.title, body: `${playingTrack.artist} · ${playingTrack.album}` })
  }, [playingTrack, isPlaying, settings.notifications])

  /* ---- renderer errors go to the local crash log ---- */
  useEffect(() => {
    const onError = (event: ErrorEvent): void => api.ui.reportError(`${event.message} (${event.filename}:${event.lineno})`)
    const onRejection = (event: PromiseRejectionEvent): void =>
      api.ui.reportError(`Unhandled rejection: ${String(event.reason)}`)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  /* ---- keyboard and mouse shortcuts ---- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      const store = getStore()
      const ctrl = event.ctrlKey || event.metaKey

      if (ctrl && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        document.getElementById('global-search')?.focus()
        return
      }
      if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault()
        if (event.key === 'ArrowLeft') store.goBack()
        else store.goForward()
        return
      }
      if (event.key === 'Escape') {
        if (store.contextMenu) store.setContextMenu(null)
        else if (store.tagEditId) store.setTagEdit(null)
        else if (store.settingsOpen) store.setSettingsOpen(false)
        return
      }
      if (typing || event.defaultPrevented) return
      // Rows and sliders handle their own arrow keys.
      const role = target?.getAttribute('role')
      if (role === 'slider' || role === 'row') return

      switch (event.key) {
        case ' ':
          if (target?.tagName === 'BUTTON') return
          event.preventDefault()
          store.togglePlay()
          break
        case 'ArrowRight':
          event.preventDefault()
          if (ctrl) store.next()
          else store.seek(Math.min(store.duration, store.time + 5))
          break
        case 'ArrowLeft':
          event.preventDefault()
          if (ctrl) store.prev()
          else store.seek(Math.max(0, store.time - 5))
          break
        case 'ArrowUp':
          event.preventDefault()
          store.setVolume(store.volume + 0.05)
          break
        case 'ArrowDown':
          event.preventDefault()
          store.setVolume(store.volume - 0.05)
          break
        default: {
          if (ctrl || event.altKey) return
          const key = event.key.toLowerCase()
          if (key === 'm') store.toggleMute()
          else if (key === 's') store.toggleShuffle()
          else if (key === 'r') store.cycleRepeat()
          else if (key === 'l' && store.playingTrack) store.toggleLike(store.playingTrack.id)
        }
      }
    }
    const onMouse = (event: MouseEvent): void => {
      if (event.button === 3) getStore().goBack()
      if (event.button === 4) getStore().goForward()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mouseup', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mouseup', onMouse)
    }
  }, [])

  /* ---- drag and drop ---- */
  const isFileDrag = (event: React.DragEvent): boolean => event.dataTransfer.types.includes('Files')
  const onDragEnter = (event: React.DragEvent): void => {
    if (!isFileDrag(event)) return
    event.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }
  const onDragOver = (event: React.DragEvent): void => {
    if (!isFileDrag(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }
  const onDragLeave = (event: React.DragEvent): void => {
    if (!isFileDrag(event)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }
  const onDrop = (event: React.DragEvent): void => {
    if (!isFileDrag(event)) return
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    void getStore().ingestPaths(api.files.paths(Array.from(event.dataTransfer.files)))
  }

  if (!ready) {
    return (
      <div className="app splash">
        <Ambient />
        <div className="splash-inner">
          <span className="splash-mark">
            <Logo size={56} />
          </span>
          <span className="eq-loader" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="app" onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <Ambient />
      <TitleBar />
      <div className="workspace">
        <Sidebar />
        <main className="content">
          <ViewRouter />
        </main>
        <Dock />
      </div>
      <PlayerBar />
      <Overlays />

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-card glass-panel">
            <span className="drop-icon">
              <Icon name="download" size={28} />
            </span>
            <p>Drop to play</p>
            <span>Files and folders play right away. Choose Add to library afterwards to keep them.</span>
          </div>
        </div>
      )}
    </div>
  )
}
