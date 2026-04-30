import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Use the DIRECT connection for migrations — Supabase pooler doesn't support DDL
    url:
      process.env.DATABASE_URL_DIRECT ??
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/postgres',
  },
  verbose: true,
  strict: true,
})
