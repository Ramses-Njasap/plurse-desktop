import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, unique, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { ACCOUNT_ROLES, SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES } from '../../shared/constants'

// Generate allowed values
const currencyCodes = SUPPORTED_CURRENCIES.map((c) => c.code)
const languageCodes = SUPPORTED_LANGUAGES.map((l) => l.code)
const accountRoles = ACCOUNT_ROLES.map((r) => r.role)

export const business = sqliteTable('business', {
  id: integer('id').primaryKey().default(1),
  sync_id: text('sync_id').unique(),
  business_name: text('business_name', { length: 150 }).notNull(),
  business_location_name: text('business_location_name'),
  last_sync: integer('last_sync', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
})


export const business_branch = sqliteTable(
  'business_branch',
  {
    id: integer('id').primaryKey().default(1),
    sync_id: text('sync_id').unique(),
    branch_location_name: text('branch_location_name', { length: 255 }).notNull(),
    branch_location_coordinate: text('branch_location_coordinate'),
    branch_email_address: text('branch_email_address', { length: 255 }).notNull(),
    branch_phone_number: text('branch_phone_number', { length: 20 }).notNull(),
    default_language: text('default_language', { length: 10 }).default('en'),
    default_currency: text('default_currency', { length: 10 }).default('USD'),
    verification_code: text('verification_code', { length: 6 }).notNull(),
    is_approved: integer('is_approved', { mode: 'boolean' }).default(false),
    is_verified: integer('is_verified', { mode: 'boolean' }).default(false),
    is_active: integer('is_active', { mode: 'boolean' }).default(false),
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true),
    last_sync: integer('last_sync', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (_table) => {
    // Dynamically create the currency check constraint
    const currencyCheck = sql`${sql.raw('default_currency')} IN (${sql.join(
      currencyCodes.map((c) => sql.raw(`'${c}'`)),
      sql.raw(', ')
    )})`

    // Dynamically create the language check constraint
    const languageCheck = sql`${sql.raw('default_language')} IN (${sql.join(
      languageCodes.map((l) => sql.raw(`'${l}'`)),
      sql.raw(', ')
    )})`

    return {
      // The check function adds the constraint to the database schema
      currencyCheck: check('currency_codes_check', currencyCheck),
      languageCheck: check('language_codes_check', languageCheck)
    }
  }
)

export const employees = sqliteTable(
  'employees',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sync_id: text('sync_id').unique(),
    username: text('username', { length: 50 }).notNull(),
    password_hash: text('password_hash', { length: 255 }).notNull(),
    role: text('role', { length: 50 }).default('viewer'),

    first_name: text('first-name', { length: 100 }),
    last_name: text('last_name', { length: 100 }),
    email: text('email', { length: 150 }),
    phone: text('phone', { length: 20 }),
    address: text('address', { length: 255 }),
    date_of_birth: text('date_of_birth'),
    date_of_joining: text('date_of_joining'),
    emergency_contact: text('emergency_contact', { length: 255 }),
    department_id: integer('department_id').references(() => departments.id),
    salary: text('salary').default('0'),
    created_on: integer('created_on', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updated_on: integer('updated_on', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`)
      .$onUpdate(() => sql`(strftime('%s', 'now'))`),
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    last_sync: integer('last_sync', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true),
    is_active: integer('is_active', { mode: 'boolean' }).default(true)
  },
  (_table) => {
    // Dynamically create the account roles check constraint
    const accountRolesCheck = sql`${sql.raw('role')} IN (${sql.join(
      accountRoles.map((r) => sql.raw(`'${r}'`)),
      sql.raw(', ')
    )})`

    return {
      // The check function adds the constraint to the database schema
      accountRolesCheck: check('account_roles_check', accountRolesCheck)
    }
  }
)

export const departments = sqliteTable('departments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sync_id: text('sync_id').unique(),
  department_name: text('department_name', { length: 100 }).notNull(),
  created_on: integer('created_on', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updated_on: integer('updated_on', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`)
    .$onUpdate(() => sql`(strftime('%s', 'now'))`),
  is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true),
  last_sync: integer('last_sync', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  is_active: integer('is_active', { mode: 'boolean' }).default(true)
})

export const employee_media = sqliteTable('employee_media', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sync_id: text('sync_id').unique(),
  employee_id: integer('employee_id')
    .notNull()
    .references(() => employees.id, {
      onDelete: 'cascade',
      onUpdate: 'no action'
    }),
  profile_picture: text('profile_picture'),
  id_card: text('id_card'),
  employee_badge: text('employee_badge'),
  contract: text('contract'),
  signature: text('signature'),
  created_on: integer('created_on', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updated_on: integer('updated_on', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`)
    .$onUpdate(() => sql`(strftime('%s', 'now'))`),
  is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true),
  last_sync: integer('last_sync', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
}, (_table) => [
  index('employee_media_employee_id_idx').on(_table.employee_id),
  uniqueIndex('employee_media_sync_id_unique').on(_table.sync_id).where(sql`${_table.sync_id} != ''`),
])

export const employee_activities = sqliteTable(
  'employee_activities',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    activity: text('activity', { length: 255 }).notNull(),

    // These two columns will form a unique constraint
    linked_activity_id: integer('linked_activity_id').default(0),
    linked_activity_table: text('linked_activity_table', { length: 50 }).default(''),

    old_data: text('old_data').default(''),
    new_data: text('new_data').default(''),
    employee_id: integer('employee_id')
      .notNull()
      .references(() => employees.id, {
        onDelete: 'cascade',
        onUpdate: 'no action'
      }),
    created_on: integer('created_on', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    last_sync: integer('last_sync', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (_table) => {
    // Use '_' to avoid the "variable declared but unused" warning
    return {
      // 💡 Composite Unique Constraint
      // This ensures no two rows have the same combination of these two columns.
      linkedActivityUnique: unique('linked_activity_idx').on(
        _table.linked_activity_id,
        _table.linked_activity_table
      )
    }
  }
)
