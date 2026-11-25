import { useRef, useState } from 'react'
import { useVirtualRows } from '../hooks'
import { useStore } from '../store/useStore'
import type { Track } from '../types'
import { cx, formatTime } from '../utils'
import { Cover } from './Cover'
import { AlphaIndex } from './AlphaIndex'
import { Icon } from './Icons'
import { LikeButton } from './LikeButton'

export type SortKey = 'title' | 'artist' | 'album' | 'added' | 'duration' | 'plays'
export interface SortState {
  key: SortKey
  desc: boolean
}

interface SongTableProps {
  tracks: Track[]
  onPlay: (index: number) => void
  showAlbum?: boolean
  showIndex?: boolean
  /** Shown instead of the album column, e.g. play counts on a smart playlist. */
  extra?: { label: string; render: (track: Track) => React.ReactNode }
  sort?: SortState
  onSort?: (key: SortKey) => void
  /** Row indices, as passed in `tracks`. */
  reorder?: (from: number, to: number) => void
  onRemove?: (indices: number[]) => void
  emptyLabel?: string
  /** Shows an A–Z jump rail keyed on this value (for lists sorted by it). */
  indexBy?: (track: Track) => string
}

const ROW_HEIGHT = 52
const VIRTUAL_AFTER = 150

function SortHeader({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: React.ReactNode
  column: SortKey
  sort?: SortState
  onSort?: (key: SortKey) => void
  className: string
}) {
  if (!onSort) return <span className={className}>{label}</span>
  const active = sort?.key === column
  return (
    <button
      type="button"
      className={cx(className, 'sort-head', active && 'active')}
      onClick={() => onSort(column)}
      aria-sort={active ? (sort?.desc ? 'descending' : 'ascending') : 'none'}
    >
      {label}
      {active && <Icon name="chevron-down" size={12} className={cx('sort-caret', !sort?.desc && 'up')} />}
    </button>
  )
}

export function SongTable({
  tracks,
  onPlay,
  showAlbum = true,
  showIndex = true,
  extra,
  sort,
  onSort,
  reorder,
  onRemove,
  emptyLabel,
  indexBy,
}: SongTableProps) {
  const playingId = useStore((state) => state.playingTrack?.id)
  const isPlaying = useStore((state) => state.isPlaying)
  const setContextMenu = useStore((state) => state.setContextMenu)

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [anchor, setAnchor] = useState<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [listSeen, setListSeen] = useState(tracks)

  // A new list means a new selection (adjusted during render, not in an effect).
  if (listSeen !== tracks) {
    setListSeen(tracks)
    setSelected(new Set())
    setAnchor(null)
  }

  const virtual = tracks.length > VIRTUAL_AFTER
  const { start, end } = useVirtualRows(bodyRef, tracks.length, ROW_HEIGHT, virtual)

  if (!tracks.length) return <div className="empty-row">{emptyLabel ?? 'Nothing here yet'}</div>

  const ids = tracks.map((track) => track.id)

  const select = (index: number, event: React.MouseEvent | React.KeyboardEvent): void => {
    if (event.shiftKey && anchor !== null) {
      const [a, b] = anchor < index ? [anchor, index] : [index, anchor]
      const range = new Set<number>()
      for (let i = a; i <= b; i += 1) range.add(i)
      setSelected(range)
      return
    }
    if (event.ctrlKey || event.metaKey) {
      const next = new Set(selected)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      setSelected(next)
      setAnchor(index)
      return
    }
    setSelected(new Set([index]))
    setAnchor(index)
  }

  const openMenu = (index: number, x: number, y: number): void => {
    const rows = selected.has(index) && selected.size > 1 ? [...selected].sort((a, b) => a - b) : [index]
    if (!selected.has(index)) {
      setSelected(new Set([index]))
      setAnchor(index)
    }
    setContextMenu({
      x,
      y,
      trackIds: rows.map((row) => ids[row]),
      context: { ids, index },
    })
  }

  const onKeyDown = (event: React.KeyboardEvent, index: number): void => {
    const focusRow = (row: number): void => {
      const target = bodyRef.current?.querySelector<HTMLElement>(`[data-row="${row}"]`)
      target?.focus()
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      onPlay(index)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = Math.max(0, Math.min(tracks.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
      select(next, event)
      focusRow(next)
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && onRemove) {
      event.preventDefault()
      onRemove(selected.size ? [...selected] : [index])
    } else if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      setSelected(new Set(tracks.map((_, i) => i)))
    } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault()
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      openMenu(index, rect.left + 48, rect.bottom)
    }
  }

  const rows: number[] = []
  for (let i = start; i < end; i += 1) rows.push(i)

  return (
    <div
      className={cx('song-table', !showAlbum && !extra && 'no-album', !showIndex && 'no-index')}
      role="grid"
      aria-rowcount={tracks.length}
      aria-multiselectable="true"
    >
      <div className="song-head" role="row">
        {showIndex && <span className="col-index">#</span>}
        <SortHeader label="Title" column="title" sort={sort} onSort={onSort} className="col-title" />
        {extra ? (
          <span className="col-album">{extra.label}</span>
        ) : (
          showAlbum && <SortHeader label="Album" column="album" sort={sort} onSort={onSort} className="col-album" />
        )}
        <SortHeader
          label={<Icon name="clock" size={14} />}
          column="duration"
          sort={sort}
          onSort={onSort}
          className="col-duration"
        />
        <span className="col-actions" />
      </div>

      <div
        ref={bodyRef}
        className="song-body"
        style={virtual ? { height: tracks.length * ROW_HEIGHT, position: 'relative' } : undefined}
      >
        {rows.map((index) => {
          const track = tracks[index]
          const active = track.id === playingId
          return (
            <div
              key={`${track.id}-${index}`}
              data-row={index}
              role="row"
              aria-rowindex={index + 1}
              aria-selected={selected.has(index)}
              tabIndex={index === (anchor ?? 0) ? 0 : -1}
              className={cx(
                'song-row',
                active && 'active',
                selected.has(index) && 'selected',
                dragIndex === index && 'dragging',
                dropIndex === index && dragIndex !== null && dragIndex !== index && 'drop-target',
              )}
              style={virtual ? { position: 'absolute', top: index * ROW_HEIGHT, left: 0, right: 0 } : undefined}
              onClick={(event) => select(index, event)}
              onDoubleClick={() => onPlay(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              onContextMenu={(event) => {
                event.preventDefault()
                openMenu(index, event.clientX, event.clientY)
              }}
              draggable={Boolean(reorder)}
              onDragStart={(event) => {
                setDragIndex(index)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('application/x-meowplayer-row', String(index))
              }}
              onDragEnd={() => {
                setDragIndex(null)
                setDropIndex(null)
              }}
              onDragOver={(event) => {
                if (!reorder || dragIndex === null) return
                event.preventDefault()
                setDropIndex(index)
              }}
              onDrop={(event) => {
                if (!reorder || dragIndex === null) return
                event.preventDefault()
                if (dragIndex !== index) reorder(dragIndex, index)
                setDragIndex(null)
                setDropIndex(null)
              }}
            >
              {showIndex && (
                <span className="col-index">
                  {active && isPlaying ? (
                    <span className="mini-bars" aria-label="Playing">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    <>
                      <span className="index-number">{index + 1}</span>
                      <button
                        type="button"
                        className="index-play"
                        title={`Play ${track.title}`}
                        aria-label={`Play ${track.title}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onPlay(index)
                        }}
                      >
                        <Icon name="play" size={13} />
                      </button>
                    </>
                  )}
                </span>
              )}

              <span className="col-title">
                <Cover src={track.cover} size={38} seed={track.album} alt="" />
                <span className="title-text">
                  <span className="title-name">{track.title}</span>
                  <span className="title-artist">{track.artist}</span>
                </span>
              </span>

              {extra ? (
                <span className="col-album">{extra.render(track)}</span>
              ) : (
                showAlbum && <span className="col-album">{track.album}</span>
              )}

              <span className="col-duration">{formatTime(track.duration)}</span>

              <span className="col-actions">
                <LikeButton trackId={track.id} size={15} className="tiny" />
                {onRemove ? (
                  <button
                    type="button"
                    className="icon-btn tiny"
                    title="Remove"
                    aria-label={`Remove ${track.title}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemove([index])
                    }}
                  >
                    <Icon name="x" size={15} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="icon-btn tiny"
                    title="More"
                    aria-label={`More options for ${track.title}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      const rect = event.currentTarget.getBoundingClientRect()
                      openMenu(index, rect.right - 240, rect.bottom + 6)
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
      {indexBy && tracks.length > 30 && (
        <AlphaIndex values={tracks.map(indexBy)} bodyRef={bodyRef} rowHeight={ROW_HEIGHT} />
      )}
    </div>
  )
}
