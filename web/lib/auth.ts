import { auth } from '@clerk/nextjs/server'
import { headers } from 'next/headers'

export type TenantContext = {
  userId: string
  tenantId: string  // Clerk orgId
}

/**
 * Get tenant context for API route handlers.
 * Throws if not authenticated or no org selected.
 */
export async function getTenant(): Promise<TenantContext> {
  const { userId, orgId } = await auth()

  if (!userId) throw new Error('Unauthenticated')
  if (!orgId)  throw new Error('No organization selected')

  return { userId, tenantId: orgId }
}

/**
 * Build Postgres session variables for RLS.
 * Must be called at the start of every DB-touching request.
 */
export function tenantSQLVar(tenantId: string): string {
  // Validated: orgId from Clerk is trusted server-side
  return `SET LOCAL app.tenant_id = '${tenantId}'`
}

/**
 * Get tenant ID from request headers (set by middleware).
 * Faster than re-calling auth() in nested server components.
 */
export async function getTenantIdFromHeaders(): Promise<string> {
  const hdrs = await headers()
  const tenantId = hdrs.get('x-tenant-id')
  if (!tenantId) throw new Error('No tenant context in headers')
  return tenantId
}
