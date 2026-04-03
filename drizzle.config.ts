// drizzle.config.ts

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema/sqlite3/**/*.ts',
  out: './drizzle',
  dbCredentials: {
    url: 'file:plurse-desktop.db.sqlite-v1'
  },
  strict: true
})
