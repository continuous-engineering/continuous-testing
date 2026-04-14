/**
 * lib/recording.ts — DB-backed recording session store.
 *
 * Sessions live in recording_sessions table (expires_at = now + 2h).
 * No RLS — the table uses token_hash for bookmarklet auth and tenant_id for app auth.
 * Cross-origin note: IndexedDB/localStorage are origin-scoped so the bookmarklet
 * (running on any site) MUST talk to us via HTTP. That's why we store server-side.
 */
import { createHash, randomBytes } from 'crypto'
import { raw } from '@/lib/db/query'

export type RecordedAction = {
  type:      'navigate' | 'click' | 'fill' | 'select' | 'assert' | 'screenshot'
  url?:      string
  selector?: string
  value?:    string
  intent?:   string
}

export type RecordingSession = {
  id:          string
  tenantId:    string
  userId:      string
  startUrl:    string
  actions:     RecordedAction[]
  status:      'active' | 'saved'
  createdAt:   string
  savedAt?:    string
}

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(tenantId: string, userId: string): Promise<{ session: RecordingSession; token: string }> {
  const id    = randomBytes(12).toString('hex')
  const token = randomBytes(24).toString('hex')
  await raw(
    `INSERT INTO recording_sessions (id, token_hash, tenant_id, user_id)
     VALUES ($1, $2, $3, $4)`,
    [id, hash(token), tenantId, userId],
  )
  return {
    token,
    session: { id, tenantId, userId, startUrl: '', actions: [], status: 'active', createdAt: new Date().toISOString() },
  }
}

export async function getSession(id: string, tenantId: string): Promise<RecordingSession | null> {
  const rows = await raw<{
    id: string; tenant_id: string; user_id: string; start_url: string
    actions: RecordedAction[]; status: string; created_at: string; saved_at: string | null
  }>(
    `SELECT id, tenant_id, user_id, start_url, actions, status, created_at, saved_at
     FROM recording_sessions
     WHERE id = $1 AND tenant_id = $2 AND expires_at > now()`,
    [id, tenantId],
  )
  const r = rows[0]
  if (!r) return null
  return {
    id:        r.id,
    tenantId:  r.tenant_id,
    userId:    r.user_id,
    startUrl:  r.start_url,
    actions:   r.actions,
    status:    r.status as 'active' | 'saved',
    createdAt: r.created_at,
    savedAt:   r.saved_at ?? undefined,
  }
}

export async function saveActions(id: string, token: string, startUrl: string, actions: RecordedAction[]): Promise<boolean> {
  const rows = await raw<{ id: string }>(
    `UPDATE recording_sessions
     SET start_url = $3, actions = $4::jsonb, status = 'saved', saved_at = now()
     WHERE id = $1 AND token_hash = $2 AND expires_at > now()
     RETURNING id`,
    [id, hash(token), startUrl, JSON.stringify(actions)],
  )
  return rows.length > 0
}
