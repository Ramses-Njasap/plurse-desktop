import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Allows only one row to exist in the table
// Used to track setup progress and skipped stages
export const setup = sqliteTable('setup', {
  id: integer('id').primaryKey().default(1),

  // Track progress: 0=initial, 1..4 stages
  progress: integer('progress').default(0), // enforce 0-4 in app logic

  // JSON array of skipped stages like "[1,3,5]"
  skipped_stages: text('skipped_stages'),

  // Whether setup is completed (0=false, 1=true)
  is_completed: integer('is_completed').default(0)

  // Note: complex CHECKs (like "completed only if progress=4") should be enforced in app logic
})
