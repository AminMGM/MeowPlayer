import { EQ_BANDS } from '../audio/eq'
import type { CloseBehavior, NormalizeMode, Settings, ThemeName, VisualizerStyle } from '../types'

export const DEFAULT_SETTINGS: Settings = {
  accent: '#a3b7c9',
  gradient: 'graphite',
  blur: 38,
  animations: true,
  volume: 0.8,
  muted: false,
  rate: 1,
  folders: [],
  folderAliases: {},
  eqGains: EQ_BANDS.map(() => 0),
  eqPreset: 'Flat',
  eqPresets: [],
  visualizer: true,
  visualizerStyle: 'filament',
  hideDuplicates: false,
  uiScale: 0,
  notifications: false,
  albumTheming: false,
  ambientArt: false,
  updateCheck: true,
  updateSnoozedUntil: null,
  crossfade: 0,
  normalize: 'off',
  gapless: true,
  amplify: false,
  lyrics: true,
  autoLyrics: true,
  miniLyrics: true,
  collapsedSidebar: false,
  watchFolders: true,
  closeBehavior: 'ask',
  sinkId: '',
  firstOpenedAt: null,
  lastOpenedAt: null,
  lastGreetingId: null,
}

const THEMES: ThemeName[] = ['system', 'graphite', 'light', 'cherry', 'navy']

/** The accent palette. Cherry and Navy used to be whole themes in 1.x. */
export const ACCENTS: { name: string; color: string }[] = [
  { name: 'Graphite', color: '#a3b7c9' },
  { name: 'Cherry', color: '#d98a95' },
  { name: 'Navy', color: '#8ea6e6' },
  { name: 'Lavender', color: '#b7a6e6' },
  { name: 'Mint', color: '#86cdb4' },
  { name: 'Amber', color: '#e2b87a' },
  { name: 'Rose', color: '#e2a3bd' },
]

/** Older theme names mapped onto the current ones. */
const LEGACY_THEMES: Record<string, { gradient: ThemeName; accent?: string }> = {
  mono: { gradient: 'graphite' },
  dark: { gradient: 'graphite' },
  liquid: { gradient: 'graphite' },
}
const VISUALIZERS: VisualizerStyle[] = ['bars', 'ribbon', 'aurora', 'filament']
const CLOSE: CloseBehavior[] = ['ask', 'tray', 'quit']
const NORMALIZE: NormalizeMode[] = ['off', 'track', 'album']

const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
const num = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)
const oneOf = <T extends string>(value: unknown, options: T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback
const stamp = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const gains = (value: unknown): number[] | null =>
  Array.isArray(value) && value.length === EQ_BANDS.length && value.every((g) => typeof g === 'number' && Number.isFinite(g))
    ? value.map((g) => Math.max(-12, Math.min(12, g)))
    : null

/**
 * Builds a valid Settings object from anything: a 1.x save file, a settings
 * export from another PC, or a hand-edited JSON file. Unknown keys are dropped
 * and every value is range-checked, so a bad import can never break playback.
 */
export function sanitizeSettings(raw: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = base

  const folders = Array.isArray(input.folders)
    ? [...new Set(input.folders.filter((f): f is string => typeof f === 'string' && f.length > 0))]
    : d.folders
  const aliases: Record<string, string> = {}
  if (input.folderAliases && typeof input.folderAliases === 'object') {
    for (const [key, value] of Object.entries(input.folderAliases as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) aliases[key] = value.trim()
    }
  }
  const presets = Array.isArray(input.eqPresets)
    ? input.eqPresets
        .map((preset) => {
          const p = preset as { name?: unknown; gains?: unknown }
          const g = gains(p?.gains)
          return typeof p?.name === 'string' && p.name.trim() && g ? { name: p.name.trim(), gains: g } : null
        })
        .filter((preset): preset is { name: string; gains: number[] } => Boolean(preset))
    : d.eqPresets

  // 1.x only had a close-to-tray switch; carry that choice over.
  const legacyClose =
    typeof input.closeToTray === 'boolean' ? (input.closeToTray ? 'tray' : 'quit') : undefined

  const legacyTheme = typeof input.gradient === 'string' ? LEGACY_THEMES[input.gradient] : undefined
  // 1.x shipped a near-black accent that disappeared on the dark theme.
  const accent = isHex(input.accent) && input.accent.toLowerCase() !== '#1f1f1f' ? input.accent : d.accent

  return {
    accent: legacyTheme?.accent && accent === DEFAULT_SETTINGS.accent ? legacyTheme.accent : accent,
    gradient: legacyTheme?.gradient ?? oneOf(input.gradient, THEMES, d.gradient),
    blur: num(input.blur, 0, 64, d.blur),
    animations: bool(input.animations, d.animations),
    volume: num(input.volume, 0, 1.5, d.volume),
    muted: bool(input.muted, d.muted),
    rate: num(input.rate, 0.5, 2, d.rate),
    folders,
    folderAliases: input.folderAliases ? aliases : d.folderAliases,
    eqGains: gains(input.eqGains) ?? d.eqGains,
    eqPreset: typeof input.eqPreset === 'string' ? input.eqPreset : d.eqPreset,
    eqPresets: presets,
    visualizer: bool(input.visualizer, d.visualizer),
    visualizerStyle: oneOf(input.visualizerStyle, VISUALIZERS, d.visualizerStyle),
    hideDuplicates: bool(input.hideDuplicates, d.hideDuplicates),
    uiScale: input.uiScale === 0 ? 0 : num(input.uiScale, 0.8, 1.4, d.uiScale),
    notifications: bool(input.notifications, d.notifications),
    albumTheming: bool(input.albumTheming, d.albumTheming),
    ambientArt: bool(input.ambientArt, d.ambientArt),
    updateCheck: bool(input.updateCheck, d.updateCheck),
    updateSnoozedUntil: stamp(input.updateSnoozedUntil) ?? d.updateSnoozedUntil,
    crossfade: num(input.crossfade, 0, 12, d.crossfade),
    normalize: oneOf(input.normalize, NORMALIZE, d.normalize),
    gapless: bool(input.gapless, d.gapless),
    amplify: bool(input.amplify, d.amplify),
    lyrics: bool(input.lyrics, d.lyrics),
    autoLyrics: bool(input.autoLyrics, d.autoLyrics),
    miniLyrics: bool(input.miniLyrics, d.miniLyrics),
    collapsedSidebar: bool(input.collapsedSidebar, d.collapsedSidebar),
    watchFolders: bool(input.watchFolders, d.watchFolders),
    closeBehavior: oneOf(input.closeBehavior ?? legacyClose, CLOSE, d.closeBehavior),
    sinkId: typeof input.sinkId === 'string' ? input.sinkId : d.sinkId,
    firstOpenedAt: stamp(input.firstOpenedAt) ?? d.firstOpenedAt,
    lastOpenedAt: stamp(input.lastOpenedAt) ?? d.lastOpenedAt,
    lastGreetingId: stamp(input.lastGreetingId) ?? d.lastGreetingId,
  }
}

/** Settings that only make sense on the PC they came from are not imported. */
export const MACHINE_SPECIFIC: (keyof Settings)[] = [
  'folders',
  'folderAliases',
  'sinkId',
  'firstOpenedAt',
  'lastOpenedAt',
  'lastGreetingId',
  'updateSnoozedUntil',
]
