import type { ReactNode } from 'react'
import { cx } from '../utils'
import { Logo } from './Logo'

interface EmptyStateProps {
  title: string
  children?: ReactNode
  actions?: ReactNode
  foot?: ReactNode
  compact?: boolean
}

/** Empty screens carry the MeowPlayer cat instead of a generic icon. */
export function EmptyState({ title, children, actions, foot, compact }: EmptyStateProps) {
  return (
    <div className={cx('empty-state', compact && 'compact')}>
      <span className="empty-cat" aria-hidden="true">
        <Logo size={compact ? 34 : 52} />
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {actions && <div className="empty-actions">{actions}</div>}
      {foot && <p className="empty-foot">{foot}</p>}
    </div>
  )
}
