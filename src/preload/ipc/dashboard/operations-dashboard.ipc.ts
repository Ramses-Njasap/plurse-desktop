import { getDB } from '@db/sqlite3'
import { employees } from '@schema/sqlite3/accounts'
import { stock_purchases, suppliers } from '@schema/sqlite3/products'
import { sales } from '@schema/sqlite3/sales'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { ipcMain } from 'electron'
import {
  BarChartData,
  // DashboardFilters,
  DashboardResponse,
  EmployeePerformance,
  OperationsData,
  SupplierPerformance
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
 * Get current month range
 */
const getCurrentMonthRange = (): { start: number; end: number } => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
  const end = Math.floor(Date.now() / 1000)
  return { start, end }
}

/**
 * Get last 30 days range
 */
const getLast30DaysRange = (): { start: number; end: number } => {
  const end = Math.floor(Date.now() / 1000)
  const start = end - (30 * 24 * 60 * 60)
  return { start, end }
}

/**
 * Get today's range
 */
// const getTodayRange = (): { start: number; end: number } => {
//   const now = new Date()
//   const start = new Date(now.setHours(0, 0, 0, 0)).getTime() / 1000
//   const end = new Date(now.setHours(23, 59, 59, 999)).getTime() / 1000
//   return { start, end }
// }


// async (_event, filters?: DashboardFilters): Promise<DashboardResponse<OperationsData>> => {
ipcMain.handle(
  'operations:get-dashboard',
  async (_event): Promise<DashboardResponse<OperationsData>> => {
    const startTime = Date.now()
    
    try {
      const dbInstance = db()
      const currentMonth = getCurrentMonthRange()
      const last30Days = getLast30DaysRange()
      // const today = getTodayRange()

      // ==========================================================================
      // 1. EMPLOYEE PERFORMANCE LEADERBOARD
      // ==========================================================================
      
      // Get all active employees
      const employeeList = await dbInstance
        .select({
          id: employees.id,
          name: sql<string>`${employees.first_name} || ' ' || ${employees.last_name}`,
          role: employees.role
        })
        .from(employees)
        .where(
          and(
            eq(employees.is_deleted, false),
            eq(employees.is_active, true)
          )
        )
        .all()

      const employeePerformance: EmployeePerformance[] = []

      for (const emp of employeeList) {
        // Get sales data for this employee
        const salesData = await dbInstance
          .select({
            revenue: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`,
            transactions: sql<number>`COUNT(*)`,
            items_sold: sql<number>`COALESCE(SUM(${sales.quantity}), 0)`,
            profit: sql<number>`COALESCE(SUM(
              ${sales.total_price} - ${sales.cost_price_snapshot}
            ), 0)`
          })
          .from(sales)
          .where(
            and(
              eq(sales.issued_by, emp.id),
              gte(sales.sold_on, toDate(currentMonth.start)),
              lte(sales.sold_on, toDate(currentMonth.end)),
              eq(sales.is_deleted, false),
              eq(sales.has_been_canceled, false)
            )
          )
          .get()

        const revenue = Number(salesData?.revenue || 0)
        const transactions = Number(salesData?.transactions || 0)
        const itemsSold = Number(salesData?.items_sold || 0)
        const profit = Number(salesData?.profit || 0)
        
        const avgTicket = transactions > 0 ? revenue / transactions : 0
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0

        // Get customer satisfaction (simulated)
        const customerSatisfaction = 85 + Math.floor(Math.random() * 10)

        // Determine badge based on performance
        let badge: string | undefined
        if (revenue > 50000) badge = '⭐ Top Performer'
        else if (margin > 25) badge = '💰 High Margin'
        else if (transactions > 100) badge = '📊 High Volume'

        employeePerformance.push({
          id: emp.id,
          name: emp.name,
          role: emp.role || 'Employee',
          sales: revenue,
          revenue,
          transactions,
          avg_ticket: avgTicket,
          items_sold: itemsSold,
          profit,
          margin,
          customer_satisfaction: customerSatisfaction,
          badge
        })
      }

      // Sort by revenue
      employeePerformance.sort((a, b) => b.revenue - a.revenue)

      // Best performer
      const bestPerformer = employeePerformance[0] || {
        id: 0,
        name: 'N/A',
        role: 'N/A',
        sales: 0,
        revenue: 0,
        transactions: 0,
        avg_ticket: 0,
        items_sold: 0,
        profit: 0,
        margin: 0
      }

      // Chart data
      const salesByEmployee: BarChartData = {
        labels: employeePerformance.slice(0, 5).map(e => e.name.split(' ')[0]),
        datasets: [
          {
            name: 'Revenue',
            data: employeePerformance.slice(0, 5).map(e => e.revenue),
            color: '#3b82f6'
          }
        ]
      }

      const revenueByEmployee: BarChartData = {
        labels: employeePerformance.slice(0, 5).map(e => e.name.split(' ')[0]),
        datasets: [
          {
            name: 'Profit',
            data: employeePerformance.slice(0, 5).map(e => e.profit),
            color: '#10b981'
          }
        ]
      }

      // ==========================================================================
      // 2. TRANSACTION METRICS
      // ==========================================================================
      
      // Overall metrics
      const overallMetrics = await dbInstance
        .select({
          revenue: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`,
          transactions: sql<number>`COUNT(*)`,
          items_sold: sql<number>`COALESCE(SUM(${sales.quantity}), 0)`
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

      const monthRevenue = Number(overallMetrics?.revenue || 0)
      const monthTransactions = Number(overallMetrics?.transactions || 0)
      const monthItemsSold = Number(overallMetrics?.items_sold || 0)

      const avgTransactionValue = monthTransactions > 0 ? monthRevenue / monthTransactions : 0
      const itemsPerTransaction = monthTransactions > 0 ? monthItemsSold / monthTransactions : 0

      // Peak hours
      const hourlyData = await dbInstance
        .select({
          hour: sql<number>`strftime('%H', ${sales.sold_on}, 'unixepoch')`.as('hour'),
          count: sql<number>`COUNT(*)`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, toDate(last30Days.start)),
            lte(sales.sold_on, toDate(last30Days.end)),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .groupBy(sql`strftime('%H', ${sales.sold_on}, 'unixepoch')`)
        .orderBy(desc(sql`count`))
        .limit(5)
        .all()

      const peakHours = hourlyData.map(h => ({
        hour: `${h.hour.toString().padStart(2, '0')}:00`,
        count: h.count
      }))

      // Abandoned carts (sales with pending status for > 1 hour)
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600
      
      const abandonedResult = await dbInstance
        .select({
          count: sql<number>`COUNT(*)`
        })
        .from(sales)
        .where(
          and(
            eq(sales.status, 'pending'),
            lte(sales.sold_on, toDate(oneHourAgo)),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()

      const abandonedCarts = Number(abandonedResult?.count || 0)

      // ==========================================================================
      // 3. SUPPLIER PERFORMANCE
      // ==========================================================================
      
      const supplierList = await dbInstance
        .select({
          id: suppliers.id,
          name: suppliers.supplier_name,
          contact: suppliers.contact_person,
          email: suppliers.email
        })
        .from(suppliers)
        .where(eq(suppliers.is_deleted, false))
        .all()

      const supplierPerformance: SupplierPerformance[] = []

      for (const sup of supplierList) {
        // Get purchase data
        const purchaseData = await dbInstance
          .select({
            total_spent: sql<number>`COALESCE(SUM(${stock_purchases.total_price_bought}), 0)`,
            order_count: sql<number>`COUNT(*)`,
            on_time: sql<number>`SUM(CASE 
              WHEN ${stock_purchases.arrived_on} <= ${stock_purchases.purchased_on} + 7*86400 
              THEN 1 ELSE 0 END
            )`
          })
          .from(stock_purchases)
          .where(eq(stock_purchases.supplier_id, sup.id))
          .get()

        const totalSpent = Number(purchaseData?.total_spent || 0)
        const orderCount = Number(purchaseData?.order_count || 0)
        const onTimeDeliveries = Number(purchaseData?.on_time || 0)

        // Calculate metrics
        const onTimeDelivery = orderCount > 0 ? (onTimeDeliveries / orderCount) * 100 : 100
        const orderAccuracy = 95 + Math.floor(Math.random() * 5) // Simulated
        const avgLeadTimeDays = 14 + Math.floor(Math.random() * 7) // Simulated
        const reliabilityScore = Math.floor((onTimeDelivery + orderAccuracy) / 20) // 0-10 scale

        supplierPerformance.push({
          id: sup.id,
          name: sup.name,
          on_time_delivery: {
            value: onTimeDelivery,
            formatted: `${onTimeDelivery.toFixed(0)}%`,
            percentage: onTimeDelivery,
            comparison_value: undefined,
            change_percentage: undefined,
            trend: onTimeDelivery > 90 ? 'up' : 'down'
          },
          order_accuracy: {
            value: orderAccuracy,
            formatted: `${orderAccuracy.toFixed(0)}%`,
            percentage: orderAccuracy,
            comparison_value: undefined,
            change_percentage: undefined,
            trend: orderAccuracy > 95 ? 'up' : 'stable'
          },
          avg_lead_time_days: {
            value: avgLeadTimeDays,
            formatted: avgLeadTimeDays.toString(),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: avgLeadTimeDays < 14 ? 'down' : 'up'
          },
          total_spent: {
            value: totalSpent,
            formatted: formatCurrency(totalSpent),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: 'stable',
            currency: 'XAF '
          },
          reliability_score: reliabilityScore
        })
      }

      // Sort by reliability
      supplierPerformance.sort((a, b) => b.reliability_score - a.reliability_score)

      // ==========================================================================
      // 4. BUILD FINAL RESPONSE
      // ==========================================================================
      
      const result: OperationsData = {
        employees: {
          leaderboard: employeePerformance,
          best_performer: bestPerformer,
          charts: {
            sales_by_employee: salesByEmployee,
            revenue_by_employee: revenueByEmployee
          }
        },
        transactions: {
          avg_transaction_value: {
            value: avgTransactionValue,
            formatted: formatCurrency(avgTransactionValue),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: avgTransactionValue > 50 ? 'up' : 'stable',
            currency: 'XAF '
          },
          items_per_transaction: {
            value: itemsPerTransaction,
            formatted: itemsPerTransaction.toFixed(1),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: itemsPerTransaction > 2 ? 'up' : 'stable'
          },
          transaction_count: {
            value: monthTransactions,
            formatted: monthTransactions.toString(),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: monthTransactions > 500 ? 'up' : 'stable'
          },
          peak_hours: peakHours,
          abandoned_carts: {
            value: abandonedCarts,
            formatted: abandonedCarts.toString(),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: abandonedCarts > 10 ? 'up' : 'stable'
          }
        },
        suppliers: supplierPerformance
      }

      const executionTime = Date.now() - startTime

      return {
        success: true,
        data: result,
        meta: {
          period: {
            total: monthRevenue,
            change_percentage: 0,
            trend: 'stable'
          },
          execution_time_ms: executionTime
        }
      }

    } catch (error) {
      console.error('Error in operations:get-dashboard:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch operations dashboard'
      }
    }
  }
)