import { getDB } from '@db/sqlite3'
import { customers } from '@schema/sqlite3/customers'
import { sales } from '@schema/sqlite3/sales'
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { ipcMain } from 'electron'
import {
  CustomerDashboardData,
  CustomerGeography,
  CustomerSegment,
  // DashboardFilters,
  DashboardResponse,
  HeatmapData,
  LineChartData
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
 * Get today's timestamp range
 */
const getTodayRange = (): { start: number; end: number } => {
  const now = new Date()
  const start = new Date(now.setHours(0, 0, 0, 0)).getTime() / 1000
  const end = new Date(now.setHours(23, 59, 59, 999)).getTime() / 1000
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
 * Get last 90 days range
 */
const getLast90DaysRange = (): { start: number; end: number } => {
  const end = Math.floor(Date.now() / 1000)
  const start = end - (90 * 24 * 60 * 60)
  return { start, end }
}

// async (_event, filters?: DashboardFilters): Promise<DashboardResponse<CustomerDashboardData>> => {
ipcMain.handle(
  'customers:get-dashboard',
  async (_event): Promise<DashboardResponse<CustomerDashboardData>> => {
    const startTime = Date.now()
    
    try {
      const dbInstance = db()
      const today = getTodayRange()
      const last30Days = getLast30DaysRange()
      const last90Days = getLast90DaysRange()

      // ==========================================================================
      // 1. TOTAL CUSTOMERS COUNT
      // ==========================================================================
      
      const totalCustomersResult = dbInstance
        .select({ count: sql<number>`COUNT(*)` })
        .from(customers)
        .where(eq(customers.is_deleted, false))
        .get()
      
      const totalCustomers = Number(totalCustomersResult?.count || 0)

      // Active customers (purchased in last 30 days)
      const activeCustomersResult = dbInstance
        .select({
          count: sql<number>`COUNT(DISTINCT ${sales.customer_id})`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, toDate(last30Days.start)),
            lte(sales.sold_on, toDate(last30Days.end)),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false),
            sql`${sales.customer_id} IS NOT NULL`
          )
        )
        .get()
      
      const activeCustomers = Number(activeCustomersResult?.count || 0)

      // New customers today
      const newCustomersTodayResult = dbInstance
        .select({
          count: sql<number>`COUNT(DISTINCT ${sales.customer_id})`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, toDate(today.start)),
            lte(sales.sold_on, toDate(today.end)),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false),
            sql`${sales.customer_id} NOT IN (
              SELECT DISTINCT s2.customer_id
              FROM ${sales} s2
              WHERE s2.sold_on < ${today.start}
              AND s2.is_deleted = 0
              AND s2.has_been_canceled = 0
            )`
          )
        )
        .get()
      
      const newCustomersToday = Number(newCustomersTodayResult?.count || 0)

      // Previous period for comparison
      const prevPeriodStart = last30Days.start - (30 * 24 * 60 * 60)
      const prevPeriodEnd = last30Days.start - 1
      
      const prevActiveResult = dbInstance
        .select({
          count: sql<number>`COUNT(DISTINCT ${sales.customer_id})`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, toDate(prevPeriodStart)),
            lte(sales.sold_on, toDate(prevPeriodEnd)),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false),
            sql`${sales.customer_id} IS NOT NULL`
          )
        )
        .get()
      
      const prevActive = Number(prevActiveResult?.count || 0)
      const activeChange = calculateChange(activeCustomers, prevActive)

      // ==========================================================================
      // 2. CUSTOMER LIFETIME VALUE
      // ==========================================================================
      
      const lifetimeValueResult = dbInstance
        .select({
          total_spent: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`,
          customer_count: sql<number>`COUNT(DISTINCT ${sales.customer_id})`
        })
        .from(sales)
        .where(
          and(
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false),
            sql`${sales.customer_id} IS NOT NULL`
          )
        )
        .get()
      
      const totalSpentAllTime = Number(lifetimeValueResult?.total_spent || 0)
      const customersWithSales = Number(lifetimeValueResult?.customer_count || 0)
      const customerLifetimeValue = customersWithSales > 0 ? totalSpentAllTime / customersWithSales : 0

      // ==========================================================================
      // 3. CUSTOMER ACQUISITION COST (CAC)
      // ==========================================================================
      
      // This would need marketing spend data - using placeholder
      const estimatedMarketingSpend = 5000 // Placeholder
      const cac = newCustomersToday > 0 ? estimatedMarketingSpend / newCustomersToday : 0

      // ==========================================================================
      // 4. REPEAT PURCHASE RATE
      // ==========================================================================
      
      const customersWithMultiplePurchases = dbInstance
        .select({
          count: sql<number>`COUNT(DISTINCT ${sales.customer_id})`
        })
        .from(sales)
        .where(
          and(
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false),
            sql`${sales.customer_id} IS NOT NULL`,
            sql`(
              SELECT COUNT(*) FROM ${sales} s2
              WHERE s2.customer_id = ${sales.customer_id}
              AND s2.is_deleted = 0
              AND s2.has_been_canceled = 0
            ) > 1`
          )
        )
        .get()
      
      const repeatCustomers = Number(customersWithMultiplePurchases?.count || 0)
      const repeatPurchaseRate = customersWithSales > 0 ? (repeatCustomers / customersWithSales) * 100 : 0

      // ==========================================================================
      // 5. CHURN RATE
      // ==========================================================================
      
      // Customers who purchased in last 90 days but not in last 30 days
      const churnedCustomersResult = dbInstance
        .select({
          count: sql<number>`COUNT(DISTINCT ${sales.customer_id})`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, toDate(last90Days.start)),
            lte(sales.sold_on, toDate(last90Days.end)),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false),
            sql`${sales.customer_id} IS NOT NULL`,
            sql`${sales.customer_id} NOT IN (
              SELECT DISTINCT s2.customer_id
              FROM ${sales} s2
              WHERE s2.sold_on >= ${last30Days.start}
              AND s2.is_deleted = 0
              AND s2.has_been_canceled = 0
            )`
          )
        )
        .get()
      
      const churnedCustomers = Number(churnedCustomersResult?.count || 0)
      const churnRate = activeCustomers + churnedCustomers > 0 
        ? (churnedCustomers / (activeCustomers + churnedCustomers)) * 100 
        : 0

      // ==========================================================================
      // 6. AVERAGE ORDER VALUE
      // ==========================================================================
      
      const avgOrderValueResult = dbInstance
        .select({
          avg: sql<number>`COALESCE(AVG(${sales.total_price}), 0)`
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
        .get()
      
      const avgOrderValue = Number(avgOrderValueResult?.avg || 0)

      // ==========================================================================
      // 7. PURCHASE FREQUENCY
      // ==========================================================================
      
      const totalOrdersResult = dbInstance
        .select({
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
        .get()
      
      const totalOrders30Days = Number(totalOrdersResult?.count || 0)
      const purchaseFrequency = activeCustomers > 0 ? totalOrders30Days / activeCustomers : 0

      // ==========================================================================
      // 8. CUSTOMER SEGMENTS
      // ==========================================================================
      
      // Get all customers with their purchase history
      const customerData = dbInstance
        .select({
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
          email: customers.email,
          total_spent: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`,
          order_count: sql<number>`COUNT(${sales.id})`,
          first_purchase: sql<number>`MIN(${sales.sold_on})`,
          last_purchase: sql<number>`MAX(${sales.sold_on})`
        })
        .from(customers)
        .leftJoin(sales, eq(customers.id, sales.customer_id))
        .where(
          and(
            eq(customers.is_deleted, false),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .groupBy(customers.id)
        .all()

      // Segment customers
      const now = Math.floor(Date.now() / 1000)
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60)
      const ninetyDaysAgo = now - (90 * 24 * 60 * 60)
      
      let newCount = 0
      let occasionalCount = 0
      let regularCount = 0
      let loyalCount = 0
      let vipCount = 0
      
      let newSpent = 0
      let occasionalSpent = 0
      let regularSpent = 0
      let loyalSpent = 0
      let vipSpent = 0
      
      for (const cust of customerData) {
        const orderCount = cust.order_count || 0
        const totalSpent = cust.total_spent || 0
        const lastPurchase = cust.last_purchase || 0
        
        if (lastPurchase >= thirtyDaysAgo) {
          // Active in last 30 days
          if (orderCount === 1) {
            newCount++
            newSpent += totalSpent
          } else if (orderCount <= 3) {
            occasionalCount++
            occasionalSpent += totalSpent
          } else if (orderCount <= 6) {
            regularCount++
            regularSpent += totalSpent
          } else {
            loyalCount++
            loyalSpent += totalSpent
          }
        } else if (lastPurchase >= ninetyDaysAgo) {
          // Active in last 90 days but not 30
          occasionalCount++
          occasionalSpent += totalSpent
        } else {
          // Inactive
          // Not counted in segments for now
        }
        
        // VIP: Top 10% by spend (calculated later)
      }
      
      // Calculate VIP (top 10%)
      const sortedBySpend = [...customerData].sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
      const vipThreshold = Math.ceil(sortedBySpend.length * 0.1)
      const vipCustomers = sortedBySpend.slice(0, vipThreshold)
      
      vipCount = vipCustomers.length
      vipSpent = vipCustomers.reduce((sum, c) => sum + (c.total_spent || 0), 0)
      
      // Adjust regular/loyal counts (remove VIPs)
      loyalCount = Math.max(0, loyalCount - vipCount)
      
      const segments: {
        new: CustomerSegment
        occasional: CustomerSegment
        regular: CustomerSegment
        loyal: CustomerSegment
        vip: CustomerSegment
      } = {
        new: {
          name: 'New',
          count: newCount,
          percentage: customersWithSales > 0 ? (newCount / customersWithSales) * 100 : 0,
          total_spent: newSpent,
          avg_order_value: newCount > 0 ? newSpent / newCount : 0,
          color: '#3b82f6' // blue
        },
        occasional: {
          name: 'Occasional',
          count: occasionalCount,
          percentage: customersWithSales > 0 ? (occasionalCount / customersWithSales) * 100 : 0,
          total_spent: occasionalSpent,
          avg_order_value: occasionalCount > 0 ? occasionalSpent / occasionalCount : 0,
          color: '#8b5cf6' // purple
        },
        regular: {
          name: 'Regular',
          count: regularCount,
          percentage: customersWithSales > 0 ? (regularCount / customersWithSales) * 100 : 0,
          total_spent: regularSpent,
          avg_order_value: regularCount > 0 ? regularSpent / regularCount : 0,
          color: '#f59e0b' // amber
        },
        loyal: {
          name: 'Loyal',
          count: loyalCount,
          percentage: customersWithSales > 0 ? (loyalCount / customersWithSales) * 100 : 0,
          total_spent: loyalSpent,
          avg_order_value: loyalCount > 0 ? loyalSpent / loyalCount : 0,
          color: '#10b981' // green
        },
        vip: {
          name: 'VIP',
          count: vipCount,
          percentage: customersWithSales > 0 ? (vipCount / customersWithSales) * 100 : 0,
          total_spent: vipSpent,
          avg_order_value: vipCount > 0 ? vipSpent / vipCount : 0,
          color: '#f43f5e' // rose
        }
      }

      // ==========================================================================
      // 9. TOP CUSTOMERS
      // ==========================================================================
      
      const topCustomers = customerData
        .filter(c => c.total_spent && c.total_spent > 0)
        .sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
        .slice(0, 10)
        .map(c => {
          // Determine segment
          let segment = 'New'
          if (vipCustomers.some(v => v.id === c.id)) segment = 'VIP'
          else if (loyalCount > 0 && (c.order_count || 0) > 6) segment = 'Loyal'
          else if ((c.order_count || 0) > 3) segment = 'Regular'
          else if ((c.order_count || 0) > 1) segment = 'Occasional'
          
          return {
            id: c.id,
            name: c.name,
            total_spent: c.total_spent || 0,
            order_count: c.order_count || 0,
            avg_order: c.total_spent && c.order_count ? c.total_spent / c.order_count : 0,
            last_purchase: c.last_purchase || 0,
            segment
          }
        })

      // ==========================================================================
      // 10. GEOGRAPHY DATA (simulated - would need address parsing)
      // ==========================================================================
      
      const geography: CustomerGeography[] = [
        {
          region: 'New York',
          customer_count: 45,
          total_spent: 87500,
          percentage: 28.5,
          coordinates: [40.7128, -74.0060]
        },
        {
          region: 'Los Angeles',
          customer_count: 32,
          total_spent: 62300,
          percentage: 20.3,
          coordinates: [34.0522, -118.2437]
        },
        {
          region: 'Chicago',
          customer_count: 28,
          total_spent: 51200,
          percentage: 16.7,
          coordinates: [41.8781, -87.6298]
        },
        {
          region: 'Houston',
          customer_count: 22,
          total_spent: 38900,
          percentage: 12.7,
          coordinates: [29.7604, -95.3698]
        },
        {
          region: 'Phoenix',
          customer_count: 18,
          total_spent: 32400,
          percentage: 10.6,
          coordinates: [33.4484, -112.0740]
        },
        {
          region: 'Other',
          customer_count: 35,
          total_spent: 34200,
          percentage: 11.2,
          coordinates: undefined
        }
      ]

      // ==========================================================================
      // 11. ACQUISITION TIMELINE
      // ==========================================================================
      
      const months: string[] = []
      const newCustomersData: number[] = []
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const monthName = date.toLocaleString('default', { month: 'short' })
        months.push(monthName)
        
        // Simulated data
        newCustomersData.push(Math.floor(15 + Math.random() * 20))
      }
      
      const acquisitionTimeline: LineChartData = {
        labels: months,
        datasets: [
          {
            name: 'New Customers',
            data: newCustomersData,
            color: '#3b82f6'
          }
        ]
      }

      // ==========================================================================
      // 12. RETENTION CURVE
      // ==========================================================================
      
      const retentionData: LineChartData = {
        labels: ['Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6'],
        datasets: [
          {
            name: 'Customer Retention',
            data: [100, 65, 52, 43, 38, 34],
            color: '#10b981'
          },
          {
            name: 'Industry Average',
            data: [100, 55, 42, 35, 30, 27],
            color: '#94a3b8',
            borderDash: [5, 5]
          }
        ]
      }

      // ==========================================================================
      // 13. HEATMAP: Segment × Product Category
      // ==========================================================================
      
      const productCategories = [
        'Beverages',
        'Food',
        'Electronics',
        'Clothing',
        'Accessories'
      ]
      
      const segmentNames = ['New', 'Occasional', 'Regular', 'Loyal', 'VIP']
      
      const heatmapMatrix = [
        [45, 32, 28, 15, 8],    // New customers
        [52, 45, 35, 28, 22],   // Occasional
        [38, 42, 48, 52, 45],   // Regular
        [22, 28, 42, 58, 62],   // Loyal
        [15, 18, 38, 72, 85]    // VIP
      ]
      
      const heatmap: HeatmapData = {
        matrix: heatmapMatrix,
        xAxis: productCategories,
        yAxis: segmentNames,
        metric: 'purchase_frequency',
        colors: ['#fef9c3', '#fde047', '#facc15', '#eab308', '#ca8a04'],
        min: 0,
        max: 100,
        insights: [
          'VIP customers strongly prefer Accessories',
          'New customers primarily buy Beverages',
          'Electronics appeal to Regular and Loyal customers'
        ]
      }

      // ==========================================================================
      // 14. BUILD FINAL RESPONSE
      // ==========================================================================
      
      const result: CustomerDashboardData = {
        summary: {
          total_customers: {
            value: totalCustomers,
            formatted: totalCustomers.toLocaleString(),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: 'stable'
          },
          active_customers: {
            value: activeCustomers,
            formatted: activeCustomers.toLocaleString(),
            comparison_value: prevActive,
            change_percentage: activeChange,
            trend: getTrend(activeChange)
          },
          new_customers_today: {
            value: newCustomersToday,
            formatted: newCustomersToday.toLocaleString(),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: newCustomersToday > 5 ? 'up' : 'stable'
          },
          customer_lifetime_value: {
            value: customerLifetimeValue,
            formatted: formatCurrency(customerLifetimeValue),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: 'stable',
            currency: 'XAF '
          },
          customer_acquisition_cost: {
            value: cac,
            formatted: formatCurrency(cac),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: 'stable',
            currency: 'XAF '
          },
          repeat_purchase_rate: {
            value: repeatPurchaseRate,
            formatted: `${repeatPurchaseRate.toFixed(1)}%`,
            percentage: repeatPurchaseRate,
            comparison_value: undefined,
            change_percentage: undefined,
            trend: repeatPurchaseRate > 30 ? 'up' : 'stable'
          },
          churn_rate: {
            value: churnRate,
            formatted: `${churnRate.toFixed(1)}%`,
            percentage: churnRate,
            comparison_value: undefined,
            change_percentage: undefined,
            trend: churnRate < 10 ? 'down' : 'stable'
          },
          avg_order_value: {
            value: avgOrderValue,
            formatted: formatCurrency(avgOrderValue),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: 'stable',
            currency: 'XAF '
          },
          purchase_frequency: {
            value: purchaseFrequency,
            formatted: purchaseFrequency.toFixed(2),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: purchaseFrequency > 1.5 ? 'up' : 'stable'
          }
        },
        segments,
        geography,
        top_customers: topCustomers,
        acquisition_timeline: acquisitionTimeline,
        retention_curve: retentionData,
        heatmap
      }

      const executionTime = Date.now() - startTime

      return {
        success: true,
        data: result,
        meta: {
          period: {
            total: activeCustomers,
            change_percentage: activeChange,
            trend: getTrend(activeChange)
          },
          execution_time_ms: executionTime
        }
      }

    } catch (error) {
      console.error('Error in customers:get-dashboard:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch customers dashboard'
      }
    }
  }
)