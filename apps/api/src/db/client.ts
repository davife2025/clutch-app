import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'
import * as relations from './relations.js'

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres'

/**
 * Supabase's transaction pooler (port 6543) requires `prepare: false`.
 * Direct connections (port 5432) work with prepared statements.
 */
const isPooler = connectionString.includes(':6543')

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  prepare: !isPooler,
})

export const db = drizzle(client, { schema: { ...schema, ...relations } })

/** Health check — verifies the DB connection is alive. */
export async function pingDb(): Promise<boolean> {
  try {
    await client`SELECT 1`
    return true
  } catch {
    return false
  }
}
