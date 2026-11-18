import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { cx } from '../utils'
import { Icon } from './Icons'

interface OutputPickerProps {
  compact?: boolean
}

export function OutputPicker({ compact }: OutputPickerProps) {
  const [open, setOpen] = useState(false)
  const devices = useStore((state) => state.devices)
  const sinkId = useStore((state) => state.settings.sinkId)
  const refreshDevices = useStore((state) => state.refreshDevices)
  const setSink = useStore((state) => state.setSink)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    void refreshDevices()
    const handler = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, refreshDevices])

  const current = devices.find((device) => device.id === sinkId)

  return (
    <div className="menu-anchor" ref={ref}>
      <button
        type="button"
        className={cx('icon-btn', sinkId && 'on', compact && 'tiny')}
        title={current ? `Output: ${current.label}` : 'Playback device'}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="speaker" size={compact ? 15 : 17} />
      </button>
      {open && (
        <div className="popover device-popover">
          <p className="popover-title">Play on</p>
          <button
            type="button"
            className={cx('popover-item', !sinkId && 'active')}
            onClick={() => {
              void setSink('')
              setOpen(false)
            }}
          >
            <span>System default</span>
            {!sinkId && <Icon name="check" size={14} />}
          </button>
          {devices.map((device) => (
            <button
              key={device.id}
              type="button"
              className={cx('popover-item', sinkId === device.id && 'active')}
              onClick={() => {
                void setSink(device.id)
                setOpen(false)
              }}
            >
              <span className="truncate">{device.label}</span>
              {sinkId === device.id && <Icon name="check" size={14} />}
            </button>
          ))}
          {devices.length === 0 && <p className="popover-note">No output devices found</p>}
        </div>
      )}
    </div>
  )
}
