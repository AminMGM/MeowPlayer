import { useState } from 'react'
import type { Track } from '../types'
import { useStore } from '../store/useStore'
import { cx, formatTime } from '../utils'
import { Cover } from './Cover'
import { Icon } from './Icons'

interface SongTableProps {
  tracks: Track[]
  onPlay: (index: number) => void
  showAlbum?: boolean
  showIndex?: boolean
  reorder?: (from: number, to: number) => void
  onRemove?: (trackId: string) => void
  emptyLabel?: string
}

export function SongTable({
  tracks,
  onPlay,
  showAlbum = true,
  showIndex = true,
  reorder,
  onRemove,
  emptyLabel,
}: SongTableProps) {
  const currentId = useStore((state) => state.currentId)
  const isPlaying = useStore((state) => state.isPlaying)
  const favorites = useStore((state) => state.favorites)
  const toggleLike = useStore((state) => state.toggleLike)
  const setContextMenu = useStore((state) => state.setContextMenu)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  if (!tracks.length) {
    return <div className="empty-row">{emptyLabel ?? 'Nothing here yet'}</div>
  }

  const gridClass = cx('song-table', !showAlbum && 'no-album', !showIndex && 'no-index')

  return (
    <div className={gridClass}>
      <div className="song-head">
        {showIndex && <span className="col-index">#</span>}
        <span className="col-title">Title</span>
        {showAlbum && <span className="col-album">Album</span>}
        <span className="col-duration">
          <Icon name="clock" size={14} />
        </span>
        <span className="col-actions" />
      </div>

      {tracks.map((track, index) => {
        const active = track.id === currentId
        const liked = favorites.includes(track.id)
        return (
          <div
            key={`${track.id}-${index}`}
            className={cx('song-row', active && 'active', dragIndex === index && 'dragging')}
            onClick={() => onPlay(index)}
            onContextMenu={(event) => {
              event.preventDefault()
              setContextMenu({ x: event.clientX, y: event.clientY, trackId: track.id })
            }}
            draggable={Boolean(reorder)}
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(event) => {
              if (reorder) event.preventDefault()
            }}
            onDrop={(event) => {
              if (!reorder) return
              event.preventDefault()
              if (dragIndex !== null && dragIndex !== index) reorder(dragIndex, index)
              setDragIndex(null)
            }}
            onDoubleClick={() => onPlay(index)}
          >
            {showIndex && (
              <span className="col-index">
                {active && isPlaying ? (
                  <span className="mini-bars" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  <span className="index-number">{index + 1}</span>
                )}
              </span>
            )}

            <span className="col-title">
              <Cover src={track.cover} size={38} seed={track.album} alt={track.album} />
              <span className="title-text">
                <span className="title-name">{track.title}</span>
                <span className="title-artist">{track.artist}</span>
              </span>
            </span>

            {showAlbum && <span className="col-album">{track.album}</span>}

            <span className="col-duration">{formatTime(track.duration)}</span>

            <span className="col-actions">
              <button
                type="button"
                className={cx('icon-btn tiny', liked && 'liked')}
                title={liked ? 'Remove from Liked' : 'Add to Liked'}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleLike(track.id)
                }}
              >
                <Icon name="heart" size={15} />
              </button>
              {onRemove ? (
                <button
                  type="button"
                  className="icon-btn tiny"
                  title="Remove"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemove(track.id)
                  }}
                >
                  <Icon name="x" size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  className="icon-btn tiny"
                  title="More"
                  onClick={(event) => {
                    event.stopPropagation()
                    const rect = event.currentTarget.getBoundingClientRect()
                    setContextMenu({ x: rect.left - 160, y: rect.bottom + 6, trackId: track.id })
                  }}
                >
                  <Icon name="more-horizontal" size={16} />
                </button>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}
