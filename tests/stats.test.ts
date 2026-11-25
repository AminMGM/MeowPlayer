import { describe, expect, it } from 'vitest'
import { computeStreak, listenedIn, playsIn } from '../src/stats'
import { dayKey } from '../src/utils'

const NOW = new Date(2026, 10, 25, 15, 0).getTime()
const daysAgo = (n: number): string => {
  const date = new Date(NOW)
  date.setDate(date.getDate() - n)
  return dayKey(date.getTime())
}
const log = (days: number[], seconds = 600): Record<string, number> =>
  Object.fromEntries(days.map((n) => [daysAgo(n), seconds]))

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    const streak = computeStreak(log([0, 1, 2, 3]), NOW)
    expect(streak.current).toBe(4)
    expect(streak.today).toBe(true)
  })

  it('keeps yesterday’s streak alive until today ends', () => {
    const streak = computeStreak(log([1, 2]), NOW)
    expect(streak.current).toBe(2)
    expect(streak.today).toBe(false)
  })

  it('breaks on a missed day', () => {
    expect(computeStreak(log([0, 2, 3]), NOW).current).toBe(1)
    expect(computeStreak(log([2, 3]), NOW).current).toBe(0)
  })

  it('ignores days under five minutes', () => {
    expect(computeStreak(log([0, 1], 120), NOW).current).toBe(0)
  })

  it('remembers the best streak', () => {
    const streak = computeStreak({ ...log([0]), ...log([10, 11, 12, 13, 14]) }, NOW)
    expect(streak.current).toBe(1)
    expect(streak.best).toBe(5)
  })

  it('returns the last seven days, ending today', () => {
    const streak = computeStreak(log([0, 2]), NOW)
    expect(streak.week).toHaveLength(7)
    expect(streak.week[6]).toMatchObject({ isToday: true, done: true })
    expect(streak.week[5].done).toBe(false)
    expect(streak.week[4].done).toBe(true)
  })
})

describe('ranges', () => {
  it('adds up listening time per range', () => {
    const data = { ...log([0, 3], 60), ...log([20], 120), ...log([200], 1000) }
    expect(listenedIn(data, '7d', NOW)).toBe(120)
    expect(listenedIn(data, '30d', NOW)).toBe(240)
    expect(listenedIn(data, 'all', NOW)).toBe(1240)
  })

  it('counts plays per track inside a range', () => {
    const day = 86_400_000
    const events = [
      { id: 'a', at: NOW - 1000 },
      { id: 'a', at: NOW - 2 * day },
      { id: 'b', at: NOW - 20 * day },
    ]
    expect(playsIn(events, '7d', NOW).get('a')).toBe(2)
    expect(playsIn(events, '7d', NOW).has('b')).toBe(false)
    expect(playsIn(events, '30d', NOW).get('b')).toBe(1)
  })
})
