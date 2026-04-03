import { getDB } from '@db/sqlite3'
import { sku, stock_purchases } from '@schema/sqlite3/products'
import { payments, sales } from '@schema/sqlite3/sales'
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { ipcMain } from 'electron'
import {
  // DashboardFilters,
  DashboardResponse,
  ExecutiveSummary,
  KpiProgress,
  OverviewDashboardData
} from './types/dashboard.types'

const db = () => getDB()

const toTimestamp = (date: Date): number => Math.floor(date.getTime() / 1000)

/**
 * Format currency values consistently
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 2
  }).format(value)
}

/**
 * Calculate change percentage between two values
 */
const calculateChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/**
 * Determine trend direction
 */
const getTrend = (change: number): 'up' | 'down' | 'stable' => {
  if (change > 1) return 'up'
  if (change < -1) return 'down'
  return 'stable'
}

/**
 * Get today's timestamp range as Date Objects
 */
const getTodayRange = (): { start: Date; end: Date } => {
  const now = new Date()
  const start = new Date(now.setHours(0, 0, 0, 0))
  const end = new Date(now.setHours(23, 59, 59, 999))
  return { start, end }
}

/**
 * Get month-to-date range as Date objects
 */
const getMonthToDateRange = (): { start: Date; end: Date } => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date() // current date/time
  return { start, end }
}

/**
 * Get previous month range as Date Object
 */
const getPreviousMonthRange = (): { start: Date; end: Date } => {
  const now = new Date()
  const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  return {
    start: firstDayPrevMonth,
    end: lastDayPrevMonth
  }
}

/**
 * Get previous day range as Date objects
 */
const getPreviousDayRange = (): { start: Date; end: Date } => {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const start = new Date(yesterday.setHours(0, 0, 0, 0))
  const end = new Date(yesterday.setHours(23, 59, 59, 999))
  return { start, end }
}

// async (_event, filters?: DashboardFilters): Promise<DashboardResponse<OverviewDashboardData>> => {

ipcMain.handle(
  'dashboard:get-overview',
  async (_event): Promise<DashboardResponse<OverviewDashboardData>> => {
    const startTime = Date.now()
    
    try {
      const dbInstance = db()
      const today = getTodayRange()
      const mtd = getMonthToDateRange()
      const yesterday = getPreviousDayRange()
      const prevMonth = getPreviousMonthRange()

      // ==========================================================================
      // 1. REVENUE METRICS
      // ==========================================================================
      
      // Today's revenue
      const todayRevenueResult = dbInstance
        .select({ total: sql<number>`COALESCE(SUM(${sales.total_price}), 0)` })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, today.start),
            lte(sales.sold_on, today.end),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const todayRevenue = Number(todayRevenueResult?.total || 0)

      // Yesterday's revenue for comparison
      const yesterdayRevenueResult = dbInstance
        .select({ total: sql<number>`COALESCE(SUM(${sales.total_price}), 0)` })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, yesterday.start),
            lte(sales.sold_on, yesterday.end),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const yesterdayRevenue = Number(yesterdayRevenueResult?.total || 0)
      const revenueChange = calculateChange(todayRevenue, yesterdayRevenue)

      // Month-to-date revenue
      const mtdRevenueResult = dbInstance
        .select({ total: sql<number>`COALESCE(SUM(${sales.total_price}), 0)` })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, mtd.start),
            lte(sales.sold_on, mtd.end),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const mtdRevenue = Number(mtdRevenueResult?.total || 0)

      // Previous month revenue for comparison
      const prevMonthRevenueResult = dbInstance
        .select({ total: sql<number>`COALESCE(SUM(${sales.total_price}), 0)` })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, prevMonth.start),
            lte(sales.sold_on, prevMonth.end),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const prevMonthRevenue = Number(prevMonthRevenueResult?.total || 0)
      const mtdChange = calculateChange(mtdRevenue, prevMonthRevenue)

      // ==========================================================================
      // 2. PROFIT METRICS
      // ==========================================================================
      
      // Today's profit (revenue - cost)
      const todayProfitResult = dbInstance
        .select({
          profit: sql<number>`COALESCE(SUM(
            ${sales.total_price} - 
            (${sales.cost_price_snapshot})
          ), 0)`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, today.start),
            lte(sales.sold_on, today.end),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const todayProfit = Number(todayProfitResult?.profit || 0)

      // Month-to-date profit
      const mtdProfitResult = dbInstance
        .select({
          profit: sql<number>`COALESCE(SUM(
            ${sales.total_price} - 
            (${sales.cost_price_snapshot})
          ), 0)`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, mtd.start),
            lte(sales.sold_on, mtd.end),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const mtdProfit = Number(mtdProfitResult?.profit || 0)

      // ==========================================================================
      // 3. CASH FLOW METRICS
      // ==========================================================================
      
      // Cash at hand (total payments received today)
      const cashTodayResult = dbInstance
        .select({ total: sql<number>`COALESCE(SUM(${payments.amount_paid}), 0)` })
        .from(payments)
        .innerJoin(sales, eq(payments.sale_id, sales.id))
        .where(
          and(
            gte(payments.payment_date, today.start),
            lte(payments.payment_date, today.end),
            eq(payments.is_deleted, false),
            eq(payments.has_been_canceled, false),
            eq(payments.payment_method, 'cash')
          )
        )
        .get()
      
      const cashAtHand = Number(cashTodayResult?.total || 0)

        const debtSales = dbInstance
          .select({
            id: sales.id,
            total_price: sales.total_price
          })
          .from(sales)
          .where(
            and(
              eq(sales.is_debt_sale, true),
              eq(sales.is_deleted, false),
              eq(sales.has_been_canceled, false)
            )
          )
          .all()

          let accountsReceivable = 0

          for (const sale of debtSales) {
            // Get total payments for this specific sale
            const paymentsResult = dbInstance
              .select({
                total: sql<number>`COALESCE(SUM(${payments.amount_paid}), 0)`
              })
              .from(payments)
              .where(
                and(
                  eq(payments.sale_id, sale.id),
                  eq(payments.is_deleted, false),
                  eq(payments.has_been_canceled, false)
                )
              )
              .get()
  
            const totalPaid = Number(paymentsResult?.total || 0)
            const outstanding = sale.total_price - totalPaid
            
            // This should NEVER be negative
            // If it is negative, log it for debugging
            if (outstanding < 0) {
              console.error(`WARNING: Sale ${sale.id} has negative outstanding:`, {
                sale_id: sale.id,
                total_price: sale.total_price,
                total_paid: totalPaid,
                outstanding
              })
            }
            
            accountsReceivable += Math.max(0, outstanding) // Cap at zero just in case
          }


      // Accounts Payable (simplified - could be from suppliers)
      // This would need a proper payable tracking system
      const accountsPayable = 0

      // ==========================================================================
      // 4. INVENTORY METRICS
      // ==========================================================================
      
      // Total inventory value
      const inventoryValueResult = dbInstance
        .select({
          total: sql<number>`COALESCE(SUM(
            ${stock_purchases.quantity_bought} * ${stock_purchases.price_per_unit}
          ), 0)`
        })
        .from(stock_purchases)
        .where(eq(stock_purchases.is_deleted, false))
        .get()

      
      const inventoryValue = Number(inventoryValueResult?.total || 0)

      // Low stock count (remaining < threshold)
      // This requires a threshold per SKU - using 10 as default for demo
      const lowStockResult = dbInstance
        .select({
          count: sql<number>`COUNT(*)`
        })
        .from(sku)
        .innerJoin(stock_purchases, eq(sku.id, stock_purchases.sku_id))
        .where(
          and(
            eq(sku.is_deleted, false),
            eq(stock_purchases.is_deleted, false),
            sql`${stock_purchases.quantity_bought} - COALESCE((
              SELECT SUM(${sales.quantity})
              FROM ${sales}
              WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
              AND ${sales.is_deleted} = 0
              AND ${sales.has_been_canceled} = 0
            ), 0) < 10`
          )
        )
        .get()
      
      const lowStockCount = Number(lowStockResult?.count || 0)

      // Out of stock count
      const outOfStockResult = dbInstance
        .select({
          count: sql<number>`COUNT(DISTINCT ${sku.id})`
        })
        .from(sku)
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
        .get()
      
      const outOfStockCount = Number(outOfStockResult?.count || 0)

      // ==========================================================================
      // 5. CUSTOMER METRICS
      // ==========================================================================
      
      // Active customers today
      const activeCustomersResult = dbInstance
        .select({
          count: sql<number>`COUNT(DISTINCT ${sales.customer_id})`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, today.start),
            lte(sales.sold_on, today.end),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()

      const activeCustomersToday = Number(activeCustomersResult?.count || 0)

      // New customers today (first purchase)
      const newCustomersResult = dbInstance
        .select({
          count: sql<number>`COUNT(DISTINCT ${sales.customer_id})`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, today.start),
            lte(sales.sold_on, today.end),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false),
            sql`${sales.customer_id} NOT IN (
              SELECT DISTINCT s2.customer_id
              FROM ${sales} s2
              WHERE s2.sold_on < ${toTimestamp(today.start)}
              AND s2.is_deleted = 0
              AND s2.has_been_canceled = 0
            )`
          )
        )
        .get()
      
      const newCustomersToday = Number(newCustomersResult?.count || 0)

      // ==========================================================================
      // 6. TRANSACTION METRICS
      // ==========================================================================
      
      // Average transaction value today
      const avgTransactionResult = dbInstance
        .select({
          avg: sql<number>`COALESCE(AVG(${sales.total_price}), 0)`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, today.start),
            lte(sales.sold_on, today.end),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const avgTransactionValue = Number(avgTransactionResult?.avg || 0)

      // Transaction count today
      const transactionCountResult = dbInstance
        .select({
          count: sql<number>`COUNT(*)`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, today.start),
            lte(sales.sold_on, today.end),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const transactionCount = Number(transactionCountResult?.count || 0)

      // ==========================================================================
      // 7. BUILD EXECUTIVE SUMMARY
      // ==========================================================================
      
      const summary: ExecutiveSummary = {
        revenue_today: {
          value: todayRevenue,
          formatted: formatCurrency(todayRevenue),
          comparison_value: yesterdayRevenue,
          change_percentage: revenueChange,
          trend: getTrend(revenueChange),
          currency: 'XAF '
        },
        revenue_mtd: {
          value: mtdRevenue,
          formatted: formatCurrency(mtdRevenue),
          comparison_value: prevMonthRevenue,
          change_percentage: mtdChange,
          trend: getTrend(mtdChange),
          currency: 'XAF '
        },
        profit_today: {
          value: todayProfit,
          formatted: formatCurrency(todayProfit),
          comparison_value: undefined,
          change_percentage: undefined,
          trend: 'stable',
          currency: 'XAF '
        },
        profit_mtd: {
          value: mtdProfit,
          formatted: formatCurrency(mtdProfit),
          comparison_value: undefined,
          change_percentage: undefined,
          trend: 'stable',
          currency: 'XAF '
        },
        cash_at_hand: {
          value: cashAtHand,
          formatted: formatCurrency(cashAtHand),
          comparison_value: undefined,
          change_percentage: undefined,
          trend: 'stable',
          currency: 'XAF '
        },
        accounts_receivable: {
          value: accountsReceivable,
          formatted: formatCurrency(accountsReceivable),
          comparison_value: undefined,
          change_percentage: undefined,
          trend: 'stable',
          currency: 'XAF '
        },
        accounts_payable: {
          value: accountsPayable,
          formatted: formatCurrency(accountsPayable),
          comparison_value: undefined,
          change_percentage: undefined,
          trend: 'stable',
          currency: 'XAF '
        },
        inventory_value: {
          value: inventoryValue,
          formatted: formatCurrency(inventoryValue),
          comparison_value: undefined,
          change_percentage: undefined,
          trend: 'stable',
          currency: 'XAF '
        },
        low_stock_count: {
          value: lowStockCount,
          formatted: lowStockCount.toString(),
          comparison_value: undefined,
          change_percentage: undefined,
          trend: lowStockCount > 10 ? 'up' : 'stable'
        },
        out_of_stock_count: {
          value: outOfStockCount,
          formatted: outOfStockCount.toString(),
          comparison_value: undefined,
          change_percentage: undefined,
          trend: outOfStockCount > 5 ? 'up' : 'stable'
        },
        active_customers_today: {
          value: activeCustomersToday,
          formatted: activeCustomersToday.toString(),
          comparison_value: undefined,
          change_percentage: undefined,
          trend: 'stable'
        },
        new_customers_today: {
          value: newCustomersToday,
          formatted: newCustomersToday.toString(),
          comparison_value: undefined,
          change_percentage: undefined,
          trend: newCustomersToday > 5 ? 'up' : 'stable'
        },
        avg_transaction_value: {
          value: avgTransactionValue,
          formatted: formatCurrency(avgTransactionValue),
          comparison_value: undefined,
          change_percentage: undefined,
          trend: 'stable',
          currency: 'XAF '
        },
        transaction_count: {
          value: transactionCount,
          formatted: transactionCount.toString(),
          comparison_value: undefined,
          change_percentage: undefined,
          trend: 'stable'
        }
      }

      // ==========================================================================
      // 8. KPI TARGETS (Example targets - would come from settings)
      // ==========================================================================
      
      const dailyRevenueTarget = 300000
      // const monthlyRevenueTarget = 9500000
      const dailyProfitTarget = 75000
      // const monthlyProfitTarget = 2325000
      const customerTarget = 20
      const inventoryTarget = 300000000

      const kpis: KpiProgress = {
        revenue_target: {
          value: todayRevenue,
          formatted: formatCurrency(todayRevenue),
          target: dailyRevenueTarget,
          progress_percentage: (todayRevenue / dailyRevenueTarget) * 100,
          on_track: todayRevenue >= dailyRevenueTarget,
          trend: getTrend(revenueChange)
        },
        profit_target: {
          value: todayProfit,
          formatted: formatCurrency(todayProfit),
          target: dailyProfitTarget,
          progress_percentage: (todayProfit / dailyProfitTarget) * 100,
          on_track: todayProfit >= dailyProfitTarget,
          trend: 'stable'
        },
        customer_target: {
          value: activeCustomersToday,
          formatted: activeCustomersToday.toString(),
          target: customerTarget,
          progress_percentage: (activeCustomersToday / customerTarget) * 100,
          on_track: activeCustomersToday >= customerTarget,
          trend: 'stable'
        },
        inventory_target: {
          value: inventoryValue,
          formatted: formatCurrency(inventoryValue),
          target: inventoryTarget,
          progress_percentage: inventoryValue > 0 ? (inventoryTarget / inventoryValue) * 100 : 0,
          on_track: inventoryValue <= inventoryTarget,
          trend: 'stable'
        }
      }

      // ==========================================================================
      // 9. QUICK ACTIONS
      // ==========================================================================
      
      const quickActions = [
        {
          label: 'Low Stock Alerts',
          handler: 'inventory:get-dashboard',
          icon: '⚠️',
          count: lowStockCount
        },
        {
          label: 'Outstanding Debt',
          handler: 'sales:get-dashboard',
          icon: '💰',
          count: accountsReceivable > 0 ? 1 : 0
        },
        {
          label: 'New Customers',
          handler: 'customers:get-dashboard',
          icon: '👥',
          count: newCustomersToday
        }
      ]

      // ==========================================================================
      // 10. ALERTS (Simplified - would come from alerts handler)
      // ==========================================================================
      
      const alerts = [
        ...(lowStockCount > 0 ? [{
          id: `low-stock-${Date.now()}`,
          type: 'inventory' as const,
          severity: 'warning' as const,
          title: 'Low Stock Alert',
          message: `${lowStockCount} products are running low on stock.`,
          timestamp: Math.floor(Date.now() / 1000),
          read: false,
          actionable: true,
          action: {
            label: 'View Inventory',
            handler: 'inventory:get-dashboard'
          }
        }] : []),
        ...(accountsReceivable > 1000 ? [{
          id: `debt-${Date.now()}`,
          type: 'debt' as const,
          severity: 'warning' as const,
          title: 'High Outstanding Debt',
          message: `Total outstanding debt is ${formatCurrency(accountsReceivable)}.`,
          timestamp: Math.floor(Date.now() / 1000),
          read: false,
          actionable: true,
          action: {
            label: 'View Debt',
            handler: 'sales:get-dashboard',
            payload: { filters: { is_debt: true } }
          }
        }] : [])
      ]

      // ==========================================================================
      // 11. BUILD RESPONSE
      // ==========================================================================
      
      const executionTime = Date.now() - startTime

      return {
        success: true,
        data: {
          summary,
          kpis,
          alerts,
          quick_actions: quickActions
        },
        meta: {
          period: {
            total: todayRevenue,
            change_percentage: revenueChange,
            trend: getTrend(revenueChange)
          },
          execution_time_ms: executionTime
        }
      }

    } catch (error) {
      console.error('Error in dashboard:get-overview:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch dashboard overview'
      }
    }
  }
)