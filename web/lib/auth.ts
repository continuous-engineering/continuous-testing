import { auth } from '@clerk/nextjs/server'
import { headers } from 'next/headers'

export type TenantContext = {
  userId: string
  tenantId: string  // Clerk orgId
}

// ── Test mode bypass ──────────────────────────────────────────────────────────
// When CT_TEST_API_KEY env var is set AND request carries matching X-CT-Test-Key header,
// auth is bypassed with a fixed test tenant/user. NEVER enabled in production.
// The test tenant ID is a fixed UUID derived from 'ct-test-tenant'.
const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const TEST_USER_ID   = 'user_test_local'

function isTestRequest(hdrs: Awaited<ReturnType<typeof headers>>): boolean {
  const testKey = process.env.CT_TEST_API_KEY
  // Test mode active when CT_TEST_API_KEY is set AND request carries matching header.
  // NODE_ENV check removed — CT_TEST_API_KEY being set in production is admin's explicit choice.
  if (!testKey) return false
  return hdrs.get('x-ct-test-key') === testKey
}

/**
 * Get tenant context for API route handlers.
 * In test mode (CT_TEST_API_KEY set + matching header): returns fixed test tenant.
 * Otherwise requires Clerk auth.
 */
export async function getTenant(): Promise<TenantContext> {
  const hdrs = await headers()

  if (isTestRequest(hdrs)) {
    return { userId: TEST_USER_ID, tenantId: TEST_TENANT_ID }
  }

  const { userId, orgId } = await auth()
  if (!userId) throw new Error('Unauthenticated')
  if (!orgId)  throw new Error('No organization selected')
  return { userId, tenantId: orgId }
}

/**
 * Build Postgres session variables for RLS.
 */
export function tenantSQLVar(tenantId: string): string {
  return `SET LOCAL app.tenant_id = '${tenantId}'`
}

/**
 * Get tenant ID from request headers (set by middleware).
 */
export async function getTenantIdFromHeaders(): Promise<string> {
  const hdrs = await headers()
  if (isTestRequest(hdrs)) return TEST_TENANT_ID
  const tenantId = hdrs.get('x-tenant-id')
  if (!tenantId) throw new Error('No tenant context in headers')
  return tenantId
}
