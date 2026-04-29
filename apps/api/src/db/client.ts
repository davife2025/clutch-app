import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const connectionString = process.env.DATABASE_URL ?? 'postgresql://clutch:clutch@localhost:5432/clutch'

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })

/** Health check — verifies the DB connection is alive. */
export async function pingDb(): Promise<boolean> {
  try {
    await client`SELECT 1`
    return true
  } catch {
    return false
  }
}
