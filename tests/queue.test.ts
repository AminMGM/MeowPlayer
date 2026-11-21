import { describe, expect, it } from 'vitest'
import { insertNext, move, nextIndex, prevIndex, removeAt, shuffleUpcoming, unshuffle } from '../src/store/queue'

describe('nextIndex', () => {
  it('advances through the queue', () => {
    expect(nextIndex(3, 0, 'off', true)).toBe(1)
  })

  it('stops at the end with repeat off when the track ended by itself', () => {
    expect(nextIndex(3, 2, 'off', true)).toBeNull()
  })

  it('wraps at the end when the user presses next', () => {
    expect(nextIndex(3, 2, 'off', false)).toBe(0)
  })

  it('wraps at the end with repeat all', () => {
    expect(nextIndex(3, 2, 'all', true)).toBe(0)
  })

  it('stays on the same track with repeat one, but only when it ended by itself', () => {
    expect(nextIndex(3, 1, 'one', true)).toBe(1)
    expect(nextIndex(3, 1, 'one', false)).toBe(2)
  })

  it('handles an empty queue', () => {
    expect(nextIndex(0, -1, 'all', true)).toBeNull()
  })
})

describe('prevIndex', () => {
  it('goes back and wraps to the end', () => {
    expect(prevIndex(3, 2)).toBe(1)
    expect(prevIndex(3, 0)).toBe(2)
  })
})

describe('shuffle', () => {
  const queue = ['a', 'b', 'c', 'd', 'e', 'f']

  it('keeps the played part and the current track in place', () => {
    const result = shuffleUpcoming({ queue, index: 2 })
    expect(result.index).toBe(2)
    expect(result.queue.slice(0, 3)).toEqual(['a', 'b', 'c'])
    expect([...result.queue].sort()).toEqual([...queue].sort())
  })

  it('restores the original order and keeps the current track playing', () => {
    const shuffled = { queue: ['a', 'b', 'c', 'f', 'd', 'e'], index: 3 }
    const result = unshuffle(shuffled, queue)
    expect(result.queue).toEqual(queue)
    expect(result.queue[result.index]).toBe('f')
  })

  it('keeps tracks queued while shuffled', () => {
    const result = unshuffle({ queue: ['a', 'x', 'b'], index: 1 }, ['a', 'b'])
    expect(result.queue).toEqual(['a', 'b', 'x'])
    expect(result.queue[result.index]).toBe('x')
  })
})

describe('removeAt', () => {
  it('shifts the current index when an earlier track is removed', () => {
    expect(removeAt({ queue: ['a', 'b', 'c'], index: 2 }, 0)).toEqual({ queue: ['b', 'c'], index: 1 })
  })

  it('leaves the current index alone when a later track is removed', () => {
    expect(removeAt({ queue: ['a', 'b', 'c'], index: 0 }, 2)).toEqual({ queue: ['a', 'b'], index: 0 })
  })

  it('makes "next" play the track after a removed current track', () => {
    const result = removeAt({ queue: ['a', 'b', 'c'], index: 1 }, 1)
    expect(result.queue).toEqual(['a', 'c'])
    expect(result.queue[result.index + 1]).toBe('c')
  })

  it('ignores an index out of range', () => {
    const state = { queue: ['a'], index: 0 }
    expect(removeAt(state, 5)).toBe(state)
  })
})

describe('move', () => {
  it('follows the current track when it is moved', () => {
    expect(move({ queue: ['a', 'b', 'c'], index: 0 }, 0, 2)).toEqual({ queue: ['b', 'c', 'a'], index: 2 })
  })

  it('keeps the right entry current when the same track is queued twice', () => {
    const result = move({ queue: ['a', 'b', 'a'], index: 2 }, 0, 1)
    expect(result.queue).toEqual(['b', 'a', 'a'])
    expect(result.index).toBe(2)
  })

  it('adjusts the index when a track jumps over the current one', () => {
    expect(move({ queue: ['a', 'b', 'c'], index: 1 }, 2, 0)).toEqual({ queue: ['c', 'a', 'b'], index: 2 })
    expect(move({ queue: ['a', 'b', 'c'], index: 1 }, 0, 2)).toEqual({ queue: ['b', 'c', 'a'], index: 0 })
  })
})

describe('insertNext', () => {
  it('puts tracks right after the current one and moves them up if already queued', () => {
    const result = insertNext({ queue: ['a', 'b', 'c', 'd'], index: 0 }, ['d'])
    expect(result.queue).toEqual(['a', 'd', 'b', 'c'])
  })
})
