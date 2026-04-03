// src/main/ipc/transactions/transactions.ts

import { getDB } from '@db/sqlite3'
import { employees } from '@schema/sqlite3/accounts'
import { transactions } from '@schema/sqlite3/transactions'
import { randomUUID } from 'crypto'
import { and, asc, desc, eq, gte, inArray, like, lte, sql, SQL } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { sessionManager } from '../../main/session-manager'
import type {
    CreateTransactionPayload,
    CreateTransactionResponse,
    GetAllTransactionsPayload,
    GetAllTransactionsResponse,
    GetTransactionByIdPayload,
    GetTransactionByIdResponse,
    GetTransactionsByEmployeePayload,
    GetTransactionsByEmployeeResponse,
    SoftDeleteTransactionPayload,
    SoftDeleteTransactionResponse,
    Transaction,
    TransactionType,
    TransactionWithEmployee,
    UpdateTransactionPayload,
    UpdateTransactionResponse
} from './dashboard/types/transactions.types'
import { transactionTypeValues } from './dashboard/types/transactions.types'


const db = () => getDB()

/**
 * Helper to get date range from preset
 */
const getDateRangeFromPreset = (preset: string): { from: Date; to: Date } => {
  const now = new Date()
  const from = new Date(now)
  const to = new Date(now)

  switch(preset) {
    case 'today':
      from.setHours(0, 0, 0, 0)
      to.setHours(23, 59, 59, 999)
      break
    case 'yesterday':
      from.setDate(from.getDate() - 1)
      from.setHours(0, 0, 0, 0)
      to.setDate(to.getDate() - 1)
      to.setHours(23, 59, 59, 999)
      break
    case 'this_week':
      from.setDate(from.getDate() - from.getDay())
      from.setHours(0, 0, 0, 0)
      to.setDate(to.getDate() + (6 - to.getDay()))
      to.setHours(23, 59, 59, 999)
      break
    case 'this_month':
      from.setDate(1)
      from.setHours(0, 0, 0, 0)
      to.setMonth(to.getMonth() + 1)
      to.setDate(0)
      to.setHours(23, 59, 59, 999)
      break
    case 'this_year':
      from.setMonth(0, 1)
      from.setHours(0, 0, 0, 0)
      to.setMonth(11, 31)
      to.setHours(23, 59, 59, 999)
      break
    default:
      from.setHours(0, 0, 0, 0)
      to.setHours(23, 59, 59, 999)
  }

  return { from, to }
}

// ============================================================================
// CREATE TRANSACTION
// ============================================================================
ipcMain.handle(
  'transactions:create',
  async (_event, payload: CreateTransactionPayload): Promise<CreateTransactionResponse> => {
    try {
      // Check authentication
      const session = sessionManager.getCurrentSession()
      if (!session) {
        return {
          success: false,
          message: 'Not authenticated. Please log in.'
        }
      }

      // Validate payload
      if (!payload.transaction_type) {
        return {
          success: false,
          message: 'Transaction type is required.'
        }
      }

      if (!transactionTypeValues.includes(payload.transaction_type)) {
        return {
          success: false,
          message: `Invalid transaction type. Must be one of: ${transactionTypeValues.join(', ')}`
        }
      }

      if (!payload.amount || payload.amount <= 0) {
        return {
          success: false,
          message: 'Amount must be greater than 0.'
        }
      }

      // Insert transaction
      const now = new Date()
      const result = db()
        .insert(transactions)
        .values({
          transaction_type: payload.transaction_type,
          amount: payload.amount,
          description: payload.description || null,
          recorded_by: session.employeeId,
          sync_id: payload.sync_id || randomUUID(),
          created_on: now,
          last_synced_on: now,
          is_deleted: false,
          is_sync_required: false
        })
        .run()

      const transactionId = Number(result.lastInsertRowid)

      // Fetch created transaction
      const newTransaction = db()
        .select({
          id: transactions.id,
          transaction_type: transactions.transaction_type,
          amount: transactions.amount,
          description: transactions.description,
          recorded_by: transactions.recorded_by,
          created_on: sql<number>`CAST(strftime('%s', ${transactions.created_on}) AS INTEGER)`,
          is_deleted: transactions.is_deleted,
          is_sync_required: transactions.is_sync_required,
          last_synced_on: transactions.last_synced_on
        })
        .from(transactions)
        .where(eq(transactions.id, transactionId))
        .get() as Transaction

      return {
        success: true,
        message: 'Transaction created successfully.',
        data: {
          id: transactionId,
          transaction: newTransaction
        }
      }

    } catch (error) {
      console.error('Error creating transaction:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create transaction.'
      }
    }
  }
)

// ============================================================================
// GET ALL TRANSACTIONS
// ============================================================================
ipcMain.handle(
  'transactions:get-all',
  async (_event, payload?: GetAllTransactionsPayload): Promise<GetAllTransactionsResponse> => {
    try {
      const {
        page = 1,
        limit = 20,
        transaction_type = 'all',
        date_preset,
        date_from,
        date_to,
        recorded_by,
        min_amount,
        max_amount,
        search,
        include_deleted = false,
        sort_by = 'created_on',
        sort_order = 'desc',
        include_employee_details = true
      } = payload || {}

      const offset = (page - 1) * limit

      // Build conditions
      const conditions: SQL[] = []

      // Soft delete filter
      if (!include_deleted) {
        conditions.push(eq(transactions.is_deleted, false))
      }

      // Transaction type filter
      if (transaction_type !== 'all') {
        conditions.push(eq(transactions.transaction_type, transaction_type))
      }

      // Date filters
      if (date_preset) {
        const { from, to } = getDateRangeFromPreset(date_preset)
        conditions.push(gte(transactions.created_on, from))
        conditions.push(lte(transactions.created_on, to))
      } else {
        if (date_from) {
          conditions.push(gte(transactions.created_on, new Date(date_from)))
        }
        if (date_to) {
          conditions.push(lte(transactions.created_on, new Date(date_to)))
        }
      }

      // Recorded by filter
      if (recorded_by) {
        conditions.push(eq(transactions.recorded_by, recorded_by))
      }

      // Amount range filters
      if (min_amount !== undefined) {
        conditions.push(gte(transactions.amount, min_amount))
      }
      if (max_amount !== undefined) {
        conditions.push(lte(transactions.amount, max_amount))
      }

      // Search in description
      if (search) {
        conditions.push(like(transactions.description, `%${search}%`))
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      // Get total count
      const countResult = db()
        .select({ count: sql<number>`COUNT(*)` })
        .from(transactions)
        .where(whereClause)
        .get()

      const total = Number(countResult?.count || 0)

      if (total === 0) {
        return {
          success: true,
          data: {
            items: [],
            pagination: {
              page,
              limit,
              total: 0,
              total_pages: 0,
              has_next: false,
              has_prev: false,
              returned: 0,
              from: 0,
              to: 0
            },
            summary: {
              total_cashin: 0,
              total_cashout: 0,
              total_transfer: 0,
              net_cashflow: 0,
              expected_cash_in_drawer: 0,
              average_transaction: 0
            }
          }
        }
      }

      // Build order by
      let orderByClause
      switch (sort_by) {
        case 'created_on':
          orderByClause = sort_order === 'asc' ? asc(transactions.created_on) : desc(transactions.created_on)
          break
        case 'amount':
          orderByClause = sort_order === 'asc' ? asc(transactions.amount) : desc(transactions.amount)
          break
        case 'transaction_type':
          orderByClause = sort_order === 'asc' ? asc(transactions.transaction_type) : desc(transactions.transaction_type)
          break
        default:
          orderByClause = desc(transactions.created_on)
      }

      // Fetch transactions
      const rawTransactionList = db()
        .select({
          id: transactions.id,
          sync_id: transactions.sync_id,
          transaction_type: transactions.transaction_type,
          amount: transactions.amount,
          description: transactions.description,
          recorded_by: transactions.recorded_by,
          created_on: transactions.created_on,
          is_deleted: transactions.is_deleted,
          is_sync_required: transactions.is_sync_required,
          last_synced_on: transactions.last_synced_on
        })
        .from(transactions)
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset)
        .all()

      // Convert to proper Transaction type
      const convertTransaction = (t: any): Transaction => ({
        id: t.id,
        sync_id: t.sync_id,
        transaction_type: t.transaction_type as TransactionType,
        amount: t.amount,
        description: t.description,
        recorded_by: t.recorded_by,
        created_on: Math.floor(t.created_on.getTime() / 1000),
        is_deleted: t.is_deleted === 1,
        is_sync_required: t.is_sync_required === 1,
        last_synced_on: t.last_synced_on ? Math.floor(t.last_synced_on.getTime() / 1000) : null
      })

      const transactionList: Transaction[] = rawTransactionList.map(convertTransaction)

      // Fetch employee details if requested
      let items: TransactionWithEmployee[] = transactionList

      if (include_employee_details) {
        const employeeIds = [...new Set(transactionList.map(t => t.recorded_by).filter(id => id !== null))] as number[]

        if (employeeIds.length > 0) {
          const employeeData = db()
            .select({
              id: employees.id,
              name: sql<string>`${employees.first_name} || ' ' || ${employees.last_name}`,
              username: employees.username
            })
            .from(employees)
            .where(inArray(employees.id, employeeIds))
            .all()

          const employeeMap = new Map(employeeData.map(e => [e.id, e]))

          items = transactionList.map(t => ({
            ...t,
            employee_name: t.recorded_by ? employeeMap.get(t.recorded_by)?.name : undefined,
            employee_username: t.recorded_by ? employeeMap.get(t.recorded_by)?.username : undefined
          }))
        }
      }

      // Calculate summaries
      const cashinTotal = items
        .filter(t => t.transaction_type === 'cashin')
        .reduce((sum, t) => sum + t.amount, 0)

      const cashoutTotal = items
        .filter(t => t.transaction_type === 'cashout')
        .reduce((sum, t) => sum + t.amount, 0)

      const transferTotal = items
        .filter(t => t.transaction_type === 'transfer')
        .reduce((sum, t) => sum + t.amount, 0)

      const netCashflow = cashinTotal - cashoutTotal
      
      // 👇 THIS IS THE KEY ADDITION - Expected cash in drawer
      const expectedCashInDrawer = cashinTotal - (cashoutTotal + transferTotal)
      
      const averageTransaction = items.length > 0 
        ? items.reduce((sum, t) => sum + t.amount, 0) / items.length 
        : 0

      const totalPages = Math.ceil(total / limit)
      const from = offset + 1
      const to = Math.min(offset + limit, total)

      return {
        success: true,
        data: {
          items,
          pagination: {
            page,
            limit,
            total,
            total_pages: totalPages,
            has_next: page < totalPages,
            has_prev: page > 1,
            returned: items.length,
            from,
            to
          },
          summary: {
            total_cashin: cashinTotal,
            total_cashout: cashoutTotal,
            total_transfer: transferTotal,
            net_cashflow: netCashflow,
            expected_cash_in_drawer: expectedCashInDrawer,  // 👈 ADDED
            average_transaction: averageTransaction
          }
        }
      }

    } catch (error) {
      console.error('Error fetching transactions:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch transactions.'
      }
    }
  }
)

// ============================================================================
// GET TRANSACTION BY ID
// ============================================================================
ipcMain.handle(
  'transactions:get-by-id',
  async (_event, payload: GetTransactionByIdPayload): Promise<GetTransactionByIdResponse> => {
    try {
      const { id, include_deleted = false, include_employee_details = true } = payload

      if (!id) {
        return {
          success: false,
          message: 'Transaction ID is required.'
        }
      }

      // Fetch transaction
      const transaction = db()
        .select({
          id: transactions.id,
          sync_id: transactions.sync_id,
          transaction_type: transactions.transaction_type,
          amount: transactions.amount,
          description: transactions.description,
          recorded_by: transactions.recorded_by,
          created_on: transactions.created_on,
          is_deleted: transactions.is_deleted,
          is_sync_required: transactions.is_sync_required,
          last_synced_on: transactions.last_synced_on
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.id, id),
            include_deleted ? undefined : eq(transactions.is_deleted, false)
          )
        )
        .get() as Transaction | undefined

      if (!transaction) {
        return {
          success: false,
          message: `Transaction with ID ${id} not found.`
        }
      }

      let result: TransactionWithEmployee = transaction

      // Fetch employee details if requested
      if (include_employee_details && transaction.recorded_by) {
        const employee = db()
          .select({
            name: sql<string>`${employees.first_name} || ' ' || ${employees.last_name}`,
            username: employees.username
          })
          .from(employees)
          .where(eq(employees.id, transaction.recorded_by))
          .get()

        if (employee) {
          result = {
            ...transaction,
            employee_name: employee.name,
            employee_username: employee.username
          }
        }
      }

      return {
        success: true,
        data: result
      }

    } catch (error) {
      console.error('Error fetching transaction:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch transaction.'
      }
    }
  }
)

// ============================================================================
// GET TRANSACTIONS BY EMPLOYEE
// ============================================================================
ipcMain.handle(
  'transactions:get-by-employee',
  async (_event, payload: GetTransactionsByEmployeePayload): Promise<GetTransactionsByEmployeeResponse> => {
    try {
      const {
        employee_id,
        page = 1,
        limit = 20,
        date_from,
        date_to,
        transaction_type = 'all',
        include_deleted = false
      } = payload

      if (!employee_id) {
        return {
          success: false,
          message: 'Employee ID is required.'
        }
      }

      const offset = (page - 1) * limit

      // Build conditions
      const conditions: SQL[] = [
        eq(transactions.recorded_by, employee_id)
      ]

      if (!include_deleted) {
        conditions.push(eq(transactions.is_deleted, false))
      }

      if (transaction_type !== 'all') {
        conditions.push(eq(transactions.transaction_type, transaction_type))
      }

      if (date_from) {
        conditions.push(gte(transactions.created_on, new Date(date_from)))
      }
      if (date_to) {
        conditions.push(lte(transactions.created_on, new Date(date_to)))
      }

      const whereClause = and(...conditions)

      // Get total count
      const countResult = db()
        .select({ count: sql<number>`COUNT(*)` })
        .from(transactions)
        .where(whereClause)
        .get()

      const total = Number(countResult?.count || 0)

      // Fetch employee details
      const employee = db()
        .select({
          id: employees.id,
          name: sql<string>`${employees.first_name} || ' ' || ${employees.last_name}`,
          username: employees.username
        })
        .from(employees)
        .where(eq(employees.id, employee_id))
        .get()

      if (!employee) {
        return {
          success: false,
          message: `Employee with ID ${employee_id} not found.`
        }
      }

      if (total === 0) {
        return {
          success: true,
          data: {
            items: [],
            employee,
            pagination: {
              page,
              limit,
              total: 0,
              total_pages: 0,
              has_next: false,
              has_prev: false,
              returned: 0
            },
            summary: {
              total_cashin: 0,
              total_cashout: 0,
              net_contribution: 0
            }
          }
        }
      }

      // Fetch transactions
      const transactionList = db()
        .select({
          id: transactions.id,
          transaction_type: transactions.transaction_type,
          amount: transactions.amount,
          description: transactions.description,
          recorded_by: transactions.recorded_by,
          created_on: sql<number>`CAST(strftime('%s', ${transactions.created_on}) AS INTEGER)`,
          is_deleted: transactions.is_deleted,
          is_sync_required: transactions.is_sync_required,
          last_synced_on: transactions.last_synced_on
        })
        .from(transactions)
        .where(whereClause)
        .orderBy(desc(transactions.created_on))
        .limit(limit)
        .offset(offset)
        .all() as Transaction[]

      // Calculate summaries
      const cashinTotal = transactionList
        .filter(t => t.transaction_type === 'cashin')
        .reduce((sum, t) => sum + t.amount, 0)

      const cashoutTotal = transactionList
        .filter(t => t.transaction_type === 'cashout')
        .reduce((sum, t) => sum + t.amount, 0)

      const netContribution = cashinTotal - cashoutTotal

      const totalPages = Math.ceil(total / limit)

      return {
        success: true,
        data: {
          items: transactionList,
          employee,
          pagination: {
            page,
            limit,
            total,
            total_pages: totalPages,
            has_next: page < totalPages,
            has_prev: page > 1,
            returned: transactionList.length
          },
          summary: {
            total_cashin: cashinTotal,
            total_cashout: cashoutTotal,
            net_contribution: netContribution
          }
        }
      }

    } catch (error) {
      console.error('Error fetching employee transactions:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch employee transactions.'
      }
    }
  }
)

// ============================================================================
// UPDATE TRANSACTION
// ============================================================================
ipcMain.handle(
  'transactions:update',
  async (_event, payload: UpdateTransactionPayload): Promise<UpdateTransactionResponse> => {
    try {
      const { id, transaction_type, amount, description } = payload

      if (!id) {
        return {
          success: false,
          message: 'Transaction ID is required.'
        }
      }

      // Check authentication
      const session = sessionManager.getCurrentSession()
      if (!session) {
        return {
          success: false,
          message: 'Not authenticated. Please log in.'
        }
      }

      // Check if transaction exists
      const existing = db()
        .select({
            id: transactions.id,
            recorded_by: transactions.recorded_by
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.id, id),
            eq(transactions.is_deleted, false)
          )
        )
        .get()

      if (!existing) {
        return {
          success: false,
          message: `Transaction with ID ${id} not found.`
        }
      }

      if (!(session.employeeId === existing.recorded_by || 
            session.role === 'admin' || 
            session.role === 'manager')) {
        return {
            success: false,
            message: 'You do not have permission to update this transaction. You must be the person who recorded it, an admin, or a manager.'
        }
    }

      // Validate amount if provided
      if (amount !== undefined && amount <= 0) {
        return {
          success: false,
          message: 'Amount must be greater than 0.'
        }
      }

      // Validate transaction type if provided
      if (transaction_type && !transactionTypeValues.includes(transaction_type)) {
        return {
          success: false,
          message: `Invalid transaction type. Must be one of: ${transactionTypeValues.join(', ')}`
        }
      }

      // Build update data
      const updateData: any = {
        is_sync_required: true
      }

      if (transaction_type !== undefined) {
        updateData.transaction_type = transaction_type
      }
      if (amount !== undefined) {
        updateData.amount = amount
      }
      if (description !== undefined) {
        updateData.description = description || null
      }

      // Update transaction
      db()
        .update(transactions)
        .set(updateData)
        .where(eq(transactions.id, id))
        .run()

      // Fetch updated transaction
      const updated = db()
        .select({
          id: transactions.id,
          transaction_type: transactions.transaction_type,
          amount: transactions.amount,
          description: transactions.description,
          recorded_by: transactions.recorded_by,
          created_on: sql<number>`CAST(strftime('%s', ${transactions.created_on}) AS INTEGER)`,
          is_deleted: transactions.is_deleted,
          is_sync_required: transactions.is_sync_required,
          last_synced_on: transactions.last_synced_on
        })
        .from(transactions)
        .where(eq(transactions.id, id))
        .get() as Transaction

      return {
        success: true,
        message: 'Transaction updated successfully.',
        data: updated
      }

    } catch (error) {
      console.error('Error updating transaction:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update transaction.'
      }
    }
  }
)

// ============================================================================
// SOFT DELETE / RESTORE TRANSACTION
// ============================================================================
ipcMain.handle(
  'transactions:soft-delete',
  async (_event, payload: SoftDeleteTransactionPayload): Promise<SoftDeleteTransactionResponse> => {
    try {
      const { id, restore = false } = payload

      if (!id) {
        return {
          success: false,
          message: 'Transaction ID is required.'
        }
      }

      // Check authentication
      const session = sessionManager.getCurrentSession()
      if (!session) {
        return {
          success: false,
          message: 'Not authenticated. Please log in.'
        }
      }

      // Check if transaction exists
      const transaction = db()
        .select({
          id: transactions.id,
          is_deleted: transactions.is_deleted
        })
        .from(transactions)
        .where(eq(transactions.id, id))
        .get()

      if (!transaction) {
        return {
          success: false,
          message: `Transaction with ID ${id} not found.`
        }
      }

      // Check if already in desired state
      if (restore && !transaction.is_deleted) {
        return {
          success: false,
          message: 'Transaction is already active.'
        }
      }
      if (!restore && transaction.is_deleted) {
        return {
          success: false,
          message: 'Transaction is already deleted.'
        }
      }

      // Update delete status
      db()
        .update(transactions)
        .set({
          is_deleted: restore ? false : true,
          is_sync_required: true
        })
        .where(eq(transactions.id, id))
        .run()

      // Fetch updated transaction if requested
      let updatedTransaction: Transaction | undefined

      if (restore) {
        updatedTransaction = db()
          .select({
            id: transactions.id,
            transaction_type: transactions.transaction_type,
            amount: transactions.amount,
            description: transactions.description,
            recorded_by: transactions.recorded_by,
            created_on: sql<number>`CAST(strftime('%s', ${transactions.created_on}) AS INTEGER)`,
            is_deleted: transactions.is_deleted,
            is_sync_required: transactions.is_sync_required,
            last_synced_on: transactions.last_synced_on
          })
          .from(transactions)
          .where(eq(transactions.id, id))
          .get() as Transaction
      }

      return {
        success: true,
        message: `Transaction ${restore ? 'restored' : 'deleted'} successfully.`,
        data: {
          id,
          action: restore ? 'restored' : 'deleted',
          transaction: updatedTransaction
        }
      }

    } catch (error) {
      console.error('Error in transaction soft delete/restore:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : `Failed to ${payload.restore ? 'restore' : 'delete'} transaction.`
      }
    }
  }
)