/**
 * POST /api/runners/heartbeat
 * Called by runner process every 30s. Auth via X-Runner-Token header.
 * Updates last_seen_at, keeps status = idle.
 */
import { createHash } from 'crypto'
import { one } from '@/lib/db/query'
import pool from '@/lib/db/client'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ok, err } from '@/lib/api'

function sqlFile(name: string) {
  return readFileSync(join(process.cwd(), 'lib', 'queries', `${name}.sql`), 'utf-8')
}

export async function POST(req: Request) {
  const token = req.headers.get('x-runner-token')
  if (!token) return err('Missing X-Runner-Token', 401)

  const tokenHash = createHash('sha256').update(token).digest('hex')
  const runner = await one<{ id: string; tenant_id: string }>('runners/get-by-token-hash', [tokenHash])
  if (!runner) return err('Invalid runner token', 401)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL app.tenant_id = '${runner.tenant_id}'`)
    await client.query(sqlFile('runners/heartbeat'), [runner.id])
    await client.query('COMMIT')
  } finally {
    client.release()
  }

  return ok({ status: 'ok', runnerId: runner.id })
}
