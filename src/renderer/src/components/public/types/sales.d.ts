// src/components/public/types/sales.d.ts

// ─── Sales Page Types v2 ─────────────────────────────────────────────────

export type ProductMetrics = {
  // Legacy field (some components still reference this)
  items_sold?: number
  total_items_bought: number      // Add this
  total_items_sold: number         // Add this
  total_items_remaining: number    // Add this
  inventory_value: number
  
  // Financial metrics
  total_revenue: number            // Add this
  total_cost: number               // Add this
  total_profit: number             // Add this
  profit_margin: number

  sku_count: number  

  // Core inventory — matches getAllProducts API response
  total_items_bought?: number
  total_items_sold: number
  total_items_remaining: number
  inventory_value: number

  // Financial
  total_revenue: number
  total_cost?: number
  total_profit: number
  profit_margin: number

  // SKU metrics
  sku_count?: number
  avg_sku_profit_margin: number

  // Performance
  sell_through_rate: number
  days_of_inventory: number

  // Status flags
  is_low_stock: boolean
  is_high_margin: boolean
  is_loss_making: boolean
  is_best_seller: boolean
  stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
}

export type ProductImage = {
  id: number
  path: string
  filename: string
  is_primary?: boolean
}

export type Product = {
  id: number
  product_name: string
  category_id: number
  category_name: string
  description: string | null
  created_on: number
  updated_on: number
  is_active: boolean
  is_deleted: boolean
  images: ProductImage[]
  sku?: Array<any>   // legacy name
  skus?: Array<any>  // actual API response field
  sku_count: number
  metrics: ProductMetrics
}

export type SKUAttribute = {
  id: number
  attribute_id?: number  // present in getSkuById, absent in getAllSkus list responses
  name: string
  value: string
  unit: string | null
  display_value?: string
  is_active?: boolean
}

export type SKUImage = {
  id?: number
  path: string
  filename?: string
  is_primary?: boolean
}

export type SKU = {
  id: number
  sku_name: string
  code: string
  is_active: boolean
  is_deleted: boolean
  timestamps: { created_on: number; updated_on: number; last_sync: number }
  product: { id: number; name: string; is_active: boolean; category_id?: number }
  images: SKUImage[]
  attributes: SKUAttribute[]
  stock_purchases: StockPurchase[]
  has_stock_purchases: boolean
  stats: { image_count: number; attribute_count: number; purchase_count: number; sale_count?: number }
  metrics?: {
    total_bought: number
    total_sold: number
    total_remaining: number
    total_revenue: number
    total_cost: number
    total_profit: number
    profit_margin: number
    avg_cost_per_unit: number
    avg_selling_price: number
    avg_profit_per_unit: number
    sell_through_rate: number
    days_of_inventory: number
    stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
    is_low_stock: boolean
    is_overstocked: boolean
    is_out_of_stock: boolean
    is_profitable: boolean
  }
}

export type StockPurchaseCalculations = {
  total_cost: number
  cost_per_unit: number
  expected_revenue: { min: number; max: number; avg: number }
  expected_profit: { min: number; max: number; avg: number }
  roi: { min: number; max: number; avg: number }
}

export type StockPurchase = {
  id: number
  sku_id: number
  quantity: number
  price_per_unit: number
  total_price_bought: number
  shipping_cost: number | null
  min_price: number | null
  max_price: number | null
  avg_anticipated_profit_margin: number | null
  manufacture_date: string | null
  expiry_date: string | null
  batch_number: string | null
  purchased_on: number | null
  arrived_on: number | null
  supplier_id: number | null
  sku_name: string
  sku_code: string
  product_name: string
  supplier_name?: string | null
  calculations: StockPurchaseCalculations
  is_expired: boolean
  days_until_expiry: number | null
  // nested from getAllStockPurchases
  sku?: any
  supplier?: any
  total_cost?: number
  expected_revenue?: { min: number; max: number; avg: number }
}

export type Customer = {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  created_on: number
  updated_on: number
  is_active: boolean
  is_deleted: boolean
}

// ─── Cart ─────────────────────────────────────────────────────────────────

export type CartItem = {
  cartId: string // unique per cart entry
  purchase: StockPurchase
  sku: SKU
  productName: string
  quantity: number
  unitPrice: number // seller's chosen price
}

export type CartSummary = {
  items: CartItem[]
  subtotal: number
  totalItems: number
  amountPaid: number
  isDebt: boolean
  change: number
  remainingBalance: number
}

// ─── Filters ──────────────────────────────────────────────────────────────

export type ProductFilters = {
  search: string
  category_id?: number
  has_sku?: 'yes' | 'no' | 'both'
  low_stock_only?: boolean
  best_seller_only?: boolean
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export type SKUFilters = {
  search: string
  has_stock?: boolean
  is_active?: boolean
}

export type StockPurchaseFilters = {
  search: string
  min_quantity?: number
  max_quantity?: number
  min_price?: number
  max_price?: number
  has_expiry?: boolean
  exclude_expired?: boolean
  supplier_id?: number
  sort_by?: 'quantity' | 'price_per_unit' | 'purchased_on' | 'expiry_date'
  sort_order?: 'asc' | 'desc'
}

export type PaymentMethodValue = typeof PAYMENT_METHODS[number]['methods']

// ─── SaleFormData (v1 compatibility) ─────────────────────────────────────
export type SaleFormData = {
  quantity: number
  total_price: number
  is_debt_sale: boolean
  balance_due: number | null
  customer_id: number | null
  payment: {
    amount_paid: number
    payment_method: string
    reference_number: string
    description: string
  }
  notes: string
}