import { useRef, type ReactNode } from 'react'
import { Cover } from '../components/Cover'
import { Icon } from '../components/Icons'
import { useArtworkTint, useScrolledPast } from '../hooks'
import { getStore } from '../store/useStore'
import { cx } from '../utils'

/** Simple page header for list views. */
export function ViewHeader({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow?: string
  title: ReactNode
  sub?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="view-head">
      <div className="view-head-text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="view-title">{title}</h1>
        {sub && <p className="view-sub">{sub}</p>}
      </div>
      {actions && <div className="view-actions">{actions}</div>}
    </header>
  )
}

interface DetailHeaderProps {
  eyebrow: string
  title: ReactNode
  plainTitle: string
  meta?: ReactNode
  cover?: string | null
  seed?: string
  circle?: boolean
  actions?: ReactNode
  onPlay?: () => void
  /** Wraps the artwork, e.g. in a "change cover" button. */
  renderCover?: (cover: ReactNode) => ReactNode
  back?: { label: string; onClick: () => void }
}

/**
 * The header of album, artist and playlist pages. The artwork's colour bleeds
 * into the page behind it, and once the header scrolls away a slim bar with
 * the title and a play button stays pinned to the top.
 */
export function DetailHeader({
  eyebrow,
  title,
  plainTitle,
  meta,
  cover,
  seed,
  circle,
  actions,
  onPlay,
  renderCover,
  back,
}: DetailHeaderProps) {
  const tint = useArtworkTint(cover)
  const ref = useRef<HTMLElement | null>(null)
  const pinned = useScrolledPast(ref)
  const art = (
    <Cover src={cover} size={208} seed={seed ?? plainTitle} alt="" circle={circle} className="detail-cover hero-art" />
  )

  return (
    <>
      <div className="detail-tint" style={tint ? ({ '--tint': tint } as React.CSSProperties) : undefined} />
      <div className={cx('sticky-bar', pinned && 'show')} aria-hidden={!pinned}>
        {onPlay && (
          <button type="button" className="play-btn small" onClick={onPlay} aria-label={`Play ${plainTitle}`} tabIndex={pinned ? 0 : -1}>
            <Icon name="play" size={15} />
          </button>
        )}
        <span className="sticky-title truncate">{plainTitle}</span>
      </div>
      {back && (
        <button type="button" className="link back" onClick={back.onClick}>
          <Icon name="arrow-left" size={15} /> {back.label}
        </button>
      )}
      <header className={cx('detail-head', circle && 'round')} ref={ref}>
        {renderCover ? renderCover(art) : art}
        <div className="detail-info">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="detail-title">{title}</h1>
          {meta && <p className="detail-meta">{meta}</p>}
          {actions && <div className="detail-actions">{actions}</div>}
        </div>
      </header>
    </>
  )
}

/** "Play" and "Shuffle" buttons used by most pages. */
export function PlayButtons({ ids, extra }: { ids: string[]; extra?: ReactNode }) {
  const s = getStore()
  const shuffle = (): void => {
    if (!ids.length) return
    if (!getStore().shuffle) s.toggleShuffle()
    s.playTracks(ids, Math.floor(Math.random() * ids.length))
  }
  return (
    <>
      <button type="button" className="btn primary" onClick={() => ids.length && s.playTracks(ids, 0)} disabled={!ids.length}>
        <Icon name="play" size={15} /> Play
      </button>
      <button type="button" className="btn ghost" onClick={shuffle} disabled={!ids.length}>
        <Icon name="shuffle" size={15} /> Shuffle
      </button>
      {extra}
    </>
  )
}
