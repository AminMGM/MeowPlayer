/** The equalizer bands (Hz) and built-in presets (dB per band). */
export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const

export const EQ_PRESETS: { name: string; gains: number[] }[] = [
  { name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Bass Boost', gains: [8, 7, 5.5, 3, 0.5, 0, 0, 0, 0, 0] },
  { name: 'Treble Boost', gains: [0, 0, 0, 0, 0, 1.5, 3, 5, 7, 8] },
  { name: 'Vocal', gains: [-2, -1, 0.5, 3, 5, 5, 3, 1, 0, -1] },
  { name: 'Rock', gains: [5, 4, 2, -1, -2, 0, 2.5, 4.5, 5.5, 5] },
  { name: 'Pop', gains: [-1, 0, 2, 4, 4.5, 2, -1, -1, 1, 2] },
  { name: 'Jazz', gains: [3, 2, 1, 2, -1, -1, 0, 1, 2.5, 3.5] },
  { name: 'Electronic', gains: [6, 5, 1, 0, -2, 1.5, 1, 2, 5, 6] },
  { name: 'Classical', gains: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4] },
  { name: 'Lo-Fi', gains: [3, 2, 1, 0, -3, -5, -6, -8, -9, -10] },
]
