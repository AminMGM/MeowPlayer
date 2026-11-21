import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/**
 * The whole app state lives in one JSON file under userData. Writes go to a
 * temporary file that is then renamed over the real one, so a crash or power
 * cut mid-write can never leave a half-written file behind. The previous good
 * copy is kept as `.bak` and is used if the main file is ever unreadable.
 */

let filePath = ''
let state: Record<string, unknown> = {}
let timer: NodeJS.Timeout | null = null

const backupPath = (): string => `${filePath}.bak`

function readJson(file: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function initStore(): void {
  filePath = path.join(app.getPath('userData'), 'meowplayer-state.json')
  const main = readJson(filePath)
  if (main) {
    state = main
    return
  }
  const backup = readJson(backupPath())
  if (backup) {
    console.warn('[store] state file was unreadable, restored the backup copy')
    state = backup
    return
  }
  state = {}
}

export function getState(): Record<string, unknown> {
  return state
}

/** Shallow-merges top-level keys and schedules a write. */
export function patchState(patch: Record<string, unknown>): void {
  state = { ...state, ...patch }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => flush(), 500)
}

export function flush(): void {
  if (!filePath) return
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    const temp = `${filePath}.tmp`
    fs.writeFileSync(temp, JSON.stringify(state))
    if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backupPath())
    fs.renameSync(temp, filePath)
  } catch (err) {
    console.error('[store] failed to persist state', err)
  }
}
