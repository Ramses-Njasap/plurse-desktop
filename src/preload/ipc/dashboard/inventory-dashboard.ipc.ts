import { getDB } from '@db/sqlite3'
import { products, sku, stock_purchases, suppliers } from '@schema/sqlite3/products'
import { sales } from '@schema/sqlite3/sales'
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { ipcMain } from 'electron'
import {
  // DashboardFilters,
  DashboardResponse,
  HeatmapData,
  InventoryAgingBucket,
  InventoryDashboardData,
  InventoryHealthScore,
  LineChartData,
  ReorderSuggestion
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
const getTrend = (change: number): 'up' | 'down' | 'stable' => {
  if (change > 1) return 'up'
  if (change < -1) return 'down'
  return 'stable'
}

/**
 * Get last 30 days date range
 */
const getLast30DaysRange = (): { start: number; end: number } => {
  const end = Math.floor(Date.now() / 1000)
  const start = end - (30 * 24 * 60 * 60)
  return { start, end }
}

/**
 * Get last 90 days date range
 */
const getLast90DaysRange = (): { start: number; end: number } => {
  const end = Math.floor(Date.now() / 1000)
  const start = end - (90 * 24 * 60 * 60)
  return { start, end }
}

// async (_event, filters?: DashboardFilters): Promise<DashboardResponse<InventoryDashboardData>> => {

ipcMain.handle(
  'inventory:get-dashboard',
  async (_event): Promise<DashboardResponse<InventoryDashboardData>> => {
    const startTime = Date.now()
    
    try {
      const dbInstance = db()
      
      // ==========================================================================
      // 1. SUMMARY METRICS - TOTAL INVENTORY VALUE
      // ==========================================================================
      
      // Get all stock purchases with remaining quantity
      const stockPurchasesWithRemaining = dbInstance
        .select({
          id: stock_purchases.id,
          sku_id: stock_purchases.sku_id,
          quantity_bought: stock_purchases.quantity_bought,
          total_price_bought: stock_purchases.total_price_bought,
          shipping_cost: stock_purchases.shipping_cost,
          price_per_unit: stock_purchases.price_per_unit,
          purchased_on: stock_purchases.purchased_on,
          expiry_date: stock_purchases.expiry_date,
          batch_number: stock_purchases.batch_number,
          sku_name: sku.sku_name,
          sku_code: sku.code,
          product_id: sku.product_id,
          product_name: products.product_name,
          sold_quantity: sql<number>`COALESCE((
            SELECT SUM(${sales.quantity})
            FROM ${sales}
            WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
            AND ${sales.is_deleted} = 0
            AND ${sales.has_been_canceled} = 0
          ), 0)`.as('sold_quantity')
        })
        .from(stock_purchases)
        .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
        .innerJoin(products, eq(sku.product_id, products.id))
        .where(eq(stock_purchases.is_deleted, false))
        .all()

      // Calculate remaining quantities and values
      let totalInventoryValue = 0
      let totalUnits = 0
      let totalLandedCost = 0
      
      const inventoryItems = stockPurchasesWithRemaining.map(p => {
        const remaining = p.quantity_bought - p.sold_quantity
        const landedCostPerUnit = (p.total_price_bought + (p.shipping_cost || 0)) / p.quantity_bought
        const value = remaining * landedCostPerUnit
        
        if (remaining > 0) {
          totalInventoryValue += value
          totalUnits += remaining
          totalLandedCost += p.total_price_bought + (p.shipping_cost || 0)
        }
        
        return {
          ...p,
          remaining,
          value
        }
      }).filter(i => i.remaining > 0)

      // Get previous period value for trend (using last month's data)
      const lastMonthRange = getLast30DaysRange()
      
      const prevInventoryValueResult = dbInstance
        .select({
          total: sql<number>`COALESCE(SUM(
            (${stock_purchases.quantity_bought} - COALESCE((
              SELECT SUM(${sales.quantity})
              FROM ${sales}
              WHERE ${sales.stock_purchased_id} = ${stock_purchases.id}
              AND ${sales.is_deleted} = 0
              AND ${sales.has_been_canceled} = 0
              AND ${sales.sold_on} <= ${lastMonthRange.end}
            ), 0)) * 
            (${stock_purchases.total_price_bought} + COALESCE(${stock_purchases.shipping_cost}, 0)) / 
            NULLIF(${stock_purchases.quantity_bought}, 1)
          ), 0)`
        })
        .from(stock_purchases)
        .where(
          and(
            eq(stock_purchases.is_deleted, false),
            sql`${stock_purchases.purchased_on} <= ${lastMonthRange.end}`
          )
        )
        .get()
      
      const prevInventoryValue = Number(prevInventoryValueResult?.total || 0)
      const inventoryValueChange = calculateChange(totalInventoryValue, prevInventoryValue)

      // ==========================================================================
      // 2. INVENTORY HEALTH SCORE
      // ==========================================================================
      
      // Calculate factors for health score:
      // 1. Sell-through rate (higher = better)
      // 2. Stock-out rate (lower = better)
      // 3. Overstock rate (lower = better)
      // 4. Expiry risk (lower = better)
      
      // Sell-through rate (last 30 days)
      const last30Days = getLast30DaysRange()
      
      const sellThroughResult = dbInstance
        .select({
          sold: sql<number>`COALESCE(SUM(${sales.quantity}), 0)`,
          available: sql<number>`COALESCE(SUM(${stock_purchases.quantity_bought}), 0)`
        })
        .from(stock_purchases)
        .leftJoin(sales, eq(stock_purchases.id, sales.stock_purchased_id))
        .where(
          and(
            gte(stock_purchases.purchased_on, toDate(last30Days.start)),
            lte(stock_purchases.purchased_on, toDate(last30Days.end)),
            eq(stock_purchases.is_deleted, false)
          )
        )
        .get()
      
      const soldLast30Days = Number(sellThroughResult?.sold || 0)
      const availableLast30Days = Number(sellThroughResult?.available || 0)
      const sellThroughRate = availableLast30Days > 0 ? (soldLast30Days / availableLast30Days) * 100 : 0

      // Stock-out rate (SKUs with zero inventory)
      const totalSkus = dbInstance
        .select({ count: sql<number>`COUNT(*)` })
        .from(sku)
        .where(eq(sku.is_deleted, false))
        .get()
      
      const totalSkusCount = Number(totalSkus?.count || 0)

      const outOfStockSkus = dbInstance
        .select({ count: sql<number>`COUNT(DISTINCT ${sku.id})` })
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
      
      const outOfStockCount = Number(outOfStockSkus?.count || 0)
      const outOfStockRate = totalSkusCount > 0 ? (outOfStockCount / totalSkusCount) * 100 : 0

      // Overstock rate (SKUs with >90 days of inventory)
      const overstockCount = inventoryItems.filter(item => {
        const dailySales = soldLast30Days / 30
        return dailySales > 0 && (item.remaining / dailySales) > 90
      }).length
      
      const overstockRate = totalSkusCount > 0 ? (overstockCount / totalSkusCount) * 100 : 0

      // Expiry risk (items expiring in next 30 days)
      const now = Math.floor(Date.now() / 1000)
      const thirtyDaysFromNow = now + (30 * 24 * 60 * 60)
      
      const expiringSoonCount = inventoryItems.filter(item => 
        item.expiry_date && 
        Number(item.expiry_date) <= thirtyDaysFromNow &&
        Number(item.expiry_date) >= now
      ).length
      
      const expiryRiskRate = inventoryItems.length > 0 ? (expiringSoonCount / inventoryItems.length) * 100 : 0

      // Calculate health score (0-100)
      const sellThroughScore = Math.min(sellThroughRate, 100) * 0.3
      const stockOutScore = Math.max(0, 100 - outOfStockRate) * 0.25
      const overstockScore = Math.max(0, 100 - overstockRate) * 0.25
      const expiryScore = Math.max(0, 100 - expiryRiskRate) * 0.2
      
      const healthScoreValue = Math.round(sellThroughScore + stockOutScore + overstockScore + expiryScore)
      
      let healthLevel: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
      let healthColor: string
      
      if (healthScoreValue >= 90) {
        healthLevel = 'excellent'
        healthColor = '#10b981' // green
      } else if (healthScoreValue >= 75) {
        healthLevel = 'good'
        healthColor = '#3b82f6' // blue
      } else if (healthScoreValue >= 50) {
        healthLevel = 'fair'
        healthColor = '#f59e0b' // amber
      } else if (healthScoreValue >= 25) {
        healthLevel = 'poor'
        healthColor = '#f97316' // orange
      } else {
        healthLevel = 'critical'
        healthColor = '#ef4444' // red
      }
      
      const healthScore: InventoryHealthScore = {
        score: healthScoreValue,
        level: healthLevel,
        color: healthColor
      }

      // ==========================================================================
      // 3. TURNOVER RATE
      // ==========================================================================
      
      // Calculate COGS for last 30 days
      const cogsLast30DaysResult = dbInstance
        .select({
          cogs: sql<number>`COALESCE(SUM(
            (${stock_purchases.total_price_bought} + COALESCE(${stock_purchases.shipping_cost}, 0)) * 
            ${sales.quantity} / NULLIF(${stock_purchases.quantity_bought}, 1)
          ), 0)`
        })
        .from(sales)
        .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
        .where(
          and(
            gte(sales.sold_on, toDate(last30Days.start)),
            lte(sales.sold_on, toDate(last30Days.end)),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const cogsLast30Days = Number(cogsLast30DaysResult?.cogs || 0)
      
      // Calculate average inventory value for the period
      const avgInventoryValue = (totalInventoryValue + prevInventoryValue) / 2
      
      // Turnover rate = COGS / Average Inventory
      const turnoverRate = avgInventoryValue > 0 ? cogsLast30Days / avgInventoryValue : 0
      
      // Annualized turnover
      // const annualizedTurnover = turnoverRate * 12
      
      // Previous period turnover for comparison
      const prevTurnoverRate = 4.5 // Placeholder - would need historical calculation
      const turnoverChange = calculateChange(turnoverRate, prevTurnoverRate)

      // ==========================================================================
      // 4. DAYS OF INVENTORY
      // ==========================================================================
      
      const avgDailySales = soldLast30Days / 30
      const daysOfInventory = avgDailySales > 0 ? totalUnits / avgDailySales : 999

      // ==========================================================================
      // 5. SLOW MOVERS & DEAD STOCK
      // ==========================================================================
      
      // Slow movers: items with sell-through rate < 30% in last 90 days
      const last90Days = getLast90DaysRange()
      
      const slowMovers = inventoryItems.filter(item => {
        const itemSales = dbInstance
          .select({ sold: sql<number>`COALESCE(SUM(${sales.quantity}), 0)` })
          .from(sales)
          .where(
            and(
              eq(sales.stock_purchased_id, item.id),
              gte(sales.sold_on, toDate(last90Days.start)),
              lte(sales.sold_on, toDate(last90Days.end)),
              eq(sales.is_deleted, false),
              eq(sales.has_been_canceled, false)
            )
          )
          .get()
        
        const sold90Days = Number(itemSales?.sold || 0)
        const sellThrough90Days = item.quantity_bought > 0 ? (sold90Days / item.quantity_bought) * 100 : 0
        
        return sellThrough90Days < 30
      })
      
      const slowMoversCount = slowMovers.length
      // const slowMoversValue = slowMovers.reduce((sum, item) => sum + item.value, 0)

      // Dead stock: items with no sales in last 90 days
      const deadStock = inventoryItems.filter(item => {
        const itemSales = dbInstance
          .select({ sold: sql<number>`COALESCE(SUM(${sales.quantity}), 0)` })
          .from(sales)
          .where(
            and(
              eq(sales.stock_purchased_id, item.id),
              gte(sales.sold_on, toDate(last90Days.start)),
              lte(sales.sold_on, toDate(last90Days.end)),
              eq(sales.is_deleted, false),
              eq(sales.has_been_canceled, false)
            )
          )
          .get()
        
        return Number(itemSales?.sold || 0) === 0
      })
      
      const deadStockValue = deadStock.reduce((sum, item) => sum + item.value, 0)

      // ==========================================================================
      // 6. STOCK-TO-SALES RATIO
      // ==========================================================================
      
      const stockToSalesRatio = avgDailySales > 0 ? totalUnits / avgDailySales : 999

      // ==========================================================================
      // 7. STATUS BREAKDOWN
      // ==========================================================================
      
      const inStock = inventoryItems.filter(i => i.remaining > 0 && (i.remaining / (soldLast30Days / 30 || 1)) < 30).length
      const lowStock = inventoryItems.filter(i => {
        const dailySales = soldLast30Days / 30
        return dailySales > 0 && i.remaining > 0 && (i.remaining / dailySales) < 30 && (i.remaining / dailySales) > 0
      }).length
      const overstocked = inventoryItems.filter(i => {
        const dailySales = soldLast30Days / 30
        return dailySales > 0 && (i.remaining / dailySales) > 90
      }).length

      // ==========================================================================
      // 8. AGING ANALYSIS
      // ==========================================================================
      
      const agingBuckets: InventoryAgingBucket[] = [
        {
          range: '0-30 days',
          value: 0,
          percentage: 0,
          color: '#10b981',
          items_count: 0
        },
        {
          range: '31-60 days',
          value: 0,
          percentage: 0,
          color: '#3b82f6',
          items_count: 0
        },
        {
          range: '61-90 days',
          value: 0,
          percentage: 0,
          color: '#f59e0b',
          items_count: 0
        },
        {
          range: '90+ days',
          value: 0,
          percentage: 0,
          color: '#ef4444',
          items_count: 0
        }
      ]
      
      for (const item of inventoryItems) {
        const daysInInventory = (now - Number(item.purchased_on)) / (24 * 60 * 60)
        
        if (daysInInventory <= 30) {
          agingBuckets[0].value += item.value
          agingBuckets[0].items_count += item.remaining
        } else if (daysInInventory <= 60) {
          agingBuckets[1].value += item.value
          agingBuckets[1].items_count += item.remaining
        } else if (daysInInventory <= 90) {
          agingBuckets[2].value += item.value
          agingBuckets[2].items_count += item.remaining
        } else {
          agingBuckets[3].value += item.value
          agingBuckets[3].items_count += item.remaining
        }
      }
      
      // Calculate percentages
      const totalAgingValue = agingBuckets.reduce((sum, b) => sum + b.value, 0)
      for (const bucket of agingBuckets) {
        bucket.percentage = totalAgingValue > 0 ? (bucket.value / totalAgingValue) * 100 : 0
      }

      // ==========================================================================
      // 9. EXPIRY WATCH
      // ==========================================================================
      
      const expiryItems = inventoryItems
        .filter(item => item.expiry_date)
        .map(item => ({
          sku_id: item.sku_id,
          sku_name: item.sku_name,
          product_name: item.product_name,
          batch_number: item.batch_number || '',
          quantity: item.remaining,
          expiry_date: item.expiry_date!,
          days_until_expiry: Math.floor((Number(item.expiry_date) - now) / (24 * 60 * 60)),
          value_at_risk: item.value,
          cost: item.price_per_unit * item.remaining
        }))
        .filter(item => item.days_until_expiry > 0) // Only future expiries
      
      const expiryThisWeek = expiryItems.filter(i => i.days_until_expiry <= 7)
      const expiryThisMonth = expiryItems.filter(i => i.days_until_expiry <= 30 && i.days_until_expiry > 7)
      const expiryNextQuarter = expiryItems.filter(i => i.days_until_expiry <= 90 && i.days_until_expiry > 30)
      
      const totalAtRisk = [...expiryThisWeek, ...expiryThisMonth, ...expiryNextQuarter]
        .reduce((sum, i) => sum + i.value_at_risk, 0)

      // ==========================================================================
      // 10. REORDER SUGGESTIONS
      // ==========================================================================
      
      const reorderSuggestions: ReorderSuggestion[] = []
      
      // Group by SKU
      const skuGroups = new Map<number, typeof inventoryItems>()
      
      for (const item of inventoryItems) {
        if (!skuGroups.has(item.sku_id)) {
          skuGroups.set(item.sku_id, [])
        }
        skuGroups.get(item.sku_id)!.push(item)
      }
      
      for (const [skuId, items] of Array.from(skuGroups.entries())) {
        const totalRemaining = items.reduce((sum, i) => sum + i.remaining, 0)
        const dailySales = soldLast30Days / 30 // Would need SKU-specific calculation
        
        // Reorder point = 30 days of stock
        const reorderPoint = Math.ceil(dailySales * 30)
        
        if (totalRemaining < reorderPoint) {
          // Get supplier info
          const supplierInfo = dbInstance
            .select({
              supplier_id: stock_purchases.supplier_id,
              supplier_name: suppliers.supplier_name
            })
            .from(stock_purchases)
            .leftJoin(suppliers, eq(stock_purchases.supplier_id, suppliers.id))
            .where(eq(stock_purchases.sku_id, skuId))
            .limit(1)
            .get()
          
          const urgency = totalRemaining < reorderPoint * 0.3 ? 'immediate' :
                          totalRemaining < reorderPoint * 0.6 ? 'soon' : 'normal'
          
          reorderSuggestions.push({
            sku_id: skuId,
            sku_name: items[0].sku_name,
            current_stock: totalRemaining,
            reorder_point: reorderPoint,
            suggested_order: Math.ceil(reorderPoint * 1.5) - totalRemaining,
            supplier_id: supplierInfo?.supplier_id || undefined,
            supplier_name: supplierInfo?.supplier_name || undefined,
            urgency
          })
        }
      }
      
      // Sort by urgency
      reorderSuggestions.sort((a, b) => {
        const urgencyWeight = { immediate: 0, soon: 1, normal: 2 }
        return urgencyWeight[a.urgency] - urgencyWeight[b.urgency]
      })

      // ==========================================================================
      // 11. HEATMAP: SKU × Location (simulated - would need location data)
      // ==========================================================================
      
      // This would require a location/warehouse table in schema
      // For now, create a simulated heatmap based on product categories
      const categories = await dbInstance
        .select({
          id: products.category_id,
          name: sql<string>`'Category ' || ${products.category_id}`
        })
        .from(products)
        .groupBy(products.category_id)
        .limit(10)
        .all()
      
      const topSkus = inventoryItems.slice(0, 10)
      
      const heatmapMatrix: number[][] = []
      for (let i = 0; i < topSkus.length; i++) {
        const row: number[] = []
        for (let j = 0; j < categories.length; j++) {
          // Simulated value based on sell-through rate
          const item = topSkus[i]
          const dailySales = soldLast30Days / 30
          const value = dailySales > 0 ? Math.min(100, (item.remaining / dailySales) * 10) : 0
          row.push(Math.round(value))
        }
        heatmapMatrix.push(row)
      }
      
      const heatmap: HeatmapData = {
        matrix: heatmapMatrix,
        xAxis: categories.map(c => c.name),
        yAxis: topSkus.map(s => s.sku_name),
        metric: 'days_of_inventory',
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
        min: 0,
        max: 100,
        insights: [
          'Category 1 has highest inventory levels',
          'SKU "Coffee - Dark Roast" needs reordering',
          '3 SKUs have >60 days of inventory'
        ]
      }

      // ==========================================================================
      // 12. TRENDS CHART (Inventory value over time)
      // ==========================================================================
      
      // Get monthly inventory value for last 6 months
      const months: string[] = []
      const values: number[] = []
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const monthName = date.toLocaleString('default', { month: 'short' })
        months.push(monthName)
        
        // Simulated data - would need historical snapshots
        values.push(totalInventoryValue * (0.8 + (i * 0.04)))
      }
      
      const trends: LineChartData = {
        labels: months,
        datasets: [
          {
            name: 'Inventory Value',
            data: values,
            color: '#3b82f6'
          },
          {
            name: 'Target',
            data: values.map(v => v * 0.9),
            color: '#10b981',
            borderDash: [5, 5]
          }
        ]
      }

      // ==========================================================================
      // 13. BUILD FINAL RESPONSE
      // ==========================================================================
      
      const result: InventoryDashboardData = {
        summary: {
          total_value: {
            value: totalInventoryValue,
            formatted: formatCurrency(totalInventoryValue),
            comparison_value: prevInventoryValue,
            change_percentage: inventoryValueChange,
            trend: getTrend(inventoryValueChange),
            currency: 'XAF '
          },
          total_units: {
            value: totalUnits,
            formatted: totalUnits.toLocaleString(),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: 'stable'
          },
          health_score: healthScore,
          turnover_rate: {
            value: turnoverRate,
            formatted: turnoverRate.toFixed(2),
            comparison_value: prevTurnoverRate,
            change_percentage: turnoverChange,
            trend: getTrend(turnoverChange)
          },
          days_of_inventory: {
            value: daysOfInventory,
            formatted: Math.round(daysOfInventory).toString(),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: daysOfInventory > 60 ? 'up' : 'stable'
          },
          slow_movers_count: {
            value: slowMoversCount,
            formatted: slowMoversCount.toString(),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: slowMoversCount > 10 ? 'up' : 'stable'
          },
          dead_stock_value: {
            value: deadStockValue,
            formatted: formatCurrency(deadStockValue),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: deadStockValue > 1000 ? 'up' : 'stable',
            currency: 'XAF '
          },
          stock_to_sales_ratio: {
            value: stockToSalesRatio,
            formatted: stockToSalesRatio.toFixed(1),
            comparison_value: undefined,
            change_percentage: undefined,
            trend: stockToSalesRatio > 60 ? 'up' : 'stable'
          }
        },
        status_breakdown: {
          in_stock: inStock,
          low_stock: lowStock,
          out_of_stock: outOfStockCount,
          overstocked: overstocked
        },
        aging_analysis: agingBuckets,
        expiry_watch: {
          this_week: expiryThisWeek.map(i => ({
            sku_id: i.sku_id,
            sku_name: i.sku_name,
            product_name: i.product_name,
            batch_number: i.batch_number,
            quantity: i.quantity,
            expiry_date: i.expiry_date,
            days_until_expiry: i.days_until_expiry,
            value_at_risk: i.value_at_risk,
            cost: i.cost
          })),
          this_month: expiryThisMonth.map(i => ({
            sku_id: i.sku_id,
            sku_name: i.sku_name,
            product_name: i.product_name,
            batch_number: i.batch_number,
            quantity: i.quantity,
            expiry_date: i.expiry_date,
            days_until_expiry: i.days_until_expiry,
            value_at_risk: i.value_at_risk,
            cost: i.cost
          })),
          next_quarter: expiryNextQuarter.map(i => ({
            sku_id: i.sku_id,
            sku_name: i.sku_name,
            product_name: i.product_name,
            batch_number: i.batch_number,
            quantity: i.quantity,
            expiry_date: i.expiry_date,
            days_until_expiry: i.days_until_expiry,
            value_at_risk: i.value_at_risk,
            cost: i.cost
          })),
          total_at_risk: {
            value: totalAtRisk,
            formatted: formatCurrency(totalAtRisk),
            currency: 'XAF '
          }
        },
        reorder_suggestions: reorderSuggestions,
        heatmap,
        trends
      }

      const executionTime = Date.now() - startTime

      return {
        success: true,
        data: result,
        meta: {
          period: {
            total: totalInventoryValue,
            change_percentage: inventoryValueChange,
            trend: getTrend(inventoryValueChange)
          },
          execution_time_ms: executionTime
        }
      }

    } catch (error) {
      console.error('Error in inventory:get-dashboard:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch inventory dashboard'
      }
    }
  }
)