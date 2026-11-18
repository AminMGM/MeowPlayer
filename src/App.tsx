import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { engine } from './audio/engine'
import { useStore } from './store/useStore'
import { Overlays } from './components/Overlays'
import { PlayerBar } from './components/PlayerBar'
import { Sidebar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { ViewRouter } from './components/Views'
import { Dock } from './components/Dock'
import { Icon } from './components/Icons'
import { MiniWindow } from './components/MiniPlayer'
import { activeLyricIndex, applyAccent, extractAccent } from './utils'

export default function App() {
  if (window.location.hash.startsWith('#mini')) return <MiniWindow />
  return <MainApp />
}

function drawThumbarIcon(kind: 'play' | 'pause' | 'prev' | 'next'): string {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'

  if (kind === 'play') {
    ctx.beginPath()
    ctx.moveTo(10, 6)
    ctx.lineTo(25, 16)
    ctx.lineTo(10, 26)
    ctx.closePath()
    ctx.fill()
  } else if (kind === 'pause') {
    ctx.fillRect(10, 7, 4.5, 18)
    ctx.fillRect(18, 7, 4.5, 18)
  } else if (kind === 'prev') {
    ctx.beginPath()
    ctx.moveTo(23, 7)
    ctx.lineTo(11, 16)
    ctx.lineTo(23, 25)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(8, 7, 2.5, 18)
  } else {
    ctx.beginPath()
    ctx.moveTo(9, 7)
    ctx.lineTo(21, 16)
    ctx.lineTo(9, 25)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(21.5, 7, 2.5, 18)
  }
  return canvas.toDataURL('image/png')
}

/**
 * The Windows media overlay can only render real image URLs, so anything served
 * from the app's own mp-media:// protocol is inlined as a data URL first.
 */
async function toArtworkUrl(cover: string | null): Promise<string | null> {
  if (!cover) return null
  if (/^(data:|https?:)/.test(cover)) return cover
  try {
    const res = await fetch(cover)
    const blob = await res.blob()
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

function MainApp() {
  const ready = useStore((state) => state.ready)
  const settings = useStore((state) => state.settings)
  const playingTrack = useStore((state) => state.playingTrack)
  const isPlaying = useStore((state) => state.isPlaying)
  const time = useStore((state) => state.time)
  const duration = useStore((state) => state.duration)
  const sleepUntil = useStore((state) => state.sleepUntil)

  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  useEffect(() => {
    void useStore.getState().init()

    const offCommand = api.onPlayerCommand((command) => {
      const store = useStore.getState()
      if (command === 'playpause') store.togglePlay()
      else if (command === 'next') store.next()
      else if (command === 'prev') store.prev()
      else if (command === 'stop') {
        engine.pause()
        engine.seek(0)
      } else if (command === 'addToLibrary') store.addExternalToLibrary()
      else if (command === 'toggleMiniLyrics') store.updateSettings({ miniLyrics: !store.settings.miniLyrics })
    })

    const offFiles = api.onOpenFiles((paths) => {
      void useStore.getState().openFiles(paths)
    })

    const offUpdate = api.updates.onAvailable((info) => {
      const update = info as { version: string; available: boolean }
      useStore.setState({ update: info as never })
      if (update?.available) useStore.getState().showToast(`MeowPlayer ${update.version} is available`)
    })

    return () => {
      offCommand()
      offFiles()
      offUpdate()
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--accent', settings.accent)
    root.style.setProperty('--blur', `${settings.blur}px`)
    root.dataset.gradient = settings.gradient
    root.dataset.animations = settings.animations ? 'on' : 'off'
    api.ui.trayPrefs({ closeBehavior: settings.closeBehavior })
  }, [settings.accent, settings.blur, settings.gradient, settings.animations, settings.closeBehavior])

  // Taskbar thumbnail controls and their play/pause state
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
    if (api.platform !== 'win32') return
    api.ui.thumbarState(isPlaying)
  }, [isPlaying])

  // Keep the floating mini window in sync
  useEffect(() => {
    const favorites = () => useStore.getState().favorites
    const currentLyric = (synced: { time: number; text: string }[], time: number): string | null => {
      const index = activeLyricIndex(synced, time)
      const line = synced[index]
      return line && line.text.trim() ? line.text : null
    }
    const send = (): void => {
      const s = useStore.getState()
      const track = s.playingTrack
      if (!track) return
      api.mini.broadcast({
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        cover: track.cover,
        playing: s.isPlaying,
        time: s.time,
        duration: s.duration || track.duration,
        liked: favorites().includes(track.id),
        external: Boolean(s.external),
        lyric: s.settings.miniLyrics ? currentLyric(s.lyrics.synced, s.time) : null,
      })
    }
    send()
    const timer = window.setInterval(send, 400)
    return () => window.clearInterval(timer)
  }, [])

  // Persist playback position periodically so a restart resumes the session
  useEffect(() => {
    const timer = window.setInterval(() => {
      const s = useStore.getState()
      if (s.playingTrack) s.saveSession()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!playingTrack) {
      navigator.mediaSession.metadata = null
      return
    }

    let cancelled = false
    void toArtworkUrl(playingTrack.cover).then((artwork) => {
      if (cancelled) return
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: playingTrack.title,
          artist: playingTrack.artist,
          album: playingTrack.album,
          artwork: artwork
            ? [
                {
                  src: artwork,
                  sizes: '512x512',
                  type: artwork.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
                },
              ]
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

  // Registered once and kept for the whole session. Windows delivers the
  // hardware Next/Previous/Play keys to the page's media session, and these
  // handlers used to exist only while a track was already playing, so the first
  // key press (and every press before playback started) silently did nothing.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const store = useStore.getState()
    navigator.mediaSession.setActionHandler('play', () => useStore.getState().togglePlay())
    navigator.mediaSession.setActionHandler('pause', () => useStore.getState().togglePlay())
    navigator.mediaSession.setActionHandler('nexttrack', () => useStore.getState().next())
    navigator.mediaSession.setActionHandler('previoustrack', () => useStore.getState().prev())
    navigator.mediaSession.setActionHandler('stop', () => {
      const s = useStore.getState()
      if (s.isPlaying) s.togglePlay()
    })
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number') store.seek(details.seekTime)
    })
    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
      navigator.mediaSession.setActionHandler('previoustrack', null)
      navigator.mediaSession.setActionHandler('stop', null)
      navigator.mediaSession.setActionHandler('seekto', null)
    }
  }, [])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !duration) return
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(time, duration),
        playbackRate: useStore.getState().rate,
      })
    } catch {
      /* ignore */
    }
  }, [time, duration])

  useEffect(() => {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  useEffect(() => {
    if (!sleepUntil) return
    let fading = false
    const stop = (): void => {
      if (!fading) engine.pause()
      useStore.setState({ sleepUntil: null, sleepMode: 'off' })
      useStore.getState().showToast('Sleep timer stopped playback')
    }
    const timer = window.setInterval(() => {
      const remaining = sleepUntil - Date.now()
      if (remaining <= 0) {
        stop()
        return
      }
      // Fade the last 15 seconds instead of cutting the music off.
      if (!fading && remaining <= 15_000) {
        fading = true
        engine.fadeOut(remaining / 1000, () => {
          useStore.setState({ sleepUntil: null, sleepMode: 'off' })
          useStore.getState().showToast('Sleep timer stopped playback')
        })
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [sleepUntil])

  // Windows sleep/lock pauses playback instead of leaving it running.
  useEffect(() => api.onSystemPause(() => engine.pause()), [])

  // Interface scale, for HiDPI screens and larger text.
  useEffect(() => {
    document.body.style.zoom = String(settings.uiScale || 1)
  }, [settings.uiScale])

  // Album-art theming: tint the accent from the current cover.
  useEffect(() => {
    if (!settings.albumTheming) {
      applyAccent(settings.accent)
      return
    }
    const cover = playingTrack?.cover
    if (!cover) {
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

  // Optional desktop notification when the track changes.
  const notifiedTrack = useRef<string | null>(null)
  useEffect(() => {
    if (!settings.notifications || !playingTrack || !isPlaying) return
    if (notifiedTrack.current === playingTrack.id) return
    notifiedTrack.current = playingTrack.id
    if (document.hasFocus()) return
    void api.ui.notify({ title: playingTrack.title, body: playingTrack.artist })
  }, [playingTrack, isPlaying, settings.notifications])

  // Narrow windows tuck the sidebar away, wide ones bring it back.
  useEffect(() => {
    let autoCollapsed = false
    const onResize = (): void => {
      const { settings: current, updateSettings } = useStore.getState()
      if (window.innerWidth < 1150 && !current.collapsedSidebar) {
        autoCollapsed = true
        updateSettings({ collapsedSidebar: true })
      } else if (window.innerWidth > 1240 && current.collapsedSidebar && autoCollapsed) {
        autoCollapsed = false
        updateSettings({ collapsedSidebar: false })
      }
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Renderer errors go to the local crash log.
  useEffect(() => {
    const onError = (event: ErrorEvent): void => {
      api.ui.reportError(`${event.message} (${event.filename}:${event.lineno})`)
    }
    const onRejection = (event: PromiseRejectionEvent): void => {
      api.ui.reportError(`Unhandled rejection: ${String(event.reason)}`)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const store = useStore.getState()
      const ctrl = event.ctrlKey || event.metaKey

      if (ctrl && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        store.setView({ kind: 'search' })
        return
      }
      if (event.key === 'Escape') {
        store.setContextMenu(null)
        if (store.settingsOpen) store.setSettingsOpen(false)
        return
      }

      switch (event.key) {
        case ' ':
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
          store.setVolume(Math.min(store.settings.amplify ? 1.5 : 1, store.volume + 0.05))
          break
        case 'ArrowDown':
          event.preventDefault()
          store.setVolume(Math.max(0, store.volume - 0.05))
          break
        default:
          if (event.key.toLowerCase() === 'm') store.toggleMute()
          else if (event.key.toLowerCase() === 's') store.toggleShuffle()
          else if (event.key.toLowerCase() === 'r') store.cycleRepeat()
          else if (event.key.toLowerCase() === 'f' && store.playingTrack) store.toggleLike(store.playingTrack.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const onDragEnter = (event: React.DragEvent): void => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }

  const onDragOver = (event: React.DragEvent): void => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const onDragLeave = (): void => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  const onDrop = (event: React.DragEvent): void => {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const paths = api.files.paths(Array.from(event.dataTransfer.files))
    void useStore.getState().ingestPaths(paths)
  }

  if (!ready) {
    return (
      <div className="app splash">
        <div className="aurora" />
        <div className="splash-inner">
          <span className="splash-mark">
            <span className="eq-loader">
              <i />
              <i />
              <i />
              <i />
            </span>
          </span>
          <p>MeowPlayer</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="app"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="aurora" />
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
          <div className="drop-card">
            <span className="drop-icon">
              <Icon name="download" size={28} />
            </span>
            <p>Drop to play</p>
            <span>Audio files are added to your library, folders are scanned</span>
          </div>
        </div>
      )}
    </div>
  )
}
