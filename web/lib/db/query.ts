import { readFileSync } from 'fs'
import { join } from 'path'
import type { PoolClient } from 'pg'
import pool from './client'

// ─── SQL file cache ───────────────────────────────────────────────────────────
const cache = new Map<string, string>()

function sql(name: string): string {
  if (!cache.has(name)) {
    const filePath = join(process.cwd(), 'lib', 'queries', `${name}.sql`)
    cache.set(name, readFileSync(filePath, 'utf-8'))
  }
  return cache.get(name)!
}

// ─── Query helpers ────────────────────────────────────────────────────────────

/** Run a named .sql query, return all rows */
export async function query<T = Record<string, unknown>>(
  name: string,
  params?: unknown[],
): Promise<T[]> {
  const { rows } = await pool.query(sql(name), params)
  return rows as T[]
}

/** Run a named .sql query, return first row or null */
export async function one<T = Record<string, unknown>>(
  name: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(name, params)
  return rows[0] ?? null
}

/** Run a named .sql query inside a transaction */
export async function tx<T>(
  fn: (q: <R>(name: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
): Promise<T> {
  const client: PoolClient = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(async <R>(name: string, params?: unknown[]) => {
      const { rows } = await client.query(sql(name), params)
      return rows as R[]
    })
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** Raw query for one-off inline SQL (migrations, admin only — avoid in routes) */
export async function raw<T = Record<string, unknown>>(
  sqlText: string,
  params?: unknown[],
): Promise<T[]> {
  const { rows } = await pool.query(sqlText, params)
  return rows as T[]
}
