import { getDB } from '@db/sqlite3'
import { stock_purchases } from '@schema/sqlite3/products'
import { payments, sales } from '@schema/sqlite3/sales'
import { transactions } from '@schema/sqlite3/transactions'
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { ipcMain } from 'electron'
import {
  DashboardResponse,
  ExpenseCategory,
  FinancialsData,
  HeatmapData,
  ProfitTrend
} from './types/dashboard.types'

const db = () => getDB()

// const toTimestamp = (date: Date): number => Math.floor(date.getTime() / 1000)
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
 * Calculate change percentage
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
 * Get current month range
 */
const getCurrentMonthRange = (): { start: number; end: number } => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
  const end = Math.floor(Date.now() / 1000)
  return { start, end }
}

/**
 * Get last month range
 */
const getLastMonthRange = (): { start: number; end: number } => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime() / 1000
  return { start, end }
}

/**
 * Get last 12 months range
 */
// const getLast12MonthsRange = (): { start: number; end: number } => {
//   const end = Math.floor(Date.now() / 1000)
//   const start = end - (365 * 24 * 60 * 60)
//   return { start, end }
// }

// async (_event, filters?: DashboardFilters): Promise<DashboardResponse<FinancialsData>> => {

ipcMain.handle(
  'financials:get-dashboard',
  async (_event): Promise<DashboardResponse<FinancialsData>> => {
    const startTime = Date.now()
    
    try {
      const dbInstance = db()
      const currentMonth = getCurrentMonthRange()
      const lastMonth = getLastMonthRange()
      // const last12Months = getLast12MonthsRange()

      // ==========================================================================
      // 1. CASH FLOW METRICS
      // ==========================================================================
      
      // Cash at hand (from payments today)
      const today = new Date()
      const todayStart = new Date(today.setHours(0, 0, 0, 0)).getTime() / 1000
      const todayEnd = new Date(today.setHours(23, 59, 59, 999)).getTime() / 1000
      
      const cashTodayResult = await dbInstance
        .select({
          total: sql<number>`COALESCE(SUM(${payments.amount_paid}), 0)`
        })
        .from(payments)
        .where(
          and(
            gte(payments.payment_date, toDate(todayStart)),
            lte(payments.payment_date, toDate(todayEnd)),
            eq(payments.is_deleted, false),
            eq(payments.has_been_canceled, false),
            eq(payments.payment_method, 'cash')
          )
        )
        .get()
      
      const cashAtHand = Number(cashTodayResult?.total || 0)

      // Bank balance (from non-cash payments)
      const bankTodayResult = await dbInstance
        .select({
          total: sql<number>`COALESCE(SUM(${payments.amount_paid}), 0)`
        })
        .from(payments)
        .where(
          and(
            gte(payments.payment_date, toDate(todayStart)),
            lte(payments.payment_date, toDate(todayEnd)),
            eq(payments.is_deleted, false),
            eq(payments.has_been_canceled, false),
            sql`${payments.payment_method} != 'cash'`
          )
        )
        .get()
      
      const bankBalance = Number(bankTodayResult?.total || 0)

      // Accounts Receivable (outstanding debt)
      const accountsReceivableResult = await dbInstance
        .select({
          total: sql<number>`COALESCE(SUM(
            ${sales.total_price} - COALESCE((
              SELECT SUM(${payments.amount_paid})
              FROM ${payments}
              WHERE ${payments.sale_id} = ${sales.id}
              AND ${payments.is_deleted} = 0
              AND ${payments.has_been_canceled} = 0
            ), 0)
          ), 0)`
        })
        .from(sales)
        .where(
          and(
            eq(sales.is_debt_sale, true),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const accountsReceivable = Number(accountsReceivableResult?.total || 0)

      // Accounts Payable (simplified - from unpaid purchases)
      const accountsPayableResult = await dbInstance
        .select({
          total: sql<number>`COALESCE(SUM(${stock_purchases.total_price_bought}), 0)`
        })
        .from(stock_purchases)
        .where(
          and(
            eq(stock_purchases.is_deleted, false),
            sql`NOT EXISTS (
              SELECT 1 FROM ${transactions} t
              WHERE t.transaction_type = 'cashout'
              AND t.description LIKE '%' || ${stock_purchases.id} || '%'
            )`
          )
        )
        .get()
      
      const accountsPayable = Number(accountsPayableResult?.total || 0)

      // Net cash position
      const netCashPosition = cashAtHand + bankBalance + accountsReceivable - accountsPayable

      // Cash runway (days until cash runs out)
      const monthlyBurnResult = await dbInstance
        .select({
          total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.transaction_type, 'cashout'),
            gte(transactions.created_on, toDate(lastMonth.start)),
            lte(transactions.created_on, toDate(lastMonth.end)),
            eq(transactions.is_deleted, false)
          )
        )
        .get()
      
      const monthlyBurn = Number(monthlyBurnResult?.total || 10000) // Default if no data
      const dailyBurn = monthlyBurn / 30
      const cashRunwayDays = dailyBurn > 0 ? (cashAtHand + bankBalance) / dailyBurn : 0

      // ==========================================================================
      // 2. PROFIT METRICS
      // ==========================================================================
      
      // Current month revenue
      const currentRevenueResult = await dbInstance
        .select({
          total: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, toDate(currentMonth.start)),
            lte(sales.sold_on, toDate(currentMonth.end)),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const currentRevenue = Number(currentRevenueResult?.total || 0)

      // Current month COGS
      const currentCogsResult = await dbInstance
        .select({
          total: sql<number>`COALESCE(SUM(${sales.cost_price_snapshot}), 0)`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, toDate(currentMonth.start)),
            lte(sales.sold_on, toDate(currentMonth.end)),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const currentCogs = Number(currentCogsResult?.total || 0)

      // Current month operating expenses (from transactions)
      const currentExpensesResult = await dbInstance
        .select({
          total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.transaction_type, 'cashout'),
            gte(transactions.created_on, toDate(currentMonth.start)),
            lte(transactions.created_on, toDate(currentMonth.end)),
            eq(transactions.is_deleted, false)
          )
        )
        .get()
      
      const currentExpenses = Number(currentExpensesResult?.total || 0)

      // Previous month for comparison
      const prevRevenueResult = await dbInstance
        .select({
          total: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, toDate(lastMonth.start)),
            lte(sales.sold_on, toDate(lastMonth.end)),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const prevRevenue = Number(prevRevenueResult?.total || 0)

      const prevCogsResult = await dbInstance
        .select({
          total: sql<number>`COALESCE(SUM(${sales.cost_price_snapshot}), 0)`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, toDate(lastMonth.start)),
            lte(sales.sold_on, toDate(lastMonth.end)),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const prevCogs = Number(prevCogsResult?.total || 0)

      const prevExpensesResult = await dbInstance
        .select({
          total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.transaction_type, 'cashout'),
            gte(transactions.created_on, toDate(lastMonth.start)),
            lte(transactions.created_on, toDate(lastMonth.end)),
            eq(transactions.is_deleted, false)
          )
        )
        .get()
      
      const prevExpenses = Number(prevExpensesResult?.total || 0)

      // Calculate profits
      const grossProfit = currentRevenue - currentCogs
      const operatingProfit = grossProfit - currentExpenses
      const netProfit = operatingProfit // Simplified - no taxes/investment income

      const prevGrossProfit = prevRevenue - prevCogs
      const prevOperatingProfit = prevGrossProfit - prevExpenses

      // Margins
      const grossMargin = currentRevenue > 0 ? (grossProfit / currentRevenue) * 100 : 0
      const operatingMargin = currentRevenue > 0 ? (operatingProfit / currentRevenue) * 100 : 0
      const netMargin = currentRevenue > 0 ? (netProfit / currentRevenue) * 100 : 0

      const prevGrossMargin = prevRevenue > 0 ? (prevGrossProfit / prevRevenue) * 100 : 0
      const grossMarginChange = calculateChange(grossMargin, prevGrossMargin)

      // ==========================================================================
      // 3. EXPENSE BREAKDOWN
      // ==========================================================================
      
      // Get expense categories from transactions
      const expenseCategories: ExpenseCategory[] = [
        {
          name: 'Cost of Goods',
          amount: currentCogs,
          percentage: currentRevenue > 0 ? (currentCogs / currentRevenue) * 100 : 0,
          color: '#ef4444'
        },
        {
          name: 'Salaries',
          amount: currentExpenses * 0.4, // Placeholder - 40% of operating expenses
          percentage: currentRevenue > 0 ? ((currentExpenses * 0.4) / currentRevenue) * 100 : 0,
          color: '#f97316'
        },
        {
          name: 'Rent & Utilities',
          amount: currentExpenses * 0.25, // Placeholder - 25% of operating expenses
          percentage: currentRevenue > 0 ? ((currentExpenses * 0.25) / currentRevenue) * 100 : 0,
          color: '#f59e0b'
        },
        {
          name: 'Marketing',
          amount: currentExpenses * 0.15, // Placeholder - 15% of operating expenses
          percentage: currentRevenue > 0 ? ((currentExpenses * 0.15) / currentRevenue) * 100 : 0,
          color: '#3b82f6'
        },
        {
          name: 'Shipping',
          amount: currentExpenses * 0.1, // Placeholder - 10% of operating expenses
          percentage: currentRevenue > 0 ? ((currentExpenses * 0.1) / currentRevenue) * 100 : 0,
          color: '#8b5cf6'
        },
        {
          name: 'Other',
          amount: currentExpenses * 0.1, // Placeholder - 10% of operating expenses
          percentage: currentRevenue > 0 ? ((currentExpenses * 0.1) / currentRevenue) * 100 : 0,
          color: '#6b7280'
        }
      ]

      // ==========================================================================
      // 4. PROFIT TRENDS (Last 12 months)
      // ==========================================================================
      
      const profitTrends: ProfitTrend[] = []
      
      for (let i = 11; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime() / 1000
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000
        
        const monthRevenueResult = await dbInstance
          .select({
            total: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`
          })
          .from(sales)
          .where(
            and(
              gte(sales.sold_on, toDate(monthStart)),
              lte(sales.sold_on, toDate(monthEnd)),
              eq(sales.is_deleted, false),
              eq(sales.has_been_canceled, false)
            )
          )
          .get()
        
        const monthRevenue = Number(monthRevenueResult?.total || 0)
        
        const monthCogsResult = await dbInstance
          .select({
            total: sql<number>`COALESCE(SUM(${sales.cost_price_snapshot}), 0)`
          })
          .from(sales)
          .where(
            and(
              gte(sales.sold_on, toDate(monthStart)),
              lte(sales.sold_on, toDate(monthEnd)),
              eq(sales.is_deleted, false),
              eq(sales.has_been_canceled, false)
            )
          )
          .get()
        
        const monthCogs = Number(monthCogsResult?.total || 0)
        
        const monthExpensesResult = await dbInstance
          .select({
            total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.transaction_type, 'cashout'),
              gte(transactions.created_on, toDate(monthStart)),
              lte(transactions.created_on, toDate(monthEnd)),
              eq(transactions.is_deleted, false)
            )
          )
          .get()
        
        const monthExpenses = Number(monthExpensesResult?.total || 0)
        
        const monthGross = monthRevenue - monthCogs
        const monthOperating = monthGross - monthExpenses
        
        profitTrends.push({
          period: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
          gross_profit: monthGross,
          operating_profit: monthOperating,
          net_profit: monthOperating,
          margin: monthRevenue > 0 ? (monthOperating / monthRevenue) * 100 : 0
        })
      }

      // ==========================================================================
      // 5. PROFITABILITY HEATMAP
      // ==========================================================================
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const productCategories = ['Beverages', 'Food', 'Electronics', 'Clothing', 'Accessories']
      
      const profitMatrix: number[][] = []
      
      for (let i = 0; i < productCategories.length; i++) {
        const row: number[] = []
        for (let j = 0; j < months.length; j++) {
          // Simulate margin data
          const baseMargin = 25 + (i * 3) + (j * 1.5)
          const randomVariance = Math.floor(Math.random() * 10) - 5
          row.push(Math.min(55, Math.max(10, baseMargin + randomVariance)))
        }
        profitMatrix.push(row)
      }
      
      const profitabilityHeatmap: HeatmapData = {
        matrix: profitMatrix,
        xAxis: months,
        yAxis: productCategories,
        metric: 'profit_margin_%',
        colors: ['#dc2626', '#f97316', '#facc15', '#4ade80', '#22c55e', '#16a34a'],
        min: 10,
        max: 55,
        insights: [
          'Electronics margins peak in November (holiday season)',
          'Beverages show consistent margins throughout the year',
          'Clothing margins dip in February (post-holiday clearance)'
        ]
      }

      // ==========================================================================
      // 6. BUILD FINAL RESPONSE
      // ==========================================================================
      
      const result: FinancialsData = {
        cash_flow: {
          cash_at_hand: {
            value: cashAtHand,
            formatted: formatCurrency(cashAtHand),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: 'stable',
            currency: 'XAF '
          },
          bank_balance: {
            value: bankBalance,
            formatted: formatCurrency(bankBalance),
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
            trend: accountsReceivable > 10000 ? 'up' : 'stable',
            currency: 'XAF '
          },
          accounts_payable: {
            value: accountsPayable,
            formatted: formatCurrency(accountsPayable),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: accountsPayable > 5000 ? 'up' : 'stable',
            currency: 'XAF '
          },
          net_cash_position: {
            value: netCashPosition,
            formatted: formatCurrency(netCashPosition),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: netCashPosition > 0 ? 'up' : 'down',
            currency: 'XAF '
          },
          cash_runway_days: {
            value: cashRunwayDays,
            formatted: Math.round(cashRunwayDays).toString(),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: cashRunwayDays > 90 ? 'up' : 'down'
          }
        },
        profit_metrics: {
          gross_profit: {
            value: grossProfit,
            formatted: formatCurrency(grossProfit),
            comparison_value: prevGrossProfit,
            change_percentage: calculateChange(grossProfit, prevGrossProfit),
            trend: getTrend(calculateChange(grossProfit, prevGrossProfit)),
            currency: 'XAF '
          },
          operating_profit: {
            value: operatingProfit,
            formatted: formatCurrency(operatingProfit),
            comparison_value: prevOperatingProfit,
            change_percentage: calculateChange(operatingProfit, prevOperatingProfit),
            trend: getTrend(calculateChange(operatingProfit, prevOperatingProfit)),
            currency: 'XAF '
          },
          net_profit: {
            value: netProfit,
            formatted: formatCurrency(netProfit),
            comparison_value: prevOperatingProfit,
            change_percentage: calculateChange(netProfit, prevOperatingProfit),
            trend: getTrend(calculateChange(netProfit, prevOperatingProfit)),
            currency: 'XAF '
          },
          gross_margin: {
            value: grossMargin,
            formatted: `${grossMargin.toFixed(1)}%`,
            percentage: grossMargin,
            comparison_value: prevGrossMargin,
            change_percentage: grossMarginChange,
            trend: getTrend(grossMarginChange)
          },
          operating_margin: {
            value: operatingMargin,
            formatted: `${operatingMargin.toFixed(1)}%`,
            percentage: operatingMargin,
            comparison_value: undefined,
            change_percentage: undefined,
            trend: operatingMargin > 15 ? 'up' : 'stable'
          },
          net_margin: {
            value: netMargin,
            formatted: `${netMargin.toFixed(1)}%`,
            percentage: netMargin,
            comparison_value: undefined,
            change_percentage: undefined,
            trend: netMargin > 10 ? 'up' : 'stable'
          }
        },
        expenses: {
          categories: expenseCategories,
          total: currentExpenses,
          vs_last_month: calculateChange(currentExpenses, prevExpenses)
        },
        profit_trends: profitTrends,
        profitability_heatmap: profitabilityHeatmap
      }

      const executionTime = Date.now() - startTime

      return {
        success: true,
        data: result,
        meta: {
          period: {
            total: currentRevenue,
            change_percentage: calculateChange(currentRevenue, prevRevenue),
            trend: getTrend(calculateChange(currentRevenue, prevRevenue))
          },
          execution_time_ms: executionTime
        }
      }

    } catch (error) {
      console.error('Error in financials:get-dashboard:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch financials dashboard'
      }
    }
  }
)