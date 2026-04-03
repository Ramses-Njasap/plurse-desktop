// Allows only one row to exist in the table
// Used to store activation key and whether activation is required
// sync_id is used to track changes for synchronization purposes
// last_sync is updated whenever the row is modified
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const activation = sqliteTable('activation', {
  id: integer('id').primaryKey().default(1),
  sync_id: text('sync_id').unique(),
  activation_key: text('activation_key'),
  subscription: text('subscription').default('basic'), // enforce 'basic' | 'pro' in app logic
  is_activation_required: integer('is_activation_required').default(0), // 0=false, 1=true
  is_sync_required: integer('is_sync_required').default(1),
  last_sync: text('last_sync')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`)
})
