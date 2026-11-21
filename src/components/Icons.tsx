const FILLED: Record<string, string[]> = {
  play: ['M8 5.2v13.6L19.2 12z'],
  pause: ['M6.2 5h3.9v14H6.2zm7.7 0h3.9v14h-3.9z'],
  next: ['M5.5 18.2V5.8L15 12zM16.6 5.4h2.4v13.2h-2.4z'],
  prev: ['M18.5 18.2V5.8L9 12zM5.5 5.4h2.4v13.2H5.5z'],
  shuffle: [
    'M16.8 3.4 21 7.2l-4.2 3.8V8.6h-1.5c-1 0-1.7.4-2.4 1.3l-1.2 1.6-1.4-1.9 1-1.3c1.1-1.4 2.3-2 4-2h1.5zM3 5.6h3.1c1.7 0 2.9.6 4 2l5.2 7c.7.9 1.4 1.3 2.4 1.3h1.5v-2.4L21 18.6l-4.2 3.8v-2.4h-1.5c-1.7 0-2.9-.6-4-2l-5.2-7c-.7-.9-1.4-1.3-2.4-1.3H3z',
  ],
  repeat: [
    'M17.5 3.5 21 7l-3.5 3.5V8.2H8.6A1.6 1.6 0 0 0 7 9.8v2.6H4.6V9.8A4 4 0 0 1 8.6 5.8h8.9zM6.5 20.5 3 17l3.5-3.5v2.3h8.9a1.6 1.6 0 0 0 1.6-1.6v-2.6h2.4v2.6a4 4 0 0 1-4 4H6.5z',
  ],
  'more-horizontal': [
    'M12 6.4a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8zM12 13.9a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8zM12 21.4a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z',
  ],
  heart: [
    'M12 20.9 4.9 14A5.6 5.6 0 0 1 12 5.9 5.6 5.6 0 0 1 19.1 14z',
  ],
  star: ['M12 3.2l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.5l-5.6 2.9 1.1-6.2L3 9.8l6.2-.9z'],
}

const STROKE: Record<string, string[]> = {
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M16.2 16.2 21 21'],
  home: ['M3 10.7 12 3.3l9 7.4V20a1 1 0 0 1-1 1h-5.2v-6.6H9.2V21H4a1 1 0 0 1-1-1z'],
  music: ['M9 18V5.4L20 3v12', 'M9 18a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z', 'M20 15a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z'],
  disc: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z'],
  mic: ['M12 15.2a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v5.2a4 4 0 0 0 4 4z', 'M5.4 11.4a6.6 6.6 0 0 0 13.2 0', 'M12 18.4V21'],
  playlist: ['M4 6.5h11M4 11.5h11M4 16.5h7', 'M17 13.4v6.2', 'M20 10.4v9'],
  plus: ['M12 5v14M5 12h14'],
  settings: [
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
    'M19.4 15a1.7 1.7 0 0 0 .4 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H2.9a2 2 0 1 1 0-4H3a1.7 1.7 0 0 0 1.4-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4V3.9a2 2 0 1 1 4 0V4a1.7 1.7 0 0 0 2.9 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 20 11h.1a2 2 0 1 1 0 4H20a1.7 1.7 0 0 0-1.6 1z',
  ],
  queue: ['M4 6.5h9M4 11.5h9M4 16.5h6', 'M16.5 10.4v7.4l5-3.7z'],
  sliders: ['M4 8h9M17 8h3M4 16h4M12 16h8', 'M15 5.6v4.8M9 13.6v4.8'],
  'chevron-left': ['M15 18.5 8.5 12 15 5.5'],
  'chevron-right': ['M9 5.5 15.5 12 9 18.5'],
  'chevron-down': ['M5.5 9 12 15.5 18.5 9'],
  x: ['M18 6 6 18M6 6l12 12'],
  moon: ['M20.6 13.4A8.6 8.6 0 1 1 10.6 3.4a6.9 6.9 0 0 0 10 10z'],
  trash: ['M3.6 6.4h16.8M9 6.4V3.8h6v2.6M6.4 6.4 7.4 20a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1l1-13.6'],
  download: ['M12 3.5v11.6M7.4 10.9 12 15.5l4.6-4.6M4.4 20.5h15.2'],
  check: ['M20 6.5 9.4 17.2 4 11.8'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7.4V12l3.4 2'],
  folder: ['M3.4 7.4a2 2 0 0 1 2-2h3.4l2 2h7.8a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2z'],
  // a stack of folders: a scan location that contains several subfolders
  folders: [
    'M6.4 5.4a2 2 0 0 1 2-2h3l1.8 1.8h6.4a2 2 0 0 1 2 2v7.4a2 2 0 0 1-2 2h-1.2',
    'M3.6 9.2a2 2 0 0 1 2-2h2.8l1.8 1.8h6.2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2z',
  ],
  image: ['M4 5.4h16v13.2H4z', 'M4 15.4l4.6-4.6 3.4 3.4 3-3 5 5', 'M15.4 9.4h.01'],
  edit: ['M4.4 19.6l4.2-1.1 10.2-10.2a2 2 0 0 0-2.8-2.8L5.8 15.7z', 'M15.4 6.9l1.7 1.7'],
  refresh: ['M20.4 12a8.4 8.4 0 1 1-2.9-6.4', 'M20.6 3.6v5.6h-5.6'],
  volume: ['M4 9.4h3.2L12 5.4v13.2L7.2 14.6H4z', 'M15.6 9.2a4 4 0 0 1 0 5.6', 'M18.2 6.6a8 8 0 0 1 0 10.8'],
  'volume-mute': ['M4 9.4h3.2L12 5.4v13.2L7.2 14.6H4z', 'M16 9.6l4.4 4.8M20.4 9.6 16 14.4'],
  expand: ['M4 15v5h5M20 9V4h-5'],
  // picture-in-picture: the mini player
  pip: ['M3.4 5.2h17.2v13.6H3.4z', 'M11.6 11.8h6.4v5.2h-6.4z'],
  collapse: ['M9 4v5H4M15 20v-5h5'],
  minimize: ['M5 12h14'],
  maximize: ['M5.4 5.4h13.2v13.2H5.4z'],
  external: ['M14.4 3.6h6v6M20.4 3.6 11 13', 'M9.6 4.4H5.4a1 1 0 0 0-1 1v13.2a1 1 0 0 0 1 1h13.2a1 1 0 0 0 1-1v-4.2'],
  speaker: ['M6 9.4h3.4L14 5.6v12.8L9.4 14.6H6z'],
  sort: ['M7 4v16M3.6 16.6 7 20l3.4-3.4', 'M17 20V4M13.6 7.4 17 4l3.4 3.4'],
  'log-out': ['M15 4.4h3.4a1.6 1.6 0 0 1 1.6 1.6v12a1.6 1.6 0 0 1-1.6 1.6H15', 'M10 8.4 6.4 12l3.6 3.6', 'M6.6 12H16'],
  'arrow-left': ['M19 12H5M11 6 5 12l6 6'],
  'arrow-right': ['M5 12h14M13 6l6 6-6 6'],
  'heart-outline': ['M12 20.2 5.1 13.5a5 5 0 0 1 6.9-7.2 5 5 0 0 1 6.9 7.2z'],
  chart: ['M4 20h16', 'M7 16.5v-5M12 16.5V7M17 16.5v-8'],
  sparkle: ['M12 3.5 13.9 10 20.5 12 13.9 14 12 20.5 10.1 14 3.5 12 10.1 10z'],
  history: ['M3.6 12a8.4 8.4 0 1 0 2.5-6', 'M3.4 4.4v4.2h4.2', 'M12 7.8V12l3 1.8'],
  palette: [
    'M12 3.4a8.6 8.6 0 0 0 0 17.2c1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6h1.9a4.4 4.4 0 0 0 4.4-4.4c0-4.1-3.9-7.4-8.7-7.4z',
    'M7.6 11.6h.01M10 7.8h.01M14.4 7.8h.01',
  ],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5.4M12 7.8h.01'],
  alert: ['M12 3.6 21.4 20H2.6z', 'M12 10v4.4M12 17.4h.01'],
  monitor: ['M3.6 4.6h16.8v11.6H3.6z', 'M8.6 20h6.8M12 16.2V20'],
  library: ['M4.4 4.4v15.2M8.6 4.4v15.2', 'M12.6 5.4l3.8-1 3.6 14.8-3.8 1z'],
  tag: ['M3.6 12.6V4.4h8.2l8.6 8.6-8.2 8.2z', 'M8 8.4h.01'],
  lyrics: ['M4 6h16M4 10.4h16M4 14.8h10', 'M17.6 13.6v6.2', 'M17.6 13.6c1.2.2 2.4.9 2.8 2'],
  headphones: ['M4 15v-3a8 8 0 0 1 16 0v3', 'M4 14.4h2.4a1.4 1.4 0 0 1 1.4 1.4v3.4a1.4 1.4 0 0 1-1.4 1.4H4zM20 14.4h-2.4a1.4 1.4 0 0 0-1.4 1.4v3.4a1.4 1.4 0 0 0 1.4 1.4H20z'],
}

interface IconProps {
  name: string
  size?: number
  className?: string
  strokeWidth?: number
  filledAlt?: boolean
}

export function Icon({ name, size = 18, className, strokeWidth = 1.7 }: IconProps) {
  if (name === 'repeat1') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor" aria-hidden="true">
        {FILLED.repeat.map((d, index) => (
          <path key={index} d={d} />
        ))}
        <text x="12" y="15.6" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor" stroke="none">
          1
        </text>
      </svg>
    )
  }

  const filled = FILLED[name]
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor" aria-hidden="true">
        {filled.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </svg>
    )
  }

  const paths = STROKE[name] ?? []
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  )
}
