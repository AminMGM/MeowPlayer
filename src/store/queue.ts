import type { RepeatMode } from '../types'
import { shuffleArray } from '../utils'

/**
 * Pure queue operations. The queue is always the actual play order: shuffle
 * reorders the upcoming tracks instead of jumping to random positions, so
 * "previous" goes back to the track you really heard and every track plays
 * once before anything repeats.
 */

export interface QueueState {
  queue: string[]
  index: number
}

/** Index to play after `index`, or `null` when playback should stop. */
export function nextIndex(length: number, index: number, repeat: RepeatMode, auto: boolean): number | null {
  if (!length) return null
  if (auto && repeat === 'one') return Math.max(0, index)
  const next = index + 1
  if (next < length) return next
  if (repeat === 'all' || !auto) return 0
  return null
}

/** Index to play before `index`, wrapping to the end. */
export function prevIndex(length: number, index: number): number | null {
  if (!length) return null
  return index <= 0 ? length - 1 : index - 1
}

/**
 * Shuffles everything after the current track. The current track stays where
 * it is so playback is not interrupted.
 */
export function shuffleUpcoming(state: QueueState): QueueState {
  const { queue, index } = state
  if (queue.length < 2) return state
  const head = queue.slice(0, Math.max(0, index) + 1)
  const tail = shuffleArray(queue.slice(Math.max(0, index) + 1))
  return { queue: [...head, ...tail], index }
}

/**
 * Restores the original order after shuffle is turned off, keeping the
 * current track playing and continuing from its original position.
 */
export function unshuffle(state: QueueState, original: string[]): QueueState {
  const current = state.queue[state.index]
  const remaining = new Set(state.queue)
  const restored = original.filter((id) => remaining.has(id))
  // Anything queued while shuffled goes to the end, in the order it was added.
  for (const id of state.queue) if (!restored.includes(id)) restored.push(id)
  const index = current ? restored.indexOf(current) : -1
  return { queue: restored, index: index >= 0 ? index : Math.min(state.index, restored.length - 1) }
}

export function removeAt(state: QueueState, at: number): QueueState {
  if (at < 0 || at >= state.queue.length) return state
  const queue = state.queue.filter((_, i) => i !== at)
  let index = state.index
  if (at < index) index -= 1
  else if (at === index) index = Math.min(index, queue.length - 1) - 1
  return { queue, index: Math.max(-1, Math.min(index, queue.length - 1)) }
}

/** Moves one entry, keeping the current index on the same entry (duplicates included). */
export function move(state: QueueState, from: number, to: number): QueueState {
  const { queue, index } = state
  if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return state
  const next = [...queue]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  let current = index
  if (from === index) current = to
  else if (from < index && to >= index) current -= 1
  else if (from > index && to <= index) current += 1
  return { queue: next, index: current }
}

/** Inserts ids right after the current track, moving them up if they were already queued later. */
export function insertNext(state: QueueState, ids: string[]): QueueState {
  const at = Math.max(0, state.index + 1)
  const fresh = [...new Set(ids)]
  const rest = state.queue.slice(at).filter((id) => !fresh.includes(id))
  return { queue: [...state.queue.slice(0, at), ...fresh, ...rest], index: state.index }
}

export function append(state: QueueState, ids: string[]): QueueState {
  return { queue: [...state.queue, ...new Set(ids)], index: state.index }
}
