import { useEffect, useState } from 'react'
import { api } from '../api'
import { matchPlaylist, parsePlaylistExport, type PlaylistRow } from '../spotify'
import { getStore, useStore } from '../store/useStore'
import { plural } from '../utils'
import { Icon } from './Icons'

interface Imported {
  name: string
  playlistId: string | null
  total: number
  matched: number
  missing: PlaylistRow[]
}

/**
 * Rebuilds Spotify playlists from the songs in the local library. Spotify
 * does not allow other players to stream its catalogue, so the playlist is
 * exported to CSV first (Exportify is free and open source) and matched here.
 */
export function SpotifyImport() {
  const open = useStore((state) => state.spotifyImportOpen)
  if (!open) return null
  return <SpotifyImportDialog />
}

function SpotifyImportDialog() {
  const [results, setResults] = useState<Imported[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const close = (): void => getStore().setSpotifyImportOpen(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const pick = async (): Promise<void> => {
    setBusy(true)
    const files = await api.library.pickPlaylistExports()
    const s = getStore()
    const out: Imported[] = []
    for (const file of files) {
      const rows = parsePlaylistExport(file.text)
      if (!rows.length) {
        out.push({ name: file.name, playlistId: null, total: 0, matched: 0, missing: [] })
        continue
      }
      const { ids, missing } = matchPlaylist(rows, s.tracks)
      const playlistId = ids.length ? s.createPlaylist(file.name, ids) : null
      out.push({ name: file.name, playlistId, total: rows.length, matched: ids.length, missing })
    }
    setBusy(false)
    if (files.length) setResults(out)
  }

  return (
    <div className="modal-backdrop" onPointerDown={close}>
      <div
        className="modal glass-panel spotify-import"
        role="dialog"
        aria-modal="true"
        aria-label="Import from Spotify"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <p className="eyebrow">Import from Spotify</p>
            <h2>{results ? 'Imported playlists' : 'Bring your playlists over'}</h2>
          </div>
          <button type="button" className="icon-btn" title="Close" aria-label="Close" onClick={close}>
            <Icon name="x" size={17} />
          </button>
        </header>

        <div className="modal-body">
          {!results ? (
            <>
              <p className="help">
                Spotify does not let other players stream its music, but your playlists can come along: MeowPlayer
                rebuilds them from the songs already in your library and lists the ones you do not have.
              </p>
              <ol className="steps">
                <li>
                  <span>
                    Export your playlists as CSV with <strong>Exportify</strong>, a free open-source site. Sign in with
                    Spotify there and click <em>Export</em> next to a playlist (or <em>Export all</em>).
                  </span>
                  <button type="button" className="btn ghost small" onClick={() => void api.openExternal('https://exportify.net')}>
                    <Icon name="external" size={14} /> Open Exportify
                  </button>
                </li>
                <li>
                  <span>Choose the CSV files here. Each file becomes a playlist. Exports from TuneMyMusic or Soundiiz, and text files with one "Artist - Title" per line, work too.</span>
                </li>
              </ol>
              <footer className="modal-footer">
                <button type="button" className="btn ghost" onClick={close}>
                  Cancel
                </button>
                <button type="button" className="btn primary" disabled={busy} onClick={() => void pick()}>
                  <Icon name="download" size={15} /> {busy ? 'Importing…' : 'Choose CSV files…'}
                </button>
              </footer>
            </>
          ) : (
            <>
              <ul className="import-results">
                {results.map((result) => (
                  <li key={result.name} className="import-result">
                    <div className="import-row">
                      <span className="import-name">
                        <strong className="truncate">{result.name}</strong>
                        <small>
                          {result.total === 0
                            ? 'No songs found in this file'
                            : `${result.matched.toLocaleString()} of ${plural(result.total, 'song')} found in your library`}
                        </small>
                      </span>
                      {result.missing.length > 0 && (
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={() => setExpanded(expanded === result.name ? null : result.name)}
                        >
                          {expanded === result.name ? 'Hide missing' : `${result.missing.length} missing`}
                        </button>
                      )}
                      {result.playlistId && (
                        <button
                          type="button"
                          className="btn primary small"
                          onClick={() => {
                            getStore().setView({ kind: 'playlist', id: result.playlistId as string })
                            close()
                          }}
                        >
                          Open
                        </button>
                      )}
                    </div>
                    {expanded === result.name && (
                      <ul className="missing-list">
                        {result.missing.map((row, index) => (
                          <li key={index} className="truncate">
                            {row.artist ? `${row.artist} — ` : ''}
                            {row.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
              <footer className="modal-footer">
                <button type="button" className="btn ghost" onClick={() => setResults(null)}>
                  Import more
                </button>
                <button type="button" className="btn primary" onClick={close}>
                  Done
                </button>
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
