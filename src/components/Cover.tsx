import { Icon } from './Icons'
import { colorFor, initials } from '../utils'

interface CoverProps {
  src?: string | null
  alt?: string
  size?: number
  radius?: number
  className?: string
  seed?: string
  circle?: boolean
}

export function Cover({ src, alt = '', size = 44, radius, className, seed, circle }: CoverProps) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: circle ? '50%' : radius ?? Math.max(6, Math.round(size * 0.16)),
  }

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`cover ${className ?? ''}`}
        style={style}
        loading="lazy"
        draggable={false}
      />
    )
  }

  const label = seed ?? alt
  const background = `linear-gradient(140deg, ${colorFor(label || 'music')}cc, ${colorFor(
    (label || 'music') + 'x',
  )}55)`

  return (
    <div className={`cover cover-fallback ${className ?? ''}`} style={{ ...style, background }} aria-hidden="true">
      {size >= 64 ? (
        label ? (
          <span className="cover-initials" style={{ fontSize: Math.max(12, size * 0.24) }}>
            {initials(label)}
          </span>
        ) : (
          <Icon name="music" size={size * 0.34} />
        )
      ) : null}
    </div>
  )
}
