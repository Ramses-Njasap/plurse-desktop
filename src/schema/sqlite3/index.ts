// Import your Drizzle tables
import {
  business,
  business_branch,
  departments,
  employee_activities,
  employee_media,
  employees
} from './accounts'
import { activation } from './activation'
import { customers } from './customers'
import {
  attributes,
  // attributesRelations,
  product_categories, product_category_image,
  product_image,
  // productCategoriesRelations,
  // productCategoryImageRelations,
  // productImageRelations,
  products,
  // productsRelations,
  sku,
  sku_images,
  // skuImagesRelations,
  // skuRelations,
  stock_purchases,
  // stockPurchasesRelations,
  suppliers,
} from './products'
import { payments, sales } from './sales'
import { setup } from './setup'
import { transactions } from './transactions'

// Aggregate all tables
export const sqlite3Tables = {
  business,
  business_branch,
  employees,
  departments,
  employee_media,
  employee_activities,
  activation,
  setup,
  customers,
  stock_purchases,
  product_categories,
  product_category_image,
  // productCategoriesRelations,
  // productCategoryImageRelations,
  products,
  // productsRelations,
  product_image,
  // productImageRelations,
  sku,
  // skuRelations,
  sku_images,
  // skuImagesRelations,
  attributes,
  // attributesRelations,
  // stockPurchasesRelations,
  suppliers,
  // suppliersRelations,
  transactions,
  sales,
  payments
} as const
