import { clearSessionCookie, getSessionToken, revokeToken } from '@/lib/auth'
import { ok } from '@/lib/api'

export async function POST() {
  const token = await getSessionToken()
  if (token) await revokeToken(token)
  await clearSessionCookie()
  return ok({ loggedOut: true })
}
