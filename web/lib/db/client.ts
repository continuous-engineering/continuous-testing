import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined
}

// Singleton pool — reused across hot reloads in dev
const pool = global.__pgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

if (process.env.NODE_ENV !== 'production') {
  global.__pgPool = pool
}

export default pool
