import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const customers = sqliteTable('customers', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    sync_id: text('sync_id').default(''),
    created_on: integer('created_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    updated_on: integer('updated_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`)
        .$onUpdate(() => sql`(strftime('%s', 'now'))`),
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_active: integer('is_active', { mode: 'boolean' }).default(true),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true),
    last_synced_on: integer('last_synced_on', { mode: 'timestamp' }),
}, (_table) => [
    index('customers_name_idx').on(_table.name),
    index('customers_phone_idx').on(_table.phone),
    index('customers_email_idx').on(_table.email),
    uniqueIndex('customers_sync_id_unique').on(_table.sync_id).where(sql`${_table.sync_id} != ''`),
])