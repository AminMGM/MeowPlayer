import { useEffect, useRef, useState } from 'react'
import { useDismiss } from '../hooks'
import { useStore } from '../store/useStore'
import { cx } from '../utils'
import { Icon } from './Icons'

/** Chooses the audio output device (speakers, headphones, Bluetooth). */
export function OutputPicker() {
  const [open, setOpen] = useState(false)
  const devices = useStore((state) => state.devices)
  const sinkId = useStore((state) => state.settings.sinkId)
  const refreshDevices = useStore((state) => state.refreshDevices)
  const setSink = useStore((state) => state.setSink)
  const ref = useRef<HTMLDivElement | null>(null)
  useDismiss(ref, open, () => setOpen(false))

  useEffect(() => {
    if (open) void refreshDevices()
  }, [open, refreshDevices])

  const current = devices.find((device) => device.id === sinkId)
  const choose = (id: string): void => {
    void setSink(id)
    setOpen(false)
  }

  return (
    <div className="menu-anchor" ref={ref}>
      <button
        type="button"
        className={cx('icon-btn', (open || sinkId) && 'on')}
        title={current ? `Output: ${current.label}` : 'Output device'}
        aria-label="Output device"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="speaker" size={17} />
      </button>
      {open && (
        <div className="popover device-popover">
          <p className="popover-title">Play on</p>
          <button type="button" className={cx('popover-item', !sinkId && 'active')} onClick={() => choose('')}>
            <span className="grow">System default</span>
            {!sinkId && <Icon name="check" size={14} />}
          </button>
          {devices.map((device) => (
            <button
              key={device.id}
              type="button"
              className={cx('popover-item', sinkId === device.id && 'active')}
              onClick={() => choose(device.id)}
            >
              <span className="truncate grow">{device.label}</span>
              {sinkId === device.id && <Icon name="check" size={14} />}
            </button>
          ))}
          {devices.length === 0 && <p className="popover-note">No other output devices found</p>}
        </div>
      )}
    </div>
  )
}
