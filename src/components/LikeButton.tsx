import { useState } from 'react'
import { useStore } from '../store/useStore'
import { cx } from '../utils'
import { Icon } from './Icons'

interface LikeButtonProps {
  trackId: string
  size?: number
  className?: string
}

/** A heart that pops with a small burst when a track is liked. */
export function LikeButton({ trackId, size = 17, className }: LikeButtonProps) {
  const liked = useStore((state) => state.favorites.includes(trackId))
  const toggleLike = useStore((state) => state.toggleLike)
  const [burst, setBurst] = useState(0)

  return (
    <button
      type="button"
      className={cx('icon-btn like-btn', liked && 'liked', className)}
      title={liked ? 'Remove from Liked' : 'Add to Liked'}
      aria-label={liked ? 'Remove from Liked' : 'Add to Liked'}
      aria-pressed={liked}
      onClick={(event) => {
        event.stopPropagation()
        if (!liked) setBurst((value) => value + 1)
        toggleLike(trackId)
      }}
    >
      <span key={burst} className={cx('like-icon', burst > 0 && liked && 'pop')}>
        <Icon name={liked ? 'heart' : 'heart-outline'} size={size} />
      </span>
    </button>
  )
}
