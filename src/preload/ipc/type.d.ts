// preload/ipc/type.d.ts

import { PaymentMethod } from '@schema/sqlite3/sales'

// Types for employees
export type Employee = {
  id: number
  sync_id: number
  username: string
  password_hash: string
  role: string
  first_name: string
  last_name: string
  email: string
  phone: string
  created_on: string
  updated_on: string
  is_deleted: number
  last_sync: string | null
  is_sync_required: number
  is_active: number
  profile_picture?: FileMetadata | null
}

export type EmployeeMedia = {
  id: number
  sync_id: number
  employee_id: number
  profile_picture: string | null
  id_card: string | null
  employee_badge: string | null
  contract: string | null
  signature: string | null
  created_at: string
  updated_at: string
  is_sync_required: number
  is_deleted: number
}

export type FileMetadata = {
  path: string
  filename: string
  original_filename: string
  mime_type: string
  file_size: number
  uploaded_at: string
}

export type CreateEmployeePayload = {
  username: string
  password: string
  role: string
  with_profile_pic?: boolean
  profile_pic_data?: string // Base64 encoded image
  profile_pic_filename?: string
  profile_pic_mime_type?: string
}

export type CreateEmployeeByAdminPayload = {
  username: string
  password: string

  role: string
  first_name: string
  last_name: string

  email?: string
  phone?: string

  address: string
  date_of_birth: string
  date_of_joining: string
  emergency_contact?: string
  department_id?: number
  salary: string

  with_profile_pic: true
  profile_pic_data: string // Base64 encoded image (required)
}


export type UpdateEmployeePayload = {
  id: number
  username?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  password?: string
  role?: string
  is_active?: number
  with_profile_pic?: boolean
  profile_pic_data?: string
  profile_pic_filename?: string
  profile_pic_mime_type?: string
}

export type GetEmployeesPayload = {
  page?: number
  limit?: number
  with_profile_pics?: boolean
  search?: string
}


// Products and product categories

export type UpdateProductCategoryPayload = {
  id: number

  category_name?: string
  description?: string
  is_active?: boolean
  parent_category_id?: number | null

  update_image?: boolean
  image_data?: string // base64
}

type GetCategoriesPayload = {
  nested?: boolean
  include_deleted?: boolean
  include_inactive?: boolean
}

export type CreateProductCategoryPayload = {
  category_name: string
  description?: string
  is_active?: boolean

  with_image?: boolean
  image_data?: string // base64 data URL

  subcategories?: Array<{
    category_name: string
    description?: string
    is_active?: boolean

    with_image?: boolean
    image_data?: string
  }>
}

export type DeleteCategoryPayload = {
  id: number
  cascade?: boolean // if true, delete children too
}

export type ProductImagePayload = {
  id?: number // if exists, update/delete this image
  image_data?: string | null // base64. if null => delete
  original_filename?: string
}

export type CreateProductPayload = {
  product_name: string
  category_id: number
  description?: string
  is_active?: boolean

  images?: Array<{
    image_data: string
    original_filename?: string
  }>
}

export type UpdateProductPayload = {
  id: number

  product_name?: string
  category_id?: number
  description?: string
  is_active?: boolean

  images?: ProductImagePayload[]
}

// type.d.ts
export type HasSkuFilter = 'yes' | 'no' | 'both'
export type SortOrder = 'asc' | 'desc'
export type ProductSortField = 'product_name' | 'created_on' | 'updated_on' | 'items_sold' | 'profit_margin' | 'inventory_value' | 'sell_through_rate'

export type GetProductsPayload = {
  // Pagination
  page?: number
  limit?: number

  // Filter flags
  include_deleted?: boolean
  include_inactive?: boolean
  include_unsynced?: boolean

  // SKU filter
  has_sku?: HasSkuFilter

  // Sorting
  sort_by?: ProductSortField
  sort_order?: SortOrder

  // Category filter
  category_id?: number | number[]

  // Search
  search?: string

  // Date range filters
  created_after?: number
  created_before?: number
  updated_after?: number
  updated_before?: number

  // Metric filters (applied at SQL level for performance)
  min_profit_margin?: number
  max_profit_margin?: number
  min_items_sold?: number
  max_items_sold?: number
  low_stock_only?: boolean
  best_seller_only?: boolean
  loss_making_only?: boolean
  min_sell_through_rate?: number
  max_sell_through_rate?: number

  // Include related data
  include_images?: boolean
  include_skus?: boolean
  max_skus_return?: number

  // Field selection
  fields?: Array<keyof Product>
}

export type Product = {
  id: number
  sync_id: string | null
  product_name: string
  category_id: number
  description: string | null
  created_on: number
  updated_on: number
  last_sync: number
  is_deleted: boolean
  is_active: boolean
  is_sync_required: boolean
}

export type ProductMetrics = {
  // Core inventory metrics
  total_items_bought: number
  total_items_sold: number
  total_items_remaining: number
  inventory_value: number
  
  // Financial metrics
  total_revenue: number
  total_cost: number
  total_profit: number
  profit_margin: number
  
  // SKU metrics
  sku_count: number
  avg_sku_profit_margin: number
  
  // Performance metrics
  sell_through_rate: number
  days_of_inventory: number
  
  // Status flags
  is_low_stock: boolean
  is_high_margin: boolean
  is_loss_making: boolean
  is_best_seller: boolean
  stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
}

export type ProductSummary = {
  total_products: number
  total_items_bought: number
  total_items_sold: number
  total_items_remaining: number
  total_inventory_value: number
  total_revenue: number
  total_profit: number
  avg_profit_margin: number
  with_images: number
  with_skus: number
  out_of_stock: number
  low_stock: number
  overstocked: number
}


// type.d.ts
export type GetProductsByCategoryPayload = {
  // Category ID (required)
  category_id: number
  
  // Pagination
  page?: number
  limit?: number

  // Filter flags
  include_deleted?: boolean
  include_inactive?: boolean
  include_unsynced?: boolean

  // SKU filter
  has_sku?: HasSkuFilter

  // Sorting
  sort_by?: ProductSortField
  sort_order?: SortOrder

  // Search
  search?: string

  // Metric filters
  min_profit_margin?: number
  max_profit_margin?: number
  min_items_sold?: number
  max_items_sold?: number
  low_stock_only?: boolean
  best_seller_only?: boolean
  loss_making_only?: boolean
  min_sell_through_rate?: number
  max_sell_through_rate?: number

  // Include related data
  include_images?: boolean
  include_skus?: boolean
  max_skus_return?: number

  // Field selection
  fields?: Array<keyof Product>
}

export type GetProductByIdPayload = {
  id: number
  include_deleted?: boolean
}


export type ProductSearchPayload = {
  query?: string

  category_id?: number
  include_subcategories?: boolean

  include_deleted?: boolean
  include_inactive?: boolean
  include_unsynced?: boolean

  has_sku?: 'yes' | 'no' | 'both'

  created_from?: string
  created_to?: string

  limit?: number // optional hard cap, default 300
}


export type CreateSkuPayload = {
  product_id: number
  sku_name: string
  code: string
  is_active?: boolean

  images?: Array<{
    image_data: string
    is_primary?: boolean
  }>

  sku_attributes?: Array<{
    attribute_id: number
    value: string
    is_active?: boolean
  }>
}


export type UpdateSkuPayload = {
  id: number

  sku_name?: string
  code?: string
  is_active?: boolean

  update_images?: boolean
  images?: Array<{
    id?: number
    image_data?: string | null
  }>

  update_attributes?: boolean
  sku_attributes?: Array<{
    id?: number
    attribute_id?: number
    value?: string | null
    is_active?: boolean
  }>
}


export type TriState = 'yes' | 'no' | 'both'


export type GetAllSkusPayload = {
  // Tri-state filters
  is_active?: TriState
  is_deleted?: TriState
  is_sync_required?: TriState
  has_stock_purchases?: TriState

  // Product filters
  product_id?: number | number[]

  // Search
  search?: string

  // Price range filters
  min_price?: number
  max_price?: number

  // Pagination
  should_paginate?: boolean
  page?: number
  limit?: number

  // Sorting
  sort_by?: 'sku_name' | 'code' | 'created_on' | 'updated_on' | 
            'total_bought' | 'total_sold' | 'total_remaining' | 
            'profit_margin' | 'sell_through_rate'
  sort_order?: 'asc' | 'desc'

  // Nested data
  nested?: boolean
  with_images?: boolean
  with_attributes?: boolean
  with_stock_purchases?: boolean
  stock_purchases_limit?: number

  min_profit_margin?: number
  max_profit_margin?: number
  min_sell_through?: number
  max_sell_through?: number
  low_stock_only?: boolean
  overstocked_only?: boolean
  out_of_stock_only?: boolean
  
  // Sales history (NEW)
  with_sales_history?: boolean
  sales_limit?: number
}

export type CreateAttributePayload = {
  attribute_name: string
  unit?: string
  is_active?: boolean
}

export type GetAllAttributesPayload = {
  is_active?: TriState
  is_deleted?: TriState
  is_sync_required?: TriState
  search?: string
  has_units?: boolean // true = only attributes with units, false = only without units
  should_paginate?: boolean
  page?: number
  limit?: number
  sort_by?: 'attribute_name' | 'created_on' | 'unit'
  sort_order?: 'asc' | 'desc'
  with_sku_count?: boolean // Include count of SKUs using this attribute
}

export type GetAttributeByIdPayload = {
  id: number
  include_deleted?: boolean
  with_sku_details?: boolean // Include SKUs that use this attribute
}

export type UpdateAttributePayload = {
  id: number
  attribute_name?: string
  unit?: string | null // null means remove unit
  is_active?: boolean
}

export type DeleteAttributePayload = {
  id: number
  cascade?: boolean // If true, also soft delete all sku_attributes using this attribute
  restore?: boolean // If true, restore instead of delete
}

export type CreateSkuAttributePayload = {
  sku_id: number
  attribute_id: number
  value: string
  is_active?: boolean
}

export type GetAllSkuAttributesPayload = {
  sku_id?: number | number[]
  attribute_id?: number | number[]
  is_active?: TriState
  is_deleted?: TriState
  search?: string // Search in attribute name or value
  should_paginate?: boolean
  page?: number
  limit?: number
  sort_by?: 'value' | 'attribute_name' | 'created_on'
  sort_order?: 'asc' | 'desc'
  with_sku_details?: boolean
  with_attribute_details?: boolean
}

export type GetSkuAttributeByIdPayload = {
  id: number
  include_deleted?: boolean
}

export type UpdateSkuAttributePayload = {
  id: number
  value?: string
  is_active?: boolean
}

export type DeleteSkuAttributePayload = {
  id: number
  restore?: boolean
}

export type CreateSupplierPayload = {
  supplier_name: string
  contact_person?: string
  phone_number?: string
  email?: string
  address?: string
  is_active?: boolean
}

export type GetAllSuppliersPayload = {
  // Tri-state filters
  is_active?: TriState
  is_deleted?: TriState
  is_sync_required?: TriState
  
  // Search
  search?: string
  
  // Purchase filters
  has_purchases?: boolean
  min_total_spent?: number
  max_total_spent?: number
  min_purchases?: number
  max_purchases?: number
  with_recent_purchases_only?: boolean
  
  // Pagination
  should_paginate?: boolean
  page?: number
  limit?: number
  
  // Sorting
  sort_by?: 'supplier_name' | 'contact_person' | 'created_on' | 'total_spent' | 'total_purchases' | 'avg_profit_margin'
  sort_order?: 'asc' | 'desc'
  
  // Include statistics
  with_purchase_stats?: boolean
}

export type GetSupplierByIdPayload = {
  id: number
  include_deleted?: boolean
  with_purchases?: boolean
  purchase_limit?: number
  include_sales_stats?: boolean
}

export type UpdateSupplierPayload = {
  id: number
  supplier_name?: string
  contact_person?: string | null
  phone_number?: string | null
  email?: string | null
  address?: string | null
  is_active?: boolean
}

export type DeleteSupplierPayload = {
  id: number
  cascade?: boolean // If true, also soft delete all stock purchases
  restore?: boolean
}

export type CreateStockPurchasePayload = {
  sku_id: number
  quantity: number
  price_per_unit: number
  total_price_bought: number
  shipping_cost?: number
  min_price?: number
  max_price?: number
  manufacture_date?: string
  expiry_date?: string
  batch_number?: string
  purchased_on?: number
  arrived_on?: number
  supplier_id?: number
}

export type GetAllStockPurchasesPayload = {
  // Core filters
  sku_id?: number | number[]
  supplier_id?: number | number[]
  is_deleted?: TriState
  
  // Date filters
  date_from?: number
  date_to?: number
  expiry_from?: string
  expiry_to?: string
  
  // Performance filters
  min_profit_margin?: number
  max_profit_margin?: number
  min_sell_through?: number
  max_sell_through?: number
  
  // Batch filters
  batch_number?: string
  has_remaining_stock?: boolean
  expiring_soon_only?: boolean
  
  // Pagination
  should_paginate?: boolean
  page?: number
  limit?: number
  
  // Sorting
  sort_by?: 'purchased_on' | 'expiry_date' | 'price_per_unit' | 'profit_margin' | 'sell_through_rate' | 'remaining_quantity'
  sort_order?: 'asc' | 'desc'
  
  // Related data
  with_sku_details?: boolean
  with_supplier_details?: boolean
  with_sales_stats?: boolean
}
  
export type GetStockPurchaseByIdPayload = {
  id: number
  include_deleted?: boolean
  with_sales_history?: boolean
  sales_limit?: number
}


export type UpdateStockPurchasePayload = {
  id: number
  quantity?: number
  price_per_unit?: number
  total_price_bought?: number
  shipping_cost?: number
  min_price?: number
  max_price?: number
  manufacture_date?: string
  expiry_date?: string
  batch_number?: string
  purchased_on?: number
  arrived_on?: number
  supplier_id?: number | null
}


export type DeleteStockPurchasePayload = {
  id: number
  restore?: boolean
}


export type CreateSalePayload = {
  issued_by: number
  customer_id: number
  stock_purchased_id: number
  quantity: number
  total_price: number
  status?: 'pending' | 'completed' | 'cancelled' | 'refunded'
  balance_due?: number // timestamp for due date
  sold_on?: number
  is_debt_sale?: boolean
  has_been_overwritten?: boolean
  price_override_reason?: string
  override_approved_by?: number
  payment: {
    amount_paid: number
    payment_date?: number
    payment_method: PaymentMethod
    reference_number?: string
    description?: string
    recorded_by: number
  }
}


// Add these to your ipc/type.ts file

export type SaleStatus = 'pending' | 'completed' | 'cancelled' | 'refunded'
export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'custom'
export type GroupBy = 'day' | 'week' | 'month' | 'employee' | 'customer' | 'product' | 'status'
export type ProfitMarginStatus = 'above_expected' | 'within_expected' | 'below_expected' | 'critical'
export type DebtStatus = 'overdue' | 'upcoming' | 'paid' | 'all'

export type GetAllSalesPayload = {
  // Pagination
  page?: number
  limit?: number
  sort_by?: 'sold_on' | 'total_price' | 'profit_margin' | 'quantity' | 'customer_name'
  sort_order?: 'asc' | 'desc'

  // Basic filters
  status?: SaleStatus[]
  is_debt_sale?: boolean
  is_deleted?: boolean
  has_been_overwritten?: boolean
  override_approved?: boolean
  
  // Price and quantity ranges
  price_range?: { min?: number; max?: number }
  quantity_range?: { min?: number; max?: number }
  
  // Profit margin filters
  profit_margin?: { min?: number; max?: number }
  profit_margin_status?: ProfitMarginStatus
  profit_margin_deviation?: number
  
  // Date filters
  date_range?: {
    from?: number
    to?: number
    preset?: DatePreset
  }
  sold_on?: { from?: number; to?: number }
  payment_date?: { from?: number; to?: number }
  due_date?: { from?: number; to?: number }
  
  // Entity filters
  customer_ids?: number[]
  employee_ids?: number[]
  product_ids?: number[]
  sku_ids?: number[]
  category_ids?: number[]
  
  // Payment filters
  payment_methods?: PaymentMethod[]
  has_full_payment?: boolean
  payment_reference?: string
  
  // Debt-specific
  debt_status?: DebtStatus
  overdue_days?: number
  
  // Search
  search?: string
  
  // Nested data options
  include_customer?: boolean
  include_employee?: boolean
  include_stock_purchase?: boolean
  include_payments?: boolean
  include_product_details?: boolean
  include_sku_details?: boolean
  max_payments_per_sale?: number
  
  // Summary and aggregation
  include_summary?: boolean
  group_by?: GroupBy
}

export type SalesSummary = {
  total_sales: number
  total_revenue: number
  total_profit: number
  average_margin: number
  total_quantity_sold: number
  debt_sales_count: number
  total_debt_amount: number
  total_outstanding_debt: number
  average_sale_value: number
  sales_by_status: Record<SaleStatus, number>
  sales_by_payment_method: Record<string, number>
  sales_by_employee: Array<{ employee_id: number; employee_name: string; count: number; revenue: number }>
  sales_by_customer: Array<{ customer_id: number; customer_name: string; count: number; revenue: number }>
  top_products: Array<{ product_id: number; product_name: string; quantity: number; revenue: number }>
  by_date?: Array<{ period: string; count: number; revenue: number; profit: number; avg_margin: number }>
  trends?: {
    daily_average: number
    weekly_average: number
    monthly_average: number
    best_day: { date: string; revenue: number; sales: number }
    best_month: { month: string; revenue: number; sales: number }
    profit_trend: 'increasing' | 'decreasing' | 'stable'
  }
}


export type TimeSeriesDataPoint = {
  period: string
  count: number
  revenue: number
  profit: number
  avg_margin: number
}

export type TrendsData = {
  daily_average: number
  weekly_average: number
  monthly_average: number
  best_day: { date: string; revenue: number; sales: number }
  best_month: { month: string; revenue: number; sales: number }
  profit_trend: 'increasing' | 'decreasing' | 'stable'
}



export type ExportFormat = 'csv' | 'docx'

export type ExportScope = 'all' | 'filtered' | 'selected'

export type ExportSalesPayload = {
  // Export options
  format: ExportFormat
  scope: ExportScope
  
  // If scope is 'selected', provide IDs
  sale_ids?: number[]
  
  // If scope is 'filtered', reuse filters from getAll
  filters?: Omit<GetAllSalesPayload, 'page' | 'limit' | 'include_summary' | 'group_by'>
  
  // Date range for export (overrides filters if provided)
  date_range?: {
    from?: number
    to?: number
    preset?: DatePreset
  }
  
  // Word specific options (for financial reports)
  word_options?: {
    title?: string
    company_name?: string
    report_period?: string
    prepared_by?: string
    include_charts?: boolean
    include_signature?: boolean
    notes?: string
  }
  
  // CSV specific options
  csv_options?: {
    delimiter?: ',' | ';' | '\t'
    include_headers?: boolean
    include_summary_row?: boolean
  }
}

// types.ts (or your payload types file)

export type GetSalesByIdPayload = {
  // Direct ID lookup
  id?: number
  
  // Optional filters
  include_deleted?: boolean
  include_details?: boolean // Include related data (customer, employee, product, payments)
  
  // Additional IDs for filtering (combined with id if provided)
  filters?: {
    customer_id?: number
    issued_by?: number
    stock_purchased_id?: number
    use_current_user?: boolean
    sku_id?: number
    product_id?: number
    payment_id?: number
  }
}

export type SalesByIdResponse = {
  success: boolean
  message?: string
  data?: {
    sales: Array<{
      // Core sale fields
      id: number
      sync_id?: string | null
      quantity: number
      total_price: number
      shipping_cost: number | null
      cost_price_snapshot: number
      status: string
      is_debt_sale: boolean
      balance_due: number | null
      sold_on: number
      updated_on?: number
      has_been_canceled: boolean
      reason_for_cancellation?: string | null
      has_been_overwritten?: boolean
      price_override_reason: string | null
      override_approved_by?: number | null
      is_deleted?: boolean
      is_sync_required?: boolean
      
      // Related data
      customer?: {
        id?: number
        name?: string
        phone?: string
        email?: string
        address?: string
        is_active?: boolean
      } | null
      
      employee?: {
        id: number
        name: string
        username: string
        role: string
        email?: string
      } | null
      
      product?: {
        id: number
        name: string
        category_id: number
        sku: {
          id: number
          name: string
          code: string
        }
        purchase: {
          id: number
          batch_number?: string
          price_per_unit: number
          shipping_cost: number | null
          total_cost: number
          landed_cost_per_unit: number
          min_selling_price: number | null
          max_selling_price: number | null
          purchased_on: number
          expiry_date?: string
        }
      } | null
      
      payments?: Array<{
        id: number
        amount_paid: number
        payment_date: number
        payment_method: string
        reference_number?: string
        description?: string
        recorded_by: number | null
        has_been_canceled: boolean
        reason_for_cancellation: string | null
        has_been_overwritten: boolean
        price_override_reason: string | null
        override_approved_by: number | null
      }>
      
      // Core metrics
      profit_margin: number
      
      // Payment metrics
      payment_metrics?: {
        total_paid: number
        remaining_balance: number
        payment_count: number
        is_fully_paid: boolean
        is_overdue: boolean
        overdue_days: number | null
      }
      
      // Performance metrics
      performance_metrics?: {
        days_since_sale: number
        cost_of_goods_sold: number
        actual_profit: number
        roi: number
        expected_profit: number
        expected_margin: number
        profit_variance: number
        profit_variance_percentage: number
        performance_vs_expected: 'above' | 'within' | 'below'
      }
      
      // Override info
      override_info?: {
        reason: string | null
        approved_by: number | null
      } | null
    }>
  }
}


export type SaleUpdateAction = 'cancel' | 'overwrite'

export type SaleFieldChange = {
  old_value: any
  new_value: any
  field_name: string
  field_label?: string
}

export type SaleOverwriteData = {
  changes: SaleFieldChange[]
  reason: string
  old_data: Record<string, any>
  new_data: Record<string, any>
}

export type UpdateSalePayload = {
  id: number
  action: SaleUpdateAction
  
  // For cancellation
  reason?: string
  
  // For overwrite
  updates?: Partial<{
    quantity: number
    total_price: number
    status: string
    is_debt_sale: boolean
    balance_due: number | null
    has_been_overwritten: boolean
    price_override_reason: string
    customer_id: number
    stock_purchased_id: number
  }>
  overwrite_reason?: string
  
  // Payment updates (optional)
  payments?: Array<{
    id?: number
    amount_paid?: number
    payment_method?: string
    reference_number?: string
    description?: string
    is_deleted?: boolean
  }>
}

export type UpdateSaleResponse = {
  success: boolean
  message?: string
  data?: {
    id: number
    action: SaleUpdateAction
    changes: SaleFieldChange[]
    requires_approval?: boolean
    approval_status?: 'pending' | 'approved' | 'rejected'
    sale: any // Updated sale data
  }
}


export type CreatePaymentPayload = {
  sale_id: number
  amount_paid: number
  payment_date?: number
  payment_method: PaymentMethod
  reference_number?: string
  description?: string
}

export type UpdatePaymentPayload = {
  id: number
  amount_paid?: number
  payment_date?: number
  payment_method?: PaymentMethod
  reference_number?: string
  description?: string
  has_been_overwritten?: boolean
  price_override_reason?: string
  override_approved_by?: number
}

export type CancelPaymentPayload = {
  id: number
  reason: string
  approved_by?: number
}

export type GetPaymentByIdPayload = {
  id: number
  include_deleted?: boolean
  include_sale_details?: boolean
}

export type GetPaymentsBySaleIdPayload = {
  sale_id: number
  include_deleted?: boolean
  include_cancelled?: boolean
  page?: number
  limit?: number
  sort_by?: 'payment_date' | 'amount_paid' | 'created_on'
  sort_order?: 'asc' | 'desc'
}

export type PaymentResponse = {
  success: boolean
  message?: string
  data?: {
    id: number
    sale_id: number
    amount_paid: number
    payment_date: number
    payment_method: PaymentMethod
    reference_number: string | null
    description: string | null
    recorded_by: number | null
    has_been_canceled: boolean
    reason_for_cancellation: string | null
    has_been_overwritten: boolean
    price_override_reason: string | null
    override_approved_by: number | null
    created_on: number
    is_deleted: boolean
    
    // Optional nested data
    sale?: {
      id: number
      total_price: number
      status: string
      is_debt_sale: boolean
      customer?: {
        id: number
        name: string
      } | null
    } | null
    recorded_by_employee?: {
      id: number
      name: string
      role: string
    } | null
    approver?: {
      id: number
      name: string
      role: string
    } | null
  }
}

export type PaymentsListResponse = {
  success: boolean
  message?: string
  data?: {
    payments: Array<{
      id: number
      sale_id: number
      amount_paid: number
      payment_date: number
      payment_method: PaymentMethod
      reference_number: string | null
      description: string | null
      recorded_by: number | null
      has_been_canceled: boolean
      reason_for_cancellation: string | null
      has_been_overwritten: boolean
      price_override_reason: string | null
      override_approved_by: number | null
      created_on: number
      is_deleted: boolean
      recorded_by_employee?: {
        id: number
        name: string
        role: string
      } | null
      approver?: {
        id: number
        name: string
        role: string
      } | null
    }>
    pagination?: {
      page: number
      limit: number
      total: number
      total_pages: number
      has_next: boolean
      has_prev: boolean
    }
    summary?: {
      total_amount: number
      average_amount: number
      count_by_method: Record<string, number>
    }
  }
}


// ============================================================================
// Customer Types
// ============================================================================

export type CreateCustomerPayload = {
  name: string
  phone?: string
  email?: string
  address?: string
  is_active?: boolean
}

export type UpdateCustomerPayload = {
  id: number
  name?: string
  phone?: string | null
  email?: string | null
  address?: string | null
  is_active?: boolean
}

export type GetCustomerByIdPayload = {
  id: number
  include_deleted?: boolean
  include_sales?: boolean
  sales_limit?: number
  sales_status?: SaleStatus[]
}

export type GetAllCustomersPayload = {
  page?: number
  limit?: number
  include_deleted?: boolean
  include_inactive?: boolean
  search?: string
  sort_by?: 'name' | 'created_on' | 'total_spent' | 'sale_count'
  sort_order?: 'asc' | 'desc'
  with_sales_stats?: boolean
  min_total_spent?: number
  max_total_spent?: number
  min_sale_count?: number
  max_sale_count?: number
  has_debt?: boolean
  created_after?: number
  created_before?: number
}

export type DeleteCustomerPayload = {
  id: number
  restore?: boolean
}

export type CustomerResponse = {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  created_on: number
  updated_on: number
  is_active: boolean
  is_deleted: boolean
  is_sync_required: boolean
  // last_sync: number | null
  
  // Optional nested data
  sales?: Array<{
    id: number
    quantity: number
    total_price: number
    status: string
    is_debt_sale: boolean
    sold_on: number
    profit_margin: number | null
    payment_count: number
    total_paid: number
    remaining_balance: number
  }>
  sales_stats?: {
    total_sales: number
    total_spent: number
    average_sale_value: number
    total_quantity: number
    debt_sales_count: number
    total_debt: number
    outstanding_debt: number
    first_purchase: number | null
    last_purchase: number | null
    favorite_payment_method?: string
  }
}


// src/main/ipc/transactions/type.ts

import { TRANSACTION_TYPE } from '../../shared/constants'

export const transactionTypeValues = TRANSACTION_TYPE.map((t) => t.type)
export type TransactionType = typeof transactionTypeValues[number]

export interface Transaction {
  id: number
  sync_id: string | null
  transaction_type: TransactionType
  amount: number
  description: string | null
  recorded_by: number | null
  created_on: number
  is_deleted: boolean
  is_sync_required: boolean
  last_synced_on: number | null
}

export interface TransactionWithEmployee extends Transaction {
  employee_name?: string
  employee_username?: string
}

// ============================================================================
// CREATE TRANSACTION
// ============================================================================
export interface CreateTransactionPayload {
  transaction_type: TransactionType
  amount: number
  description?: string
  sync_id?: string
}

export interface CreateTransactionResponse {
  success: boolean
  message?: string
  data?: {
    id: number
    transaction: Transaction
  }
}

// ============================================================================
// GET ALL TRANSACTIONS
// ============================================================================
export type TransactionFilterType = 'all' | 'cashin' | 'cashout' | 'transfer'
export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year' | 'custom'
export type SortOrder = 'asc' | 'desc'
export type SortField = 'created_on' | 'amount' | 'transaction_type'

export interface GetAllTransactionsPayload {
  // Pagination
  page?: number
  limit?: number
  
  // Filters
  transaction_type?: TransactionFilterType
  date_preset?: DatePreset
  date_from?: number
  date_to?: number
  recorded_by?: number
  min_amount?: number
  max_amount?: number
  search?: string  // Search in description
  
  // Soft delete filter
  include_deleted?: boolean
  
  // Sorting
  sort_by?: SortField
  sort_order?: SortOrder
  
  // Related data
  include_employee_details?: boolean
}

export interface GetAllTransactionsResponse {
  success: boolean
  message?: string
  data?: {
    items: TransactionWithEmployee[]
    pagination: {
      page: number
      limit: number
      total: number
      total_pages: number
      has_next: boolean
      has_prev: boolean
      returned: number
      from: number
      to: number
    }
    summary: {
      total_cashin: number
      total_cashout: number
      total_transfer: number
      net_cashflow: number
      expected_cash_in_drawer: number
      average_transaction: number
    }
  }
}

// ============================================================================
// GET TRANSACTION BY ID
// ============================================================================
export interface GetTransactionByIdPayload {
  id: number
  include_deleted?: boolean
  include_employee_details?: boolean
}

export interface GetTransactionByIdResponse {
  success: boolean
  message?: string
  data?: TransactionWithEmployee
}

// ============================================================================
// GET TRANSACTIONS BY EMPLOYEE
// ============================================================================
export interface GetTransactionsByEmployeePayload {
  employee_id: number
  page?: number
  limit?: number
  date_from?: number
  date_to?: number
  transaction_type?: TransactionFilterType
  include_deleted?: boolean
}

export interface GetTransactionsByEmployeeResponse {
  success: boolean
  message?: string
  data?: {
    items: TransactionWithEmployee[]
    employee: {
      id: number
      name: string
      username: string
    }
    pagination: {
      page: number
      limit: number
      total: number
      total_pages: number
      has_next: boolean
      has_prev: boolean
      returned: number
    }
    summary: {
      total_cashin: number
      total_cashout: number
      net_contribution: number
    }
  }
}

// ============================================================================
// UPDATE TRANSACTION
// ============================================================================
export interface UpdateTransactionPayload {
  id: number
  transaction_type?: TransactionType
  amount?: number
  description?: string
}

export interface UpdateTransactionResponse {
  success: boolean
  message?: string
  data?: Transaction
}

// ============================================================================
// SOFT DELETE / RESTORE TRANSACTION
// ============================================================================
export interface SoftDeleteTransactionPayload {
  id: number
  restore?: boolean  // true = restore, false = soft delete
}

export interface SoftDeleteTransactionResponse {
  success: boolean
  message?: string
  data?: {
    id: number
    action: 'deleted' | 'restored'
    transaction?: Transaction
  }
}