import { describe, expect, it } from 'vitest'
import { createPlayCounter } from '../src/store/playCounter'

describe('play counter', () => {
  it('counts a play after 10 seconds of listening, once', () => {
    const counter = createPlayCounter()
    counter.switchTo('a')
    expect(counter.listen(4)).toBe(false)
    expect(counter.listen(5.5)).toBe(false)
    expect(counter.listen(1)).toBe(true)
    expect(counter.listen(30)).toBe(false)
  })

  it('reports a skip when leaving before 10 seconds', () => {
    const counter = createPlayCounter()
    counter.switchTo('a')
    counter.listen(3)
    expect(counter.switchTo('b')).toBe('a')
  })

  it('does not report a skip after the track counted', () => {
    const counter = createPlayCounter()
    counter.switchTo('a')
    counter.listen(12)
    expect(counter.switchTo('b')).toBeNull()
  })

  it('counts a short track when it ends, without a skip', () => {
    const counter = createPlayCounter()
    counter.switchTo('jingle')
    counter.listen(6)
    expect(counter.ended()).toBe(true)
    expect(counter.switchTo('next')).toBeNull()
  })

  it('counts each repeat of the same track', () => {
    const counter = createPlayCounter()
    counter.switchTo('a')
    expect(counter.listen(10)).toBe(true)
    counter.restart()
    expect(counter.listen(10)).toBe(true)
  })

  it('ignores seeks and negative time', () => {
    const counter = createPlayCounter()
    counter.switchTo('a')
    expect(counter.listen(-50)).toBe(false)
    expect(counter.listen(Number.NaN)).toBe(false)
  })
})
