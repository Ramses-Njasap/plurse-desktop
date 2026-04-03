// src/main/ipc/transactions/type.ts

import { TRANSACTION_TYPE } from "@utils/config"

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