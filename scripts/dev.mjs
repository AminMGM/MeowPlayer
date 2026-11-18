import { createServer } from 'vite'
import { spawn, execFileSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()

console.log('» compiling electron main process…')
execFileSync(process.execPath, [path.resolve(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.electron.json'], {
  stdio: 'inherit',
  cwd: root,
})

const server = await createServer({ configFile: path.resolve(root, 'vite.config.ts') })
await server.listen()
server.printUrls()
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5173/'

const electronPath = (await import('electron')).default
const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
})

const shutdown = () => {
  child.kill()
  server.close().finally(() => process.exit(0))
}

child.on('close', shutdown)
process.on('SIGINT', shutdown)
