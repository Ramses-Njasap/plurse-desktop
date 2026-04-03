import { sql } from 'drizzle-orm'
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { PAYMENT_METHODS } from '../../shared/constants'
import { employees } from './accounts'
import { customers } from './customers'
import { stock_purchases } from './products'

const paymentMethodValues = PAYMENT_METHODS.map((m) => m.methods)

export type PaymentMethod = typeof paymentMethodValues[number]


const sale_fields = {
    id: integer('id').primaryKey({ autoIncrement: true }),

    // Foreign keys
    issued_by: integer('issued_by')
        .references(() => employees.id, {
            onDelete: 'set null',
            onUpdate: 'cascade'
        }),

    customer_id: integer('customer_id')
        .references(() => customers.id, {
            onDelete: 'set null',
            onUpdate: 'cascade'
        }),

    stock_purchased_id: integer('stock_purchased_id')
        .references(() => stock_purchases.id, {
            onDelete: 'set default',
            onUpdate: 'cascade'
        }),
    
    // Sale details
    quantity: integer('quantity').notNull(),
    total_price: real('total_price').notNull(),
    shipping_cost: real('shipping_cost').default(0),
    cost_price_snapshot: real('cost_price_snapshot').notNull().default(0),

    // Status
    status: text('status', { 
        enum: ['pending', 'completed', 'cancelled', 'refunded'] 
    }).default('pending'),
    
    // Debt tracking
    is_debt_sale: integer('is_debt_sale', { mode: 'boolean' }).default(false),
    balance_due: integer('balance_due', { mode: 'timestamp' }),  // This is the due date for the remaining balance to be paid for debt sales. This field can be null for non-debt sales or for debt sales that don't have a specific due date.

    // Timestamps
    sold_on: integer('sold_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    
    updated_on: integer('updated_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`)
        .$onUpdate(() => sql`(strftime('%s', 'now'))`),
    
    // Cancellation (This can be during update or a separate field to mark cancellation)
    has_been_canceled: integer('has_been_canceled', { mode: 'boolean' }).default(false),
    reason_for_cancellation: text('reason_for_cancellation').default(''),

    // This is when the price goes below or above the selling price range as approved by the manager
    has_been_overwritten: integer('has_been_overwritten', { mode: 'boolean' }).default(false),
    price_override_reason: text('price_override_reason'),  // OPtional field to capture reason for price override
    override_approved_by: integer('override_approved_by').references(() => employees.id),  // This can be null if not approved, if not approved it means that the sale is not pending since the person who issued the sale has the right to override the price without approval unless that particular stock profit margin is below a set threshold in which case it will require manager approval. This is to allow flexibility for the sales team while also ensuring that there is oversight on very low profit margin sales.
    
    // Sync fields
    sync_id: text('sync_id').default(''),
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true)
}

export const sales = sqliteTable('sales', {
    ...sale_fields,
    profit_margin: real('profit_margin')
}, (table) => [
    index('sales_customer_id_idx').on(table.customer_id),
    index('sales_issued_by_idx').on(table.issued_by),
    index('sales_stock_purchased_id_idx').on(table.stock_purchased_id),
    index('sales_status_idx').on(table.status),
    index('sales_sold_on_idx').on(table.sold_on),
    index('sales_is_debt_sale_idx').on(table.is_debt_sale),
    uniqueIndex('sales_sync_id_unique').on(table.sync_id).where(sql`${table.sync_id} != ''`),
])

export const payments = sqliteTable('payments', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    
    sale_id: integer('sale_id')
        .references(() => sales.id, {
            onDelete: 'cascade',
            onUpdate: 'cascade'
        })
        .notNull(),

    amount_paid: real('amount_paid').notNull(),
    
    payment_date: integer('payment_date', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    
    payment_method: text('payment_method')
        .$type<PaymentMethod>()
        .notNull()
        .default(paymentMethodValues[0]),
    
    reference_number: text('reference_number'),
    description: text('description').default(''),
    
    recorded_by: integer('recorded_by')
        .references(() => employees.id, {
            onDelete: 'set null'
        }),
    
    has_been_canceled: integer('has_been_canceled', { mode: 'boolean' }).default(false),
    reason_for_cancellation: text('reason_for_cancellation').default(''),

    has_been_overwritten: integer('has_been_overwritten', { mode: 'boolean' }).default(false),
    price_override_reason: text('price_override_reason'),  // OPtional field to capture reason for price override
    override_approved_by: integer('override_approved_by').references(() => employees.id),
    
    sync_id: text('sync_id').default(''),
    created_on: integer('created_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true)
}, (table) => [
    index('payments_sale_id_idx').on(table.sale_id),
    index('payments_payment_date_idx').on(table.payment_date),
    index('payments_payment_method_idx').on(table.payment_method),
    check('payment_method_check', sql`${table.payment_method} IN (${sql.join(
        paymentMethodValues.map((m) => sql.raw(`'${m}'`)),
        sql.raw(', ')
    )})`),
    uniqueIndex('payments_sync_id_unique').on(table.sync_id).where(sql`${table.sync_id} != ''`),
])
