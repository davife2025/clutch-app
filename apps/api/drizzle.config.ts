import { defineConfig } from 'drizzle-kit'

// Polyfill BigInt JSON serialization. drizzle-kit's diff phase calls
// JSON.stringify on the schema snapshot — BigInts in column defaults or
// the runtime DB schema (from pg_catalog introspection) crash without this.
// drizzle.config.ts is the very first file drizzle-kit loads, so installing
// the polyfill here ensures it's in place before any serialization happens.
//
// Note: must be after the import statement because TS hoists imports anyway,
// and some loaders strip top-level non-import code that appears before imports.
;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

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
