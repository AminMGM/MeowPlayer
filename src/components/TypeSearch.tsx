import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getStore, useStore } from '../store/useStore'
import { plural } from '../utils'
import { Icon } from './Icons'

const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  return Boolean(
    el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable),
  )
}

/**
 * Type-to-search: on list pages, typing anywhere (outside a text box) filters
 * the page. Backspace edits the query and Escape clears it. On these pages
 * letters search instead of acting as shortcuts; Space still plays and pauses.
 */
export function useTypeToSearch(): [string, (query: string) => void] {
  const enabled = useStore((state) => state.settings.typeToSearch)
  const [query, setQuery] = useState('')
  const queryRef = useRef(query)

  useEffect(() => {
    queryRef.current = query
  }, [query])

  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented || event.isComposing) return
      if (isTypingTarget(event.target)) return
      const store = getStore()
      if (store.settingsOpen || store.tagEditId || store.contextMenu || document.querySelector('[role="dialog"]')) return

      const current = queryRef.current
      if (event.key === 'Escape' || event.key === 'Backspace') {
        if (!current) return
        event.preventDefault()
        event.stopPropagation()
        setQuery(event.key === 'Escape' ? '' : current.slice(0, -1))
        return
      }
      if (event.key.length !== 1) return
      // Space still plays and pauses until a search has started.
      if (event.key === ' ' && !current) return
      event.preventDefault()
      event.stopPropagation()
      setQuery(current + event.key)
    }
    // Capture, so a letter reaches the search before the single-key shortcuts.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled])

  return [query, setQuery]
}

/** The floating "searching for…" pill, plus a one-time popup explaining the feature. */
export function TypeSearchPill({ query, count, onClear }: { query: string; count: number; onClear: () => void }) {
  const introSeen = useStore((state) => state.settings.typeToSearchIntroSeen)
  if (!query) return null
  const s = getStore()

  return createPortal(
    <div className="type-search-wrap">
      {!introSeen && (
        <div className="type-search-intro glass-panel" role="region" aria-label="Type to search">
          <strong>Type to search</strong>
          <p>Typing on this page filters it. Backspace edits, Esc clears. You can turn this off in Settings → Library.</p>
          <div className="type-search-intro-actions">
            <button
              type="button"
              className="btn ghost small"
              onClick={() => {
                s.updateSettings({ typeToSearch: false, typeToSearchIntroSeen: true })
                onClear()
              }}
            >
              Turn off
            </button>
            <button type="button" className="btn primary small" onClick={() => s.updateSettings({ typeToSearchIntroSeen: true })}>
              Keep it
            </button>
          </div>
        </div>
      )}
      <div className="type-search glass-panel" role="status">
        <Icon name="search" size={14} />
        <span className="type-search-query">{query}</span>
        <span className="type-search-count">{count ? plural(count, 'match', 'matches') : 'No matches'}</span>
        <button type="button" className="icon-btn tiny" aria-label="Clear search" onClick={onClear}>
          <Icon name="x" size={12} />
        </button>
      </div>
    </div>,
    document.body,
  )
}
