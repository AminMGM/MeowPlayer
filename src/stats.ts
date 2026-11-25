import type { PlayEvent } from './types'
import { dayKey } from './utils'

/** Minutes of listening that keep a streak alive for the day. */
export const STREAK_MINUTES = 5
const DAY = 86_400_000

export type StatsRange = '7d' | '30d' | 'all'

export interface Streak {
  /** Days in a row, ending today, or yesterday if today does not count yet. */
  current: number
  best: number
  /** Today already counts. */
  today: boolean
  /** The last 7 days, oldest first. */
  week: { key: string; label: string; done: boolean; isToday: boolean }[]
}

const counts = (log: Record<string, number>, key: string): boolean => (log[key] ?? 0) >= STREAK_MINUTES * 60

/** Shifts a timestamp by whole calendar days, safe across daylight-saving changes. */
function addDays(at: number, days: number): number {
  const date = new Date(at)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

export function computeStreak(log: Record<string, number>, now: number): Streak {
  const today = counts(log, dayKey(now))
  let current = 0
  let cursor = today ? now : addDays(now, -1)
  while (counts(log, dayKey(cursor))) {
    current += 1
    cursor = addDays(cursor, -1)
  }

  let best = 0
  let run = 0
  let previous: number | null = null
  for (const key of Object.keys(log).filter((k) => counts(log, k)).sort()) {
    const [y, m, d] = key.split('-').map(Number)
    const at = new Date(y, m - 1, d).getTime()
    run = previous !== null && Math.round((at - previous) / DAY) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = at
  }

  const week = Array.from({ length: 7 }, (_, i) => {
    const at = addDays(now, i - 6)
    const key = dayKey(at)
    return {
      key,
      label: new Date(at).toLocaleDateString(undefined, { weekday: 'narrow' }),
      done: counts(log, key),
      isToday: i === 6,
    }
  })

  return { current, best: Math.max(best, current), today, week }
}

/** Start of a range as a timestamp (0 for all time). */
export function rangeStart(range: StatsRange, now: number): number {
  if (range === 'all') return 0
  const days = range === '7d' ? 7 : 30
  const date = new Date(addDays(now, -(days - 1)))
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** Seconds listened within the range. */
export function listenedIn(log: Record<string, number>, range: StatsRange, now: number): number {
  if (range === 'all') return Object.values(log).reduce((sum, value) => sum + value, 0)
  const from = dayKey(rangeStart(range, now))
  return Object.entries(log)
    .filter(([key]) => key >= from)
    .reduce((sum, [, value]) => sum + value, 0)
}

/** Play counts per track within the range, from the play log. */
export function playsIn(events: PlayEvent[], range: StatsRange, now: number): Map<string, number> {
  const from = rangeStart(range, now)
  const plays = new Map<string, number>()
  for (const event of events) if (event.at >= from) plays.set(event.id, (plays.get(event.id) ?? 0) + 1)
  return plays
}
