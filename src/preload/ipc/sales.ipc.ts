import { getDB } from '@db/sqlite3'
import { employees } from '@schema/sqlite3/accounts'
import { customers } from '@schema/sqlite3/customers'
import { products, sku, stock_purchases } from '@schema/sqlite3/products'
import { sales } from '@schema/sqlite3/sales'
import { transactions } from '@schema/sqlite3/transactions'
import { randomUUID } from 'crypto'
import { ipcMain } from 'electron'

import { sessionManager } from '../../main/session-manager'
import type { SalesByIdResponse } from '../ipc/type'

import { payments } from '@schema/sqlite3/sales'
import type {
  CancelPaymentPayload,
  CreatePaymentPayload,
  CreateSalePayload,
  DatePreset,
  // ExportSalesPayload,
  GetAllSalesPayload,
  GetPaymentByIdPayload,
  GetPaymentsBySaleIdPayload,
  GetSalesByIdPayload,
  PaymentResponse,
  PaymentsListResponse,
  SaleFieldChange,
  SalesSummary,
  TimeSeriesDataPoint,
  TrendsData,
  UpdatePaymentPayload,
  UpdateSalePayload, UpdateSaleResponse
} from './type'


import { and, asc, desc, eq, gte, inArray, lte, or, sql, SQL } from 'drizzle-orm'

const db = () => getDB()


ipcMain.handle('sales:create', async (_event, payload: CreateSalePayload) => {
  try {
    /* ============================
       VALIDATION
    ============================ */
    if (!payload.issued_by) {
      return { success: false, message: 'Issued by employee ID is required.' }
    }

    // if (!payload.customer_id) {
    //   return { success: false, message: 'Customer ID is required.' }
    // }

    if (!payload.stock_purchased_id) {
      return { success: false, message: 'Stock purchase ID is required.' }
    }

    if (!payload.quantity || payload.quantity <= 0) {
      return { success: false, message: 'Quantity must be greater than 0.' }
    }

    if (!payload.total_price || payload.total_price <= 0) {
      return { success: false, message: 'Total price must be greater than 0.' }
    }

    if (!payload.payment?.amount_paid || payload.payment.amount_paid <= 0) {
      return { success: false, message: 'Amount paid must be greater than 0.' }
    }

    if (payload.payment.amount_paid > payload.total_price) {
      return { success: false, message: 'Amount paid cannot exceed total price.' }
    }

    /* ============================
       CHECK IF STOCK PURCHASE EXISTS AND IS AVAILABLE
    ============================ */
    const stockPurchase = db()
      .select({
        id: stock_purchases.id,
        sku_id: stock_purchases.sku_id,
        quantity_bought: stock_purchases.quantity_bought,
        price_per_unit: stock_purchases.price_per_unit,
        total_price_bought: stock_purchases.total_price_bought,
        min_price: stock_purchases.min_selling_price,
        max_price: stock_purchases.max_selling_price,
        // avg_anticipated_profit_margin: stock_purchases.avg_anticipated_profit_margin,
        // Get SKU details for validation
        sku_name: sku.sku_name,
        product_id: sku.product_id,
        product_name: products.product_name
      })
      .from(stock_purchases)
      .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
      .innerJoin(products, eq(sku.product_id, products.id))
      .where(
        and(
          eq(stock_purchases.id, payload.stock_purchased_id),
          eq(stock_purchases.is_deleted, false)
        )
      )
      .get()

    if (!stockPurchase) {
      return { success: false, message: 'Stock purchase not found.' }
    }

    if (stockPurchase.quantity_bought < payload.quantity) {
      return { 
        success: false, 
        message: `Insufficient stock. Available: ${stockPurchase.quantity_bought}, Requested: ${payload.quantity}` 
      }
    }

    const maximumPrice = stockPurchase.max_price ? stockPurchase.max_price : stockPurchase.min_price
    const costPriceSnapShot = ((maximumPrice + stockPurchase.min_price) / 2) * payload.quantity

    /* ============================
       CHECK IF EMPLOYEE EXISTS
    ============================ */
    const employee = db()
      .select({ 
        id: employees.id,
        role: employees.role,
        is_active: employees.is_active 
      })
      .from(employees)
      .where(and(eq(employees.id, payload.issued_by), eq(employees.is_deleted, false)))
      .get()

    if (!employee) {
      return { success: false, message: 'Employee not found.' }
    }

    if (!employee.is_active) {
      return { success: false, message: 'Employee is not active.' }
    }

    /* ============================
       CHECK IF CUSTOMER EXISTS
    ============================ */
    if (payload.customer_id) {
      const customer = db()
        .select({ 
          id: customers.id,
          name: customers.name,
          is_active: customers.is_active 
        })
        .from(customers)
        .where(and(eq(customers.id, payload.customer_id), eq(customers.is_deleted, false)))
        .get()

      if (!customer) {
        return { success: false, message: 'Customer not found.' }
      }

      if (!customer.is_active) {
        return { success: false, message: 'Customer is not active.' }
      }
    }

    /* ============================
       PRICE OVERRIDE VALIDATION
    ============================ */

    const calcAvgProfitMargin = (p: any) => {
      const minPrice = p.min_price ?? 0;
        const maxPrice = p.max_price ?? p.price_per_unit * 1.2;
        const totalCost = p.total_price_bought ?? 0;

        const avgMargin =
          totalCost > 0 && minPrice > 0 && maxPrice > 0
            ? ((((minPrice + maxPrice) / 2) - totalCost) / totalCost) * 100
            : 0;
        
        return avgMargin
    }

    const pricePerUnit = payload.total_price / payload.quantity
    const costPerUnit = stockPurchase.total_price_bought / stockPurchase.quantity_bought
    const actualProfitMargin = ((pricePerUnit - costPerUnit) / pricePerUnit) * 100
    const anticipatedMargin = calcAvgProfitMargin(stockPurchase) || 0
    const marginDiff = actualProfitMargin - anticipatedMargin
    const marginDiffPercentage = (marginDiff / anticipatedMargin) * 100

    let requiresApproval = false
    let approvalStatus = 'not_required'

    // Check if price is outside min/max range
    const isOutsideRange = (stockPurchase.min_price && pricePerUnit < stockPurchase.min_price) ||
                          (stockPurchase.max_price && pricePerUnit > stockPurchase.max_price)

    // Check if margin is significantly lower (e.g., 20% below anticipated)
    const MARGIN_THRESHOLD = -20 // 20% below anticipated
    const isMarginTooLow = marginDiffPercentage < MARGIN_THRESHOLD

    const session = sessionManager.getCurrentSession()

    if (!session) {
      return { success: false, message: 'Not authenticated.' }
    }

    const isAllowedRole = session.role === 'admin' || session.role === 'super_admin' || session.role === 'manager'

    const overwrittenBy = session.employeeId

    if (overwrittenBy) payload.override_approved_by = Number(overwrittenBy)

    if (isOutsideRange || isMarginTooLow) {

      requiresApproval = true
      
      // Check if override is approved
      if (!payload.has_been_overwritten && !isAllowedRole) {
        return {
          success: false,
          requires_approval: true,
          message: 'This sale requires manager approval due to price override.',
          details: {
            price_per_unit: pricePerUnit,
            min_price: stockPurchase.min_price,
            max_price: stockPurchase.max_price,
            anticipated_margin: anticipatedMargin,
            actual_margin: actualProfitMargin,
            margin_difference: marginDiffPercentage,
            reason: isOutsideRange ? 'price_outside_range' : 'margin_too_low'
          }
        }
      }

      // If overwritten, verify approval
      if (!payload.override_approved_by) {
        // If the current user is allowed, they can self-approve
        if (isAllowedRole) {
          payload.override_approved_by = Number(session.employeeId)
        } else {
          return { 
            success: false, 
            message: 'Price override requires approval from a manager.' 
          }
        }
      }

      // Verify approver is a manager
      if (payload.override_approved_by) {
        const approver = db()
          .select({ role: employees.role })
          .from(employees)
          .where(eq(employees.id, payload.override_approved_by))
          .get()

        if (!approver || !['admin', 'manager'].includes(approver.role as string)) {
          return { 
            success: false, 
            message: 'Only managers or admins can approve price overrides.' 
          }
        }
      }

      approvalStatus = 'approved'
    }

    /* ============================
       DETERMINE IF DEBT SALE
    ============================ */
    const isDebtSale = payload.payment.amount_paid < payload.total_price
    const balanceDueDate = isDebtSale ? payload.balance_due : null

    const balanceDueValue = balanceDueDate 
        ? sql`${balanceDueDate}` 
        : null

    // if (isDebtSale && !payload.balance_due) {
    //   return { 
    //     success: false, 
    //     message: 'Due date is required for debt sales.' 
    //   }
    // }

    /* ============================
       GENERATE REFERENCE NUMBER
    ============================ */
    const paymentReference = payload.payment.reference_number || 
      `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    /* ============================
       PERFORM IN TRANSACTION
    ============================ */
    const result = db().transaction((tx) => {
      try {
        /* ============================
           INSERT SALE
        ============================ */

        const salesDataToInsert = {
          issued_by: payload.issued_by,
          stock_purchased_id: payload.stock_purchased_id,
          quantity: payload.quantity,
          total_price: payload.total_price,
          cost_price_snapshot: costPriceSnapShot,
          status: payload.status || (isDebtSale ? 'pending' : 'completed'),
          is_debt_sale: isDebtSale,
          profit_margin: ((payload.total_price - costPriceSnapShot) / payload.total_price) * 100 ,
          balance_due: balanceDueValue,
          has_been_overwritten: payload.has_been_overwritten || false,
          price_override_reason: payload.price_override_reason,
          override_approved_by: payload.override_approved_by,
        }

        if (payload.customer_id) {
          salesDataToInsert['customer_id'] = payload.customer_id
        }

        const saleResult = tx
          .insert(sales)
          .values(salesDataToInsert)
          .run()

        const saleId = Number(saleResult.lastInsertRowid)

        /* ============================
           INSERT PAYMENT
        ============================ */
        const paymentDate = payload.payment.payment_date 
            ? sql`${payload.payment.payment_date}` // Wrap in SQL
            : sql`(strftime('%s', 'now'))`

        const paymentResult = tx
          .insert(payments)
          .values({
            sale_id: saleId,
            amount_paid: payload.payment.amount_paid,
            payment_date: paymentDate,
            payment_method: payload.payment.payment_method,
            reference_number: paymentReference,
            description: payload.payment.description,
            recorded_by: payload.payment.recorded_by,
          })
          .run()

        const paymentId = Number(paymentResult.lastInsertRowid)

        /* ============================
           UPDATE STOCK QUANTITY
        ============================ */
        const newQuantity = stockPurchase.quantity_bought - payload.quantity

        tx
          .update(stock_purchases)
          .set({
            updated_on: sql`(strftime('%s', 'now'))`,
            is_sync_required: true
          })
          .where(eq(stock_purchases.id, payload.stock_purchased_id))
          .run()

        /* ============================
           CREATE TRANSACTION RECORD (Optional - for cash flow)
        ============================ */
        if (payload.payment.amount_paid > 0) {
          tx
            .insert(transactions)
            .values({
              transaction_type: 'cashin',
              amount: payload.payment.amount_paid,
              description: `Sale #${saleId} - ${stockPurchase.product_name}`,
              recorded_by: payload.payment.recorded_by,
              sync_id: randomUUID(),
              created_on: sql`(strftime('%s', 'now'))`
            })
            .run()
        }

        /* ============================
           RETURN SUCCESS WITH DETAILS
        ============================ */
        return {
          success: true,
          data: {
            sale_id: saleId,
            payment_id: paymentId,
            is_debt_sale: isDebtSale,
            balance_due: balanceDueDate,
            remaining_balance: isDebtSale ? payload.total_price - payload.payment.amount_paid : 0,
            requires_approval: requiresApproval,
            approval_status: approvalStatus,
            payment_reference: paymentReference,
            stock_remaining: newQuantity,
            profit_margin: actualProfitMargin,
            anticipated_margin: anticipatedMargin
          }
        }

      } catch (error) {
        console.error('Transaction error:', error)
        throw error
      }
    })

    return result

  } catch (error) {
    console.error('Error creating sale:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create sale.'
    }
  }
})



// Helper function to safely combine AND conditions
// function safeAnd(...conditions: (SQL | undefined)[]): SQL | undefined {
//   const valid = conditions.filter((c): c is SQL => c !== undefined)
//   return valid.length > 0 ? and(...valid) : undefined
// }

// // Helper function to safely combine OR conditions
// function safeOr(...conditions: (SQL | undefined)[]): SQL | undefined {
//   const valid = conditions.filter((c): c is SQL => c !== undefined)
//   return valid.length > 0 ? or(...valid) : undefined
// }

// Helper function to filter out null/undefined from arrays for inArray
// function filterValidIds(ids: (number | null | undefined)[]): number[] {
//   return ids.filter((id): id is number => id !== null && id !== undefined && id > 0)
// }


ipcMain.handle('sales:get-all', async (_event, payload?: GetAllSalesPayload) => {
  try {
    const {
      // Pagination
      page = 1,
      limit = 20,
      sort_by = 'sold_on',
      sort_order = 'desc',
      
      // Basic filters
      status,
      is_debt_sale,
      is_deleted = false,
      has_been_overwritten,
      override_approved,
      
      // Price and quantity ranges
      price_range,
      quantity_range,
      
      // Profit margin filters
      profit_margin: profit_margin_range,
      profit_margin_status,
      profit_margin_deviation,
      
      // Date filters
      date_range,
      sold_on,
      payment_date,
      due_date,
      
      // Entity filters
      customer_ids,
      employee_ids,
      product_ids,
      sku_ids,
      category_ids,
      
      // Payment filters
      payment_methods,
      has_full_payment,
      payment_reference,
      
      // Debt-specific
      debt_status,
      overdue_days,
      
      // Search
      search,
      
      // Nested data options
      include_customer = true,
      include_employee = true,
      include_stock_purchase = true,
      include_payments = true,
      include_product_details = true,
      include_sku_details = true,
      max_payments_per_sale = 5,
      
      // Summary and aggregation
      include_summary = true,
      group_by,
    } = payload || {}

    const offset = (page - 1) * limit
    const now = Math.floor(Date.now() / 1000)

    /* ============================
       HELPER: GET DATE RANGE FROM PRESET
    ============================ */
    const getDateRangeFromPreset = (preset: DatePreset): { from: number; to: number } => {
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
        case 'last_week':
          from.setDate(from.getDate() - from.getDay() - 7)
          from.setHours(0, 0, 0, 0)
          to.setDate(to.getDate() - to.getDay() - 1)
          to.setHours(23, 59, 59, 999)
          break
        case 'this_month':
          from.setDate(1)
          from.setHours(0, 0, 0, 0)
          to.setMonth(to.getMonth() + 1)
          to.setDate(0)
          to.setHours(23, 59, 59, 999)
          break
        case 'last_month':
          from.setMonth(from.getMonth() - 1)
          from.setDate(1)
          from.setHours(0, 0, 0, 0)
          to.setDate(0)
          to.setHours(23, 59, 59, 999)
          break
        case 'this_quarter':
          const quarter = Math.floor(from.getMonth() / 3)
          from.setMonth(quarter * 3, 1)
          from.setHours(0, 0, 0, 0)
          to.setMonth(quarter * 3 + 3, 0)
          to.setHours(23, 59, 59, 999)
          break
        case 'last_quarter':
          const lastQuarter = Math.floor(from.getMonth() / 3) - 1
          from.setMonth(lastQuarter * 3, 1)
          from.setHours(0, 0, 0, 0)
          to.setMonth(lastQuarter * 3 + 3, 0)
          to.setHours(23, 59, 59, 999)
          break
        case 'this_year':
          from.setMonth(0, 1)
          from.setHours(0, 0, 0, 0)
          to.setMonth(11, 31)
          to.setHours(23, 59, 59, 999)
          break
        case 'last_year':
          from.setFullYear(from.getFullYear() - 1, 0, 1)
          from.setHours(0, 0, 0, 0)
          to.setFullYear(to.getFullYear() - 1, 11, 31)
          to.setHours(23, 59, 59, 999)
          break
        default:
          return {
            from: Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000),
            to: Math.floor(Date.now() / 1000)
          }
      }

      return {
        from: Math.floor(from.getTime() / 1000),
        to: Math.floor(to.getTime() / 1000)
      }
    }

    /* ============================
       BUILD WHERE CONDITIONS
    ============================ */
    const conditions: SQL[] = [eq(sales.is_deleted, is_deleted)]

    // Status filter (multiple allowed)
    if (status && status.length > 0) {
      conditions.push(inArray(sales.status, status))
    }

    // Debt sale filter
    if (is_debt_sale !== undefined) {
      conditions.push(eq(sales.is_debt_sale, is_debt_sale))
    }

    // Override filters
    if (has_been_overwritten !== undefined) {
      conditions.push(eq(sales.has_been_overwritten, has_been_overwritten))
    }

    if (override_approved !== undefined) {
      if (override_approved) {
        conditions.push(sql`${sales.override_approved_by} IS NOT NULL`)
      } else {
        conditions.push(sql`${sales.override_approved_by} IS NULL`)
      }
    }

    // Price range
    if (price_range) {
      if (price_range.min !== undefined) {
        conditions.push(gte(sales.total_price, price_range.min))
      }
      if (price_range.max !== undefined) {
        conditions.push(lte(sales.total_price, price_range.max))
      }
    }

    // Quantity range
    if (quantity_range) {
      if (quantity_range.min !== undefined) {
        conditions.push(gte(sales.quantity, quantity_range.min))
      }
      if (quantity_range.max !== undefined) {
        conditions.push(lte(sales.quantity, quantity_range.max))
      }
    }

    // Profit margin range
    if (profit_margin_range) {
      if (profit_margin_range.min !== undefined) {
        conditions.push(gte(sales.profit_margin, profit_margin_range.min))
      }
      if (profit_margin_range.max !== undefined) {
        conditions.push(lte(sales.profit_margin, profit_margin_range.max))
      }
    }

    // Profit margin status (using cost_price_snapshot as expected)
    if (profit_margin_status) {
      // For each sale, compare actual profit margin with expected from snapshot
      const marginCondition = sql`CASE
        WHEN ${sales.cost_price_snapshot} > 0 THEN
          CASE
            WHEN ${profit_margin_status} = 'above_expected' AND 
                 ${sales.profit_margin} > ((${sales.total_price} - ${sales.cost_price_snapshot}) / ${sales.cost_price_snapshot} * 100) * 1.1
            THEN 1
            WHEN ${profit_margin_status} = 'within_expected' AND 
                 ${sales.profit_margin} BETWEEN ((${sales.total_price} - ${sales.cost_price_snapshot}) / ${sales.cost_price_snapshot} * 100) * 0.9
                 AND ((${sales.total_price} - ${sales.cost_price_snapshot}) / ${sales.cost_price_snapshot} * 100) * 1.1
            THEN 1
            WHEN ${profit_margin_status} = 'below_expected' AND 
                 ${sales.profit_margin} < ((${sales.total_price} - ${sales.cost_price_snapshot}) / ${sales.cost_price_snapshot} * 100) * 0.9
            THEN 1
            WHEN ${profit_margin_status} = 'critical' AND 
                 ${sales.profit_margin} < ((${sales.total_price} - ${sales.cost_price_snapshot}) / ${sales.cost_price_snapshot} * 100) * 0.5
            THEN 1
            ELSE 0
          END
        ELSE 0
      END = 1`
      conditions.push(marginCondition)
    }

    // Profit margin deviation from expected
    if (profit_margin_deviation !== undefined) {
      const deviationCondition = sql`ABS(
        ${sales.profit_margin} - 
        ((${sales.total_price} - ${sales.cost_price_snapshot}) / NULLIF(${sales.cost_price_snapshot}, 0) * 100)
      ) >= ${profit_margin_deviation}`
      conditions.push(deviationCondition)
    }

    // Date filters
    if (date_range) {
      if (date_range.preset) {
        const { from, to } = getDateRangeFromPreset(date_range.preset)
        conditions.push(sql`${sales.sold_on} >= ${from}`)
        conditions.push(sql`${sales.sold_on} <= ${to}`)
      } else {
        if (date_range.from) conditions.push(sql`${sales.sold_on} >= ${date_range.from}`)
        if (date_range.to) conditions.push(sql`${sales.sold_on} <= ${date_range.to}`)
      }
    }

    if (sold_on) {
      if (sold_on.from) conditions.push(sql`${sales.sold_on} >= ${sold_on.from}`)
      if (sold_on.to) conditions.push(sql`${sales.sold_on} <= ${sold_on.to}`)
    }

    if (due_date) {
      if (due_date.from) conditions.push(sql`${sales.balance_due} >= ${due_date.from}`)
      if (due_date.to) conditions.push(sql`${sales.balance_due} <= ${due_date.to}`)
    }

    if (payment_date) {
      const paymentSubquery = sql`EXISTS (
        SELECT 1 FROM ${payments} 
        WHERE ${payments.sale_id} = ${sales.id}
        AND ${payments.is_deleted} = 0
        ${payment_date.from ? sql`AND ${payments.payment_date} >= ${payment_date.from}` : sql``}
        ${payment_date.to ? sql`AND ${payments.payment_date} <= ${payment_date.to}` : sql``}
      )`
      conditions.push(paymentSubquery)
    }

    // Entity filters
    if (customer_ids && customer_ids.length > 0) {
      conditions.push(inArray(sales.customer_id, customer_ids))
    }

    if (employee_ids && employee_ids.length > 0) {
      conditions.push(inArray(sales.issued_by, employee_ids))
    }

    // Product/SKU/Category filters via stock_purchases
    if (product_ids && product_ids.length > 0) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${stock_purchases} sp
        INNER JOIN ${sku} ON sp.sku_id = ${sku.id}
        WHERE sp.id = ${sales.stock_purchased_id}
        AND ${sku.product_id} IN (${sql.join(product_ids, sql`, `)})
      )`)
    }

    if (sku_ids && sku_ids.length > 0) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${stock_purchases} sp
        WHERE sp.id = ${sales.stock_purchased_id}
        AND sp.sku_id IN (${sql.join(sku_ids, sql`, `)})
      )`)
    }

    if (category_ids && category_ids.length > 0) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${stock_purchases} sp
        INNER JOIN ${sku} ON sp.sku_id = ${sku.id}
        INNER JOIN ${products} p ON ${sku.product_id} = p.id
        WHERE sp.id = ${sales.stock_purchased_id}
        AND p.category_id IN (${sql.join(category_ids, sql`, `)})
      )`)
    }

    // Payment filters
    if (payment_methods && payment_methods.length > 0) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${payments} 
        WHERE ${payments.sale_id} = ${sales.id}
        AND ${payments.payment_method} IN (${sql.join(payment_methods.map(m => sql`${m}`), sql`, `)})
      )`)
    }

    if (has_full_payment !== undefined) {
      if (has_full_payment) {
        conditions.push(sql`NOT EXISTS (
          SELECT 1 FROM ${payments} 
          WHERE ${payments.sale_id} = ${sales.id}
          AND ${payments.is_deleted} = 0
          GROUP BY ${payments.sale_id}
          HAVING COALESCE(SUM(${payments.amount_paid}), 0) < ${sales.total_price}
        )`)
      } else {
        conditions.push(sql`EXISTS (
          SELECT 1 FROM ${payments} 
          WHERE ${payments.sale_id} = ${sales.id}
          AND ${payments.is_deleted} = 0
          GROUP BY ${payments.sale_id}
          HAVING COALESCE(SUM(${payments.amount_paid}), 0) < ${sales.total_price}
        )`)
      }
    }

    if (payment_reference) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${payments} p
        WHERE p.sale_id = ${sales.id}
        AND p.reference_number LIKE ${`%${payment_reference}%`}
      )`)
    }

    // Debt status
    if (debt_status && debt_status !== 'all') {
      if (debt_status === 'overdue') {
        conditions.push(
          eq(sales.is_debt_sale, true),
          sql`${sales.balance_due} < ${now}`,
          sql`EXISTS (
            SELECT 1 FROM ${payments} 
            WHERE ${payments.sale_id} = ${sales.id}
            AND ${payments.is_deleted} = 0
            GROUP BY ${payments.sale_id}
            HAVING COALESCE(SUM(${payments.amount_paid}), 0) < ${sales.total_price}
          )`
        )
      } else if (debt_status === 'upcoming') {
        const upcomingThreshold = now + (overdue_days || 7) * 24 * 60 * 60
        conditions.push(
          eq(sales.is_debt_sale, true),
          sql`${sales.balance_due} >= ${now}`,
          sql`${sales.balance_due} <= ${upcomingThreshold}`,
          sql`EXISTS (
            SELECT 1 FROM ${payments} 
            WHERE ${payments.sale_id} = ${sales.id}
            AND ${payments.is_deleted} = 0
            GROUP BY ${payments.sale_id}
            HAVING COALESCE(SUM(${payments.amount_paid}), 0) < ${sales.total_price}
          )`
        )
      } else if (debt_status === 'paid') {
        conditions.push(
          sql`NOT EXISTS (
            SELECT 1 FROM ${payments} 
            WHERE ${payments.sale_id} = ${sales.id}
            AND ${payments.is_deleted} = 0
            GROUP BY ${payments.sale_id}
            HAVING COALESCE(SUM(${payments.amount_paid}), 0) < ${sales.total_price}
          )`
        )
      }
    }

    // Overdue days filter
    if (overdue_days !== undefined) {
      conditions.push(
        eq(sales.is_debt_sale, true),
        sql`${sales.balance_due} < ${now}`,
        sql`${sales.balance_due} >= ${now - overdue_days * 24 * 60 * 60}`
      )
    }

    // Search
    if (search) {
      const searchCondition = or(
        sql`EXISTS (
          SELECT 1 FROM ${customers} c
          WHERE c.id = ${sales.customer_id}
          AND c.name LIKE ${`%${search}%`}
        )`,
        sql`EXISTS (
          SELECT 1 FROM ${payments} p
          WHERE p.sale_id = ${sales.id}
          AND p.reference_number LIKE ${`%${search}%`}
        )`
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    const whereConditions = conditions.length > 0 ? and(...conditions) : undefined

    /* ============================
       GET TOTAL COUNT
    ============================ */
    const countResult = db()
      .select({ count: sql<number>`COUNT(DISTINCT ${sales.id})` })
      .from(sales)
      .where(whereConditions)
      .get()

    const total = Number(countResult?.count ?? 0)

    if (total === 0) {
      return {
        success: true,
        data: {
          sales: [],
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
          summary: include_summary ? createEmptySalesSummary() : undefined
        }
      }
    }

    /* ============================
       BUILD ORDER BY
    ============================ */
    let orderByClause: SQL
    
    switch(sort_by) {
      case 'sold_on':
        orderByClause = sort_order === 'asc' ? asc(sales.sold_on) : desc(sales.sold_on)
        break
      case 'total_price':
        orderByClause = sort_order === 'asc' ? asc(sales.total_price) : desc(sales.total_price)
        break
      case 'profit_margin':
        orderByClause = sort_order === 'asc' ? asc(sales.profit_margin) : desc(sales.profit_margin)
        break
      case 'quantity':
        orderByClause = sort_order === 'asc' ? asc(sales.quantity) : desc(sales.quantity)
        break
      case 'customer_name':
        orderByClause = sort_order === 'asc' 
          ? sql`(SELECT name FROM ${customers} WHERE id = ${sales.customer_id}) ASC`
          : sql`(SELECT name FROM ${customers} WHERE id = ${sales.customer_id}) DESC`
        break
      default:
        orderByClause = desc(sales.sold_on)
    }

    /* ============================
       FETCH SALES
    ============================ */
    const salesList = db()
      .select({
        id: sales.id,
        issued_by: sales.issued_by,
        customer_id: sales.customer_id,
        stock_purchased_id: sales.stock_purchased_id,
        quantity: sales.quantity,
        total_price: sales.total_price,
        shipping_cost: sales.shipping_cost,
        cost_price_snapshot: sales.cost_price_snapshot,
        status: sales.status,
        is_debt_sale: sales.is_debt_sale,
        balance_due: sales.balance_due,
        sold_on: sales.sold_on,
        updated_on: sales.updated_on,
        has_been_canceled: sales.has_been_canceled,
        reason_for_cancellation: sales.reason_for_cancellation,
        has_been_overwritten: sales.has_been_overwritten,
        price_override_reason: sales.price_override_reason,
        override_approved_by: sales.override_approved_by,
        sync_id: sales.sync_id,
        is_deleted: sales.is_deleted,
        is_sync_required: sales.is_sync_required,
        profit_margin: sales.profit_margin,
        
        // Calculated payment totals
        total_paid: sql<number>`COALESCE((
          SELECT SUM(${payments.amount_paid})
          FROM ${payments}
          WHERE ${payments.sale_id} = ${sales.id}
          AND ${payments.is_deleted} = 0
        ), 0)`.as('total_paid'),
        
        payment_count: sql<number>`COALESCE((
          SELECT COUNT(*)
          FROM ${payments}
          WHERE ${payments.sale_id} = ${sales.id}
          AND ${payments.is_deleted} = 0
        ), 0)`.as('payment_count')
      })
      .from(sales)
      .where(whereConditions)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset)
      .all()

    const saleIds = salesList.map(s => s.id)

    /* ============================
       FETCH RELATED DATA
    ============================ */
    
    // Fetch customers
    let customerMap = new Map()
    if (include_customer) {
      const customerIds = salesList
        .map(s => s.customer_id)
        .filter((id): id is number => id !== null && id !== undefined)
      
      if (customerIds.length > 0) {
        const customers_data = db()
          .select({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
            email: customers.email,
            address: customers.address,
            is_active: customers.is_active
          })
          .from(customers)
          .where(inArray(customers.id, customerIds))
          .all()
        
        customerMap = new Map(customers_data.map(c => [c.id, c]))
      }
    }

    // Fetch employees
    let employeeMap = new Map()
    if (include_employee) {
      const employeeIds = salesList
        .map(s => s.issued_by)
        .filter((id): id is number => id !== null && id !== undefined)
      
      if (employeeIds.length > 0) {
        const employees_data = db()
          .select({
            id: employees.id,
            username: employees.username,
            first_name: employees.first_name,
            last_name: employees.last_name,
            role: employees.role,
            email: employees.email
          })
          .from(employees)
          .where(inArray(employees.id, employeeIds))
          .all()
        
        employeeMap = new Map(employees_data.map(e => [e.id, e]))
      }
    }

    // Fetch stock purchases with SKU and product details
    let stockPurchaseMap = new Map()
    if (include_stock_purchase) {
      const stockPurchaseIds = salesList
        .map(s => s.stock_purchased_id)
        .filter((id): id is number => id !== null && id !== undefined)
      
      if (stockPurchaseIds.length > 0) {
        // Base stock purchase query
        let spQuery = db()
          .select({
            id: stock_purchases.id,
            sku_id: stock_purchases.sku_id,
            quantity_bought: stock_purchases.quantity_bought,
            price_per_unit: stock_purchases.price_per_unit,
            total_price_bought: stock_purchases.total_price_bought,
            shipping_cost: stock_purchases.shipping_cost,
            min_selling_price: stock_purchases.min_selling_price,
            max_selling_price: stock_purchases.max_selling_price,
            batch_number: stock_purchases.batch_number,
            purchased_on: stock_purchases.purchased_on,
            expiry_date: stock_purchases.expiry_date
          })
          .from(stock_purchases)
          .where(inArray(stock_purchases.id, stockPurchaseIds))

        const stockPurchases_data = spQuery.all()
        
        // If we need SKU or product details, fetch them
        if (include_sku_details || include_product_details) {
          const skuIds = stockPurchases_data
            .map(sp => sp.sku_id)
            .filter((id): id is number => id !== null && id !== undefined)
          
          if (skuIds.length > 0) {
            if (include_product_details) {
              const skuWithProduct = db()
                .select({
                  id: sku.id,
                  sku_name: sku.sku_name,
                  code: sku.code,
                  product_id: sku.product_id,
                  product_name: products.product_name,
                  category_id: products.category_id
                })
                .from(sku)
                .innerJoin(products, eq(sku.product_id, products.id))
                .where(inArray(sku.id, skuIds))
                .all()
              
              const skuMap = new Map(skuWithProduct.map(s => [s.id, s]))
              
              // Enhance stock purchases with SKU details
              for (const sp of stockPurchases_data) {
                const skuInfo = skuMap.get(sp.sku_id)
                if (skuInfo) {
                  Object.assign(sp, skuInfo)
                }
              }
            } else {
              // Just get basic SKU info
              const skuBasic = db()
                .select({
                  id: sku.id,
                  sku_name: sku.sku_name,
                  code: sku.code,
                  product_id: sku.product_id
                })
                .from(sku)
                .where(inArray(sku.id, skuIds))
                .all()
              
              const skuMap = new Map(skuBasic.map(s => [s.id, s]))
              
              for (const sp of stockPurchases_data) {
                const skuInfo = skuMap.get(sp.sku_id)
                if (skuInfo) {
                  Object.assign(sp, skuInfo)
                }
              }
            }
          }
        }
        
        stockPurchaseMap = new Map(stockPurchases_data.map(sp => [sp.id, sp]))
      }
    }

    // Fetch payments
    let paymentsBySaleMap = new Map()
    if (include_payments && saleIds.length > 0) {
      const payments_data = db()
        .select({
          id: payments.id,
          sale_id: payments.sale_id,
          amount_paid: payments.amount_paid,
          payment_date: payments.payment_date,
          payment_method: payments.payment_method,
          reference_number: payments.reference_number,
          description: payments.description,
          recorded_by: payments.recorded_by,
          has_been_canceled: payments.has_been_canceled,
          reason_for_cancellation: payments.reason_for_cancellation,
          has_been_overwritten: payments.has_been_overwritten,
          price_override_reason: payments.price_override_reason,
          override_approved_by: payments.override_approved_by
        })
        .from(payments)
        .where(
          and(
            inArray(payments.sale_id, saleIds),
            eq(payments.is_deleted, false)
          )
        )
        .orderBy(desc(payments.payment_date))
        .all()

      // Group payments by sale_id
      paymentsBySaleMap = payments_data.reduce((map, payment) => {
        if (!map.has(payment.sale_id)) {
          map.set(payment.sale_id, [])
        }
        const payments_list = map.get(payment.sale_id)
        if (payments_list.length < max_payments_per_sale) {
          payments_list.push(payment)
        }
        return map
      }, new Map())
    }

    /* ============================
       BUILD FINAL SALES LIST
    ============================ */
    const finalSales = salesList.map(sale => {
      const customer = customerMap.get(sale.customer_id)
      const employee = employeeMap.get(sale.issued_by)
      const stockPurchase = stockPurchaseMap.get(sale.stock_purchased_id)
      const payments_list = paymentsBySaleMap.get(sale.id) || []
      
      const totalPaid = Number(sale.total_paid || 0)
      const remainingBalance = sale.total_price - totalPaid
      const isOverdue = sale.is_debt_sale && 
                       sale.balance_due && 
                       Number(sale.balance_due) < now && 
                       remainingBalance > 0
      const overdueDays = isOverdue ? 
        Math.floor((now - Number(sale.balance_due)) / (24 * 60 * 60)) : 
        null
      
      // Calculate expected profit from snapshot
      const expectedProfit = sale.cost_price_snapshot - 
                            (sale.quantity * (stockPurchase?.total_price_bought / stockPurchase?.quantity_bought || 0))
      const expectedMargin = sale.cost_price_snapshot > 0 ? 
        (expectedProfit / sale.cost_price_snapshot) * 100 : 0
      
      // Calculate variance from expected
      const actualMargin = sale.profit_margin !== null ? Number(sale.profit_margin) : 0
      const profitVariance = actualMargin - expectedMargin
      const profitVariancePercentage = expectedMargin !== 0 ? 
        (profitVariance / Math.abs(expectedMargin)) * 100 : 0

      const soldOnTimestamp = sale.sold_on instanceof Date 
        ? Math.floor(sale.sold_on.getTime() / 1000) 
        : Number(sale.sold_on)
      
      return {
        id: sale.id,
        sync_id: sale.sync_id,
        quantity: sale.quantity,
        total_price: sale.total_price,
        shipping_cost: sale.shipping_cost,
        cost_price_snapshot: sale.cost_price_snapshot,
        status: sale.status,
        is_debt_sale: sale.is_debt_sale === true,
        balance_due: sale.balance_due,
        sold_on: sale.sold_on,
        updated_on: sale.updated_on,
        has_been_canceled: sale.has_been_canceled === true,
        reason_for_cancellation: sale.reason_for_cancellation,
        has_been_overwritten: sale.has_been_overwritten === true,
        price_override_reason: sale.price_override_reason,
        override_approved_by: sale.override_approved_by,
        is_deleted: sale.is_deleted === true,
        is_sync_required: sale.is_sync_required === true,
        
        // Nested relations
        customer: customer ? {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          is_active: customer.is_active === 1
        } : null,
        
        employee: employee ? {
          id: employee.id,
          name: employee.first_name && employee.last_name 
            ? `${employee.first_name} ${employee.last_name}`.trim()
            : employee.username,
          username: employee.username,
          role: employee.role,
          email: employee.email
        } : null,
        
        stock_purchase: stockPurchase ? {
          id: stockPurchase.id,
          sku: include_sku_details ? {
            id: stockPurchase.sku_id,
            name: stockPurchase.sku_name,
            code: stockPurchase.code
          } : { id: stockPurchase.sku_id },
          product: include_product_details && stockPurchase.product_id ? {
            id: stockPurchase.product_id,
            name: stockPurchase.product_name,
            category_id: stockPurchase.category_id
          } : null,
          quantity_bought: stockPurchase.quantity_bought,
          price_per_unit: stockPurchase.price_per_unit,
          total_cost: stockPurchase.total_price_bought,
          shipping_cost: stockPurchase.shipping_cost,
          min_selling_price: stockPurchase.min_selling_price,
          max_selling_price: stockPurchase.max_selling_price,
          batch_number: stockPurchase.batch_number,
          purchased_on: stockPurchase.purchased_on,
          expiry_date: stockPurchase.expiry_date
        } : null,
        
        payments: payments_list.map(p => ({
          id: p.id,
          amount_paid: p.amount_paid,
          payment_date: p.payment_date,
          payment_method: p.payment_method,
          reference_number: p.reference_number,
          description: p.description,
          recorded_by: p.recorded_by,
          has_been_canceled: p.has_been_canceled === 1,
          reason_for_cancellation: p.reason_for_cancellation,
          has_been_overwritten: p.has_been_overwritten === 1,
          price_override_reason: p.price_override_reason,
          override_approved_by: p.override_approved_by
        })),
        
        // Core metrics
        profit_margin: Number(sale.profit_margin?.toFixed(2) || 0),
        
        // Payment metrics
        payment_metrics: {
          total_paid: Number(totalPaid.toFixed(2)),
          remaining_balance: Number(remainingBalance.toFixed(2)),
          payment_count: sale.payment_count,
          is_fully_paid: remainingBalance <= 0,
          isOverdue,
          overdue_days: overdueDays
        },
        
        // Performance metrics
        performance_metrics: {
          days_since_sale: Math.floor((now - soldOnTimestamp) / (24 * 60 * 60)),
          expected_profit: Number(expectedProfit.toFixed(2)),
          expected_margin: Number(expectedMargin.toFixed(2)),
          profit_variance: Number(profitVariance.toFixed(2)),
          profit_variance_percentage: Number(profitVariancePercentage.toFixed(1)),
          performance_vs_expected: profitVariancePercentage > 10 ? 'above' :
                                   profitVariancePercentage < -10 ? 'below' : 'within'
        },
        
        // Override info
        override_info: sale.has_been_overwritten ? {
          reason: sale.price_override_reason,
          approved_by: sale.override_approved_by
        } : null
      }
    })

    /* ============================
       GENERATE SUMMARY (IF REQUESTED)
    ============================ */
    let summary: SalesSummary | undefined = undefined
    
    if (include_summary) {
      // Base stats
      const stats = db()
        .select({
          total_revenue: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`,
          total_quantity: sql<number>`COALESCE(SUM(${sales.quantity}), 0)`,
          avg_margin: sql<number>`COALESCE(AVG(${sales.profit_margin}), 0)`,
          avg_sale_value: sql<number>`COALESCE(AVG(${sales.total_price}), 0)`,
          
          debt_sales: sql<number>`COALESCE(SUM(CASE WHEN ${sales.is_debt_sale} = 1 THEN 1 ELSE 0 END), 0)`,
          debt_amount: sql<number>`COALESCE(SUM(CASE WHEN ${sales.is_debt_sale} = 1 THEN ${sales.total_price} ELSE 0 END), 0)`,
          
          completed_count: sql<number>`COALESCE(SUM(CASE WHEN ${sales.status} = 'completed' THEN 1 ELSE 0 END), 0)`,
          pending_count: sql<number>`COALESCE(SUM(CASE WHEN ${sales.status} = 'pending' THEN 1 ELSE 0 END), 0)`,
          cancelled_count: sql<number>`COALESCE(SUM(CASE WHEN ${sales.status} = 'cancelled' THEN 1 ELSE 0 END), 0)`,
          refunded_count: sql<number>`COALESCE(SUM(CASE WHEN ${sales.status} = 'refunded' THEN 1 ELSE 0 END), 0)`
        })
        .from(sales)
        .where(whereConditions)
        .get()

      // Outstanding debt
      const outstandingDebt = db()
        .select({
          total: sql<number>`COALESCE(SUM(${sales.total_price} - COALESCE((
            SELECT SUM(${payments.amount_paid}) 
            FROM ${payments} 
            WHERE ${payments.sale_id} = ${sales.id} 
            AND ${payments.is_deleted} = 0
          ), 0)), 0)`
        })
        .from(sales)
        .where(and(
          eq(sales.is_debt_sale, true),
          eq(sales.is_deleted, false),
          sql`${sales.status} != 'cancelled'`
        ))
        .get()

      // Payment methods breakdown
      const paymentMethods_data = db()
        .select({
          method: payments.payment_method,
          total: sql<number>`COALESCE(SUM(${payments.amount_paid}), 0)`
        })
        .from(payments)
        .where(inArray(payments.sale_id, saleIds))
        .groupBy(payments.payment_method)
        .all()

      const salesByPaymentMethod = paymentMethods_data.reduce((acc, p) => {
        acc[p.method] = Number(p.total)
        return acc
      }, {} as Record<string, number>)

      // Top employees
      const topEmployees = db()
        .select({
          employee_id: sales.issued_by,
          employee_name: sql<string>`
            COALESCE(${employees.first_name} || ' ' || ${employees.last_name}, ${employees.username})
          `,
          count: sql<number>`COUNT(*)`,
          revenue: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`
        })
        .from(sales)
        .innerJoin(employees, eq(sales.issued_by, employees.id))
        .where(inArray(sales.id, saleIds))
        .groupBy(sales.issued_by)
        .orderBy(desc(sql`SUM(${sales.total_price})`))
        .limit(5)
        .all()

      // Top customers
      const topCustomers = db()
        .select({
          customer_id: sales.customer_id,
          customer_name: customers.name,
          count: sql<number>`COUNT(*)`,
          revenue: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`
        })
        .from(sales)
        .innerJoin(customers, eq(sales.customer_id, customers.id))
        .where(inArray(sales.id, saleIds))
        .groupBy(sales.customer_id)
        .orderBy(desc(sql`SUM(${sales.total_price})`))
        .limit(5)
        .all()

      // Top products
      const topProducts = db()
        .select({
          product_id: products.id,
          product_name: products.product_name,
          quantity: sql<number>`SUM(${sales.quantity})`,
          revenue: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`
        })
        .from(sales)
        .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
        .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
        .innerJoin(products, eq(sku.product_id, products.id))
        .where(inArray(sales.id, saleIds))
        .groupBy(products.id)
        .orderBy(desc(sql`SUM(${sales.total_price})`))
        .limit(5)
        .all()

      // Time series data if grouped
      let by_date: TimeSeriesDataPoint[] | undefined = undefined
      let trends: TrendsData | undefined = undefined

      if (group_by && whereConditions) {
        let groupByClause: SQL
        let periodExtractor: SQL
        
        switch(group_by) {
          case 'day':
            groupByClause = sql`date(${sales.sold_on}, 'unixepoch')`
            periodExtractor = sql`date(${sales.sold_on}, 'unixepoch')`
            break
          case 'week':
            groupByClause = sql`strftime('%Y-%W', ${sales.sold_on}, 'unixepoch')`
            periodExtractor = sql`strftime('%Y-%W', ${sales.sold_on}, 'unixepoch')`
            break
          case 'month':
            groupByClause = sql`strftime('%Y-%m', ${sales.sold_on}, 'unixepoch')`
            periodExtractor = sql`strftime('%Y-%m', ${sales.sold_on}, 'unixepoch')`
            break
          default:
            groupByClause = sql`date(${sales.sold_on}, 'unixepoch')`
            periodExtractor = sql`date(${sales.sold_on}, 'unixepoch')`
        }

        const timeSeriesData = db()
          .select({
            period: sql<string>`${periodExtractor}`,
            count: sql<number>`COUNT(*)`,
            revenue: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`,
            profit: sql<number>`COALESCE(SUM(${sales.profit_margin} * ${sales.total_price} / 100), 0)`,
            avg_margin: sql<number>`COALESCE(AVG(${sales.profit_margin}), 0)`
          })
          .from(sales)
          .where(whereConditions)
          .groupBy(groupByClause)
          .orderBy(asc(sql`period`))
          .all()

        by_date = timeSeriesData.map(d => ({
          period: d.period,
          count: Number(d.count),
          revenue: Number(d.revenue),
          profit: Number(d.profit),
          avg_margin: Number(d.avg_margin)
        }))

        if (timeSeriesData.length > 1) {
          const revenues = timeSeriesData.map(d => Number(d.revenue))
          const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length
          const bestDay = timeSeriesData.reduce((best, d) => 
            Number(d.revenue) > Number(best.revenue) ? d : best, timeSeriesData[0])
          
          // Calculate profit trend
          const profits = timeSeriesData.map(d => Number(d.profit))
          const profitTrend = profits[profits.length - 1] > profits[0] ? 'increasing' :
                             profits[profits.length - 1] < profits[0] ? 'decreasing' : 'stable'
          
          trends = {
            daily_average: avgRevenue,
            weekly_average: avgRevenue * 7,
            monthly_average: avgRevenue * 30,
            best_day: { 
              date: bestDay.period, 
              revenue: Number(bestDay.revenue), 
              sales: Number(bestDay.count) 
            },
            best_month: { month: '', revenue: 0, sales: 0 },
            profit_trend: profitTrend
          }
        }
      }

      summary = {
        total_sales: Number(stats?.completed_count || 0) + Number(stats?.pending_count || 0),
        total_revenue: Number(stats?.total_revenue || 0),
        total_profit: Number(stats?.total_revenue || 0) * (Number(stats?.avg_margin || 0) / 100),
        average_margin: Number(stats?.avg_margin || 0),
        total_quantity_sold: Number(stats?.total_quantity || 0),
        debt_sales_count: Number(stats?.debt_sales || 0),
        total_debt_amount: Number(stats?.debt_amount || 0),
        total_outstanding_debt: Number(outstandingDebt?.total || 0),
        average_sale_value: Number(stats?.avg_sale_value || 0),
        sales_by_status: {
          pending: Number(stats?.pending_count || 0),
          completed: Number(stats?.completed_count || 0),
          cancelled: Number(stats?.cancelled_count || 0),
          refunded: Number(stats?.refunded_count || 0)
        },
        sales_by_payment_method: salesByPaymentMethod,
        sales_by_employee: topEmployees.map(e => ({
          employee_id: Number(e.employee_id),
          employee_name: String(e.employee_name || 'Unknown'),
          count: Number(e.count),
          revenue: Number(e.revenue)
        })),
        sales_by_customer: topCustomers.map(c => ({
          customer_id: Number(c.customer_id),
          customer_name: String(c.customer_name || 'Unknown'),
          count: Number(c.count),
          revenue: Number(c.revenue)
        })),
        top_products: topProducts.map(p => ({
          product_id: Number(p.product_id),
          product_name: String(p.product_name || 'Unknown'),
          quantity: Number(p.quantity),
          revenue: Number(p.revenue)
        })),
        by_date,
        trends
      }
    }

    /* ============================
       PAGINATION METADATA
    ============================ */
    const totalPages = Math.ceil(total / limit)
    const from = offset + 1
    const to = Math.min(offset + limit, total)

    return {
      success: true,
      data: {
        sales: finalSales,
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
          returned: finalSales.length,
          from,
          to
        },
        summary
      }
    }

  } catch (error) {
    console.error('Error fetching sales:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch sales.'
    }
  }
})

function createEmptySalesSummary(): SalesSummary {
  return {
    total_sales: 0,
    total_revenue: 0,
    total_profit: 0,
    average_margin: 0,
    total_quantity_sold: 0,
    debt_sales_count: 0,
    total_debt_amount: 0,
    total_outstanding_debt: 0,
    average_sale_value: 0,
    sales_by_status: {
      pending: 0,
      completed: 0,
      cancelled: 0,
      refunded: 0
    },
    sales_by_payment_method: {},
    sales_by_employee: [],
    sales_by_customer: [],
    top_products: []
  }
}



ipcMain.handle('sales:get-by-id', async (_event, payload: GetSalesByIdPayload): Promise<SalesByIdResponse> => {
  try {
    const db = getDB()
    const {
      id,
      include_deleted = false,
      include_details = true,
      filters = {}
    } = payload

    // Get current session to access the logged-in employee
    const session = sessionManager.getCurrentSession()
    
    // If no session, user is not authenticated
    if (!session) {
      return {
        success: false,
        message: 'Not authenticated. Please log in.'
      }
    }

    // Build conditions array
    const conditions: SQL[] = []

    // If ID is provided, look for that specific sale
    if (id) {
      conditions.push(eq(sales.id, id))
    }

    // Apply additional filters
    if (filters.customer_id) {
      conditions.push(eq(sales.customer_id, filters.customer_id))
    }

    if (filters.stock_purchased_id) {
      conditions.push(eq(sales.stock_purchased_id, filters.stock_purchased_id))
    }

    // Handle issued_by - if not provided but we need current user, use session
    if (filters.issued_by) {
      conditions.push(eq(sales.issued_by, filters.issued_by))
    } else if (filters.use_current_user) {
      // If use_current_user flag is true, use the logged-in employee's ID
      conditions.push(eq(sales.issued_by, session.employeeId))
    }

    // Handle sku_id and product_id filters (need to join through stock_purchases)
    if (filters.sku_id) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${stock_purchases} sp
        WHERE sp.id = ${sales.stock_purchased_id}
        AND sp.sku_id = ${filters.sku_id}
      )`)
    }

    if (filters.product_id) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${stock_purchases} sp
        INNER JOIN ${sku} ON sp.sku_id = ${sku.id}
        WHERE sp.id = ${sales.stock_purchased_id}
        AND ${sku.product_id} = ${filters.product_id}
      )`)
    }

    // Handle payment_id filter
    if (filters.payment_id) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${payments} p
        WHERE p.sale_id = ${sales.id}
        AND p.id = ${filters.payment_id}
        AND p.is_deleted = 0
      )`)
    }

    // Handle deleted records
    if (!include_deleted) {
      conditions.push(eq(sales.is_deleted, false))
    }

    // If no conditions provided, return error
    if (conditions.length === 0) {
      return {
        success: false,
        message: 'No search criteria provided. Please specify an ID or filter.'
      }
    }

    // Build the final where clause
    const whereClause = and(...conditions)

    // Base query for sales with all schema fields
    const baseQuery = db
      .select({
        // Sale fields
        id: sales.id,
        issued_by: sales.issued_by,
        customer_id: sales.customer_id,
        stock_purchased_id: sales.stock_purchased_id,
        quantity: sales.quantity,
        total_price: sales.total_price,
        shipping_cost: sales.shipping_cost,
        cost_price_snapshot: sales.cost_price_snapshot,
        status: sales.status,
        is_debt_sale: sales.is_debt_sale,
        balance_due: sales.balance_due,
        sold_on: sales.sold_on,
        updated_on: sales.updated_on,
        has_been_canceled: sales.has_been_canceled,
        reason_for_cancellation: sales.reason_for_cancellation,
        has_been_overwritten: sales.has_been_overwritten,
        price_override_reason: sales.price_override_reason,
        override_approved_by: sales.override_approved_by,
        sync_id: sales.sync_id,
        is_deleted: sales.is_deleted,
        is_sync_required: sales.is_sync_required,
        profit_margin: sales.profit_margin,
        
        // Calculated payment fields
        total_paid: sql<number>`COALESCE((
          SELECT SUM(${payments.amount_paid})
          FROM ${payments}
          WHERE ${payments.sale_id} = ${sales.id}
          AND ${payments.is_deleted} = 0
        ), 0)`.as('total_paid'),
        
        payment_count: sql<number>`COALESCE((
          SELECT COUNT(*)
          FROM ${payments}
          WHERE ${payments.sale_id} = ${sales.id}
          AND ${payments.is_deleted} = 0
        ), 0)`.as('payment_count')
      })
      .from(sales)
      .where(whereClause)
      .orderBy(desc(sales.sold_on))

    // If looking for a specific ID, limit to 1
    const finalQuery = id ? baseQuery.limit(1) : baseQuery
    const salesList = await finalQuery.all()

    if (salesList.length === 0) {
      return {
        success: false,
        message: id 
          ? `Sale with ID ${id} not found.`
          : 'No sales found matching the criteria.'
      }
    }

    // If we don't need details, return basic sales info
    if (!include_details) {
      const basicSales = salesList.map(s => ({
        id: s.id,
        quantity: s.quantity,
        total_price: s.total_price,
        shipping_cost: s.shipping_cost,
        cost_price_snapshot: s.cost_price_snapshot,
        status: s.status || 'pending',
        is_debt_sale: s.is_debt_sale === true,
        balance_due: s.balance_due ? Number(s.balance_due) : null,
        sold_on: s.sold_on instanceof Date ? Math.floor(s.sold_on.getTime() / 1000) : Number(s.sold_on),
        profit_margin: s.profit_margin !== null ? Number(s.profit_margin) : null,
        has_been_canceled: s.has_been_canceled === true,
        has_been_overwritten: s.has_been_overwritten === true
      }))
      
      return {
        success: true,
        data: {
          sales: basicSales
        }
      } as SalesByIdResponse // Type assertion on the whole object, not nested
    }

    // Collect all IDs for related data
    const saleIds = salesList.map(s => s.id)
    const customerIds = salesList
      .map(s => s.customer_id)
      .filter((id): id is number => id !== null && id !== undefined)
    const employeeIds = salesList
      .map(s => s.issued_by)
      .filter((id): id is number => id !== null && id !== undefined)
    const stockPurchaseIds = salesList
      .map(s => s.stock_purchased_id)
      .filter((id): id is number => id !== null && id !== undefined)

    // Fetch related data in parallel
    const [customers_data, employees_data, stockPurchases_data, payments_data] = await Promise.all([
      // Fetch customers
      customerIds.length > 0
        ? db.select().from(customers).where(inArray(customers.id, customerIds)).all()
        : [],

      // Fetch employees
      employeeIds.length > 0
        ? db.select().from(employees).where(inArray(employees.id, employeeIds)).all()
        : [],

      // Fetch stock purchases with SKU and product details
      stockPurchaseIds.length > 0
        ? db
            .select({
              id: stock_purchases.id,
              sku_id: stock_purchases.sku_id,
              quantity_bought: stock_purchases.quantity_bought,
              price_per_unit: stock_purchases.price_per_unit,
              total_price_bought: stock_purchases.total_price_bought,
              shipping_cost: stock_purchases.shipping_cost,
              min_selling_price: stock_purchases.min_selling_price,
              max_selling_price: stock_purchases.max_selling_price,
              batch_number: stock_purchases.batch_number,
              purchased_on: stock_purchases.purchased_on,
              expiry_date: stock_purchases.expiry_date,
              // SKU details
              sku_name: sku.sku_name,
              sku_code: sku.code,
              // Product details
              product_id: sku.product_id,
              product_name: products.product_name,
              category_id: products.category_id
            })
            .from(stock_purchases)
            .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
            .leftJoin(products, eq(sku.product_id, products.id))
            .where(inArray(stock_purchases.id, stockPurchaseIds))
            .all()
        : [],

      // Fetch payments
      saleIds.length > 0
        ? db
            .select({
              id: payments.id,
              sale_id: payments.sale_id,
              amount_paid: payments.amount_paid,
              payment_date: payments.payment_date,
              payment_method: payments.payment_method,
              reference_number: payments.reference_number,
              description: payments.description,
              recorded_by: payments.recorded_by,
              has_been_canceled: payments.has_been_canceled,
              reason_for_cancellation: payments.reason_for_cancellation,
              has_been_overwritten: payments.has_been_overwritten,
              price_override_reason: payments.price_override_reason,
              override_approved_by: payments.override_approved_by
            })
            .from(payments)
            .where(and(
              inArray(payments.sale_id, saleIds),
              eq(payments.is_deleted, false)
            ))
            .orderBy(asc(payments.payment_date))
            .all()
        : []
    ])

    // Create lookup maps
    const customerMap = new Map(customers_data.map(c => [c.id, c]))
    const employeeMap = new Map(employees_data.map(e => [e.id, e]))
    const stockPurchaseMap = new Map(stockPurchases_data.map(sp => [sp.id, sp]))

    // Group payments by sale_id
    const paymentsMap = payments_data.reduce((map, payment) => {
      if (!map.has(payment.sale_id)) {
        map.set(payment.sale_id, [])
      }
      map.get(payment.sale_id)!.push(payment)
      return map
    }, new Map<number, typeof payments_data>())

    // Build final response with all details
    const now = Math.floor(Date.now() / 1000)

    const detailedSales = salesList.map(sale => {
      const customer = customerMap.get(sale.customer_id as number)
      const employee = employeeMap.get(sale.issued_by as number)
      const stockPurchase = stockPurchaseMap.get(sale.stock_purchased_id as number)
      const salePayments = paymentsMap.get(sale.id) || []
      
      // Convert dates to timestamps
      const soldOnTimestamp = sale.sold_on instanceof Date 
        ? Math.floor(sale.sold_on.getTime() / 1000) 
        : Number(sale.sold_on)
      
      const balanceDueTimestamp = sale.balance_due instanceof Date 
        ? Math.floor(sale.balance_due.getTime() / 1000) 
        : sale.balance_due ? Number(sale.balance_due) : null
      
      const totalPaid = Number(sale.total_paid || 0)
      const remainingBalance = sale.total_price - totalPaid
      const isOverdue = sale.is_debt_sale === true && 
                        balanceDueTimestamp && 
                        balanceDueTimestamp < now && 
                        remainingBalance > 0
      const overdueDays = isOverdue && balanceDueTimestamp ? 
        Math.floor((now - balanceDueTimestamp) / (24 * 60 * 60)) : 
        null
      
      // Calculate actual cost and profit
      const costPerUnit = stockPurchase ? 
        (Number(stockPurchase.total_price_bought) + (Number(stockPurchase.shipping_cost) || 0)) / 
        Number(stockPurchase.quantity_bought) : 0
      const costOfGoodsSold = costPerUnit * sale.quantity
      const actualProfit = sale.total_price - costOfGoodsSold - (sale.shipping_cost || 0)
      
      // Calculate expected profit from snapshot
      const expectedProfit = sale.cost_price_snapshot - costOfGoodsSold
      const expectedMargin = sale.cost_price_snapshot > 0 ? 
        (expectedProfit / sale.cost_price_snapshot) * 100 : 0
      
      // Handle null profit_margin
      const actualMargin = sale.profit_margin !== null ? Number(sale.profit_margin) : 0
      const profitVariance = actualMargin - expectedMargin
      const profitVariancePercentage = expectedMargin !== 0 ? 
        (profitVariance / Math.abs(expectedMargin)) * 100 : 0

      // Determine performance vs expected with proper literal types
      let performanceVsExpected: 'above' | 'below' | 'within'

      if (profitVariancePercentage > 10) {
        performanceVsExpected = 'above'
      } else if (profitVariancePercentage < -10) {
        performanceVsExpected = 'below'
      } else {
        performanceVsExpected = 'within'
      }

      // Process customer with proper null handling
      const customerData = customer ? {
        id: customer.id,
        name: customer.name,
        phone: customer.phone || undefined,
        email: customer.email || undefined,
        address: customer.address || undefined,
        is_active: customer.is_active === true
      } : sale.customer_id ? {
        id: sale.customer_id,
        name: 'Unknown',
        phone: undefined,
        email: undefined,
        address: undefined,
        is_active: false
      } : null

      // Process employee with proper null handling
      const employeeData = employee ? {
        id: employee.id,
        name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.username,
        username: employee.username,
        role: employee.role || 'viewer',
        email: employee.email || undefined
      } : sale.issued_by ? {
        id: sale.issued_by,
        name: 'Unknown',
        username: 'unknown',
        role: 'viewer',
        email: undefined
      } : null

      return {
        id: sale.id,
        sync_id: sale.sync_id,
        quantity: sale.quantity,
        total_price: sale.total_price,
        shipping_cost: sale.shipping_cost,
        cost_price_snapshot: sale.cost_price_snapshot,
        status: sale.status || 'pending',
        is_debt_sale: sale.is_debt_sale === true,
        balance_due: balanceDueTimestamp,
        sold_on: soldOnTimestamp,
        updated_on: sale.updated_on instanceof Date 
          ? Math.floor(sale.updated_on.getTime() / 1000) 
          : Number(sale.updated_on),
        has_been_canceled: sale.has_been_canceled === true,
        reason_for_cancellation: sale.reason_for_cancellation,
        has_been_overwritten: sale.has_been_overwritten === true,
        price_override_reason: sale.price_override_reason,
        override_approved_by: sale.override_approved_by,
        is_deleted: sale.is_deleted === true,
        is_sync_required: sale.is_sync_required === true,
        
        // Related data
        customer: customerData,
        employee: employeeData,
        
        product: stockPurchase ? {
          id: stockPurchase.product_id ?? 0,
          name: stockPurchase.product_name || 'Unknown',
          category_id: stockPurchase.category_id ?? 0,
          sku: {
            id: stockPurchase.sku_id ?? 0,
            name: stockPurchase.sku_name ?? '',
            code: stockPurchase.sku_code ?? ''
          },
          purchase: {
            id: stockPurchase.id,
            batch_number: stockPurchase.batch_number || undefined,
            price_per_unit: stockPurchase.price_per_unit,
            shipping_cost: stockPurchase.shipping_cost,
            total_cost: stockPurchase.total_price_bought,
            landed_cost_per_unit: costPerUnit,
            min_selling_price: stockPurchase.min_selling_price,
            max_selling_price: stockPurchase.max_selling_price,
            purchased_on: stockPurchase.purchased_on instanceof Date 
              ? Math.floor(stockPurchase.purchased_on.getTime() / 1000) 
              : Number(stockPurchase.purchased_on),
            expiry_date: stockPurchase.expiry_date || undefined
          }
        } : null,
        
        payments: salePayments.map(p => ({
          id: p.id,
          amount_paid: p.amount_paid,
          payment_date: p.payment_date instanceof Date 
            ? Math.floor(p.payment_date.getTime() / 1000) 
            : Number(p.payment_date),
          payment_method: p.payment_method || 'cash',
          reference_number: p.reference_number || '',
          description: p.description || '',
          recorded_by: p.recorded_by || 0,
          has_been_canceled: p.has_been_canceled === true,
          reason_for_cancellation: p.reason_for_cancellation,
          has_been_overwritten: p.has_been_overwritten === true,
          price_override_reason: p.price_override_reason  || '',
          override_approved_by: p.override_approved_by || 0
        })),
        
        // Core metrics
        profit_margin: actualMargin,
        
        // Payment metrics
        payment_metrics: {
          total_paid: Number(totalPaid.toFixed(2)),
          remaining_balance: Number(remainingBalance.toFixed(2)),
          payment_count: sale.payment_count,
          is_fully_paid: remainingBalance <= 0,
          is_overdue: isOverdue || false,
          overdue_days: overdueDays
        },
        
        // Performance metrics
        performance_metrics: {
          days_since_sale: Math.floor((now - soldOnTimestamp) / (24 * 60 * 60)),
          cost_of_goods_sold: Number(costOfGoodsSold.toFixed(2)),
          actual_profit: Number(actualProfit.toFixed(2)),
          roi: costOfGoodsSold > 0 ? Number(((actualProfit / costOfGoodsSold) * 100).toFixed(2)) : 0,
          expected_profit: Number(expectedProfit.toFixed(2)),
          expected_margin: Number(expectedMargin.toFixed(2)),
          profit_variance: Number(profitVariance.toFixed(2)),
          profit_variance_percentage: Number(profitVariancePercentage.toFixed(1)),
          performance_vs_expected: performanceVsExpected
        },
        
        // Override info
        override_info: sale.has_been_overwritten ? {
          reason: sale.price_override_reason,
          approved_by: sale.override_approved_by
        } : null
      }
    })

    return {
      success: true,
      data: {
        sales: detailedSales
      }
    }

  } catch (error) {
    console.error('Error fetching sales by ID:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch sales.'
    }
  }
})

// Convenience handler for getting sales by the current logged-in user
ipcMain.handle('sales:get-my-sales', async (_event, payload?: { include_deleted?: boolean; include_details?: boolean }) => {
  try {
    const session = sessionManager.getCurrentSession()
    
    if (!session) {
      return {
        success: false,
        message: 'Not authenticated. Please log in.'
      }
    }
    let filters: null | any = null
    if (session.role == 'admin' || session.role == 'manager') {
      filters = null
    } else {
      filters = {
        issued_by: session.employeeId
      }
    }

    // Call the main handler with the current user's ID
    return await ipcMain.emit('sales:get-by-id', _event, {
      ...payload,
      filters: filters
    })
  } catch (error) {
    console.error('Error fetching my sales:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch your sales.'
    }
  }
})



// Helper to check if user has permission to update a sale
function canUpdateSale(userRole: string, saleIssuedBy: number, currentUserId: number): boolean {
  // Admins and managers can update any sale
  if (userRole === 'admin' || userRole === 'manager') {
    return true
  }
  
  // Regular users can only update their own sales
  return saleIssuedBy === currentUserId
}

// Helper to track field changes
function trackFieldChanges(oldData: any, newData: any, fields: string[]): SaleFieldChange[] {
  const changes: SaleFieldChange[] = []
  
  for (const field of fields) {
    if (field in newData && oldData[field] !== newData[field]) {
      changes.push({
        field_name: field,
        field_label: getFieldLabel(field),
        old_value: oldData[field],
        new_value: newData[field]
      })
    }
  }
  
  return changes
}

// Helper to get human-readable field labels
function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    quantity: 'Quantity',
    total_price: 'Total Price',
    status: 'Status',
    is_debt_sale: 'Debt Sale',
    balance_due: 'Balance Due Date',
    customer_id: 'Customer',
    stock_purchased_id: 'Stock Purchase'
  }
  return labels[field] || field
}

ipcMain.handle('sales:update', async (_event, payload: UpdateSalePayload): Promise<UpdateSaleResponse> => {
  try {
    const db = getDB()
    const { id, action, reason, updates, overwrite_reason, payments: paymentUpdates } = payload

    // Get current session
    const session = sessionManager.getCurrentSession()
    if (!session) {
      return {
        success: false,
        message: 'Not authenticated. Please log in.'
      }
    }

    // Fetch the existing sale with all details
    const existingSale = db
      .select({
        id: sales.id,
        quantity: sales.quantity,
        total_price: sales.total_price,
        status: sales.status,
        is_debt_sale: sales.is_debt_sale,
        balance_due: sales.balance_due,
        cost_price_snapshot: sales.cost_price_snapshot,
        sold_on: sales.sold_on,
        profit_margin: sales.profit_margin,
        has_been_canceled: sales.has_been_canceled,
        reason_for_cancellation: sales.reason_for_cancellation,
        has_been_overwritten: sales.has_been_overwritten,
        price_override_reason: sales.price_override_reason,
        customer_id: sales.customer_id,
        issued_by: sales.issued_by,
        stock_purchased_id: sales.stock_purchased_id,
        is_deleted: sales.is_deleted
      })
      .from(sales)
      .where(and(
        eq(sales.id, id),
        eq(sales.is_deleted, false)
      ))
      .get()

    if (!existingSale) {
      return {
        success: false,
        message: `Sale with ID ${id} not found.`
      }
    }

    // Check if sale is already cancelled
    if (existingSale.has_been_canceled && action !== 'overwrite') {
      return {
        success: false,
        message: 'Cannot update a cancelled sale.'
      }
    }

    // Check permissions
    const userRole = session.role
    const hasPermission = canUpdateSale(userRole, existingSale.issued_by as number, session.employeeId)
    
    if (!hasPermission) {
      return {
        success: false,
        message: 'You do not have permission to update this sale.'
      }
    }

    // Handle different actions
    if (action === 'cancel') {
      return await handleSaleCancellation(db, existingSale, reason)
    } else if (action === 'overwrite') {
      return await handleSaleOverwrite(db, existingSale, updates, overwrite_reason, paymentUpdates)
    } else {
      return {
        success: false,
        message: `Invalid action: ${action}`
      }
    }

  } catch (error) {
    console.error('Error updating sale:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update sale.'
    }
  }
})

// Handle sale cancellation
async function handleSaleCancellation(
  db: any,
  existingSale: any,
  reason: string | undefined,
  // session: any
): Promise<UpdateSaleResponse> {
  if (!reason) {
    return {
      success: false,
      message: 'Cancellation reason is required.'
    }
  }

  // Perform the cancellation in a transaction
  const result = db.transaction(() => {
    // Update the sale
    db.update(sales)
      .set({
        has_been_canceled: true,
        reason_for_cancellation: reason,
        status: 'cancelled',
        updated_on: sql`(strftime('%s', 'now'))`,
        is_sync_required: true
      })
      .where(eq(sales.id, existingSale.id))
      .run()

    // Optionally, revert stock quantity if needed
    if (existingSale.stock_purchased_id) {
      db.update(stock_purchases)
        .set({
          updated_on: sql`(strftime('%s', 'now'))`,
          is_sync_required: true
        })
        .where(eq(stock_purchases.id, existingSale.stock_purchased_id))
        .run()
    }

    // // Log the activity
    // logEmployeeActivity({
    //   activity: 'cancelled sale',
    //   employee_id: session.employeeId,
    //   linked_activity_id: existingSale.id,
    //   linked_activity_table: 'sales',
    //   details: JSON.stringify({ reason })
    // })

    return {
      id: existingSale.id,
      action: 'cancel' as const,
      changes: [{
        field_name: 'status',
        field_label: 'Status',
        old_value: existingSale.status,
        new_value: 'cancelled'
      }, {
        field_name: 'reason_for_cancellation',
        field_label: 'Cancellation Reason',
        old_value: existingSale.reason_for_cancellation,
        new_value: reason
      }]
    }
  })

  // Fetch the updated sale
  const updatedSale = db
    .select()
    .from(sales)
    .where(eq(sales.id, existingSale.id))
    .get()

  return {
    success: true,
    message: 'Sale cancelled successfully.',
    data: {
      ...result,
      sale: updatedSale
    }
  }
}

// Handle sale overwrite (update)
async function handleSaleOverwrite(
  db: any,
  existingSale: any,
  updates: any,
  overwrite_reason: string | undefined,
  // session: any,
  paymentUpdates?: any[]
): Promise<UpdateSaleResponse> {
  
  if (!overwrite_reason) {
    return {
      success: false,
      message: 'Overwrite reason is required.'
    }
  }

  if (!updates || Object.keys(updates).length === 0) {
    return {
      success: false,
      message: 'No updates provided.'
    }
  }

  const averageCostSnapShot = existingSale.cost_price_snapshot / existingSale.quantity

  // Fields that can be updated
  const updatableFields = [
    'quantity', 'total_price', 'status', 'is_debt_sale', 
    'balance_due', 'customer_id', 'stock_purchased_id'
  ]

  // Track changes
  const changes = trackFieldChanges(existingSale, updates, updatableFields)

  if (changes.length === 0) {
    return {
      success: false,
      message: 'No changes detected.'
    }
  }

  // Prepare update data
  const updateData: any = {
    updated_on: sql`(strftime('%s', 'now'))`,
    is_sync_required: true,
    has_been_overwritten: true,
    price_override_reason: overwrite_reason
  }

  // Add the updates
  for (const [key, value] of Object.entries(updates)) {
    if (updatableFields.includes(key)) {
      updateData[key] = value
    }
  }

  if(existingSale.stock_purchased_id == Number(updateData['stock_purchased_id'])) {
    if (Object.prototype.hasOwnProperty.call(updateData, 'quantity')) {
      updateData['cost_price_snapshot'] = averageCostSnapShot * updateData['quantity']
    }
  } else {
    const stock = await db.query.stock_purchases.findFirst({
      where: eq(stock_purchases.id, Number(updateData['stock_purchased_id'])),
    })


    const quantity =
      Object.prototype.hasOwnProperty.call(updateData, 'quantity')
        ? updateData.quantity
        : existingSale.quantity

    const average =
      (stock.max_selling_price + stock.min_selling_price) / 2

    const costPriceSnapshot = average * quantity

    updateData.cost_price_snapshot = costPriceSnapshot
  }

  
  // Perform the update in a transaction
  const result = db.transaction(() => {
    // Update the sale
    db.update(sales)
      .set(updateData)
      .where(eq(sales.id, existingSale.id))
      .run()

    // Handle payment updates if provided
    if (paymentUpdates && paymentUpdates.length > 0) {
      for (const payment of paymentUpdates) {
        if (payment.id) {
          // Update existing payment
          const paymentUpdate: any = {
            updated_on: sql`(strftime('%s', 'now'))`,
            is_sync_required: true
          }
          if (payment.amount_paid !== undefined) paymentUpdate.amount_paid = payment.amount_paid
          if (payment.payment_method !== undefined) paymentUpdate.payment_method = payment.payment_method
          if (payment.reference_number !== undefined) paymentUpdate.reference_number = payment.reference_number
          if (payment.description !== undefined) paymentUpdate.description = payment.description
          if (payment.is_deleted !== undefined) paymentUpdate.is_deleted = payment.is_deleted

          db.update(payments)
            .set(paymentUpdate)
            .where(eq(payments.id, payment.id))
            .run()
        }
      }
    }

    // // Log the activity
    // logEmployeeActivity({
    //   activity: 'updated sale',
    //   employee_id: session.employeeId,
    //   linked_activity_id: existingSale.id,
    //   linked_activity_table: 'sales',
    //   details: JSON.stringify({
    //     reason: overwrite_reason,
    //     changes
    //   })
    // })

    return {
      id: existingSale.id,
      action: 'overwrite' as const,
      changes,
      overwrite_data: {
        reason: overwrite_reason,
        old_data: existingSale,
        new_data: { ...existingSale, ...updates },
        changes
      }
    }
  })

  // Fetch the updated sale with all details
  const updatedSale = await fetchCompleteSale(db, existingSale.id)

  return {
    success: true,
    message: 'Sale updated successfully.',
    data: {
      ...result,
      sale: updatedSale
    }
  }
}

// Helper to fetch a complete sale with all related data
async function fetchCompleteSale(db: any, saleId: number) {
  const sale = db
    .select({
      id: sales.id,
      quantity: sales.quantity,
      total_price: sales.total_price,
      status: sales.status,
      is_debt_sale: sales.is_debt_sale,
      balance_due: sales.balance_due,
      sold_on: sales.sold_on,
      profit_margin: sales.profit_margin,
      has_been_canceled: sales.has_been_canceled,
      reason_for_cancellation: sales.reason_for_cancellation,
      has_been_overwritten: sales.has_been_overwritten,
      price_override_reason: sales.price_override_reason,
      customer_id: sales.customer_id,
      issued_by: sales.issued_by,
      stock_purchased_id: sales.stock_purchased_id
    })
    .from(sales)
    .where(eq(sales.id, saleId))
    .get()

  if (!sale) return null

  // Fetch related data
  const [customer, employee, stockPurchase, salePayments] = await Promise.all([
    sale.customer_id ? db.select().from(customers).where(eq(customers.id, sale.customer_id)).get() : null,
    sale.issued_by ? db.select().from(employees).where(eq(employees.id, sale.issued_by)).get() : null,
    sale.stock_purchased_id ? db
      .select({
        id: stock_purchases.id,
        sku_id: stock_purchases.sku_id,
        quantity_bought: stock_purchases.quantity_bought,
        price_per_unit: stock_purchases.price_per_unit,
        total_price_bought: stock_purchases.total_price_bought,
        sku_name: sku.sku_name,
        sku_code: sku.code,
        product_name: products.product_name
      })
      .from(stock_purchases)
      .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
      .leftJoin(products, eq(sku.product_id, products.id))
      .where(eq(stock_purchases.id, sale.stock_purchased_id))
      .get() : null,
    db.select().from(payments).where(and(
      eq(payments.sale_id, saleId),
      eq(payments.is_deleted, false)
    )).all()
  ])

  return {
    ...sale,
    customer,
    employee,
    stockPurchase,
    payments: salePayments
  }
}

// Soft delete handler
ipcMain.handle('sales:soft-delete', async (_event, payload: { id: number; restore?: boolean }) => {
  try {
    const db = getDB()
    const { id, restore = false } = payload
    const action = restore ? 'restore' : 'delete'
    const actionPastTense = restore ? 'restored' : 'deleted'

    const session = sessionManager.getCurrentSession()
    if (!session) {
      return {
        success: false,
        message: 'Not authenticated. Please log in.'
      }
    }

    // Check if sale exists
    const sale = db
      .select({
        id: sales.id,
        is_deleted: sales.is_deleted,
        issued_by: sales.issued_by,
        status: sales.status
      })
      .from(sales)
      .where(eq(sales.id, id))
      .get()

    if (!sale) {
      return {
        success: false,
        message: `Sale with ID ${id} not found.`
      }
    }

    // Check permissions (admins/managers can soft delete any sale)
    const userRole = session.role
    const hasPermission = userRole === 'admin' || userRole === 'manager' || sale.issued_by === session.employeeId

    if (!hasPermission) {
      return {
        success: false,
        message: 'You do not have permission to delete this sale.'
      }
    }

    // Check if already in desired state
    if (restore && !sale.is_deleted) {
      return {
        success: false,
        message: 'Sale is already active.'
      }
    }
    if (!restore && sale.is_deleted) {
      return {
        success: false,
        message: 'Sale is already deleted.'
      }
    }

    // Perform soft delete/restore
    db.update(sales)
      .set({
        is_deleted: restore ? false : true,
        updated_on: sql`(strftime('%s', 'now'))`,
        is_sync_required: true
      })
      .where(eq(sales.id, id))
      .run()

    // // Log activity
    // logEmployeeActivity({
    //   activity: `${actionPastTense} sale`,
    //   employee_id: session.employeeId,
    //   linked_activity_id: id,
    //   linked_activity_table: 'sales'
    // })

    return {
      success: true,
      message: `Sale ${actionPastTense} successfully.`,
      data: {
        id,
        action,
        restored: restore
      }
    }

  } catch (error) {
    console.error('Error in sale soft delete:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : `Failed to ${payload.restore ? 'restore' : 'delete'} sale.`
    }
  }
})



// Helper function to filter valid IDs
function filterValidIds(ids: (number | null | undefined)[]): number[] {
  return ids.filter((id): id is number => id !== null && id !== undefined && id > 0)
}

// Helper function to safely convert Date to timestamp
function toTimestamp(value: Date | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return Math.floor(value.getTime() / 1000)
  return Number(value)
}

// Helper function to safely get employee name
function getEmployeeName(employee: any): string {
  if (!employee) return 'Unknown'
  const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
  return fullName || employee.username || 'Unknown'
}

// ============================================================================
// CREATE PAYMENT
// ============================================================================
ipcMain.handle('payments:create', async (_event, payload: CreatePaymentPayload): Promise<PaymentResponse> => {
  try {
    const db = getDB()
    const { sale_id, amount_paid, payment_date, payment_method, reference_number, description } = payload

    // Get current session
    const session = sessionManager.getCurrentSession()
    if (!session) {
      return {
        success: false,
        message: 'Not authenticated. Please log in.'
      }
    }

    // Validate required fields
    if (!sale_id) {
      return { success: false, message: 'Sale ID is required' }
    }
    if (!amount_paid || amount_paid <= 0) {
      return { success: false, message: 'Amount paid must be greater than 0' }
    }
    if (!payment_method) {
      return { success: false, message: 'Payment method is required' }
    }

    // Check if sale exists and is not cancelled/deleted
    const sale = db
      .select({
        id: sales.id,
        total_price: sales.total_price,
        status: sales.status,
        is_debt_sale: sales.is_debt_sale,
        is_deleted: sales.is_deleted,
        has_been_canceled: sales.has_been_canceled
      })
      .from(sales)
      .where(eq(sales.id, sale_id))
      .get()

    if (!sale) {
      return { success: false, message: 'Sale not found' }
    }
    if (sale.is_deleted) {
      return { success: false, message: 'Cannot add payment to deleted sale' }
    }
    if (sale.has_been_canceled) {
      return { success: false, message: 'Cannot add payment to cancelled sale' }
    }

    // Calculate total payments already made
    const existingPayments = db
      .select({ total: sql<number>`COALESCE(SUM(${payments.amount_paid}), 0)` })
      .from(payments)
      .where(and(
        eq(payments.sale_id, sale_id),
        eq(payments.is_deleted, false),
        eq(payments.has_been_canceled, false)
      ))
      .get()

    const totalPaidSoFar = Number(existingPayments?.total || 0)
    const newTotalPaid = totalPaidSoFar + amount_paid

    if (newTotalPaid > sale.total_price) {
      return {
        success: false,
        message: `Total payment (${newTotalPaid}) exceeds sale total (${sale.total_price})`
      }
    }

    // Generate reference number if not provided
    const finalReference = reference_number || `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Create payment in transaction
    // let paymentId: number = 0
    
    // db.transaction(() => {
    //   // Insert payment
    //   const insertResult = db
    //     .insert(payments)
    //     .values({
    //       sale_id,
    //       amount_paid,
    //       payment_date: payment_date ? sql`${payment_date}` : sql`(strftime('%s', 'now'))`,
    //       payment_method,
    //       reference_number: finalReference,
    //       description: description || '',
    //       recorded_by: session.employeeId,
    //       sync_id: randomUUID(),
    //       created_on: sql`(strftime('%s', 'now'))`
    //     })
    //     .run()

    //   paymentId = Number(insertResult.lastInsertRowid)

    //   // Update sale status if fully paid
    //   if (Math.abs(newTotalPaid - sale.total_price) < 0.01) { // Handle floating point
    //     db.update(sales)
    //       .set({
    //         status: 'completed',
    //         updated_on: sql`(strftime('%s', 'now'))`,
    //         is_sync_required: true
    //       })
    //       .where(eq(sales.id, sale_id))
    //       .run()
    //   }

    // //   // Log activity
    // //   logEmployeeActivity({
    // //     activity: 'created payment',
    // //     employee_id: session.employeeId,
    // //     linked_activity_id: paymentId,
    // //     linked_activity_table: 'payments',
    // //     details: JSON.stringify({ sale_id, amount_paid, method: payment_method })
    // //   })
    // })

        const paymentId = db.transaction(() => {
    // Insert payment
    const insertResult = db
        .insert(payments)
        .values({
        sale_id,
        amount_paid,
        payment_date: payment_date ? sql`${payment_date}` : sql`(strftime('%s', 'now'))`,
        payment_method,
        reference_number: finalReference,
        description: description || '',
        recorded_by: session.employeeId,
        sync_id: randomUUID(),
        created_on: sql`(strftime('%s', 'now'))`
        })
        .run()

    const newPaymentId = Number(insertResult.lastInsertRowid)

    // Update sale status if fully paid
    if (Math.abs(newTotalPaid - sale.total_price) < 0.01) {
        db.update(sales)
        .set({
            status: 'completed',
            updated_on: sql`(strftime('%s', 'now'))`,
            is_sync_required: true
        })
        .where(eq(sales.id, sale_id))
        .run()
    }

    // Log activity
    //   logEmployeeActivity({
    //     activity: 'created payment',
    //     employee_id: session.employeeId,
    //     linked_activity_id: newPaymentId,
    //     linked_activity_table: 'payments',
    //     details: JSON.stringify({ sale_id, amount_paid, method: payment_method })
    //   })

    return newPaymentId
    })

    // Fetch and return the created payment
    const payment = await fetchPaymentById(paymentId, true)
    
    if (!payment) {
      return {
        success: false,
        message: 'Payment created but could not be retrieved'
      }
    }

    return {
      success: true,
      message: 'Payment created successfully',
      data: payment
    }

  } catch (error) {
    console.error('Error creating payment:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create payment'
    }
  }
})

// ============================================================================
// GET PAYMENT BY ID
// ============================================================================
ipcMain.handle('payments:get-by-id', async (_event, payload: GetPaymentByIdPayload): Promise<PaymentResponse> => {
  try {
    const { id, include_deleted = false, include_sale_details = true } = payload

    if (!id) {
      return { success: false, message: 'Payment ID is required' }
    }

    const payment = await fetchPaymentById(id, include_sale_details, include_deleted)
    
    if (!payment) {
      return {
        success: false,
        message: `Payment with ID ${id} not found`
      }
    }

    return {
      success: true,
      data: payment
    }

  } catch (error) {
    console.error('Error fetching payment:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch payment'
    }
  }
})

// ============================================================================
// GET PAYMENTS BY SALE ID
// ============================================================================
ipcMain.handle('payments:get-by-sale-id', async (_event, payload: GetPaymentsBySaleIdPayload): Promise<PaymentsListResponse> => {
  try {
    const db = getDB()
    const { 
      sale_id, 
      include_deleted = false, 
      include_cancelled = false,
      page = 1,
      limit = 20,
      sort_by = 'payment_date',
      sort_order = 'desc'
    } = payload

    if (!sale_id) {
      return { success: false, message: 'Sale ID is required' }
    }

    const offset = (page - 1) * limit

    // Build conditions
    const conditions: SQL[] = [eq(payments.sale_id, sale_id)]
    
    if (!include_deleted) {
      conditions.push(eq(payments.is_deleted, false))
    }
    
    if (!include_cancelled) {
      conditions.push(eq(payments.has_been_canceled, false))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const countResult = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(payments)
      .where(whereClause)
      .get()

    const total = Number(countResult?.count || 0)

    if (total === 0) {
      return {
        success: true,
        data: {
          payments: [],
          pagination: {
            page,
            limit,
            total: 0,
            total_pages: 0,
            has_next: false,
            has_prev: false
          }
        }
      }
    }

    // Build order by
    const orderByClause = sort_order === 'asc' 
      ? asc(payments[sort_by]) 
      : desc(payments[sort_by])

    // Fetch payments
    const paymentList = db
      .select({
        id: payments.id,
        sale_id: payments.sale_id,
        amount_paid: payments.amount_paid,
        payment_date: payments.payment_date,
        payment_method: payments.payment_method,
        reference_number: payments.reference_number,
        description: payments.description,
        recorded_by: payments.recorded_by,
        has_been_canceled: payments.has_been_canceled,
        reason_for_cancellation: payments.reason_for_cancellation,
        has_been_overwritten: payments.has_been_overwritten,
        price_override_reason: payments.price_override_reason,
        override_approved_by: payments.override_approved_by,
        created_on: payments.created_on,
        is_deleted: payments.is_deleted
      })
      .from(payments)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset)
      .all()

    // Fetch employee details for recorded_by
    const employeeIds = filterValidIds(paymentList.map(p => p.recorded_by))
    const employees_data = employeeIds.length > 0
      ? db.select().from(employees).where(inArray(employees.id, employeeIds)).all()
      : []

    const employeeMap = new Map(employees_data.map(e => [e.id, e]))

    // Fetch approver details
    const approverIds = filterValidIds(paymentList.map(p => p.override_approved_by))
    const approvers_data = approverIds.length > 0
      ? db.select().from(employees).where(inArray(employees.id, approverIds)).all()
      : []

    const approverMap = new Map(approvers_data.map(e => [e.id, e]))

    // Calculate summary
    const totalAmount = paymentList.reduce((sum, p) => sum + p.amount_paid, 0)
    const countByMethod = paymentList.reduce((acc, p) => {
      const method = p.payment_method
      acc[method] = (acc[method] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Build response
    const payments_response = paymentList.map(p => ({
      id: p.id,
      sale_id: p.sale_id,
      amount_paid: p.amount_paid,
      payment_date: toTimestamp(p.payment_date) || 0,
      payment_method: p.payment_method,
      reference_number: p.reference_number,
      description: p.description,
      recorded_by: p.recorded_by,
      has_been_canceled: p.has_been_canceled || false,
      reason_for_cancellation: p.reason_for_cancellation,
      has_been_overwritten: p.has_been_overwritten || false,
      price_override_reason: p.price_override_reason,
      override_approved_by: p.override_approved_by,
      created_on: toTimestamp(p.created_on) || 0,
      is_deleted: p.is_deleted || false,
      recorded_by_employee: p.recorded_by ? {
        id: p.recorded_by,
        name: getEmployeeName(employeeMap.get(p.recorded_by)),
        role: employeeMap.get(p.recorded_by)?.role || 'unknown'
      } : null,
      approver: p.override_approved_by ? {
        id: p.override_approved_by,
        name: getEmployeeName(approverMap.get(p.override_approved_by)),
        role: approverMap.get(p.override_approved_by)?.role || 'unknown'
      } : null
    }))

    const totalPages = Math.ceil(total / limit)

    return {
      success: true,
      data: {
        payments: payments_response,
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        },
        summary: {
          total_amount: totalAmount,
          average_amount: paymentList.length > 0 ? totalAmount / paymentList.length : 0,
          count_by_method: countByMethod
        }
      }
    }

  } catch (error) {
    console.error('Error fetching payments by sale:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch payments'
    }
  }
})

// ============================================================================
// UPDATE PAYMENT
// ============================================================================
ipcMain.handle('payments:update', async (_event, payload: UpdatePaymentPayload): Promise<PaymentResponse> => {
  try {
    const db = getDB()
    const { 
      id, 
      amount_paid, 
      payment_date, 
      payment_method, 
      reference_number, 
      description,
      has_been_overwritten,
      price_override_reason,
      override_approved_by
    } = payload

    // Get current session
    const session = sessionManager.getCurrentSession()
    if (!session) {
      return {
        success: false,
        message: 'Not authenticated. Please log in.'
      }
    }

    if (!id) {
      return { success: false, message: 'Payment ID is required' }
    }

    // Check if payment exists and is not cancelled/deleted
    const existingPayment = db
      .select({
        id: payments.id,
        sale_id: payments.sale_id,
        amount_paid: payments.amount_paid,
        payment_method: payments.payment_method,
        has_been_canceled: payments.has_been_canceled,
        is_deleted: payments.is_deleted,
        recorded_by: payments.recorded_by
      })
      .from(payments)
      .where(eq(payments.id, id))
      .get()

    if (!existingPayment) {
      return { success: false, message: 'Payment not found' }
    }
    if (existingPayment.is_deleted) {
      return { success: false, message: 'Cannot update deleted payment' }
    }
    if (existingPayment.has_been_canceled) {
      return { success: false, message: 'Cannot update cancelled payment' }
    }

    // Check if user has permission (admin/manager or the one who recorded)
    const hasPermission = session.role === 'admin' || 
                         session.role === 'manager' || 
                         existingPayment.recorded_by === session.employeeId

    if (!hasPermission) {
      return {
        success: false,
        message: 'You do not have permission to update this payment'
      }
    }

    // Build update data
    const updateData: any = {
      updated_on: sql`(strftime('%s', 'now'))`,
      is_sync_required: true
    }

    if (amount_paid !== undefined) {
      if (amount_paid <= 0) {
        return { success: false, message: 'Amount paid must be greater than 0' }
      }
      updateData.amount_paid = amount_paid
    }

    if (payment_date !== undefined) {
      updateData.payment_date = payment_date
    }

    if (payment_method !== undefined) {
      updateData.payment_method = payment_method
    }

    if (reference_number !== undefined) {
      updateData.reference_number = reference_number
    }

    if (description !== undefined) {
      updateData.description = description
    }

    if (has_been_overwritten !== undefined) {
      updateData.has_been_overwritten = has_been_overwritten
    }

    if (price_override_reason !== undefined) {
      updateData.price_override_reason = price_override_reason
    }

    if (override_approved_by !== undefined) {
      updateData.override_approved_by = override_approved_by
    }

    // Update in transaction
    db.transaction(() => {
      db.update(payments)
        .set(updateData)
        .where(eq(payments.id, id))
        .run()

      // Log activity
    //   logEmployeeActivity({
    //     activity: 'updated payment',
    //     employee_id: session.employeeId,
    //     linked_activity_id: id,
    //     linked_activity_table: 'payments',
    //     details: JSON.stringify({ changes: Object.keys(updateData) })
    //   })
    })

    // Fetch and return updated payment
    const payment = await fetchPaymentById(id, true)
    
    if (!payment) {
      return {
        success: false,
        message: 'Payment updated but could not be retrieved'
      }
    }

    return {
      success: true,
      message: 'Payment updated successfully',
      data: payment
    }

  } catch (error) {
    console.error('Error updating payment:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update payment'
    }
  }
})

// ============================================================================
// CANCEL PAYMENT
// ============================================================================
ipcMain.handle('payments:cancel', async (_event, payload: CancelPaymentPayload): Promise<PaymentResponse> => {
  try {
    const db = getDB()
    const { id, reason, approved_by } = payload

    // Get current session
    const session = sessionManager.getCurrentSession()
    if (!session) {
      return {
        success: false,
        message: 'Not authenticated. Please log in.'
      }
    }

    if (!id) {
      return { success: false, message: 'Payment ID is required' }
    }
    if (!reason) {
      return { success: false, message: 'Cancellation reason is required' }
    }

    // Check if payment exists
    const existingPayment = db
      .select({
        id: payments.id,
        sale_id: payments.sale_id,
        amount_paid: payments.amount_paid,
        has_been_canceled: payments.has_been_canceled,
        is_deleted: payments.is_deleted,
        recorded_by: payments.recorded_by
      })
      .from(payments)
      .where(eq(payments.id, id))
      .get()

    if (!existingPayment) {
      return { success: false, message: 'Payment not found' }
    }
    if (existingPayment.is_deleted) {
      return { success: false, message: 'Cannot cancel deleted payment' }
    }
    if (existingPayment.has_been_canceled) {
      return { success: false, message: 'Payment is already cancelled' }
    }

    // Check permission (admins/managers can cancel any payment)
    const hasPermission = session.role === 'admin' || 
                         session.role === 'manager' || 
                         existingPayment.recorded_by === session.employeeId

    if (!hasPermission) {
      return {
        success: false,
        message: 'You do not have permission to cancel this payment'
      }
    }

    // Cancel payment in transaction
    db.transaction(() => {
      db.update(payments)
        .set({
          has_been_canceled: true,
          reason_for_cancellation: reason,
          override_approved_by: approved_by || (session.role === 'admin' || session.role === 'manager' ? session.employeeId : null),
        //   updated_on: sql`(strftime('%s', 'now'))`,
          is_sync_required: true
        })
        .where(eq(payments.id, id))
        .run()

      // Update sale status back to pending if this was the only payment
      const remainingPayments = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(payments)
        .where(and(
          eq(payments.sale_id, existingPayment.sale_id),
          eq(payments.is_deleted, false),
          eq(payments.has_been_canceled, false)
        ))
        .get()

      if (Number(remainingPayments?.count || 0) === 0) {
        db.update(sales)
          .set({
            status: 'pending',
            updated_on: sql`(strftime('%s', 'now'))`,
            is_sync_required: true
          })
          .where(eq(sales.id, existingPayment.sale_id))
          .run()
      }

      // Log activity
    //   logEmployeeActivity({
    //     activity: 'cancelled payment',
    //     employee_id: session.employeeId,
    //     linked_activity_id: id,
    //     linked_activity_table: 'payments',
    //     details: JSON.stringify({ reason })
    //   })
    })

    // Fetch and return cancelled payment
    const payment = await fetchPaymentById(id, true)
    
    if (!payment) {
      return {
        success: false,
        message: 'Payment cancelled but could not be retrieved'
      }
    }

    return {
      success: true,
      message: 'Payment cancelled successfully',
      data: payment
    }

  } catch (error) {
    console.error('Error cancelling payment:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to cancel payment'
    }
  }
})

// ============================================================================
// SOFT DELETE PAYMENT
// ============================================================================
ipcMain.handle('payments:soft-delete', async (_event, payload: { id: number; restore?: boolean }) => {
  try {
    const db = getDB()
    const { id, restore = false } = payload
    // const action = restore ? 'restore' : 'delete'

    // Get current session
    const session = sessionManager.getCurrentSession()
    if (!session) {
      return {
        success: false,
        message: 'Not authenticated. Please log in.'
      }
    }

    if (!id) {
      return { success: false, message: 'Payment ID is required' }
    }

    // Check if payment exists
    const existingPayment = db
      .select({
        id: payments.id,
        is_deleted: payments.is_deleted,
        sale_id: payments.sale_id,
        recorded_by: payments.recorded_by
      })
      .from(payments)
      .where(eq(payments.id, id))
      .get()

    if (!existingPayment) {
      return { success: false, message: 'Payment not found' }
    }

    // Check if already in desired state
    if (restore && !existingPayment.is_deleted) {
      return { success: false, message: 'Payment is already active' }
    }
    if (!restore && existingPayment.is_deleted) {
      return { success: false, message: 'Payment is already deleted' }
    }

    // Check permission
    const hasPermission = session.role === 'admin' || 
                         session.role === 'manager' || 
                         existingPayment.recorded_by === session.employeeId

    if (!hasPermission) {
      return {
        success: false,
        message: 'You do not have permission to delete this payment'
      }
    }

    // Perform soft delete/restore
    db.update(payments)
      .set({
        is_deleted: restore ? false : true,
        updated_on: sql`(strftime('%s', 'now'))`,
        is_sync_required: true
      } as any)
      .where(eq(payments.id, id))
      .run()

    // Log activity
    // logEmployeeActivity({
    //   activity: `${restore ? 'restored' : 'deleted'} payment`,
    //   employee_id: session.employeeId,
    //   linked_activity_id: id,
    //   linked_activity_table: 'payments'
    // })

    return {
      success: true,
      message: `Payment ${restore ? 'restored' : 'deleted'} successfully`,
      data: {
        id,
        action: restore ? 'restore' : 'delete',
        restored: restore
      }
    }

  } catch (error) {
    console.error('Error in payment soft delete:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : `Failed to ${payload.restore ? 'restore' : 'delete'} payment`
    }
  }
})

// ============================================================================
// HELPER FUNCTION: Fetch payment by ID with all details
// ============================================================================
async function fetchPaymentById(
  id: number, 
  includeSaleDetails: boolean = true,
  includeDeleted: boolean = false
): Promise<any> {
  const db = getDB()

  // Build conditions
  const conditions: SQL[] = [eq(payments.id, id)]
  if (!includeDeleted) {
    conditions.push(eq(payments.is_deleted, false))
  }

  const payment = db
    .select({
      id: payments.id,
      sale_id: payments.sale_id,
      amount_paid: payments.amount_paid,
      payment_date: payments.payment_date,
      payment_method: payments.payment_method,
      reference_number: payments.reference_number,
      description: payments.description,
      recorded_by: payments.recorded_by,
      has_been_canceled: payments.has_been_canceled,
      reason_for_cancellation: payments.reason_for_cancellation,
      has_been_overwritten: payments.has_been_overwritten,
      price_override_reason: payments.price_override_reason,
      override_approved_by: payments.override_approved_by,
      created_on: payments.created_on,
      is_deleted: payments.is_deleted
    })
    .from(payments)
    .where(and(...conditions))
    .get()

  if (!payment) return null

  // Fetch related data
  const recordedByEmployee = payment.recorded_by 
    ? db.select().from(employees).where(eq(employees.id, payment.recorded_by)).get()
    : null

  const approver = payment.override_approved_by
    ? db.select().from(employees).where(eq(employees.id, payment.override_approved_by)).get()
    : null

    type SaleData = {
        id: number
        total_price: number
        status: 'pending' | 'completed' | 'cancelled' | 'refunded' | null
        is_debt_sale: boolean | null
        customer_id: number | null
    }

    type CustomerData = {
        id: number
        name: string
    }

  let sale: SaleData | null | undefined = null
  let customer: CustomerData | null | undefined = null

  if (includeSaleDetails && payment.sale_id) {
    sale = db
      .select({
        id: sales.id,
        total_price: sales.total_price,
        status: sales.status,
        is_debt_sale: sales.is_debt_sale,
        customer_id: sales.customer_id
      })
      .from(sales)
      .where(eq(sales.id, payment.sale_id))
      .get() as any

    if (sale && sale.customer_id) {
      customer = db
        .select({
          id: customers.id,
          name: customers.name
        })
        .from(customers)
        .where(eq(customers.id, sale.customer_id))
        .get()
    }
  }

  return {
    id: payment.id,
    sale_id: payment.sale_id,
    amount_paid: payment.amount_paid,
    payment_date: toTimestamp(payment.payment_date) || 0,
    payment_method: payment.payment_method,
    reference_number: payment.reference_number,
    description: payment.description,
    recorded_by: payment.recorded_by,
    has_been_canceled: payment.has_been_canceled || false,
    reason_for_cancellation: payment.reason_for_cancellation,
    has_been_overwritten: payment.has_been_overwritten || false,
    price_override_reason: payment.price_override_reason,
    override_approved_by: payment.override_approved_by,
    created_on: toTimestamp(payment.created_on) || 0,
    is_deleted: payment.is_deleted || false,
    sale: sale ? {
      id: sale.id,
      total_price: sale.total_price,
      status: sale.status,
      is_debt_sale: sale.is_debt_sale || false,
      customer: customer ? {
        id: customer.id,
        name: customer.name
      } : null
    } : null,
    recorded_by_employee: recordedByEmployee ? {
      id: recordedByEmployee.id,
      name: getEmployeeName(recordedByEmployee),
      role: recordedByEmployee.role || 'unknown'
    } : null,
    approver: approver ? {
      id: approver.id,
      name: getEmployeeName(approver),
      role: approver.role || 'unknown'
    } : null
  }
}