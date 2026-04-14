import { getTenant } from '@/lib/auth'
import { createSession } from '@/lib/recording'
import { ok, handleError } from '@/lib/api'

export async function POST() {
  try {
    const { userId, tenantId } = await getTenant()
    const { session, token } = await createSession(tenantId, userId)
    return ok({ sessionId: session.id, token })
  } catch (e) { return handleError(e) }
}
