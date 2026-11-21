import { useState } from 'react'
import { useStore } from '../store/useStore'
import { cx } from '../utils'

interface Layer {
  src: string
  key: number
}

/**
 * The backdrop behind the whole app: drifting light by default, and while a
 * track with artwork plays, its cover hugely blurred so the interface takes on
 * the mood of the music. Covers crossfade from one track to the next.
 */
export function Ambient() {
  const cover = useStore((state) => state.playingTrack?.cover ?? null)
  const enabled = useStore((state) => state.settings.ambientArt)
  const target = enabled ? cover : null
  const [shown, setShown] = useState<string | null>(null)
  const [layers, setLayers] = useState<Layer[]>([])

  // Adjusting state while rendering (not in an effect) keeps the crossfade in one pass.
  if (target !== shown) {
    setShown(target)
    const key = (layers[layers.length - 1]?.key ?? 0) + 1
    setLayers(target ? [...layers.slice(-1), { src: target, key }] : [])
  }

  return (
    <div className={cx('ambient', layers.length > 0 && 'has-art')} aria-hidden="true">
      <div className="aurora" />
      {layers.map((layer, index) => (
        <div
          key={layer.key}
          className={cx('ambient-art', index === layers.length - 1 && 'current')}
          style={{ backgroundImage: `url("${layer.src}")` }}
        />
      ))}
      <div className="ambient-veil" />
    </div>
  )
}
