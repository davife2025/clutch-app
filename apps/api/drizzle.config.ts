// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: 'postgresql://postgres:T8qJfK2z$m)8_Kr@db.tyimzyylyawbdhmmlubu.supabase.co:5432/postgres',
    ssl: 'require',
  },
  verbose: true,
  strict: true,
})