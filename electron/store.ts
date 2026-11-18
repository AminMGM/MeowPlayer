import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

let filePath = ''
let state: Record<string, unknown> = {}
let timer: NodeJS.Timeout | null = null

export function initStore(): void {
  filePath = path.join(app.getPath('userData'), 'meowplayer-state.json')
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    state = parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    state = {}
  }
}

export function getState(): Record<string, unknown> {
  return state
}

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
    fs.writeFileSync(filePath, JSON.stringify(state))
  } catch (err) {
    console.error('[store] failed to persist state', err)
  }
}
