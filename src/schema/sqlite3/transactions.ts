import { sql } from 'drizzle-orm'
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { TRANSACTION_TYPE } from '../../shared/constants'
import { employees } from './accounts'


const  transactionTypeValues = TRANSACTION_TYPE.map((t) => t.type)
export type TransactionType = typeof transactionTypeValues[number]

export const transactions = sqliteTable('transactions', {
    id: integer('id').primaryKey({ autoIncrement: true }),

    transaction_type: text('transaction_type')
        .$type<TransactionType>()
        .notNull()
        .default(transactionTypeValues[0]),

    amount: real('amount').notNull(),
    description: text('description'),
    
    recorded_by: integer('recorded_by')
        .references(() => employees.id, {
            onDelete: 'set null'
        }),

    sync_id: text('sync_id').default(''),
    created_on: integer('created_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true),
    last_synced_on: integer('last_synced_on', { mode: 'timestamp' })
}, (table) => [
    index('transactions_transaction_type_idx').on(table.transaction_type),
    index('transactions_recorded_by_idx').on(table.recorded_by),
    check('transaction_type_check', sql`${table.transaction_type} IN (${sql.join(
        transactionTypeValues.map((t) => sql.raw(`'${t}'`)),
        sql.raw(', ')
    )})`),
    uniqueIndex('transactions_sync_id_unique').on(table.sync_id).where(sql`${table.sync_id} != ''`),
])