/**
 * lib/auth-edge.ts — Edge Runtime safe JWT verification.
 * NO pg, NO Node.js builtins. Only jose (Web Crypto API).
 * Used by middleware.ts only.
 */
import { jwtVerify, type JWTPayload } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'dev-only-change-me-in-production-min-32-chars!',
)

type SessionPayload = JWTPayload & { sub: string; org: string }

export async function verifyJwtEdge(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as SessionPayload
  } catch { return null }
}
