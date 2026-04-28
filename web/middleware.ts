/**
 * middleware.ts — Own JWT session validation. No Clerk.
 * Reads ct_session cookie → validates → injects x-user-id + x-tenant-id headers.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyJwtEdge } from '@/lib/auth-edge'

// Only these exact paths bypass auth — /api/auth/me is NOT listed (requires valid session)
// Runner sub-routes: only claim/heartbeat/result use runner-token auth (no session).
// /api/runners  (list/register) and /api/runners/status require session auth.
const PUBLIC = [
  '/login',
  '/signup',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/logout',
  '/api/webhooks/',
  '/api/triggers/',
  '/api/runners/claim',
  '/api/runners/heartbeat',
  '/api/runners/result',
]
const SESSION_COOKIE = 'ct_session'

function isPublic(p: string) {
  return PUBLIC.some(r => p === r || (r.endsWith('/') ? p.startsWith(r) : p.startsWith(r + '/')))
}
function isApi(p: string)    { return p.startsWith('/api/') }

function isTestRequest(req: NextRequest): boolean {
  const key = process.env.CT_TEST_API_KEY
  if (!key) return false
  return req.headers.get('x-ct-test-key') === key
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isTestRequest(req)) {
    const h = new Headers(req.headers)
    h.set('x-user-id',   'user_test_local')
    h.set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
    return NextResponse.next({ request: { headers: h } })
  }

  if (isPublic(pathname)) return NextResponse.next()

  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    return isApi(pathname)
      ? NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', req.url))
  }

  const payload = await verifyJwtEdge(token)
  if (!payload?.sub || !payload.org) {
    const res = isApi(pathname)
      ? NextResponse.json({ error: 'Session expired' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete(SESSION_COOKIE)
    return res
  }

  const h = new Headers(req.headers)
  h.set('x-user-id',   payload.sub)
  h.set('x-tenant-id', payload.org as string)
  return NextResponse.next({ request: { headers: h } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
