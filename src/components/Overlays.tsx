import { useEffect, useState } from 'react'
import { api } from '../api'
import { useStore } from '../store/useStore'
import { Icon } from './Icons'
import { Settings } from './Settings'

export function Overlays() {
  return (
    <>
      <ContextMenu />
      <TagEditor />
      <Settings />
      <Toast />
    </>
  )
}

function ContextMenu() {
  const menu = useStore((state) => state.contextMenu)
  const setContextMenu = useStore((state) => state.setContextMenu)
  const tracks = useStore((state) => state.tracks)
  const playlists = useStore((state) => state.playlists)
  const favorites = useStore((state) => state.favorites)
  const playTracks = useStore((state) => state.playTracks)
  const playNext = useStore((state) => state.playNext)
  const addToQueue = useStore((state) => state.addToQueue)
  const toggleLike = useStore((state) => state.toggleLike)
  const addToPlaylist = useStore((state) => state.addToPlaylist)
  const createPlaylist = useStore((state) => state.createPlaylist)
  const setView = useStore((state) => state.setView)
  const [showPlaylists, setShowPlaylists] = useState(false)

  useEffect(() => {
    setShowPlaylists(false)
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const handler = (): void => setContextMenu(null)
    const keyHandler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('resize', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      window.removeEventListener('resize', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [menu, setContextMenu])

  if (!menu) return null
  const track = tracks.find((item) => item.id === menu.trackId)
  if (!track) return null

  const liked = favorites.includes(track.id)
  const x = Math.min(menu.x, window.innerWidth - 250)
  const y = Math.min(menu.y, window.innerHeight - 380)

  return (
    <>
      <div className="context-backdrop" onMouseDown={() => setContextMenu(null)} onContextMenu={(event) => event.preventDefault()} />
      <div className="context-menu glass" style={{ left: Math.max(8, x), top: Math.max(8, y) }}>
        <div className="context-head">
          <span className="title-name">{track.title}</span>
          <span className="title-artist">{track.artist}</span>
        </div>
        <button
          type="button"
          className="context-item"
          onClick={() => {
            playTracks([track.id], 0)
            setContextMenu(null)
          }}
        >
          <Icon name="play" size={15} /> Play now
        </button>
        <button
          type="button"
          className="context-item"
          onClick={() => {
            playNext([track.id])
            setContextMenu(null)
          }}
        >
          <Icon name="next" size={15} /> Play next
        </button>
        <button
          type="button"
          className="context-item"
          onClick={() => {
            addToQueue([track.id])
            setContextMenu(null)
          }}
        >
          <Icon name="queue" size={15} /> Add to queue
        </button>
        <button
          type="button"
          className="context-item"
          onClick={() => {
            toggleLike(track.id)
            setContextMenu(null)
          }}
        >
          <Icon name="heart" size={15} /> {liked ? 'Remove from Liked' : 'Add to Liked'}
        </button>

        <div className="context-sep" />

        {!showPlaylists ? (
          <button type="button" className="context-item" onClick={() => setShowPlaylists(true)}>
            <Icon name="playlist" size={15} /> Add to playlist
            <span className="context-chevron">
              <Icon name="chevron-right" size={13} />
            </span>
          </button>
        ) : (
          <div className="context-sub">
            {playlists.length === 0 && <p className="context-hint">No playlists yet</p>}
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                className="context-item"
                onClick={() => {
                  addToPlaylist(playlist.id, [track.id])
                  setContextMenu(null)
                }}
              >
                <Icon name="playlist" size={14} /> <span className="truncate">{playlist.name}</span>
              </button>
            ))}
            <button
              type="button"
              className="context-item accent"
              onClick={() => {
                const id = createPlaylist(`Playlist ${playlists.length + 1}`, [track.id])
                setView({ kind: 'playlist', id })
                setContextMenu(null)
              }}
            >
              <Icon name="plus" size={14} /> New playlist
            </button>
          </div>
        )}

        <div className="context-sep" />

        <button
          type="button"
          className="context-item"
          onClick={() => {
            setView({ kind: 'album', id: `${track.albumArtist}|||${track.album}` })
            setContextMenu(null)
          }}
        >
          <Icon name="disc" size={15} /> Go to album
        </button>
        <button
          type="button"
          className="context-item"
          onClick={() => {
            setView({ kind: 'artist', id: track.artist })
            setContextMenu(null)
          }}
        >
          <Icon name="mic" size={15} /> Go to artist
        </button>
        <button
          type="button"
          className="context-item"
          onClick={() => {
            useStore.getState().setTagEdit(track.id)
            setContextMenu(null)
          }}
        >
          <Icon name="edit" size={15} /> Edit track details
        </button>
        <button
          type="button"
          className="context-item"
          onClick={() => {
            void api.revealFile(track.path)
            setContextMenu(null)
          }}
        >
          <Icon name="folder" size={15} /> Show in Explorer
        </button>
        <span className="context-foot">{track.bitrate ? `${track.bitrate} kbps · ` : ''}{track.genre || 'audio'}</span>
      </div>
    </>
  )
}

function TagEditor() {
  const id = useStore((state) => state.tagEditId)
  const setTagEdit = useStore((state) => state.setTagEdit)
  const track = useStore((state) => (state.tagEditId ? state.tracks.find((item) => item.id === state.tagEditId) : undefined))
  const updateTrack = useStore((state) => state.updateTrack)
  const [draft, setDraft] = useState({ title: '', artist: '', album: '', genre: '', year: '' })

  useEffect(() => {
    if (!track) return
    setDraft({
      title: track.title,
      artist: track.artist,
      album: track.album,
      genre: track.genre,
      year: track.year ? String(track.year) : '',
    })
  }, [track?.id])

  if (!id || !track) return null

  const save = (): void => {
    updateTrack(track.id, {
      title: draft.title.trim() || track.title,
      artist: draft.artist.trim(),
      album: draft.album.trim(),
      genre: draft.genre.trim(),
      year: draft.year.trim() ? Number(draft.year) || null : null,
    })
    setTagEdit(null)
  }

  const fields: { key: keyof typeof draft; label: string; type?: string }[] = [
    { key: 'title', label: 'Title' },
    { key: 'artist', label: 'Artist' },
    { key: 'album', label: 'Album' },
    { key: 'genre', label: 'Genre' },
    { key: 'year', label: 'Year', type: 'number' },
  ]

  return (
    <div className="modal-backdrop" onMouseDown={() => setTagEdit(null)}>
      <div className="modal glass tag-editor" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>Edit track details</h2>
        </div>
        <div className="modal-body">
          <p className="setting-help truncate">{track.path}</p>
          {fields.map((field) => (
            <label key={field.key} className="tag-field">
              <span>{field.label}</span>
              <input
                className="input"
                type={field.type ?? 'text'}
                value={draft[field.key]}
                onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') save()
                  if (event.key === 'Escape') setTagEdit(null)
                }}
              />
            </label>
          ))}
          <p className="setting-help">
            Saved in the MeowPlayer library. Rescanning the folder restores the tags read from the file.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn ghost" onClick={() => setTagEdit(null)}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function Toast() {
  const toast = useStore((state) => state.toast)
  if (!toast) return null
  return (
    <div className="toast glass">
      <Icon name="check" size={15} />
      <span>{toast}</span>
    </div>
  )
}
