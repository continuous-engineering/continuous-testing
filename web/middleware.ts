import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/api/webhooks/(.*)',   // inbound issue sync
  '/api/triggers/(.*)',  // CI/CD: API key auth
  '/api/runners/(.*)',   // runner protocol: X-Runner-Token auth
])

/** Test mode: bypass Clerk when X-CT-Test-Key matches CT_TEST_API_KEY env var */
function isTestMode(req: NextRequest): boolean {
  const testKey = process.env.CT_TEST_API_KEY
  if (!testKey) return false
  return req.headers.get('x-ct-test-key') === testKey
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Test mode bypass — never active if CT_TEST_API_KEY not set
  if (isTestMode(req)) {
    const headers = new Headers(req.headers)
    headers.set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
    return NextResponse.next({ request: { headers } })
  }

  if (isPublicRoute(req)) return NextResponse.next()

  const { userId, orgId } = await auth()

  if (!userId) {
    // API routes return 401, UI routes redirect to login
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const headers = new Headers(req.headers)
  if (orgId) headers.set('x-tenant-id', orgId)
  return NextResponse.next({ request: { headers } })
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
