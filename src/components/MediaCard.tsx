import type { MouseEvent, ReactNode } from 'react'
import { cx } from '../utils'
import { Cover } from './Cover'
import { Icon } from './Icons'

interface MediaCardProps {
  title: string
  subtitle?: ReactNode
  cover?: string | null
  seed?: string
  circle?: boolean
  badge?: ReactNode
  /** Opens the item. Receives the artwork element so it can morph into the next page. */
  onOpen?: (art: HTMLElement | null) => void
  onPlay?: () => void
  onContextMenu?: (event: MouseEvent) => void
  className?: string
}

/** A square artwork card used by every grid and row in the library. */
export function MediaCard({
  title,
  subtitle,
  cover,
  seed,
  circle,
  badge,
  onOpen,
  onPlay,
  onContextMenu,
  className,
}: MediaCardProps) {
  const open = (event: MouseEvent<HTMLElement>): void => {
    const art = event.currentTarget.querySelector<HTMLElement>('.cover')
    if (onOpen) onOpen(art)
    else onPlay?.()
  }

  return (
    <div
      className={cx('media-card', circle && 'round', className)}
      role="button"
      tabIndex={0}
      onClick={open}
      onContextMenu={onContextMenu}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (onOpen) onOpen(event.currentTarget.querySelector<HTMLElement>('.cover'))
          else onPlay?.()
        }
      }}
    >
      <div className="media-art">
        <Cover src={cover} seed={seed ?? title} alt={title} circle={circle} fluid />
        {badge && <span className="card-badge">{badge}</span>}
        {onPlay && (
          <button
            type="button"
            className="card-play"
            title={`Play ${title}`}
            aria-label={`Play ${title}`}
            onClick={(event) => {
              event.stopPropagation()
              onPlay()
            }}
          >
            <Icon name="play" size={16} />
          </button>
        )}
      </div>
      <span className="media-title" title={title}>
        {title}
      </span>
      {subtitle && <span className="media-sub">{subtitle}</span>}
    </div>
  )
}
