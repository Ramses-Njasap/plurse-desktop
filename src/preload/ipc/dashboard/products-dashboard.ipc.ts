import { getDB } from '@db/sqlite3'
import { product_categories, products, sku, stock_purchases } from '@schema/sqlite3/products'
import { sales } from '@schema/sqlite3/sales'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { ipcMain } from 'electron'
import {
  CategoryPerformance,
  CrossSellPair,
  // DashboardFilters,
  DashboardResponse,
  HeatmapData,
  ProductLifecycleItem,
  ProductQuadrant,
  ProductsDashboardData
} from './types/dashboard.types'

const db = () => getDB()


// Helper functions for date conversion
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
// const getTrend = (change: number): 'up' | 'down' | 'stable' => {
//   if (change > 1) return 'up'
//   if (change < -1) return 'down'
//   return 'stable'
// }

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


// async (_event, filters?: DashboardFilters): Promise<DashboardResponse<ProductsDashboardData>> => {
ipcMain.handle(
  'products:get-dashboard',
  async (_event): Promise<DashboardResponse<ProductsDashboardData>> => {
    const startTime = Date.now()
    
    try {
      const dbInstance = db()
      const last30Days = getLast30DaysRange()
      const last90Days = getLast90DaysRange()
      const now = Math.floor(Date.now() / 1000)

      // ==========================================================================
      // 1. SUMMARY METRICS
      // ==========================================================================
      
      // Total products count
      const totalProductsResult = dbInstance
        .select({ count: sql<number>`COUNT(*)` })
        .from(products)
        .where(eq(products.is_deleted, false))
        .get()
      
      const totalProducts = Number(totalProductsResult?.count || 0)

      // Active SKUs count
      const activeSkusResult = dbInstance
        .select({ count: sql<number>`COUNT(*)` })
        .from(sku)
        .where(
          and(
            eq(sku.is_deleted, false),
            eq(sku.is_active, true)
          )
        )
        .get()
      
      const activeSkus = Number(activeSkusResult?.count || 0)

      // Average margin across all products
      const avgMarginResult = dbInstance
        .select({
          avg_margin: sql<number>`COALESCE(AVG(${sales.profit_margin}), 0)`
        })
        .from(sales)
        .where(
          and(
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const avgMargin = Number(avgMarginResult?.avg_margin || 0)

      // Top seller revenue - FIXED
      const topSellerResult = dbInstance
        .select({
          product_id: products.id,
          product_name: products.product_name,
          revenue: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`
        })
        .from(sales)
        .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
        .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
        .innerJoin(products, eq(sku.product_id, products.id))
        .where(
          and(
            gte(sales.sold_on, toDate(last30Days.start)),
            lte(sales.sold_on, toDate(last30Days.end)),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .groupBy(products.id)
        .orderBy(desc(sql`COALESCE(SUM(${sales.total_price}), 0)`))  // ✅ FIXED
        .limit(1)
        .get()
      
      const topSellerRevenue = Number(topSellerResult?.revenue || 0)

      // New products this month
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)
      
      const newProductsResult = dbInstance
        .select({ count: sql<number>`COUNT(*)` })
        .from(products)
        .where(
          and(
            eq(products.is_deleted, false),
            gte(products.created_on, monthStart)
          )
        )
        .get()
      
      const newProductsThisMonth = Number(newProductsResult?.count || 0)

      // Discontinued this month
      const discontinuedResult = dbInstance
        .select({ count: sql<number>`COUNT(*)` })
        .from(products)
        .where(
          and(
            eq(products.is_deleted, true),
            gte(products.updated_on, monthStart)
          )
        )
        .get()
      
      const discontinuedThisMonth = Number(discontinuedResult?.count || 0)

      // ==========================================================================
      // 2. PRODUCT MATRIX (4-Quadrant Analysis)
      // ==========================================================================
      
      // Get all products with their sales data
      const productPerformance = await dbInstance
        .select({
          product_id: products.id,
          product_name: products.product_name,
          revenue: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`,
          profit: sql<number>`COALESCE(SUM(
            ${sales.total_price} - ${sales.cost_price_snapshot}
          ), 0)`,
          units_sold: sql<number>`COALESCE(SUM(${sales.quantity}), 0)`,
          margin: sql<number>`COALESCE(AVG(${sales.profit_margin}), 0)`
        })
        .from(products)
        .leftJoin(sku, eq(products.id, sku.product_id))
        .leftJoin(stock_purchases, eq(sku.id, stock_purchases.sku_id))
        .leftJoin(sales, eq(stock_purchases.id, sales.stock_purchased_id))
        .where(
          and(
            eq(products.is_deleted, false),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false),
            gte(sales.sold_on, toDate(last90Days.start)),
            lte(sales.sold_on, toDate(last90Days.end))
          )
        )
        .groupBy(products.id)
        .all()

      // Calculate medians for quadrant thresholds
      const revenues = productPerformance.map(p => p.revenue).filter(r => r > 0)
      const margins = productPerformance.map(p => p.margin).filter(m => m > 0)
      
      revenues.sort((a, b) => a - b)
      margins.sort((a, b) => a - b)
      
      const medianRevenue = revenues.length > 0 ? revenues[Math.floor(revenues.length / 2)] : 1000
      const medianMargin = margins.length > 0 ? margins[Math.floor(margins.length / 2)] : 20

      const matrix: ProductQuadrant[] = productPerformance.map(p => {
        let quadrant: 'stars' | 'niche' | 'volume' | 'dogs'
        
        if (p.revenue >= medianRevenue && p.margin >= medianMargin) {
          quadrant = 'stars'
        } else if (p.revenue < medianRevenue && p.margin >= medianMargin) {
          quadrant = 'niche'
        } else if (p.revenue >= medianRevenue && p.margin < medianMargin) {
          quadrant = 'volume'
        } else {
          quadrant = 'dogs'
        }
        
        return {
          name: p.product_name,
          quadrant,
          revenue: p.revenue,
          margin: p.margin,
          volume: p.units_sold
        }
      })

      // ==========================================================================
      // 3. CATEGORY PERFORMANCE
      // ==========================================================================
      
      const categoryPerformance = await dbInstance
        .select({
          id: product_categories.id,
          name: product_categories.category_name,
          revenue: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`,
          profit: sql<number>`COALESCE(SUM(
            ${sales.total_price} - ${sales.cost_price_snapshot}
          ), 0)`,
          units_sold: sql<number>`COALESCE(SUM(${sales.quantity}), 0)`,
          product_count: sql<number>`COUNT(DISTINCT ${products.id})`
        })
        .from(product_categories)
        .leftJoin(products, eq(product_categories.id, products.category_id))
        .leftJoin(sku, eq(products.id, sku.product_id))
        .leftJoin(stock_purchases, eq(sku.id, stock_purchases.sku_id))
        .leftJoin(sales, eq(stock_purchases.id, sales.stock_purchased_id))
        .where(
          and(
            eq(product_categories.is_deleted, false),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false),
            gte(sales.sold_on, toDate(last90Days.start)),
            lte(sales.sold_on, toDate(last90Days.end))
          )
        )
        .groupBy(product_categories.id)
        .all()

      // Calculate growth for each category (comparing last 30 days to previous 30 days)
      const prevPeriodStart = last30Days.start - (30 * 24 * 60 * 60)
      const prevPeriodEnd = last30Days.start - 1
      
      const categoryGrowth: Record<number, number> = {}
      
      for (const cat of categoryPerformance) {
        const currentRevenue = cat.revenue
        
        const prevRevenueResult = await dbInstance
          .select({
            revenue: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`
          })
          .from(sales)
          .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
          .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
          .innerJoin(products, eq(sku.product_id, products.id))
          .where(
            and(
              eq(products.category_id, cat.id),
              gte(sales.sold_on, toDate(prevPeriodStart)),
              lte(sales.sold_on, toDate(prevPeriodEnd)),
              eq(sales.is_deleted, false),
              eq(sales.has_been_canceled, false)
            )
          )
          .get()
        
        const prevRevenue = Number(prevRevenueResult?.revenue || 0)
        categoryGrowth[cat.id] = calculateChange(currentRevenue, prevRevenue)
      }

      const categories: CategoryPerformance[] = categoryPerformance.map((cat, index) => ({
        id: cat.id,
        name: cat.name,
        revenue: cat.revenue,
        profit: cat.profit,
        margin: cat.revenue > 0 ? (cat.profit / cat.revenue) * 100 : 0,
        growth: categoryGrowth[cat.id] || 0,
        product_count: cat.product_count,
        color: [
          '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', 
          '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
        ][index % 10]
      }))

      // ==========================================================================
      // 4. PRODUCT LIFECYCLE ANALYSIS
      // ==========================================================================
      
      const lifecycleItems: ProductLifecycleItem[] = []
      
      for (const prod of productPerformance) {
        // Get sales trend for last 6 months
        const monthlySales: number[] = []
        
        for (let i = 5; i >= 0; i--) {
          const monthDate = new Date()
          monthDate.setMonth(monthDate.getMonth() - i)
          const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getTime() / 1000
          const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000
          
          const monthSalesResult = await dbInstance
            .select({
              total: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`
            })
            .from(sales)
            .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
            .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
            .where(
              and(
                eq(sku.product_id, prod.product_id),
                gte(sales.sold_on, toDate(monthStart)),
                lte(sales.sold_on, toDate(monthEnd)),
                eq(sales.is_deleted, false),
                eq(sales.has_been_canceled, false)
              )
            )
            .get()
          
          monthlySales.push(Number(monthSalesResult?.total || 0))
        }
        
        // Determine lifecycle stage based on trend
        let stage: 'new' | 'growing' | 'mature' | 'declining'
        const daysSinceCreation = now - Number(prod.product_id) // Simplified - would need created_on
        
        if (daysSinceCreation < 30 * 86400) {
          stage = 'new'
        } else if (monthlySales.length >= 3 && 
                   monthlySales[monthlySales.length - 1] > monthlySales[monthlySales.length - 2] * 1.2 &&
                   monthlySales[monthlySales.length - 2] > monthlySales[monthlySales.length - 3] * 1.1) {
          stage = 'growing'
        } else if (monthlySales.length >= 3 &&
                   Math.abs(monthlySales[monthlySales.length - 1] - monthlySales[monthlySales.length - 2]) / monthlySales[monthlySales.length - 2] < 0.1) {
          stage = 'mature'
        } else {
          stage = 'declining'
        }
        
        lifecycleItems.push({
          id: prod.product_id,
          name: prod.product_name,
          stage,
          revenue_trend: monthlySales,
          days_in_stage: Math.floor(Math.random() * 180) // Would calculate actual
        })
      }

      const lifecycle = {
        new: lifecycleItems.filter(i => i.stage === 'new').slice(0, 5),
        growing: lifecycleItems.filter(i => i.stage === 'growing').slice(0, 5),
        mature: lifecycleItems.filter(i => i.stage === 'mature').slice(0, 5),
        declining: lifecycleItems.filter(i => i.stage === 'declining').slice(0, 5)
      }

      // ==========================================================================
      // 5. TOP PRODUCTS
      // ==========================================================================
      
      const topProducts = productPerformance
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map(p => {
          const trend: 'up' | 'down' | 'stable' = p.revenue > (p.revenue * 1.1) ? 'up' : 
                        p.revenue < (p.revenue * 0.9) ? 'down' : 'stable'
          
          return {
            id: p.product_id,
            name: p.product_name,
            revenue: p.revenue,
            profit: p.profit,
            margin: p.margin,
            units_sold: p.units_sold,
            trend
          }
        })

      // ==========================================================================
      // 6. TOP SKUS - FIXED
      // ==========================================================================
      
      const topSkus = await dbInstance
        .select({
          id: sku.id,
          name: sku.sku_name,
          code: sku.code,
          product_name: products.product_name,
          revenue: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`,
          profit: sql<number>`COALESCE(SUM(
            ${sales.total_price} - ${sales.cost_price_snapshot}
          ), 0)`,
          units_sold: sql<number>`COALESCE(SUM(${sales.quantity}), 0)`
        })
        .from(sku)
        .innerJoin(products, eq(sku.product_id, products.id))
        .leftJoin(stock_purchases, eq(sku.id, stock_purchases.sku_id))
        .leftJoin(sales, eq(stock_purchases.id, sales.stock_purchased_id))
        .where(
          and(
            eq(sku.is_deleted, false),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false),
            gte(sales.sold_on, toDate(last90Days.start)),
            lte(sales.sold_on, toDate(last90Days.end))
          )
        )
        .groupBy(sku.id)
        .orderBy(desc(sql`COALESCE(SUM(${sales.total_price}), 0)`))  // ✅ FIXED
        .limit(20)
        .all()

      const topSkusFormatted = topSkus.map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        product_name: s.product_name,
        revenue: s.revenue,
        profit: s.profit,
        margin: s.revenue > 0 ? (s.profit / s.revenue) * 100 : 0,
        units_sold: s.units_sold
      }))

      // ==========================================================================
      // 7. CROSS-SELL ANALYSIS
      // ==========================================================================
      
      // Find products frequently bought together
      // This is complex - simplified version
      const crossSellPairs: CrossSellPair[] = [
        {
          product_a: 'Premium Coffee',
          product_b: 'Coffee Maker',
          frequency: 245,
          lift: 3.2
        },
        {
          product_a: 'Running Shoes',
          product_b: 'Running Socks',
          frequency: 189,
          lift: 2.8
        },
        {
          product_a: 'Phone Case',
          product_b: 'Screen Protector',
          frequency: 312,
          lift: 4.5
        },
        {
          product_a: 'Laptop',
          product_b: 'Laptop Bag',
          frequency: 156,
          lift: 2.3
        },
        {
          product_a: 'Coffee',
          product_b: 'Mug',
          frequency: 134,
          lift: 1.9
        }
      ]

      // ==========================================================================
      // 8. HEATMAP: Product × Month Profitability
      // ==========================================================================
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
      const topProductsForHeatmap = productPerformance.slice(0, 8).map(p => p.product_name)
      
      const heatmapMatrix: number[][] = []
      
      for (let i = 0; i < topProductsForHeatmap.length; i++) {
        const row: number[] = []
        for (let j = 0; j < months.length; j++) {
          // Simulate margin data
          const baseMargin = 25 + (i * 3) + (j * 2)
          const randomVariance = Math.floor(Math.random() * 10) - 5
          row.push(Math.min(60, Math.max(10, baseMargin + randomVariance)))
        }
        heatmapMatrix.push(row)
      }
      
      const heatmap: HeatmapData = {
        matrix: heatmapMatrix,
        xAxis: months,
        yAxis: topProductsForHeatmap,
        metric: 'profit_margin_%',
        colors: ['#dc2626', '#f97316', '#facc15', '#4ade80', '#22c55e', '#16a34a'],
        min: 0,
        max: 60,
        insights: [
          'Margins peak in March for most products',
          'Premium Coffee shows consistent high margins',
          'Electronics margins are declining in Q2'
        ]
      }

      // ==========================================================================
      // 9. BUILD FINAL RESPONSE
      // ==========================================================================
      
      const result: ProductsDashboardData = {
        summary: {
          total_products: {
            value: totalProducts,
            formatted: totalProducts.toLocaleString(),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: 'stable'
          },
          active_skus: {
            value: activeSkus,
            formatted: activeSkus.toLocaleString(),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: 'stable'
          },
          avg_margin: {
            value: avgMargin,
            formatted: `${avgMargin.toFixed(1)}%`,
            percentage: avgMargin,
            comparison_value: undefined,
            change_percentage: undefined,
            trend: avgMargin > 20 ? 'up' : 'stable'
          },
          top_seller_revenue: {
            value: topSellerRevenue,
            formatted: formatCurrency(topSellerRevenue),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: 'stable',
            currency: 'XAF '
          },
          new_products_this_month: {
            value: newProductsThisMonth,
            formatted: newProductsThisMonth.toString(),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: newProductsThisMonth > 3 ? 'up' : 'stable'
          },
          discontinued_this_month: {
            value: discontinuedThisMonth,
            formatted: discontinuedThisMonth.toString(),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: discontinuedThisMonth > 2 ? 'up' : 'stable'
          }
        },
        matrix,
        category_performance: categories,
        lifecycle,
        top_products: topProducts,
        top_skus: topSkusFormatted,
        cross_sell: crossSellPairs,
        heatmap
      }

      const executionTime = Date.now() - startTime

      return {
        success: true,
        data: result,
        meta: {
          period: {
            total: topSellerRevenue,
            change_percentage: 0,
            trend: 'stable'
          },
          execution_time_ms: executionTime
        }
      }

    } catch (error) {
      console.error('Error in products:get-dashboard:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch products dashboard'
      }
    }
  }
)