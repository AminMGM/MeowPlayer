import { getStore, useStore } from '../store/useStore'
import { Icon } from './Icons'

interface PlaylistPickerProps {
  trackIds: string[]
  onDone: () => void
  /** Renders as context-menu items instead of popover items. */
  variant?: 'popover' | 'context'
}

/** The "add to playlist" list shared by the player bar and every context menu. */
export function PlaylistPicker({ trackIds, onDone, variant = 'popover' }: PlaylistPickerProps) {
  const playlists = useStore((state) => state.playlists)
  const item = variant === 'context' ? 'context-item' : 'popover-item'

  return (
    <>
      {variant === 'popover' && <p className="popover-title">Add to playlist</p>}
      {playlists.length === 0 && <p className={variant === 'context' ? 'context-hint' : 'popover-note'}>No playlists yet</p>}
      <div className="picker-list">
        {playlists.map((playlist) => (
          <button
            key={playlist.id}
            type="button"
            className={item}
            onClick={() => {
              getStore().addToPlaylist(playlist.id, trackIds)
              onDone()
            }}
          >
            <Icon name="playlist" size={14} />
            <span className="truncate grow">{playlist.name}</span>
            <span className="count">{playlist.trackIds.length}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`${item} accent`}
        onClick={() => {
          const s = getStore()
          const id = s.createPlaylist(`Playlist ${s.playlists.length + 1}`, trackIds)
          s.setView({ kind: 'playlist', id })
          onDone()
        }}
      >
        <Icon name="plus" size={14} />
        <span className="grow">New playlist</span>
      </button>
    </>
  )
}
