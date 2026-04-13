/**
 * Ephemeral json-server instance per DAG run.
 * Spins up on a random port, serves seeded db.json.
 * Exposes auth/latency/error middleware toggles.
 * Torn down after run completes.
 */
import { createServer } from 'http'
import { spawn, type ChildProcess } from 'child_process'
import * as net from 'net'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export type MockMiddleware = {
  auth?: { header?: string; validPrefix?: string }
  latency?: { baseMs: number; jitterMs: number }
  errors?: { rate: number; endpoints?: string[] }
}

export type MockServerInstance = {
  port: number
  baseUrl: string
  stop: () => Promise<void>
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      srv.close(() => {
        if (addr && typeof addr === 'object') resolve(addr.port)
        else reject(new Error('Could not get port'))
      })
    })
  })
}

function buildMiddlewareJs(mw: MockMiddleware): string {
  const lines: string[] = ['module.exports = (req, res, next) => {']

  if (mw.auth?.validPrefix) {
    const header = mw.auth.header ?? 'Authorization'
    lines.push(`  const val = req.headers['${header.toLowerCase()}'];`)
    lines.push(`  if (!val || !val.startsWith('${mw.auth.validPrefix}')) {`)
    lines.push(`    return res.status(401).json({ error: 'Unauthorized' });`)
    lines.push(`  }`)
  }

  if (mw.errors?.rate && mw.errors.rate > 0) {
    const endpoints = JSON.stringify(mw.errors.endpoints ?? [])
    lines.push(`  const errEndpoints = ${endpoints};`)
    lines.push(`  const inScope = errEndpoints.length === 0 || errEndpoints.some(e => req.path.startsWith(e));`)
    lines.push(`  if (inScope && Math.random() < ${mw.errors.rate}) {`)
    lines.push(`    return res.status(500).json({ error: 'Simulated error' });`)
    lines.push(`  }`)
  }

  if (mw.latency?.baseMs) {
    const base = mw.latency.baseMs
    const jitter = mw.latency.jitterMs ?? 0
    lines.push(`  setTimeout(next, ${base} + Math.floor(Math.random() * ${jitter}));`)
  } else {
    lines.push('  next();')
  }

  lines.push('}')
  return lines.join('\n')
}

export async function startMockServer(
  dbJson: Record<string, unknown>,
  middleware: MockMiddleware = {},
): Promise<MockServerInstance> {
  const port = await findFreePort()
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-mock-'))
  const dbFile = path.join(tmpDir, 'db.json')
  const mwFile = path.join(tmpDir, 'middleware.js')

  fs.writeFileSync(dbFile, JSON.stringify(dbJson, null, 2))
  fs.writeFileSync(mwFile, buildMiddlewareJs(middleware))

  const proc: ChildProcess = spawn(
    'node',
    [
      require.resolve('json-server/lib/cli/bin'),
      '--watch', dbFile,
      '--middlewares', mwFile,
      '--port', String(port),
      '--quiet',
    ],
    { stdio: 'ignore' },
  )

  // Wait for server to be ready
  await waitForPort(port, 5000)

  return {
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>((resolve) => {
      proc.once('exit', () => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
        resolve()
      })
      proc.kill('SIGTERM')
    }),
  }
}

function waitForPort(port: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    function attempt() {
      const sock = net.createConnection(port, '127.0.0.1')
      sock.once('connect', () => { sock.destroy(); resolve() })
      sock.once('error', () => {
        sock.destroy()
        if (Date.now() > deadline) reject(new Error(`Port ${port} not ready after ${timeoutMs}ms`))
        else setTimeout(attempt, 100)
      })
    }
    attempt()
  })
}
