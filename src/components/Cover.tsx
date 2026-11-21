import { useState } from 'react'
import { colorFor, cx, initials } from '../utils'
import { Icon } from './Icons'

interface CoverProps {
  src?: string | null
  alt?: string
  size?: number
  className?: string
  seed?: string
  circle?: boolean
  /** Fill the parent's width instead of using a fixed size. */
  fluid?: boolean
}

/**
 * Artwork with a consistent radius, a fine inner edge, a shimmer while it
 * loads and a fade-in once it has. Missing artwork falls back to a gradient
 * tile with initials.
 */
export function Cover({ src, alt = '', size = 44, className, seed, circle, fluid }: CoverProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const radius = circle ? '50%' : `${Math.max(6, Math.round(size * 0.14))}px`
  const style: React.CSSProperties = fluid
    ? { borderRadius: radius }
    : { width: size, height: size, borderRadius: radius }

  if (src && failedSrc !== src) {
    return (
      <span className={cx('cover', fluid && 'fluid', loadedSrc === src && 'loaded', className)} style={style}>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
        />
      </span>
    )
  }

  const label = seed ?? alt
  const base = colorFor(label || 'music')
  const background = `linear-gradient(140deg, ${base}d0, ${colorFor(`${label || 'music'}x`)}50)`

  return (
    <span
      className={cx('cover', 'cover-fallback', fluid && 'fluid', className)}
      style={{ ...style, background }}
      aria-hidden="true"
    >
      {(fluid || size >= 64) &&
        (label ? (
          <span className="cover-initials" style={fluid ? undefined : { fontSize: Math.max(12, size * 0.24) }}>
            {initials(label)}
          </span>
        ) : (
          <Icon name="music" size={fluid ? 32 : size * 0.34} />
        ))}
    </span>
  )
}
