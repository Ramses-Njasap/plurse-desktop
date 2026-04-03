import { getDB } from '@db/sqlite3'
import { products, sku, stock_purchases } from '@schema/sqlite3/products'
import { payments, sales } from '@schema/sqlite3/sales'
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { ipcMain } from 'electron'
import {
  AlertCenterData,
  AlertSeverity,
  DashboardAlert,
  DashboardResponse
} from './types/dashboard.types'

const db = () => getDB()

const toDate = (timestamp: number): Date => new Date(timestamp * 1000)

/**
 * Format currency
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 2
  }).format(value)
}

/**
 * Generate unique ID
 */
const generateId = (): string => {
  return `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

ipcMain.handle(
  'alerts:get-all',
  async (_event, filters?: { read?: boolean; category?: string }): Promise<DashboardResponse<AlertCenterData>> => {
    const startTime = Date.now()
    
    try {
      const dbInstance = db()
      const now = Math.floor(Date.now() / 1000)
      const thirtyDaysFromNow = now + (30 * 24 * 60 * 60)
      const ninetyDaysAgo = now - (90 * 24 * 60 * 60)

      const alerts: DashboardAlert[] = []

      // ==========================================================================
      // 1. INVENTORY ALERTS
      // ==========================================================================
      
      // Low stock alerts (remaining < 10 units)
      const lowStockItems = await dbInstance
        .select({
          sku_id: sku.id,
          sku_name: sku.sku_name,
          product_name: products.product_name,
          remaining: sql<number>`(
            SELECT COALESCE(SUM(${stock_purchases.quantity_bought}), 0)
            FROM ${stock_purchases}
            WHERE ${stock_purchases.sku_id} = ${sku.id}
            AND ${stock_purchases.is_deleted} = 0
          ) - COALESCE((
            SELECT SUM(${sales.quantity})
            FROM ${sales}
            INNER JOIN ${stock_purchases} sp ON sp.id = ${sales.stock_purchased_id}
            WHERE sp.sku_id = ${sku.id}
            AND ${sales.is_deleted} = 0
            AND ${sales.has_been_canceled} = 0
          ), 0)`
        })
        .from(sku)
        .innerJoin(products, eq(sku.product_id, products.id))
        .where(eq(sku.is_deleted, false))
        .having(sql`remaining < 10 AND remaining > 0`)
        .limit(5)
        .all()

      for (const item of lowStockItems) {
        alerts.push({
          id: generateId(),
          type: 'inventory',
          severity: 'warning',
          title: 'Low Stock Alert',
          message: `${item.sku_name} (${item.product_name}) is running low with only ${item.remaining} units remaining.`,
          timestamp: now,
          read: false,
          actionable: true,
          action: {
            label: 'View Inventory',
            handler: 'inventory:get-dashboard',
            payload: { filters: { sku_id: item.sku_id } }
          }
        })
      }

      // Out of stock alerts
      const outOfStockItems = await dbInstance
        .select({
          sku_id: sku.id,
          sku_name: sku.sku_name,
          product_name: products.product_name
        })
        .from(sku)
        .innerJoin(products, eq(sku.product_id, products.id))
        .where(
          and(
            eq(sku.is_deleted, false),
            sql`NOT EXISTS (
              SELECT 1 FROM ${stock_purchases} sp
              WHERE sp.sku_id = ${sku.id}
              AND sp.is_deleted = 0
              AND sp.quantity_bought > COALESCE((
                SELECT SUM(${sales.quantity})
                FROM ${sales}
                WHERE ${sales.stock_purchased_id} = sp.id
                AND ${sales.is_deleted} = 0
                AND ${sales.has_been_canceled} = 0
              ), 0)
            )`
          )
        )
        .limit(3)
        .all()

      for (const item of outOfStockItems) {
        alerts.push({
          id: generateId(),
          type: 'inventory',
          severity: 'critical',
          title: 'Out of Stock',
          message: `${item.sku_name} (${item.product_name}) is completely out of stock.`,
          timestamp: now,
          read: false,
          actionable: true,
          action: {
            label: 'Reorder Now',
            handler: 'inventory:get-dashboard',
            payload: { filters: { sku_id: item.sku_id } }
          }
        })
      }

      // Expiring soon alerts
      const expiringItems = await dbInstance
        .select({
          sku_id: sku.id,
          sku_name: sku.sku_name,
          product_name: products.product_name,
          batch_number: stock_purchases.batch_number,
          expiry_date: stock_purchases.expiry_date,
          days_until_expiry: sql<number>`(julianday(${stock_purchases.expiry_date}) - julianday('now'))`
        })
        .from(stock_purchases)
        .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
        .innerJoin(products, eq(sku.product_id, products.id))
        .where(
          and(
            eq(stock_purchases.is_deleted, false),
            sql`${stock_purchases.expiry_date} IS NOT NULL`,
            sql`${stock_purchases.expiry_date} <= ${thirtyDaysFromNow}`,
            sql`${stock_purchases.expiry_date} >= ${now}`
          )
        )
        .limit(5)
        .all()

      for (const item of expiringItems) {
        const days = Math.floor(item.days_until_expiry)
        const severity: AlertSeverity = days <= 7 ? 'critical' : days <= 14 ? 'warning' : 'info'
        
        alerts.push({
          id: generateId(),
          type: 'inventory',
          severity,
          title: 'Expiring Soon',
          message: `${item.sku_name} (Batch: ${item.batch_number || 'N/A'}) expires in ${days} days.`,
          timestamp: now,
          read: false,
          actionable: true,
          action: {
            label: 'Review Batch',
            handler: 'inventory:get-dashboard',
            payload: { filters: { batch_id: item.batch_number } }
          }
        })
      }

      // ==========================================================================
      // 2. DEBT ALERTS
      // ==========================================================================
      
      // Overdue debts (> 30 days)
      const overdueDebts = await dbInstance
        .select({
          sale_id: sales.id,
          customer_id: sales.customer_id,
          total_price: sales.total_price,
          balance_due: sales.balance_due,
          days_overdue: sql<number>`(julianday('now') - julianday(${sales.balance_due}, 'unixepoch'))`
        })
        .from(sales)
        .leftJoin(payments, eq(sales.id, payments.sale_id))
        .where(
          and(
            eq(sales.is_debt_sale, true),
            lt(sales.balance_due, now),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .groupBy(sales.id)
        .having(
          sql`COALESCE(SUM(${payments.amount_paid}), 0) < ${sales.total_price}`
        )
        .limit(5)
        .all()

      for (const debt of overdueDebts) {
        const daysOverdue = Math.floor(debt.days_overdue)
        const amountOwed = debt.total_price // Would need to subtract payments
        
        alerts.push({
          id: generateId(),
          type: 'debt',
          severity: 'critical',
          title: 'Overdue Payment',
          message: `Debt of ${formatCurrency(amountOwed)} is ${daysOverdue} days overdue.`,
          timestamp: now,
          read: false,
          actionable: true,
          action: {
            label: 'View Sale',
            handler: 'sales:get-dashboard',
            payload: { filters: { sale_id: debt.sale_id } }
          }
        })
      }

      // Upcoming debts (due in next 7 days)
      const upcomingDebts = await dbInstance
        .select({
          sale_id: sales.id,
          customer_id: sales.customer_id,
          total_price: sales.total_price,
          balance_due: sales.balance_due,
          days_until_due: sql<number>`(julianday(${sales.balance_due}, 'unixepoch') - julianday('now'))`
        })
        .from(sales)
        .leftJoin(payments, eq(sales.id, payments.sale_id))
        .where(
          and(
            eq(sales.is_debt_sale, true),
            gte(sales.balance_due, toDate(now)),
            lte(sales.balance_due, toDate(now + (7 * 24 * 60 * 60))),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .groupBy(sales.id)
        .having(
          sql`COALESCE(SUM(${payments.amount_paid}), 0) < ${sales.total_price}`
        )
        .limit(5)
        .all()

      for (const debt of upcomingDebts) {
        const daysUntilDue = Math.ceil(debt.days_until_due)
        const amountOwed = debt.total_price // Would need to subtract payments
        
        alerts.push({
          id: generateId(),
          type: 'debt',
          severity: 'warning',
          title: 'Payment Due Soon',
          message: `Debt of ${formatCurrency(amountOwed)} is due in ${daysUntilDue} days.`,
          timestamp: now,
          read: false,
          actionable: true,
          action: {
            label: 'View Sale',
            handler: 'sales:get-dashboard',
            payload: { filters: { sale_id: debt.sale_id } }
          }
        })
      }

      // ==========================================================================
      // 3. SALES ALERTS
      // ==========================================================================
      
      // Negative margin sales
      const negativeMarginSales = await dbInstance
        .select({
          sale_id: sales.id,
          total_price: sales.total_price,
          profit_margin: sales.profit_margin
        })
        .from(sales)
        .where(
          and(
            lt(sales.profit_margin, 0),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false),
            gte(sales.sold_on, toDate(ninetyDaysAgo))
          )
        )
        .limit(3)
        .all()

      for (const sale of negativeMarginSales) {
        alerts.push({
          id: generateId(),
          type: 'sales',
          severity: 'warning',
          title: 'Negative Margin Sale',
          message: `Sale #${sale.sale_id} had a negative margin of ${sale.profit_margin?.toFixed(1)}%.`,
          timestamp: now,
          read: false,
          actionable: true,
          action: {
            label: 'Review Sale',
            handler: 'sales:get-dashboard',
            payload: { filters: { sale_id: sale.sale_id } }
          }
        })
      }

      // ==========================================================================
      // 4. FINANCIAL ALERTS
      // ==========================================================================
      
      // Large expenses
      const largeExpenses = await dbInstance
        .select({
          id: stock_purchases.id,
          total_price_bought: stock_purchases.total_price_bought,
          sku_name: sku.sku_name
        })
        .from(stock_purchases)
        .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
        .where(
          and(
            gte(stock_purchases.purchased_on, toDate(last30Days.start)),
            lte(stock_purchases.purchased_on, toDate(last30Days.end)),
            eq(stock_purchases.is_deleted, false),
            gt(stock_purchases.total_price_bought, 5000)
          )
        )
        .limit(3)
        .all()

      for (const expense of largeExpenses) {
        alerts.push({
          id: generateId(),
          type: 'financial',
          severity: 'info',
          title: 'Large Purchase',
          message: `Stock purchase of ${formatCurrency(expense.total_price_bought)} for ${expense.sku_name}.`,
          timestamp: now,
          read: false,
          actionable: true,
          action: {
            label: 'View Purchase',
            handler: 'stock-purchases:get-by-id',
            payload: { id: expense.id }
          }
        })
      }

      // ==========================================================================
      // 5. CUSTOMER ALERTS
      // ==========================================================================
      
      // High-value customer with no recent purchases
      const inactiveVips = await dbInstance
        .select({
          customer_id: sales.customer_id,
          total_spent: sql<number>`SUM(${sales.total_price})`,
          last_purchase: sql<number>`MAX(${sales.sold_on})`
        })
        .from(sales)
        .where(
          and(
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false),
            gte(sales.sold_on, toDate(ninetyDaysAgo))
          )
        )
        .groupBy(sales.customer_id)
        .having(
          and(
            gte(sql`SUM(${sales.total_price})`, 10000),
            lt(sql`MAX(${sales.sold_on})`, now - (60 * 24 * 60 * 60))
          )
        )
        .limit(3)
        .all()

      for (const customer of inactiveVips) {
        alerts.push({
          id: generateId(),
          type: 'customer',
          severity: 'info',
          title: 'VIP Customer Inactive',
          message: `A customer who spent ${formatCurrency(customer.total_spent)} hasn't purchased in 60+ days.`,
          timestamp: now,
          read: false,
          actionable: true,
          action: {
            label: 'View Customer',
            handler: 'customers:get-dashboard',
            payload: { filters: { customer_id: customer.customer_id } }
          }
        })
      }

      // ==========================================================================
      // 6. SYSTEM ALERTS (simulated)
      // ==========================================================================
      
      alerts.push({
        id: generateId(),
        type: 'system',
        severity: 'success',
        title: 'Daily Report Ready',
        message: 'Yesterday\'s sales report has been generated and is ready to view.',
        timestamp: now - 3600,
        read: false,
        actionable: true,
        action: {
          label: 'View Report',
          handler: 'reports:get-daily',
          payload: { date: new Date(Date.now() - 86400000).toISOString().split('T')[0] }
        }
      })

      // ==========================================================================
      // 7. FILTER AND CATEGORIZE
      // ==========================================================================
      
      // Apply filters
      let filteredAlerts = [...alerts]
      
      if (filters?.read !== undefined) {
        filteredAlerts = filteredAlerts.filter(a => a.read === filters.read)
      }
      
      if (filters?.category) {
        filteredAlerts = filteredAlerts.filter(a => a.type === filters.category)
      }

      // Categorize by severity
      const critical = filteredAlerts.filter(a => a.severity === 'critical')
      const warnings = filteredAlerts.filter(a => a.severity === 'warning')
      const info = filteredAlerts.filter(a => a.severity === 'info')
      const success = filteredAlerts.filter(a => a.severity === 'success')

      // Sort by timestamp (newest first)
      const sortByTimestamp = (a: DashboardAlert, b: DashboardAlert) => b.timestamp - a.timestamp
      critical.sort(sortByTimestamp)
      warnings.sort(sortByTimestamp)
      info.sort(sortByTimestamp)
      success.sort(sortByTimestamp)

      // Count unread
      const unreadCount = filteredAlerts.filter(a => !a.read).length

      const result: AlertCenterData = {
        critical: critical.slice(0, 5),
        warnings: warnings.slice(0, 5),
        info: info.slice(0, 5),
        success: success.slice(0, 5),
        unread_count: unreadCount,
        archived_count: 0 // Would track archived alerts separately
      }

      const executionTime = Date.now() - startTime

      return {
        success: true,
        data: result,
        meta: {
          period: {
            total: filteredAlerts.length,
            change_percentage: 0,
            trend: 'stable'
          },
          execution_time_ms: executionTime
        }
      }

    } catch (error) {
      console.error('Error in alerts:get-all:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch alerts'
      }
    }
  }
)

// Helper for date comparisons
const lt = (a: any, b: any) => sql`${a} < ${b}`
const gt = (a: any, b: any) => sql`${a} > ${b}`

// Get last 30 days range
const last30Days = getLast30DaysRange()

function getLast30DaysRange(): { start: number; end: number } {
  const end = Math.floor(Date.now() / 1000)
  const start = end - (30 * 24 * 60 * 60)
  return { start, end }
}

// ipcMain.handle('alerts:mark-read', async (_event, alertId: string) => {
//   // This would update the database
//   // For now, just return success
//   return { success: true }
// })

// ipcMain.handle('alerts:dismiss', async (_event, alertId: string) => {
//   // This would update the database
//   // For now, just return success
//   return { success: true }
// })