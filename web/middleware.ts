import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/api/webhooks/(.*)',   // external webhooks bypass auth
  '/api/triggers/(.*)',  // CI/CD triggers use API key auth, not Clerk
])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  if (isPublicRoute(req)) return NextResponse.next()

  const { userId, orgId } = await auth()

  if (!userId) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Inject tenant context header for API routes
  const headers = new Headers(req.headers)
  if (orgId) headers.set('x-tenant-id', orgId)

  return NextResponse.next({ request: { headers } })
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
