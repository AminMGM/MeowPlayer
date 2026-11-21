import { useMemo } from 'react'
import { Cover } from '../components/Cover'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icons'
import { LikeButton } from '../components/LikeButton'
import { Lyrics } from '../components/Lyrics'
import { Visualizer } from '../components/Visualizer'
import { getStore, useStore } from '../store/useStore'
import type { Track } from '../types'
import { albumKey, formatTime } from '../utils'

export function NowPlayingView() {
  const track = useStore((state) => state.playingTrack)
  const queue = useStore((state) => state.queue)
  const queueIndex = useStore((state) => state.queueIndex)
  const tracks = useStore((state) => state.tracks)
  const s = getStore()

  const upNext = useMemo(() => {
    const byId = new Map(tracks.map((item) => [item.id, item]))
    return queue
      .slice(queueIndex + 1, queueIndex + 5)
      .map((id, offset) => ({ track: byId.get(id), index: queueIndex + 1 + offset }))
      .filter((entry): entry is { track: Track; index: number } => Boolean(entry.track))
  }, [queue, queueIndex, tracks])

  if (!track) {
    return (
      <div className="view">
        <EmptyState
          title="Nothing playing"
          actions={
            <button type="button" className="btn primary" onClick={() => s.setView({ kind: 'songs' })}>
              <Icon name="music" size={15} /> Browse songs
            </button>
          }
        >
          Pick a song and this stage fills up with its artwork, lyrics and a live spectrum.
        </EmptyState>
      </div>
    )
  }

  const facts = [
    track.year ? String(track.year) : '',
    track.genre,
    track.bitrate ? `${track.bitrate} kbps` : '',
    track.sampleRate ? `${(track.sampleRate / 1000).toFixed(1)} kHz` : '',
  ].filter(Boolean)

  return (
    <div className="view now-stage">
      <div className="stage-left">
        <Cover src={track.cover} size={360} seed={track.album} alt={track.album} className="stage-cover hero-art" />
        <div className="stage-meta">
          <div className="stage-heading">
            <div className="stage-text">
              <h1 className="stage-title">{track.title}</h1>
              <p className="stage-sub">
                <button type="button" className="link strong" onClick={() => s.setView({ kind: 'artist', id: track.artist })}>
                  {track.artist}
                </button>
                <span className="dot">·</span>
                <button type="button" className="link" onClick={() => s.setView({ kind: 'album', id: albumKey(track) })}>
                  {track.album}
                </button>
              </p>
            </div>
            <LikeButton trackId={track.id} size={20} />
          </div>
          {facts.length > 0 && (
            <div className="chip-row">
              {facts.map((fact) => (
                <span key={fact} className="chip static">
                  {fact}
                </span>
              ))}
            </div>
          )}
        </div>
        <Visualizer height={110} />

        {upNext.length > 0 && (
          <div className="stage-upnext">
            <p className="section-label">Up next</p>
            {upNext.map(({ track: item, index }) => (
              <button key={`${item.id}-${index}`} type="button" className="stat-row" onClick={() => s.jump(index)}>
                <Cover src={item.cover} size={36} seed={item.album} alt="" />
                <span className="stat-text">
                  <span className="title-name">{item.title}</span>
                  <span className="title-artist">{item.artist}</span>
                </span>
                <span className="stat-plays">{formatTime(item.duration)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="stage-right">
        <Lyrics stage />
      </div>
    </div>
  )
}
