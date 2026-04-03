import { getDB } from '@db/sqlite3'
import { customers } from '@schema/sqlite3/customers'
import { products, sku, stock_purchases } from '@schema/sqlite3/products'
import { payments, sales } from '@schema/sqlite3/sales'
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { ipcMain } from 'electron'
import {
  BarChartData,
  BatchSaleInfo,
  DailySalesBreakdown,
  DashboardFilters,
  DashboardResponse,
  DebtInfo,
  PaymentInfo,
  // PeriodType,
  PieChartData,
  ProductSaleInfo,
  SaleInfo,
  SalesComparison,
  SalesDashboardData,
  SkuSaleInfo
} from './types/dashboard.types'

const db = () => getDB()

/**
 * Format currency
 */
// const formatCurrency = (value: number): string => {
//   return new Intl.NumberFormat('en-US', {
//     style: 'currency',
//     currency: 'XAF',
//     minimumFractionDigits: 2
//   }).format(value)
// }

/**
 * Get date range based on period selection as Date objects
 */
const getDateRange = (date?: string | number): { start: Date; end: Date } => {
  const now = new Date()
  
  if (typeof date === 'number') {
    // Treat as timestamp and convert to Date
    const targetDate = new Date(date * 1000)
    const start = new Date(targetDate.setHours(0, 0, 0, 0))
    const end = new Date(targetDate.setHours(23, 59, 59, 999))
    return { start, end }
  }

  if (typeof date === 'string' && date.includes('-')) {
    // ISO date string
    const targetDate = new Date(date)
    const start = new Date(targetDate.setHours(0, 0, 0, 0))
    const end = new Date(targetDate.setHours(23, 59, 59, 999))
    return { start, end }
  }

  // Default to today
  const start = new Date(now.setHours(0, 0, 0, 0))
  const end = new Date(now.setHours(23, 59, 59, 999))
  return { start, end }
}

/**
 * Get previous period range for comparison
 */
const getPreviousPeriodRange = (start: Date, end: Date): { start: Date; end: Date } => {
  const startTimestamp = start.getTime() / 1000
  const endTimestamp = end.getTime() / 1000
  const duration = endTimestamp - startTimestamp
  
  const prevStart = new Date((startTimestamp - duration - 1) * 1000)
  const prevEnd = new Date((startTimestamp - 1) * 1000)
  
  return {
    start: prevStart,
    end: prevEnd
  }
}

/**
 * Format date for display
 */
const formatDateLabel = (timestamp: number): string => {
  return new Date(timestamp * 1000).toISOString().split('T')[0]
}

/**
 * Get week containing a date
 */
const getWeekRange = (timestamp: number): { start: Date; end: Date; days: Date[] } => {
  const date = new Date(timestamp * 1000)
  const dayOfWeek = date.getDay() // 0 = Sunday
  const diff = date.getDate() - dayOfWeek
  
  const sunday = new Date(date.setDate(diff))
  const saturday = new Date(date.setDate(diff + 6))
  
  const start = new Date(sunday.setHours(0, 0, 0, 0))
  const end = new Date(saturday.setHours(23, 59, 59, 999))
  
  // Get all days in between
  const days: Date[] = []
  for (let i = 0; i <= 6; i++) {
    const day = new Date((start.getTime() / 1000 + i * 86400) * 1000)
    days.push(new Date(day.setHours(0, 0, 0, 0)))
  }
  
  return { start, end, days }
}

/**
 * Helper to convert Date to timestamp
 */
const toTimestamp = (date: Date): number => Math.floor(date.getTime() / 1000)

/**
 * Helper to convert timestamp to Date
 */
const toDate = (timestamp: number): Date => new Date(timestamp * 1000)

ipcMain.handle(
  'sales:get-dashboard',
  async (_event, filters?: DashboardFilters): Promise<DashboardResponse<SalesDashboardData>> => {
    const startTime = Date.now()
    
    try {
      const dbInstance = db()
      
      // Determine period
      const periodType = filters?.period?.type || 'day'
      const periodValue = filters?.period?.value || 'today'
      
      let targetDate: number
      if (periodValue === 'today') {
        targetDate = Math.floor(Date.now() / 1000)
      } else if (typeof periodValue === 'string' && periodValue.includes('-')) {
        targetDate = new Date(periodValue).getTime() / 1000
      } else {
        targetDate = Number(periodValue) || Math.floor(Date.now() / 1000)
      }
      
      const dateRange = getDateRange(targetDate)
      const prevRange = getPreviousPeriodRange(dateRange.start, dateRange.end)
      
      // ==========================================================================
      // 1. GET FILTERED SALE IDs FIRST
      // ==========================================================================
      
      const filteredSales = dbInstance
        .select({ id: sales.id })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, dateRange.start),
            lte(sales.sold_on, dateRange.end),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .all()

      const saleIds = filteredSales.map(s => s.id)

      // ==========================================================================
      // 2. OVERALL SUMMARY (without cash_sales subquery)
      // ==========================================================================
      
      let currentTotal = 0
      let currentTransactions = 0
      let currentProfit = 0
      let currentDebtSales = 0
      let currentUniqueCustomers = 0
      let currentItemsSold = 0
      let currentCashSales = 0

      if (saleIds.length > 0) {
        // Main aggregates
        const summaryResult = dbInstance
          .select({
            total: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`,
            transactions: sql<number>`COUNT(*)`,
            profit: sql<number>`COALESCE(SUM(${sales.total_price} - ${sales.cost_price_snapshot}), 0)`,
            debt_sales: sql<number>`COALESCE(SUM(CASE 
              WHEN ${sales.is_debt_sale} = 1 THEN ${sales.total_price} ELSE 0 END
            ), 0)`,
            unique_customers: sql<number>`COUNT(DISTINCT ${sales.customer_id})`,
            items_sold: sql<number>`COALESCE(SUM(${sales.quantity}), 0)`
          })
          .from(sales)
          .where(inArray(sales.id, saleIds))
          .get()

        currentTotal = Number(summaryResult?.total || 0)
        currentTransactions = Number(summaryResult?.transactions || 0)
        currentProfit = Number(summaryResult?.profit || 0)
        currentDebtSales = Number(summaryResult?.debt_sales || 0)
        currentUniqueCustomers = Number(summaryResult?.unique_customers || 0)
        currentItemsSold = Number(summaryResult?.items_sold || 0)

        // Cash sales calculated directly from payments
        const cashSalesResult = dbInstance
          .select({
            total: sql<number>`COALESCE(SUM(${payments.amount_paid}), 0)`
          })
          .from(payments)
          .innerJoin(sales, eq(payments.sale_id, sales.id))
          .where(
            and(
              inArray(sales.id, saleIds),
              eq(payments.payment_method, 'cash'),
              eq(payments.is_deleted, false),
              eq(payments.has_been_canceled, false)
            )
          )
          .get()

        currentCashSales = Number(cashSalesResult?.total || 0)
      }

      // Previous period summary for comparison
      const prevSummaryResult = dbInstance
        .select({
          total: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`
        })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, prevRange.start),
            lte(sales.sold_on, prevRange.end),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const prevTotal = Number(prevSummaryResult?.total || 0)
      const changePercentage = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0
      
      const comparison: SalesComparison = {
        label: 'Previous Period',
        total: prevTotal,
        change_percentage: changePercentage,
        trend: changePercentage > 1 ? 'up' : changePercentage < -1 ? 'down' : 'stable'
      }

      // ==========================================================================
      // 3. PAYMENT METHOD BREAKDOWN (for pie chart)
      // ==========================================================================
      
      const paymentMethodsResult = saleIds.length > 0
        ? dbInstance
            .select({
              method: payments.payment_method,
              total: sql<number>`COALESCE(SUM(${payments.amount_paid}), 0)`
            })
            .from(payments)
            .innerJoin(sales, eq(payments.sale_id, sales.id))
            .where(
              and(
                inArray(sales.id, saleIds),
                eq(payments.is_deleted, false),
                eq(payments.has_been_canceled, false)
              )
            )
            .groupBy(payments.payment_method)
            .all()
        : []
      
      const paymentMethods: PieChartData = {
        labels: paymentMethodsResult.map(p => p.method),
        data: paymentMethodsResult.map(p => Number(p.total)),
        colors: [
          '#10b981', // cash - green
          '#3b82f6', // card - blue
          '#8b5cf6', // mobile money - purple
          '#f59e0b', // bank transfer - amber
          '#ef4444'  // other - red
        ]
      }

      // ==========================================================================
      // 4. HOURLY DISTRIBUTION (for bar chart)
      // ==========================================================================
      
      const hourlyResult = saleIds.length > 0
        ? dbInstance
            .select({
              hour: sql<number>`strftime('%H', ${sales.sold_on}, 'unixepoch')`.as('hour'),
              total: sql<number>`COALESCE(SUM(${sales.total_price}), 0)`
            })
            .from(sales)
            .where(
              and(
                inArray(sales.id, saleIds),
                eq(sales.is_deleted, false),
                eq(sales.has_been_canceled, false)
              )
            )
            .groupBy(sql`strftime('%H', ${sales.sold_on}, 'unixepoch')`)
            .orderBy(asc(sql`hour`))
            .all()
        : []
      
      const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
      const hourlyData = hours.map(hour => {
        const found = hourlyResult.find(h => h.hour.toString().padStart(2, '0') === hour)
        return Number(found?.total || 0)
      })
      
      const hourlyDistribution: BarChartData = {
        labels: hours.map(h => `${h}:00`),
        datasets: [
          {
            name: 'Revenue',
            data: hourlyData,
            color: '#3b82f6'
          }
        ]
      }

      // ==========================================================================
      // 5. GET ALL SALES FOR DRILL-DOWN
      // ==========================================================================
      
      const allSales = saleIds.length > 0
        ? dbInstance
            .select({
              // Sale fields
              sale_id: sales.id,
              quantity: sales.quantity,
              total_price: sales.total_price,
              sold_on: sales.sold_on,
              is_debt_sale: sales.is_debt_sale,
              customer_id: sales.customer_id,
              stock_purchased_id: sales.stock_purchased_id,
              cost_price_snapshot: sales.cost_price_snapshot,
              
              // Customer fields
              customer_name: customers.name,
              customer_phone: customers.phone,
              customer_email: customers.email,
              
              // Stock purchase fields
              batch_id: stock_purchases.id,
              batch_number: stock_purchases.batch_number,
              price_per_unit: stock_purchases.price_per_unit,
              quantity_bought: stock_purchases.quantity_bought,
              shipping_cost: stock_purchases.shipping_cost,
              min_selling_price: stock_purchases.min_selling_price,
              max_selling_price: stock_purchases.max_selling_price,
              expiry_date: stock_purchases.expiry_date,
              
              // SKU fields
              sku_id: sku.id,
              sku_name: sku.sku_name,
              sku_code: sku.code,
              
              // Product fields
              product_id: products.id,
              product_name: products.product_name,
              category_id: products.category_id
            })
            .from(sales)
            .innerJoin(stock_purchases, eq(sales.stock_purchased_id, stock_purchases.id))
            .innerJoin(sku, eq(stock_purchases.sku_id, sku.id))
            .innerJoin(products, eq(sku.product_id, products.id))
            .leftJoin(customers, eq(sales.customer_id, customers.id))
            .where(inArray(sales.id, saleIds))
            .orderBy(desc(sales.sold_on))
            .all()
        : []

      // ==========================================================================
      // 6. GET ALL PAYMENTS FOR THESE SALES
      // ==========================================================================
      
      const allPayments = saleIds.length > 0
        ? dbInstance
            .select({
              sale_id: payments.sale_id,
              payment_id: payments.id,
              amount: payments.amount_paid,
              method: payments.payment_method,
              reference: payments.reference_number,
              payment_date: payments.payment_date,
              recorded_by: payments.recorded_by
            })
            .from(payments)
            .where(
              and(
                inArray(payments.sale_id, saleIds),
                eq(payments.is_deleted, false),
                eq(payments.has_been_canceled, false)
              )
            )
            .orderBy(asc(payments.payment_date))
            .all()
        : []

      // Group payments by sale
      const paymentsBySale = new Map<number, PaymentInfo[]>()
      for (const payment of allPayments) {
        if (!paymentsBySale.has(payment.sale_id)) {
          paymentsBySale.set(payment.sale_id, [])
        }
        paymentsBySale.get(payment.sale_id)!.push({
          payment_id: payment.payment_id,
          amount: payment.amount,
          method: payment.method,
          reference: payment.reference || undefined,
          recorded_at: Math.floor(payment.payment_date.getTime() / 1000),
          status: 'completed',
          recorded_by: payment.recorded_by || undefined
        })
      }

      // ==========================================================================
      // 7. GROUP SALES BY DATE
      // ==========================================================================
      
      const salesByDate = new Map<string, typeof allSales>()
      
      for (const sale of allSales) {
        const dateKey = formatDateLabel(Math.floor(sale.sold_on.getTime() / 1000))
        if (!salesByDate.has(dateKey)) {
          salesByDate.set(dateKey, [])
        }
        salesByDate.get(dateKey)!.push(sale)
      }

      // ==========================================================================
      // 8. BUILD HIERARCHICAL STRUCTURE
      // ==========================================================================
      
      const breakdown: DailySalesBreakdown[] = []
      
      for (const [dateKey, daySales] of Array.from(salesByDate.entries()).sort()) {
        // Group by product
        const productsByProductId = new Map<number, typeof daySales>()
        
        for (const sale of daySales) {
          if (!productsByProductId.has(sale.product_id)) {
            productsByProductId.set(sale.product_id, [])
          }
          productsByProductId.get(sale.product_id)!.push(sale)
        }
        
        const productInfos: ProductSaleInfo[] = []
        let dayTotal = 0
        
        for (const [productId, productSales] of Array.from(productsByProductId.entries())) {
          const productName = productSales[0].product_name
          const categoryName = '' // Would need category lookup
          
          // Group by SKU within product
          const skusBySkuId = new Map<number, typeof productSales>()
          
          for (const sale of productSales) {
            if (!skusBySkuId.has(sale.sku_id)) {
              skusBySkuId.set(sale.sku_id, [])
            }
            skusBySkuId.get(sale.sku_id)!.push(sale)
          }
          
          const skuInfos: SkuSaleInfo[] = []
          let productTotal = 0
          let productProfit = 0
          let productUnits = 0
          
          for (const [skuId, skuSales] of Array.from(skusBySkuId.entries())) {
            const skuName = skuSales[0].sku_name
            const skuCode = skuSales[0].sku_code
            
            // Group by batch within SKU
            const batchesByBatchId = new Map<number, typeof skuSales>()
            
            for (const sale of skuSales) {
              if (!batchesByBatchId.has(sale.batch_id)) {
                batchesByBatchId.set(sale.batch_id, [])
              }
              batchesByBatchId.get(sale.batch_id)!.push(sale)
            }
            
            const batchInfos: BatchSaleInfo[] = []
            let skuTotal = 0
            let skuProfit = 0
            let skuUnits = 0
            
            for (const [batchId, batchSales] of Array.from(batchesByBatchId.entries())) {
              const batchNumber = batchSales[0].batch_number || ''
              const costPerUnit = batchSales[0].price_per_unit
              const expiryDate = batchSales[0].expiry_date
              
              // Calculate days to expiry
              const daysToExpiry = expiryDate
                ? Math.floor((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : undefined
              
              // Build sales for this batch
              const batchSalesInfos: SaleInfo[] = []
              let batchTotal = 0
              let batchProfit = 0
              let batchUnits = 0
              
              for (const sale of batchSales) {
                const payments = paymentsBySale.get(sale.sale_id) || []
                const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
                const profit = sale.total_price - (sale.quantity * costPerUnit)
                
                const debtInfo: DebtInfo = {
                  in_debt: sale.is_debt_sale === true,
                  total_debt: sale.is_debt_sale ? sale.total_price - totalPaid : undefined,
                  paid_amount: totalPaid,
                  balance_due: sale.is_debt_sale ? sale.total_price - totalPaid : undefined,
                  status: totalPaid >= sale.total_price ? 'paid' :
                          sale.is_debt_sale ? ((Math.floor(sale.sold_on.getTime() / 1000)) < (Date.now() / 1000 - 7*86400) ? 'overdue' : 'pending') : undefined
                }
                
                const saleInfo: SaleInfo = {
                  sale_id: sale.sale_id,
                  quantity: sale.quantity,
                  total_price: sale.total_price,
                  profit: profit,
                  profit_margin: (profit / sale.total_price) * 100,
                  sold_at: Math.floor(sale.sold_on.getTime() / 1000),
                  in_debt: sale.is_debt_sale === true,
                  debt_info: debtInfo.in_debt ? debtInfo : undefined,
                  customer: sale.customer_id ? {
                    id: sale.customer_id,
                    name: sale.customer_name || 'Unknown',
                    phone: sale.customer_phone || undefined,
                    email: sale.customer_email || undefined,
                    is_walk_in: !sale.customer_id
                  } : undefined,
                  payments
                }
                
                batchSalesInfos.push(saleInfo)
                batchTotal += sale.total_price
                batchProfit += profit
                batchUnits += sale.quantity
              }
              
              const avgSellingPrice = batchUnits > 0 ? batchTotal / batchUnits : 0
              
              const batchInfo: BatchSaleInfo = {
                batch_id: batchId,
                batch_number: batchNumber,
                total: batchTotal,
                units_sold: batchUnits,
                cost_per_unit: costPerUnit,
                selling_price: avgSellingPrice,
                profit_margin: batchTotal > 0 ? (batchProfit / batchTotal) * 100 : 0,
                expiry_date: expiryDate || undefined,
                days_to_expiry: daysToExpiry,
                sales: batchSalesInfos
              }
              
              batchInfos.push(batchInfo)
              skuTotal += batchTotal
              skuProfit += batchProfit
              skuUnits += batchUnits
            }
            
            const skuInfo: SkuSaleInfo = {
              sku_id: skuId,
              sku_name: skuName,
              code: skuCode,
              total: skuTotal,
              units_sold: skuUnits,
              profit: skuProfit,
              profit_margin: skuTotal > 0 ? (skuProfit / skuTotal) * 100 : 0,
              stock_purchases: batchInfos
            }
            
            skuInfos.push(skuInfo)
            productTotal += skuTotal
            productProfit += skuProfit
            productUnits += skuUnits
          }
          
          const productInfo: ProductSaleInfo = {
            product_id: productId,
            product_name: productName,
            category: categoryName,
            category_id: 0, // Would need category ID
            total: productTotal,
            percentage: 0, // Will calculate after day total
            profit: productProfit,
            profit_margin: productTotal > 0 ? (productProfit / productTotal) * 100 : 0,
            units_sold: productUnits,
            skus: skuInfos
          }
          
          productInfos.push(productInfo)
          dayTotal += productTotal
        }
        
        // Calculate percentages
        for (const product of productInfos) {
          product.percentage = dayTotal > 0 ? (product.total / dayTotal) * 100 : 0
        }
        
        breakdown.push({
          date: dateKey,
          total: dayTotal,
          products: productInfos
        })
      }

      // ==========================================================================
      // 9. WEEK NAVIGATION
      // ==========================================================================
      
      const weekRange = getWeekRange(targetDate)
      const weekDays = weekRange.days.map(day => {
        const dayTimestamp = toTimestamp(day)
        const daySales = allSales.filter(s => 
          toTimestamp(s.sold_on) >= dayTimestamp && toTimestamp(s.sold_on) <= dayTimestamp + 86399
        )
        const dayTotal = daySales.reduce((sum, s) => sum + s.total_price, 0)
        return {
          date: formatDateLabel(dayTimestamp),
          total: dayTotal
        }
      })

      const weekTotal = weekDays.reduce((sum, d) => sum + d.total, 0)

      // ==========================================================================
      // 10. PREVIOUS/NEXT NAVIGATION
      // ==========================================================================
      
      const previousDayDate = toTimestamp(dateRange.start) - 86400
      const nextDayDate = toTimestamp(dateRange.end) + 1
      
      const previousDaySales = dbInstance
        .select({ total: sql<number>`COALESCE(SUM(${sales.total_price}), 0)` })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, toDate(previousDayDate)),
            lte(sales.sold_on, toDate(previousDayDate + 86399)),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()
      
      const nextDaySales = dbInstance
        .select({ total: sql<number>`COALESCE(SUM(${sales.total_price}), 0)` })
        .from(sales)
        .where(
          and(
            gte(sales.sold_on, toDate(nextDayDate)),
            lte(sales.sold_on, toDate(nextDayDate + 86399)),
            eq(sales.is_deleted, false),
            eq(sales.has_been_canceled, false)
          )
        )
        .get()

      // ==========================================================================
      // 11. BUILD FINAL RESPONSE
      // ==========================================================================
      
      const result: SalesDashboardData = {
        period: {
          type: periodType,
          value: formatDateLabel(targetDate),
          label: periodValue === 'today' ? 'Today' : formatDateLabel(targetDate)
        },
        summary: {
          total: currentTotal,
          comparison: prevTotal > 0 ? comparison : undefined,
          total_transactions: currentTransactions,
          avg_ticket: currentTransactions > 0 ? currentTotal / currentTransactions : 0,
          total_profit: currentProfit,
          profit_margin: currentTotal > 0 ? (currentProfit / currentTotal) * 100 : 0,
          cash_sales: currentCashSales,
          debt_sales: currentDebtSales,
          debt_percentage: currentTotal > 0 ? (currentDebtSales / currentTotal) * 100 : 0,
          unique_customers: currentUniqueCustomers,
          items_sold: currentItemsSold
        },
        breakdown,
        navigation: {
          previous: previousDaySales?.total ? {
            date: formatDateLabel(previousDayDate),
            total: Number(previousDaySales.total),
            label: 'Yesterday'
          } : undefined,
          next: nextDaySales?.total ? {
            date: formatDateLabel(nextDayDate),
            total: Number(nextDaySales.total),
            label: 'Tomorrow'
          } : undefined,
          week: {
            start: formatDateLabel(toTimestamp(weekRange.start)),
            end: formatDateLabel(toTimestamp(weekRange.end)),
            total: weekTotal,
            days: weekDays
          }
        },
        payment_methods: paymentMethods,
        hourly_distribution: hourlyDistribution,
        alerts: [] // Would be populated from alerts handler
      }

      const executionTime = Date.now() - startTime

      return {
        success: true,
        data: result,
        meta: {
          period: {
            total: currentTotal,
            change_percentage: changePercentage,
            trend: changePercentage > 1 ? 'up' : changePercentage < -1 ? 'down' : 'stable'
          },
          execution_time_ms: executionTime
        }
      }

    } catch (error) {
      console.error('Error in sales:get-dashboard:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch sales dashboard'
      }
    }
  }
)