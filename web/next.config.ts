import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',  // enables Docker multi-stage build (copies only what's needed)
  // Clerk auth + middleware handled via clerkMiddleware()
}

export default config
