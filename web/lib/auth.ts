/**
 * lib/auth.ts — Own JWT auth. No Clerk. No external dependency.
 *
 * Session flow:
 *   POST /api/auth/login → create session → set httpOnly cookie → return user
 *   Middleware reads cookie → validates JWT → injects headers (x-user-id, x-tenant-id)
 *   Route handler calls getTenant() → reads those headers
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { createHash, randomBytes }              from 'crypto'
import { cookies, headers }                     from 'next/headers'
import { raw }                                  from '@/lib/db/query'

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'dev-only-change-me-in-production-min-32-chars!',
)
const COOKIE  = 'ct_session'
const TTL     = 30 * 86_400        // 30 days in seconds

export type TenantContext = { userId: string; tenantId: string }

type SessionPayload = JWTPayload & { sub: string; org: string; jti: string }

// ── Test-mode bypass ──────────────────────────────────────────────────────
const TEST_TENANT = '00000000-0000-0000-0000-000000000001'
const TEST_USER   = 'user_test_local'

async function isTestRequest(): Promise<boolean> {
  const key = process.env.CT_TEST_API_KEY
  if (!key) return false
  const h = await headers()
  return h.get('x-ct-test-key') === key
}

// ── JWT ───────────────────────────────────────────────────────────────────
export async function signSession(userId: string, orgId: string, jti: string): Promise<string> {
  return new SignJWT({ sub: userId, org: orgId, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`30d`)
    .sign(SECRET)
}

export async function verifyJwt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as SessionPayload
  } catch { return null }
}

function hashToken(t: string) { return createHash('sha256').update(t).digest('hex') }

// ── Session CRUD ──────────────────────────────────────────────────────────
export async function createSession(
  userId: string, orgId: string,
  meta: { ua?: string; ip?: string } = {},
): Promise<string> {
  const jti   = randomBytes(16).toString('hex')
  const token = await signSession(userId, orgId, jti)
  const exp   = new Date(Date.now() + TTL * 1000)
  await raw(
    `INSERT INTO sessions (user_id, org_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, orgId, hashToken(token), exp, meta.ua ?? null, meta.ip ?? null],
  )
  return token
}

export async function validateToken(token: string): Promise<TenantContext | null> {
  const payload = await verifyJwt(token)
  if (!payload?.sub || !payload.org) return null
  const rows = await raw<{ user_id: string; org_id: string }>(
    `UPDATE sessions SET last_seen = now()
     WHERE token_hash = $1 AND expires_at > now()
     RETURNING user_id, org_id`,
    [hashToken(token)],
  )
  if (!rows[0]) return null
  return { userId: rows[0].user_id, tenantId: rows[0].org_id }
}

export async function revokeToken(token: string): Promise<void> {
  await raw(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)])
}

// ── Cookie helpers ────────────────────────────────────────────────────────
export async function setSessionCookie(token: string) {
  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    // Use CT_SECURE_COOKIES=true only when serving over HTTPS.
    // Local Docker on HTTP must be false or browser silently drops the cookie.
    secure: process.env.CT_SECURE_COOKIES === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL,
  })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.delete(COOKIE)
}

export async function getSessionToken(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(COOKIE)?.value ?? null
}

// ── Route handler ─────────────────────────────────────────────────────────
export async function getTenant(): Promise<TenantContext> {
  if (await isTestRequest()) return { userId: TEST_USER, tenantId: TEST_TENANT }
  const h = await headers()
  const userId   = h.get('x-user-id')
  const tenantId = h.get('x-tenant-id')
  if (!userId || !tenantId) throw new Error('Unauthenticated')
  return { userId, tenantId }
}

export function tenantSQLVar(tenantId: string): string {
  return `SET LOCAL app.tenant_id = '${tenantId}'`
}
