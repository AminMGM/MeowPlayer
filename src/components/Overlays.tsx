import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from '../api'
import { getStore, useStore } from '../store/useStore'
import type { ContextMenuState, Track } from '../types'
import { albumKey, cx, plural } from '../utils'
import { Icon } from './Icons'
import { PlaylistPicker } from './PlaylistPicker'
import { Settings } from './Settings'

export function Overlays() {
  return (
    <>
      <ContextMenu />
      <TagEditor />
      <Settings />
      <CloseDialog />
      <Toasts />
    </>
  )
}

/* ------------------------------ context menu ----------------------------- */

const closeMenu = (): void => getStore().setContextMenu(null)

function ContextMenu() {
  const menu = useStore((state) => state.contextMenu)
  if (!menu) return null
  // A fresh body per opening, so the playlist sub-list always starts closed.
  return <ContextMenuBody key={`${menu.x},${menu.y},${menu.trackIds.join(',')}`} menu={menu} />
}

function ContextMenuBody({ menu }: { menu: ContextMenuState }) {
  const tracks = useStore((state) => state.tracks)
  const favorites = useStore((state) => state.favorites)
  const transientIds = useStore((state) => state.transientIds)
  const [showPlaylists, setShowPlaylists] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)
  const close = closeMenu

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('resize', closeMenu)
    window.addEventListener('blur', closeMenu)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('blur', closeMenu)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  // Measure the real menu and keep it inside the window.
  useLayoutEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(menu.x, window.innerWidth - rect.width - 8))
    const top = menu.y + rect.height > window.innerHeight - 8 ? Math.max(8, menu.y - rect.height) : menu.y
    setPosition({ left, top })
  }, [menu, showPlaylists])

  const byId = new Map(tracks.map((track) => [track.id, track]))
  const items = menu.trackIds.map((id) => byId.get(id)).filter((track): track is Track => Boolean(track))
  const track = items[0]
  if (!track) return null

  const s = getStore()
  const multiple = items.length > 1
  const ids = items.map((item) => item.id)
  const allLiked = ids.every((id) => favorites.includes(id))
  const someTransient = ids.some((id) => transientIds.includes(id))
  const run = (action: () => void) => () => {
    action()
    close()
  }

  return (
    <>
      <div className="context-backdrop" onPointerDown={close} onContextMenu={(event) => event.preventDefault()} />
      <div
        ref={ref}
        className="context-menu glass-panel"
        role="menu"
        style={{ left: position?.left ?? menu.x, top: position?.top ?? menu.y, visibility: position ? 'visible' : 'hidden' }}
      >
        <div className="context-head">
          <span className="title-name">{multiple ? plural(items.length, 'track') : track.title}</span>
          <span className="title-artist">{multiple ? 'Selection' : track.artist}</span>
        </div>

        <button
          type="button"
          className="context-item"
          role="menuitem"
          onClick={run(() => {
            if (multiple || !menu.context) s.playTracks(ids, 0)
            else s.playTracks(menu.context.ids, menu.context.index)
          })}
        >
          <Icon name="play" size={15} /> {multiple ? 'Play selection' : 'Play'}
        </button>
        <button type="button" className="context-item" role="menuitem" onClick={run(() => s.playNext(ids))}>
          <Icon name="next" size={15} /> Play next
        </button>
        <button type="button" className="context-item" role="menuitem" onClick={run(() => s.addToQueue(ids))}>
          <Icon name="queue" size={15} /> Add to queue
        </button>
        <button type="button" className="context-item" role="menuitem" onClick={run(() => s.setLiked(ids, !allLiked))}>
          <Icon name={allLiked ? 'heart' : 'heart-outline'} size={15} /> {allLiked ? 'Remove from Liked' : 'Add to Liked'}
        </button>
        {someTransient && (
          <button type="button" className="context-item" role="menuitem" onClick={run(() => s.addToLibrary(ids))}>
            <Icon name="library" size={15} /> Add to library
          </button>
        )}

        <div className="context-sep" />

        {!showPlaylists ? (
          <button type="button" className="context-item" role="menuitem" onClick={() => setShowPlaylists(true)}>
            <Icon name="playlist" size={15} /> Add to playlist
            <span className="context-chevron">
              <Icon name="chevron-right" size={13} />
            </span>
          </button>
        ) : (
          <div className="context-sub">
            <PlaylistPicker trackIds={ids} onDone={close} variant="context" />
          </div>
        )}

        {!multiple && (
          <>
            <div className="context-sep" />
            <button
              type="button"
              className="context-item"
              role="menuitem"
              onClick={run(() => s.setView({ kind: 'album', id: albumKey(track) }))}
            >
              <Icon name="disc" size={15} /> Go to album
            </button>
            <button
              type="button"
              className="context-item"
              role="menuitem"
              onClick={run(() => s.setView({ kind: 'artist', id: track.artist }))}
            >
              <Icon name="mic" size={15} /> Go to artist
            </button>
            <button type="button" className="context-item" role="menuitem" onClick={run(() => s.setTagEdit(track.id))}>
              <Icon name="edit" size={15} /> Edit details
            </button>
            <button
              type="button"
              className="context-item"
              role="menuitem"
              onClick={run(() => void api.revealFile(track.path))}
            >
              <Icon name="folder" size={15} /> Show in Explorer
            </button>
            <span className="context-foot">
              {[track.bitrate ? `${track.bitrate} kbps` : '', track.sampleRate ? `${(track.sampleRate / 1000).toFixed(1)} kHz` : '', track.genre]
                .filter(Boolean)
                .join(' · ') || 'Audio file'}
            </span>
          </>
        )}
      </div>
    </>
  )
}

/* ------------------------------- tag editor ------------------------------ */

type Draft = { title: string; artist: string; albumArtist: string; album: string; genre: string; year: string }

function TagEditor() {
  const track = useStore((state) => (state.tagEditId ? state.tracks.find((item) => item.id === state.tagEditId) : undefined))
  if (!track) return null
  return <TagEditorForm key={track.id} track={track} />
}

function TagEditorForm({ track }: { track: Track }) {
  const [draft, setDraft] = useState<Draft>(() => ({
    title: track.title,
    artist: track.artist,
    albumArtist: track.albumArtist,
    album: track.album,
    genre: track.genre,
    year: track.year ? String(track.year) : '',
  }))
  const [saving, setSaving] = useState(false)
  const close = (): void => getStore().setTagEdit(null)

  const save = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    const year = draft.year.trim() ? Math.round(Number(draft.year)) : null
    await getStore().updateTrack(track.id, {
      title: draft.title.trim() || track.title,
      artist: draft.artist.trim() || track.artist,
      albumArtist: draft.albumArtist.trim() || draft.artist.trim() || track.albumArtist,
      album: draft.album.trim() || track.album,
      genre: draft.genre.trim(),
      year: year && year > 0 && year < 10000 ? year : null,
    })
    setSaving(false)
    close()
  }

  const fields: { key: keyof Draft; label: string; type?: string; wide?: boolean }[] = [
    { key: 'title', label: 'Title', wide: true },
    { key: 'artist', label: 'Artist' },
    { key: 'albumArtist', label: 'Album artist' },
    { key: 'album', label: 'Album', wide: true },
    { key: 'genre', label: 'Genre' },
    { key: 'year', label: 'Year', type: 'number' },
  ]

  return (
    <div className="modal-backdrop" onPointerDown={close}>
      <div
        className="modal glass-panel tag-editor"
        role="dialog"
        aria-modal="true"
        aria-label="Edit track details"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <p className="eyebrow">Edit details</p>
            <h2 className="truncate">{track.title}</h2>
          </div>
          <button type="button" className="icon-btn" title="Close" aria-label="Close" onClick={close}>
            <Icon name="x" size={17} />
          </button>
        </header>
        <form
          className="modal-body tag-grid"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          {fields.map((field, index) => (
            <label key={field.key} className={cx('field', field.wide && 'wide')}>
              <span>{field.label}</span>
              <input
                className="input boxed"
                type={field.type ?? 'text'}
                value={draft[field.key]}
                autoFocus={index === 0}
                onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                onKeyDown={(event) => event.key === 'Escape' && close()}
              />
            </label>
          ))}
          <p className="help wide">
            Changes are written into the file, so other players see them too. Files that cannot be written keep the
            change inside MeowPlayer.
          </p>
          <p className="help wide path" title={track.path}>
            {track.path}
          </p>
          <footer className="modal-footer wide">
            <button type="button" className="btn ghost" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------ close dialog ----------------------------- */

/** Asked when the window is closed and no choice has been remembered yet. */
function CloseDialog() {
  const [open, setOpen] = useState(false)
  const [remember, setRemember] = useState(false)

  useEffect(() => api.ui.onCloseRequest(() => setOpen(true)), [])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  const answer = (choice: 'tray' | 'quit'): void => {
    setOpen(false)
    api.ui.answerClose(choice, remember)
  }

  return (
    <div className="modal-backdrop" onPointerDown={() => setOpen(false)}>
      <div
        className="modal glass-panel small-modal close-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="close-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2 id="close-title">Keep the music playing?</h2>
            <p className="help">
              MeowPlayer can keep playing from the system tray, or quit completely. You can change this later in
              Settings, Playback.
            </p>
          </div>
        </header>
        <div className="close-options">
          <button type="button" className="close-option" onClick={() => answer('tray')} autoFocus>
            <span className="close-option-icon">
              <Icon name="pip" size={18} />
            </span>
            <span className="close-option-text">
              <span className="setting-label">Keep playing in the tray</span>
              <span className="setting-help">Hide the window, keep the music going.</span>
            </span>
          </button>
          <button type="button" className="close-option" onClick={() => answer('quit')}>
            <span className="close-option-icon">
              <Icon name="x" size={18} />
            </span>
            <span className="close-option-text">
              <span className="setting-label">Quit MeowPlayer</span>
              <span className="setting-help">Stop playback and close the app.</span>
            </span>
          </button>
        </div>
        <footer className="modal-footer spread">
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>Remember my choice</span>
          </label>
          <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}

/* --------------------------------- toasts -------------------------------- */

const TOAST_ICON = { success: 'check', error: 'alert', info: 'info' } as const

function Toasts() {
  const toasts = useStore((state) => state.toasts)
  const dismiss = useStore((state) => state.dismissToast)
  if (!toasts.length) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={cx('toast glass-panel', toast.kind)}>
          <Icon name={TOAST_ICON[toast.kind]} size={15} />
          <span className="grow">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toast.action?.run()
                dismiss(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
