// ============================================================================
// TRANSACTION TYPES
// ============================================================================

export type TransactionType = 'cashin' | 'cashout' | 'transfer'

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
  employee_role?: string
}

export interface TransactionMetrics {
  total_cashin: number
  total_cashout: number
  total_transfer: number
  net_cashflow: number
  expected_cash_in_drawer: number
  average_transaction: number
}

export type TransactionFilterType = 'all' | 'cashin' | 'cashout' | 'transfer'
export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year' | 'custom'
export type SortField = 'created_on' | 'amount' | 'transaction_type'
export type SortOrder = 'asc' | 'desc'

export interface TransactionFilters {
  transaction_type?: TransactionFilterType
  date_preset?: DatePreset
  date_from?: number
  date_to?: number
  recorded_by?: number
  min_amount?: number
  max_amount?: number
  search?: string
  include_deleted?: boolean
}

export interface Pagination {
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

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface GetAllTransactionsResponse {
  success: boolean
  message?: string
  data?: {
    items: TransactionWithEmployee[]
    pagination: Pagination
    summary: TransactionMetrics
  }
}

export interface GetTransactionByIdResponse {
  success: boolean
  message?: string
  data?: TransactionWithEmployee
}

export interface CreateTransactionResponse {
  success: boolean
  message?: string
  data?: {
    id: number
    transaction: Transaction
  }
}

export interface UpdateTransactionResponse {
  success: boolean
  message?: string
  data?: Transaction
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

// ============================================================================
// FORM TYPES
// ============================================================================

export type TransactionFormData = {
  transaction_type: TransactionType
  amount: string
  description: string
}

export const defaultTransactionForm = (): TransactionFormData => ({
  transaction_type: 'cashin',
  amount: '',
  description: '',
})

// ============================================================================
// SORT TYPES
// ============================================================================

export type SortKey = 
  | 'date_desc' 
  | 'date_asc' 
  | 'amount_desc' 
  | 'amount_asc' 
  | 'type_asc' 
  | 'type_desc'

export const sortLabels: Record<SortKey, string> = {
  date_desc: 'Newest first',
  date_asc: 'Oldest first',
  amount_desc: 'Highest amount',
  amount_asc: 'Lowest amount',
  type_asc: 'Type A → Z',
  type_desc: 'Type Z → A',
}


export const formatCurrency = (val: number | null | undefined) => {
  if (val == null) return '—'
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'XAF', 
    minimumFractionDigits: 2 
  }).format(val)
}


export const sortToApiParams = (key: SortKey): { sort_by: SortField; sort_order: SortOrder } => {
  switch (key) {
    case 'date_desc': return { sort_by: 'created_on', sort_order: 'desc' }
    case 'date_asc': return { sort_by: 'created_on', sort_order: 'asc' }
    case 'amount_desc': return { sort_by: 'amount', sort_order: 'desc' }
    case 'amount_asc': return { sort_by: 'amount', sort_order: 'asc' }
    case 'type_asc': return { sort_by: 'transaction_type', sort_order: 'asc' }
    case 'type_desc': return { sort_by: 'transaction_type', sort_order: 'desc' }
    default: return { sort_by: 'created_on', sort_order: 'desc' }
  }
}