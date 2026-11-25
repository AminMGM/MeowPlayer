/**
 * Decides when a track counts as played and when it was skipped.
 *
 * A track counts as played after 10 seconds of real listening (seeking does
 * not count), or when it ends, for tracks shorter than that. Leaving a track
 * before it counted is a skip.
 */
export const PLAYED_AFTER_SECONDS = 10

export interface PlayCounter {
  /** Starts counting a new track; returns the previous track's id if it was skipped. */
  switchTo: (trackId: string) => string | null
  /** Starts the same track over (repeat one); it can count again. */
  restart: () => void
  /** Adds listened seconds; returns true at the moment the track counts as played. */
  listen: (seconds: number) => boolean
  /** The track reached its end; returns true if that made it count. */
  ended: () => boolean
  readonly trackId: string | null
}

export function createPlayCounter(threshold = PLAYED_AFTER_SECONDS): PlayCounter {
  let trackId: string | null = null
  let listened = 0
  let counted = false

  return {
    switchTo(next) {
      const skipped = trackId && !counted && trackId !== next ? trackId : null
      trackId = next
      listened = 0
      counted = false
      return skipped
    },
    restart() {
      listened = 0
      counted = false
    },
    listen(seconds) {
      if (!trackId || counted || !(seconds > 0)) return false
      listened += seconds
      if (listened >= threshold) {
        counted = true
        return true
      }
      return false
    },
    ended() {
      if (!trackId || counted) return false
      counted = true
      return true
    },
    get trackId() {
      return trackId
    },
  }
}

export const playCounter = createPlayCounter()
