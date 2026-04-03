import { relations, sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'


export const product_categories = sqliteTable('product_categories', {
    id: integer('id').primaryKey({ autoIncrement: true }),

    // Sync / external reference
    sync_id: text('sync_id').default(''),

    // Category name
    category_name: text('name', { length: 100 }).notNull(),

    // Self-referencing parent category (NULL = root category)
    parent_category_id: integer('parent_category_id')
        .references(() => product_categories.id, {
            onDelete: 'set null',
            onUpdate: 'cascade',
        }),

    description: text('description'),

    // Timestamps
    created_on: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),

    updated_on: integer('updated_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`)
        .$onUpdate(() => sql`(strftime('%s', 'now'))`),

    last_sync: integer('last_sync', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),

    // Flags
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_active: integer('is_active', { mode: 'boolean' }).default(true),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true),
}, (table) => {
    return [
        // UNIQUE partial index: sync_id must be unique only when not empty
        uniqueIndex('categories_sync_id_unique').on(table.sync_id).where(sql`${table.sync_id} != ''`),
        // Indexes for better query performance
        index('categories_parent_id_idx').on(table.parent_category_id),
        index('categories_name_idx').on(table.category_name),
        index('categories_is_active_idx').on(table.is_active),
        index('categories_is_deleted_idx').on(table.is_deleted),
        index('categories_sync_id_idx').on(table.sync_id),
        index('categories_created_at_idx').on(table.created_on),
        
        // Composite index for common queries
        index('categories_active_parent_idx').on(table.is_active, table.parent_category_id),
    ]
})

// Add relationships for better querying
export const productCategoriesRelations = relations(product_categories, ({ one, many }) => ({
    parent: one(product_categories, {
        fields: [product_categories.parentId],
        references: [product_categories.id],
        relationName: 'parent_category',
    }),
    children: many(product_categories, {
        relationName: 'parent_category',
    }),
    image: one(product_category_image, {
        fields: [product_categories.id],
        references: [product_category_image.product_category_id],
    }),
    products: many(products),
}))


export const product_category_image = sqliteTable('product_category_image', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    
    sync_id: text('sync_id').default(''),
    
    product_category_id: integer('product_category_id')
        .unique()
        .notNull()
        .references(() => product_categories.id, {
            onDelete: 'cascade',
            onUpdate: 'no action'
        }),
    
    // Store image path/URL - consider making this notNull() if every category must have an image
    image: text('image'),
    
    // Timestamps - using integer timestamps for better performance
    created_on: integer('created_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    
    updated_on: integer('updated_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`)
        .$onUpdate(() => sql`(strftime('%s', 'now'))`),
    
    last_sync: integer('last_sync', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    
    // Flags
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true)
}, (table) => {
    return [
        // UNIQUE partial index: sync_id must be unique only when not empty
        uniqueIndex('category_image_sync_id_unique').on(table.sync_id).where(sql`${table.sync_id} != ''`),
        // Indexes for better query performance
        index('category_image_category_id_idx').on(table.product_category_id),
        index('category_image_sync_id_idx').on(table.sync_id),
        index('category_image_created_on_idx').on(table.created_on),
        index('category_image_is_deleted_idx').on(table.is_deleted),
        index('category_image_active_idx').on(table.is_deleted, table.product_category_id),
    ]
})

// Define relationship with product_categories
export const productCategoryImageRelations = relations(product_category_image, ({ one }) => ({
    category: one(product_categories, {
        fields: [product_category_image.product_category_id],
        references: [product_categories.id],
    }),
}))


export const products = sqliteTable('products', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    
    // Sync / external reference
    sync_id: text('sync_id').default(''),
    
    product_name: text('product_name', { length: 150 }).notNull(),
    
    category_id: integer('category_id')
        .notNull()
        .references(() => product_categories.id, {
            onDelete: 'cascade',
            onUpdate: 'no action',
        }),  // many products can belong to one category
    
    description: text('description').default(''),

    // Timestamps - using integer for better performance
    created_on: integer('created_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),

    updated_on: integer('updated_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`)
        .$onUpdate(() => sql`(strftime('%s', 'now'))`),

    last_sync: integer('last_sync', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),

    // Flags
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_active: integer('is_active', { mode: 'boolean' }).default(true),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true),
}, (table) => [
    // UNIQUE partial index: sync_id must be unique only when not empty
    uniqueIndex('products_sync_id_unique').on(table.sync_id).where(sql`${table.sync_id} != ''`),
    // Indexes for better query performance - using ARRAY syntax
    index('products_category_id_idx').on(table.category_id),
    index('products_product_name_idx').on(table.product_name),
    index('products_sync_id_idx').on(table.sync_id),
    index('products_created_on_idx').on(table.created_on),
    index('products_is_deleted_idx').on(table.is_deleted),
    index('products_is_active_idx').on(table.is_active),
    
    // Composite indexes for common query patterns
    index('products_active_category_idx').on(table.is_active, table.category_id),
    index('products_deleted_category_idx').on(table.is_deleted, table.category_id),
    index('products_name_search_idx').on(table.is_active, table.product_name),
])

// Define relationships
export const productsRelations = relations(products, ({ one, many }) => ({
    category: one(product_categories, {
        fields: [products.category_id],
        references: [product_categories.id],
    }),
    images: many(product_image),
}))


export const product_image = sqliteTable('product_image', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    
    sync_id: text('sync_id').default(''),
    
    product_id: integer('product_id')
        .notNull()  // Note: Removed .unique() since you want multiple images per product
        .references(() => products.id, {
            onDelete: 'cascade',
            onUpdate: 'no action'
        }),  // many product_images can belong to one product
    
    image: text('image'),  // Store image path/URL
    
    // Timestamps - integer for better performance
    created_on: integer('created_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    
    updated_on: integer('updated_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`)
        .$onUpdate(() => sql`(strftime('%s', 'now'))`),
    
    // Flags
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true)
}, (table) => [
    // UNIQUE partial index: sync_id must be unique only when not empty
    uniqueIndex('product_image_sync_id_unique').on(table.sync_id).where(sql`${table.sync_id} != ''`),
    // Indexes for better query performance
    index('product_image_product_id_idx').on(table.product_id),
    index('product_image_sync_id_idx').on(table.sync_id),
    index('product_image_created_on_idx').on(table.created_on),
    index('product_image_is_deleted_idx').on(table.is_deleted),
    
    // Composite indexes for common query patterns
    index('product_image_active_idx').on(table.is_deleted, table.product_id),
    index('product_image_recent_idx').on(table.product_id, table.created_on),
])

// Define relationships
export const productImageRelations = relations(product_image, ({ one }) => ({
    product: one(products, {
        fields: [product_image.product_id],
        references: [products.id],
    }),
}))


export const sku = sqliteTable('sku', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    
    product_id: integer('product_id')
        .notNull()
        .references(() => products.id, {
            onDelete: 'cascade',
            onUpdate: 'no action',
        }),  // many SKUs can belong to one product
    
    sku_name: text('sku_name', { length: 100 }).notNull(),
    
    code: text('code', { length: 50 }).unique().notNull(),
    
    sync_id: text('sync_id').default(''),
    
    // Timestamps - integer for better performance
    created_on: integer('created_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    
    updated_on: integer('updated_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`)
        .$onUpdate(() => sql`(strftime('%s', 'now'))`),
    
    last_sync: integer('last_sync', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    
    // Flags
    is_active: integer('is_active', { mode: 'boolean' }).default(true),
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true),
}, (table) => [
    // UNIQUE partial index: sync_id must be unique only when not empty
    uniqueIndex('sku_sync_id_unique').on(table.sync_id).where(sql`${table.sync_id} != ''`),
    // Indexes for better query performance
    index('sku_product_id_idx').on(table.product_id),
    index('sku_sku_name_idx').on(table.sku_name),
    index('sku_code_idx').on(table.code),  // Even though code is unique, index helps lookups
    index('sku_sync_id_idx').on(table.sync_id),
    index('sku_created_on_idx').on(table.created_on),
    index('sku_is_active_idx').on(table.is_active),
    index('sku_is_deleted_idx').on(table.is_deleted),
    
    // Composite indexes for common query patterns
    index('sku_active_product_idx').on(table.product_id, table.is_active),
    index('sku_active_deleted_idx').on(table.is_active, table.is_deleted),
    index('sku_product_search_idx').on(table.product_id, table.sku_name),
])

// Define relationships
export const skuRelations = relations(sku, ({ one, many }) => ({
    product: one(products, {
        fields: [sku.product_id],
        references: [products.id],
    }),
    stockPurchases: many(stock_purchases),  // One SKU can have many stock purchases
    images: many(sku_images),
    attributes: many(sku_attributes),
}))



export const sku_images = sqliteTable('sku_images', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    
    sync_id: text('sync_id').default(''),
    
    sku_id: integer('sku_id')
        .notNull()
        .references(() => sku.id, {
            onDelete: 'cascade',
            onUpdate: 'no action'
        }),  // many sku_images can belong to one SKU
    
    image: text('image'),  // Store image path/URL
    
    // Timestamps - integer for better performance
    created_on: integer('created_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    
    updated_on: integer('updated_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`)
        .$onUpdate(() => sql`(strftime('%s', 'now'))`),
    
    // Flags
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true)
}, (table) => [
    // UNIQUE partial index: sync_id must be unique only when not empty
    uniqueIndex('sku_images_sync_id_unique').on(table.sync_id).where(sql`${table.sync_id} != ''`),
    // Indexes for better query performance
    index('sku_images_sku_id_idx').on(table.sku_id),
    index('sku_images_sync_id_idx').on(table.sync_id),
    index('sku_images_created_on_idx').on(table.created_on),
    index('sku_images_is_deleted_idx').on(table.is_deleted),
    
    // Composite indexes for common query patterns
    index('sku_images_active_idx').on(table.is_deleted, table.sku_id),
    index('sku_images_recent_idx').on(table.sku_id, table.created_on),
])

// Define relationships
export const skuImagesRelations = relations(sku_images, ({ one }) => ({
    sku: one(sku, {
        fields: [sku_images.sku_id],
        references: [sku.id],
    }),
}))


export const attributes = sqliteTable('attributes', {
    id: integer('id').primaryKey({ autoIncrement: true }),

    attribute_name: text('attribute_name', { length: 50 }).notNull(), // color, size, weight, material, etc.

    unit: text('unit', { length: 20 }).default(''), // kg, cm, m², '' for unitless attributes like color
    
    sync_id: text('sync_id').default(''),
    
    // Timestamps - integer for better performance
    created_on: integer('created_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    
    updated_on: integer('updated_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`)
        .$onUpdate(() => sql`(strftime('%s', 'now'))`),

    last_sync: integer('last_sync', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    
    // Flags
    is_active: integer('is_active', { mode: 'boolean' }).default(true),
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true),
}, (table) => [
    // UNIQUE partial index: sync_id must be unique only when not empty
    uniqueIndex('attributes_sync_id_unique').on(table.sync_id).where(sql`${table.sync_id} != ''`),
    // Indexes for better query performance
    index('attributes_name_idx').on(table.attribute_name),
    index('attributes_unit_idx').on(table.unit),
    index('attributes_sync_id_idx').on(table.sync_id),
    index('attributes_created_on_idx').on(table.created_on),
    index('attributes_is_active_idx').on(table.is_active),
    index('attributes_is_deleted_idx').on(table.is_deleted),
    
    // Composite indexes for common query patterns
    index('attributes_active_name_idx').on(table.is_active, table.attribute_name),
    index('attributes_active_unit_idx').on(table.is_active, table.unit),
])

// Define relationships (you'll add the many-to-many relation later)
export const attributesRelations = relations(attributes, ({ many }) => ({
    // This will be populated when you create the junction table
    skuAttributes: many(sku_attributes),
}))


export const sku_attributes = sqliteTable('sku_attributes', {
    id: integer('id').primaryKey({ autoIncrement: true }),

    // I want sync_id to be unique and still be able to have '' if no sync_id is available. This allows us to have a single "unsynced" record without needing to generate a unique sync_id for it.
    sync_id: text('sync_id').default(''),

    sku_id: integer('sku_id')
        .notNull()
        .references(() => sku.id, {
            onDelete: 'cascade',
        }),  // many sku_attributes can belong to one SKU.

    attribute_id: integer('attribute_id')
        .notNull()
        .references(() => attributes.id, {
            onDelete: 'cascade',
        }),  // many sku_attributes can belong to one attribute.

    value: text('value').notNull(), // "Black", "42", "1.5"

    // Timestamps - integer for better performance
    created_on: integer('created_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),

    updated_on: integer('updated_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`)
        .$onUpdate(() => sql`(strftime('%s', 'now'))`),

    last_sync: integer('last_sync', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),

    // Flags
    is_active: integer('is_active', { mode: 'boolean' }).default(true),
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true),
}, (table) => [
    // UNIQUE CONSTRAINT: Prevent duplicate attributes for the same SKU
    uniqueIndex('sku_attributes_sku_attribute_unique').on(table.sku_id, table.attribute_id),

    // UNIQUE partial index: sync_id must be unique only when not empty
    uniqueIndex('sku_attributes_sync_id_unique').on(table.sync_id).where(sql`${table.sync_id} != ''`),
    
    // Indexes for foreign keys (important for join performance)
    index('sku_attributes_sku_id_idx').on(table.sku_id),
    index('sku_attributes_attribute_id_idx').on(table.attribute_id),
    
    // Index for value searches (find all SKUs with a specific attribute value)
    index('sku_attributes_value_idx').on(table.value),
    
    // Indexes for timestamps and flags
    index('sku_attributes_created_on_idx').on(table.created_on),
    index('sku_attributes_is_active_idx').on(table.is_active),
    index('sku_attributes_is_deleted_idx').on(table.is_deleted),
    
    // Composite indexes for common query patterns
    index('sku_attributes_active_sku_idx').on(table.is_active, table.sku_id),
    index('sku_attributes_active_attribute_idx').on(table.is_active, table.attribute_id),
    index('sku_attributes_active_value_idx').on(table.is_active, table.value),
    
    // For finding active attributes by SKU and attribute type
    index('sku_attributes_lookup_idx').on(table.sku_id, table.attribute_id, table.is_active),
])

// Define relationships
export const skuAttributesRelations = relations(sku_attributes, ({ one }) => ({
    sku: one(sku, {
        fields: [sku_attributes.sku_id],
        references: [sku.id],
    }),
    attribute: one(attributes, {
        fields: [sku_attributes.attribute_id],
        references: [attributes.id],
    }),
}))


export const stock_purchases = sqliteTable('stock_purchases', {
    id: integer('id').primaryKey({ autoIncrement: true }),

    sku_id: integer('sku_id')
        .notNull()
        .references(() => sku.id, {
            onDelete: 'cascade',
            onUpdate: 'no action',
        }),  // many stock purchases can belong to one SKU

    quantity_bought: integer('quantity_bought').notNull().default(0),

    sync_id: text('sync_id').default(''),

    // Financial fields - consider using integer for cents to avoid floating point issues
    price_per_unit: real('price_per_unit').notNull().default(0),
    total_price_bought: real('total_price_bought').notNull().default(0),
    shipping_cost: real('shipping_cost').default(0),
 
    // Pricing fields
    min_selling_price: real('min_selling_price').notNull().default(0),
    max_selling_price: real('max_selling_price').default(0),

    // Product lot information
    manufacture_date: text('manufacture_date').default(''),  // ISO date string: YYYY-MM-DD
    expiry_date: text('expiry_date').default(''),  // ISO date string: YYYY-MM-DD
    batch_number: text('batch_number', { length: 100 }).default(''),

    // Timestamps - using integer for better performance
    purchased_on: integer('purchased_on', { mode: 'timestamp' })
        .default(sql`(strftime('%s', 'now'))`),

    arrived_on: integer('arrived_on', { mode: 'timestamp' })
        .default(sql`(strftime('%s', 'now'))`), 

    supplier_id: integer('supplier_id')
        .references(() => suppliers.id, {
            onDelete: 'set null',
            onUpdate: 'no action',
        }),  // many stock purchases can belong to one supplier
    
    // System timestamps
    created_on: integer('created_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    
    updated_on: integer('updated_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`)
        .$onUpdate(() => sql`(strftime('%s', 'now'))`),
    
    // Flags
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true),
}, (table) => [
    // UNIQUE partial index: sync_id must be unique only when not empty
    uniqueIndex('stock_purchases_sync_id_unique').on(table.sync_id).where(sql`${table.sync_id} != ''`),
    // Indexes for foreign keys
    index('stock_purchases_sku_id_idx').on(table.sku_id),
    index('stock_purchases_supplier_id_idx').on(table.supplier_id),
    index('stock_purchases_sync_id_idx').on(table.sync_id),
    
    // Indexes for date ranges (common queries)
    index('stock_purchases_purchased_on_idx').on(table.purchased_on),
    index('stock_purchases_arrived_on_idx').on(table.arrived_on),
    index('stock_purchases_expiry_date_idx').on(table.expiry_date),
    index('stock_purchases_manufacture_date_idx').on(table.manufacture_date),
    
    // Indexes for batch and product tracking
    index('stock_purchases_batch_number_idx').on(table.batch_number),
    
    // Indexes for flags
    index('stock_purchases_created_on_idx').on(table.created_on),
    index('stock_purchases_is_deleted_idx').on(table.is_deleted),
    
    // Composite indexes for common query patterns
    index('stock_purchases_sku_date_idx').on(table.sku_id, table.purchased_on),
    index('stock_purchases_supplier_date_idx').on(table.supplier_id, table.purchased_on),
    index('stock_purchases_sku_expiry_idx').on(table.sku_id, table.expiry_date),
    index('stock_purchases_active_sku_idx').on(table.is_deleted, table.sku_id),
    
    // Index for profit margin analysis
    // index('stock_purchases_profit_margin_idx').on(table.avg_anticipated_profit_margin),
])

// Define relationships
export const stockPurchasesRelations = relations(stock_purchases, ({ one }) => ({
    sku: one(sku, {
        fields: [stock_purchases.sku_id],
        references: [sku.id],
    }),
    supplier: one(suppliers, {
        fields: [stock_purchases.supplier_id],
        references: [suppliers.id],
    }),
}))


export const suppliers = sqliteTable('suppliers', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    
    sync_id: text('sync_id').default(''),
    
    supplier_name: text('supplier_name', { length: 150 }).notNull(),
    
    contact_person: text('contact_person', { length: 100 }).default(''),
    
    // Contact information
    phone_number: text('phone_number', { length: 20 }).default(''),
    email: text('email', { length: 100 }).default(''),
    address: text('address').default(''),
    
    // Timestamps - integer for better performance
    created_on: integer('created_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    
    updated_on: integer('updated_on', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`)
        .$onUpdate(() => sql`(strftime('%s', 'now'))`),
    
    last_sync: integer('last_sync', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    
    // Flags
    is_active: integer('is_active', { mode: 'boolean' }).default(true),
    is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    is_sync_required: integer('is_sync_required', { mode: 'boolean' }).default(true),
}, (table) => [
    // UNIQUE partial index: sync_id must be unique only when not empty
    uniqueIndex('suppliers_sync_id_unique').on(table.sync_id).where(sql`${table.sync_id} != ''`),
    // Indexes for searchable fields
    index('suppliers_name_idx').on(table.supplier_name),
    index('suppliers_contact_person_idx').on(table.contact_person),
    index('suppliers_phone_number_idx').on(table.phone_number),
    index('suppliers_email_idx').on(table.email),
    index('suppliers_sync_id_idx').on(table.sync_id),

    // Indexes for timestamps
    index('suppliers_created_on_idx').on(table.created_on),
    
    // Indexes for flags
    index('suppliers_is_active_idx').on(table.is_active),
    index('suppliers_is_deleted_idx').on(table.is_deleted),
    
    // Composite indexes for common query patterns
    index('suppliers_active_name_idx').on(table.is_active, table.supplier_name),
    index('suppliers_active_contact_idx').on(table.is_active, table.contact_person),
])

// Define relationships
export const suppliersRelations = relations(suppliers, ({ many }) => ({
    stockPurchases: many(stock_purchases),  // One supplier can have many stock purchases
}))
 