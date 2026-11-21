import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/store/defaults'

describe('sanitizeSettings', () => {
  it('fills in defaults for an empty object', () => {
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS)
  })

  it('rejects an equalizer curve with the wrong number of bands', () => {
    const result = sanitizeSettings({ eqGains: [1, 2, 3] })
    expect(result.eqGains).toEqual(DEFAULT_SETTINGS.eqGains)
  })

  it('clamps out-of-range numbers', () => {
    const result = sanitizeSettings({ volume: 9, crossfade: -4, blur: 500 })
    expect(result.volume).toBe(1.5)
    expect(result.crossfade).toBe(0)
    expect(result.blur).toBe(64)
  })

  it('keeps the 1.x themes and maps the old default name', () => {
    expect(sanitizeSettings({ gradient: 'mono' }).gradient).toBe('graphite')
    expect(sanitizeSettings({ gradient: 'cherry' }).gradient).toBe('cherry')
    expect(sanitizeSettings({ gradient: 'navy' }).gradient).toBe('navy')
    expect(sanitizeSettings({ gradient: 'light' }).gradient).toBe('light')
  })

  it('keeps a custom accent', () => {
    expect(sanitizeSettings({ gradient: 'navy', accent: '#b04356' }).accent).toBe('#b04356')
  })

  it('replaces the old near-black accent', () => {
    expect(sanitizeSettings({ accent: '#1f1f1f' }).accent).toBe(DEFAULT_SETTINGS.accent)
  })

  it('carries over the 1.x close-to-tray switch', () => {
    expect(sanitizeSettings({ closeToTray: true }).closeBehavior).toBe('tray')
    expect(sanitizeSettings({ closeToTray: false }).closeBehavior).toBe('quit')
  })

  it('drops invalid saved presets', () => {
    const result = sanitizeSettings({ eqPresets: [{ name: 'Mine', gains: [0, 0] }, { name: 'Ok', gains: Array(10).fill(1) }] })
    expect(result.eqPresets.map((preset) => preset.name)).toEqual(['Ok'])
  })
})
