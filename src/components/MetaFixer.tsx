import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { getStore, useStore } from '../store/useStore'
import type { MetaChanges, MetaProposal, Track } from '../types'
import { cx, plural } from '../utils'
import { Cover } from './Cover'
import { Icon } from './Icons'

const UNKNOWN = /^(unknown( artist| album)?|various|untitled)?$/i
const JUNK = /_|\b(official|lyrics?|visuali[sz]er|www\.|\.com\b)|\[(hd|hq|4k)\]/i

const stem = (file: string): string => (file.split(/[\\/]/).pop() ?? '').replace(/\.[^.]+$/, '')

/** Songs worth checking: titles taken from the file name, unknown artists or albums, no year or artwork. */
export function looksIncomplete(track: Track): boolean {
  return (
    track.title === stem(track.path) ||
    JUNK.test(track.title) ||
    UNKNOWN.test(track.artist.trim()) ||
    UNKNOWN.test(track.album.trim()) ||
    !track.year ||
    !track.cover
  )
}

const FIELDS: { key: keyof MetaChanges; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
  { key: 'album', label: 'Album' },
  { key: 'albumArtist', label: 'Album artist' },
  { key: 'year', label: 'Year' },
  { key: 'trackNo', label: 'Track' },
]

type Phase = 'setup' | 'searching' | 'review' | 'applying'

/** "Fix song info": finds better tags and artwork, shows every change, and writes only the ticked ones. */
export function MetaFixer() {
  const scope = useStore((state) => state.metaFix)
  if (!scope) return null
  return <MetaFixerDialog key={Array.isArray(scope) ? scope.join(',') : scope} scope={scope} />
}

function MetaFixerDialog({ scope }: { scope: string[] | 'all' }) {
  const tracks = useStore((state) => state.tracks)
  const [phase, setPhase] = useState<Phase>('setup')
  const [onlyIncomplete, setOnlyIncomplete] = useState(true)
  const [online, setOnline] = useState(true)
  const [progress, setProgress] = useState(0)
  const [proposals, setProposals] = useState<MetaProposal[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const stopRef = useRef(false)
  const close = (): void => {
    stopRef.current = true
    getStore().setMetaFix(null)
  }

  const byId = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks])
  const picked = Array.isArray(scope)
  const targets = useMemo(() => {
    if (Array.isArray(scope)) return scope.map((id) => byId.get(id)).filter((track): track is Track => Boolean(track))
    return onlyIncomplete ? tracks.filter(looksIncomplete) : tracks
  }, [scope, byId, tracks, onlyIncomplete])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && phase !== 'applying') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const search = async (): Promise<void> => {
    stopRef.current = false
    setPhase('searching')
    setProgress(0)
    const found: MetaProposal[] = []
    for (let index = 0; index < targets.length; index += 1) {
      if (stopRef.current) break
      const track = targets[index]
      const proposal = await api.meta.lookup(
        {
          id: track.id,
          path: track.path,
          title: track.title,
          artist: track.artist,
          album: track.album,
          albumArtist: track.albumArtist,
          year: track.year,
          trackNo: track.trackNo,
          duration: track.duration,
          hasCover: Boolean(track.cover),
        },
        online,
      )
      if (proposal) {
        found.push(proposal)
        setProposals([...found])
      }
      setProgress(index + 1)
    }
    if (!getStore().metaFix) return
    setProposals(found)
    setChecked(new Set(found.map((proposal) => proposal.id)))
    setPhase('review')
  }

  const apply = async (): Promise<void> => {
    const chosen = proposals.filter((proposal) => checked.has(proposal.id))
    if (!chosen.length) return
    setPhase('applying')
    setProgress(0)
    const { fixed, failed } = await getStore().applyMetaFixes(chosen, setProgress)
    getStore().showToast(
      failed
        ? `Fixed ${plural(fixed, 'song')}. ${plural(failed, 'file')} could not be written (in use or read-only).`
        : `Fixed ${plural(fixed, 'song')}`,
      { kind: failed ? 'info' : 'success' },
    )
    getStore().setMetaFix(null)
  }

  const toggle = (id: string): void => {
    const next = new Set(checked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setChecked(next)
  }
  const allChecked = proposals.length > 0 && checked.size === proposals.length
  const total = phase === 'applying' ? checked.size : targets.length

  return (
    <div className="modal-backdrop" onPointerDown={() => phase !== 'applying' && close()}>
      <div
        className="modal glass-panel meta-fixer"
        role="dialog"
        aria-modal="true"
        aria-label="Fix song info"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <p className="eyebrow">Fix song info</p>
            <h2>
              {phase === 'review'
                ? proposals.length
                  ? `${plural(proposals.length, 'song')} can be improved`
                  : 'Everything looks right'
                : picked
                  ? plural(targets.length, 'selected song')
                  : 'Names, details and artwork'}
            </h2>
          </div>
          <button type="button" className="icon-btn" title="Close" aria-label="Close" onClick={close} disabled={phase === 'applying'}>
            <Icon name="x" size={17} />
          </button>
        </header>

        {phase === 'setup' && (
          <div className="modal-body meta-setup">
            <p className="help">
              MeowPlayer looks for better titles, artists, albums, years, track numbers and missing artwork. You see every
              change before anything is written, and only the songs you tick are changed.
            </p>
            {!picked && (
              <div className="segmented" role="radiogroup" aria-label="Which songs">
                <button type="button" className={cx('segment', onlyIncomplete && 'active')} onClick={() => setOnlyIncomplete(true)}>
                  Songs with missing info · {tracks.filter(looksIncomplete).length.toLocaleString()}
                </button>
                <button type="button" className={cx('segment', !onlyIncomplete && 'active')} onClick={() => setOnlyIncomplete(false)}>
                  All songs · {tracks.length.toLocaleString()}
                </button>
              </div>
            )}
            <label className="check-row">
              <input type="checkbox" checked={online} onChange={(event) => setOnline(event.target.checked)} />
              <span>
                <strong>Look songs up on MusicBrainz</strong>
                <small>
                  Sends each song's title and artist to musicbrainz.org, the open music database, and fetches artwork from
                  the Cover Art Archive. About one song per second. Off: only file names are used.
                </small>
              </span>
            </label>
            {online && targets.length > 60 && (
              <p className="help">This takes about {Math.ceil(targets.length / 60)} minutes. You can stop at any time and review what was found.</p>
            )}
            <footer className="modal-footer">
              <button type="button" className="btn ghost" onClick={close}>
                Cancel
              </button>
              <button type="button" className="btn primary" disabled={!targets.length} onClick={() => void search()}>
                <Icon name="search" size={15} /> Find fixes
              </button>
            </footer>
          </div>
        )}

        {(phase === 'searching' || phase === 'applying') && (
          <div className="modal-body meta-progress">
            <div className="progress wide">
              <span style={{ width: `${total ? (progress / total) * 100 : 0}%` }} />
            </div>
            <p className="help">
              {phase === 'searching'
                ? `Checked ${progress.toLocaleString()} of ${plural(total, 'song')} · ${plural(proposals.length, 'fix', 'fixes')} found`
                : `Writing ${progress.toLocaleString()} of ${plural(total, 'song')}…`}
            </p>
            {phase === 'searching' && (
              <footer className="modal-footer">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    stopRef.current = true
                  }}
                >
                  Stop and review
                </button>
              </footer>
            )}
          </div>
        )}

        {phase === 'review' && (
          <div className="modal-body meta-review">
            {proposals.length > 0 && (
              <label className="check-row compact">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() => setChecked(allChecked ? new Set() : new Set(proposals.map((proposal) => proposal.id)))}
                />
                <span>
                  <strong>Select all</strong> <small>{checked.size.toLocaleString()} ticked</small>
                </span>
              </label>
            )}
            <ul className="meta-list">
              {proposals.map((proposal) => {
                const track = byId.get(proposal.id)
                if (!track) return null
                return (
                  <li key={proposal.id} className={cx('meta-item', checked.has(proposal.id) && 'on')}>
                    <label>
                      <input type="checkbox" checked={checked.has(proposal.id)} onChange={() => toggle(proposal.id)} />
                      <Cover src={track.cover} size={44} seed={track.title} alt="" />
                      <span className="meta-text">
                        <strong className="truncate">{track.title}</strong>
                        <small className="truncate">
                          {track.artist} · {proposal.source}
                        </small>
                        <span className="meta-diffs">
                          {FIELDS.filter((field) => proposal.changes[field.key] !== undefined).map((field) => (
                            <span key={field.key} className="meta-diff">
                              <em>{field.label}</em>
                              <s>{String(track[field.key] ?? '') || '—'}</s>
                              <Icon name="arrow-right" size={12} />
                              <b>{String(proposal.changes[field.key])}</b>
                            </span>
                          ))}
                          {proposal.coverUrl && (
                            <span className="meta-diff">
                              <em>Artwork</em>
                              <s>none</s>
                              <Icon name="arrow-right" size={12} />
                              <img src={proposal.coverUrl.replace(/front-500$/, 'front-250')} alt="New artwork" />
                            </span>
                          )}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <footer className="modal-footer">
              <button type="button" className="btn ghost" onClick={close}>
                {proposals.length ? 'Cancel' : 'Close'}
              </button>
              {proposals.length > 0 && (
                <button type="button" className="btn primary" disabled={!checked.size} onClick={() => void apply()}>
                  <Icon name="check" size={15} /> Apply {plural(checked.size, 'fix', 'fixes')}
                </button>
              )}
            </footer>
          </div>
        )}
      </div>
    </div>
  )
}
