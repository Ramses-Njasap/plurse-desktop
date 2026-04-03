// components/dashboard-overview/types/types.ts

export type ModalType =
  | 'sales'
  | 'revenue'
  | 'profit'
  | 'debt'
  | 'inventory'
  | 'customers'
  | null

// ============================================================================
// SHARED DASHBOARD TYPES
// ============================================================================

// ----------------------------------------------------------------------------
// Period Types
// ----------------------------------------------------------------------------
export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 
                         'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 
                         'last_year' | 'custom'

export type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

export interface DateRange {
  from: number  // Unix timestamp
  to: number    // Unix timestamp
  label?: string
}

export interface PeriodSelection {
  type: PeriodType
  value?: string | number
  preset?: DatePreset
  range?: DateRange
  compare_with?: PeriodComparison
}

export interface PeriodComparison {
  type: PeriodType
  value?: string | number
  preset?: DatePreset
  range?: DateRange
  label: string
}

export interface PeriodSummary {
  total: number
  comparison_value?: number
  change_percentage?: number
  trend: 'up' | 'down' | 'stable'
}

// ============================================================================
// COMPARISON TYPES - NEW
// ============================================================================

export type ComparisonPeriod = 
  | 'today_vs_yesterday'
  | 'today_vs_2days'
  | 'today_vs_3days'
  | 'today_vs_4days'
  | 'today_vs_5days'
  | 'today_vs_6days'
  | 'today_vs_7days'
  | 'this_week_vs_last_week'
  | 'this_week_vs_2weeks'
  | 'this_week_vs_3weeks'
  | 'this_month_vs_last_month'
  | 'this_month_vs_3months'
  | 'this_month_vs_6months'
  | 'this_year_vs_last_year'
  | 'this_year_vs_2years'

export interface ComparisonResult {
  currentValue: number
  previousValue: number
  changePercentage: number
  trend: 'up' | 'down' | 'stable'
  label: string
}

// ----------------------------------------------------------------------------
// Metric Types
// ----------------------------------------------------------------------------
export interface MetricValue {
  value: number
  formatted: string
  comparison_value?: number
  change_percentage?: number
  trend?: 'up' | 'down' | 'stable'
}

export interface MetricWithTarget extends MetricValue {
  target: number
  progress_percentage: number
  on_track: boolean
}

export interface CurrencyMetric extends MetricValue {
  currency: string
}

export interface PercentageMetric extends MetricValue {
  percentage: number
}

// ----------------------------------------------------------------------------
// Alert Types
// ----------------------------------------------------------------------------
export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success'
export type AlertCategory = 'inventory' | 'debt' | 'sales' | 'financial' | 'customer' | 'system'

export interface DashboardAlert {
  id: string
  type: AlertCategory
  severity: AlertSeverity
  title: string
  message: string
  timestamp: number
  read: boolean
  actionable: boolean
  action?: {
    label: string
    handler: string
    payload?: any
  }
  metadata?: Record<string, any>
}

// ----------------------------------------------------------------------------
// Chart Data Types
// ----------------------------------------------------------------------------
export interface ChartDataPoint {
  label: string
  value: number
  formatted?: string
  secondary_value?: number
  color?: string
}

export interface LineChartData {
  labels: string[]
  datasets: Array<{
    name: string
    data: number[]
    color?: string
    borderDash?: number[]
  }>
}

export interface BarChartData {
  labels: string[]
  datasets: Array<{
    name: string
    data: number[]
    color?: string
    stack?: string
  }>
}

export interface PieChartData {
  labels: string[]
  data: number[]
  colors?: string[]
}

export interface HeatmapData {
  matrix: number[][]
  xAxis: string[]
  yAxis: string[]
  metric: string
  colors?: string[]
  min?: number
  max?: number
  insights?: string[]
}

export interface GaugeData {
  value: number
  min: number
  max: number
  target?: number
  thresholds?: {
    warning: number
    critical: number
  }
  colors?: {
    good: string
    warning: string
    critical: string
  }
}

// ----------------------------------------------------------------------------
// Pagination Types
// ----------------------------------------------------------------------------
export interface PaginationParams {
  page: number
  limit: number
  offset?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

// ----------------------------------------------------------------------------
// Filter Types
// ----------------------------------------------------------------------------
export interface DashboardFilters {
  period?: PeriodSelection
  categories?: number[]
  products?: number[]
  skus?: number[]
  customers?: number[]
  employees?: number[]
  payment_methods?: string[]
  status?: string[]
  min_amount?: number
  max_amount?: number
  search?: string
}

// ----------------------------------------------------------------------------
// Response Base
// ----------------------------------------------------------------------------
export interface DashboardResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  meta?: {
    period: PeriodSummary
    filters_applied?: DashboardFilters
    execution_time_ms: number
    cached?: boolean
  }
}

// ============================================================================
// HANDLER-SPECIFIC TYPES
// ============================================================================

// ----------------------------------------------------------------------------
// Overview Dashboard (Handler 1)
// ----------------------------------------------------------------------------
export interface ExecutiveSummary {
  revenue_today: CurrencyMetric
  revenue_mtd: CurrencyMetric
  profit_today: CurrencyMetric
  profit_mtd: CurrencyMetric
  cash_at_hand: CurrencyMetric
  accounts_receivable: CurrencyMetric
  accounts_payable: CurrencyMetric
  inventory_value: CurrencyMetric
  low_stock_count: MetricValue
  out_of_stock_count: MetricValue
  active_customers_today: MetricValue
  new_customers_today: MetricValue
  avg_transaction_value: CurrencyMetric
  transaction_count: MetricValue
}

export interface KpiProgress {
  revenue_target: MetricWithTarget
  profit_target: MetricWithTarget
  customer_target: MetricWithTarget
  inventory_target: MetricWithTarget
}

export interface OverviewDashboardData {
  summary: ExecutiveSummary
  kpis: KpiProgress
  alerts: DashboardAlert[]
  quick_actions: Array<{
    label: string
    handler: string
    icon: string
    count?: number
  }>
}

// ----------------------------------------------------------------------------
// Sales Dashboard (Handler 2)
// ----------------------------------------------------------------------------
export interface PaymentInfo {
  payment_id: number
  amount: number
  method: string
  reference?: string
  recorded_at: number
  status: 'completed' | 'pending' | 'failed'
  recorded_by?: number
}

export interface DebtInfo {
  in_debt: boolean
  total_debt?: number
  paid_amount?: number
  balance_due?: number
  due_date?: number
  days_until_due?: number
  overdue_days?: number
  status?: 'pending' | 'overdue' | 'paid' | 'partially_paid'
}

export interface SaleInfo {
  sale_id: number
  quantity: number
  total_price: number
  profit: number
  profit_margin: number
  sold_at: number
  in_debt: boolean
  debt_info?: DebtInfo
  customer?: {
    id: number
    name: string
    phone?: string
    email?: string
    is_walk_in: boolean
  }
  payments: PaymentInfo[]
}

export interface BatchSaleInfo {
  batch_id: number
  batch_number: string
  total: number
  units_sold: number
  cost_per_unit: number
  selling_price: number
  profit_margin: number
  expiry_date?: string
  days_to_expiry?: number
  sales: SaleInfo[]
}

export interface SkuSaleInfo {
  sku_id: number
  sku_name: string
  code: string
  total: number
  units_sold: number
  profit: number
  profit_margin: number
  stock_purchases: BatchSaleInfo[]
  attributes?: Array<{
    name: string
    value: string
    unit?: string
  }>
}

export interface ProductSaleInfo {
  product_id: number
  product_name: string
  category: string
  category_id: number
  total: number
  percentage: number
  profit: number
  profit_margin: number
  units_sold: number
  skus: SkuSaleInfo[]
}

export interface DailySalesBreakdown {
  date: string
  total: number
  products: ProductSaleInfo[]
}

export interface SalesComparison {
  label: string
  total: number
  change_percentage: number
  trend: 'up' | 'down' | 'stable'
}

export interface SalesDashboardData {
  period: {
    type: PeriodType
    value: string
    label: string
  }
  summary: {
    total: number
    comparison?: SalesComparison
    total_transactions: number
    avg_ticket: number
    total_profit: number
    profit_margin: number
    cash_sales: number
    debt_sales: number
    debt_percentage: number
    unique_customers: number
    items_sold: number
  }
  breakdown: DailySalesBreakdown[]
  navigation: {
    previous?: {
      date: string
      total: number
      label: string
    }
    next?: {
      date: string
      total: number
      label: string
    }
    week?: {
      start: string
      end: string
      total: number
      days: Array<{ date: string; total: number }>
    }
    month?: {
      name: string
      total: number
      weeks: any[]
    }
  }
  payment_methods: PieChartData
  hourly_distribution?: BarChartData
  alerts: DashboardAlert[]
}

// ----------------------------------------------------------------------------
// Inventory Dashboard (Handler 3)
// ----------------------------------------------------------------------------
export interface InventoryHealthScore {
  score: number
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  color: string
}

export interface InventoryAgingBucket {
  range: string
  value: number
  percentage: number
  color: string
  items_count: number
}

export interface ExpiryItem {
  sku_id: number
  sku_name: string
  product_name: string
  batch_number: string
  quantity: number
  expiry_date: string
  days_until_expiry: number
  value_at_risk: number
  cost: number
}

export interface ReorderSuggestion {
  sku_id: number
  sku_name: string
  current_stock: number
  reorder_point: number
  suggested_order: number
  supplier_id?: number
  supplier_name?: string
  urgency: 'immediate' | 'soon' | 'normal'
}

export interface InventoryDashboardData {
  summary: {
    total_value: CurrencyMetric
    total_units: MetricValue
    health_score: InventoryHealthScore
    turnover_rate: MetricValue
    days_of_inventory: MetricValue
    slow_movers_count: MetricValue
    dead_stock_value: CurrencyMetric
    stock_to_sales_ratio: MetricValue
  }
  status_breakdown: {
    in_stock: number
    low_stock: number
    out_of_stock: number
    overstocked: number
  }
  aging_analysis: InventoryAgingBucket[]
  expiry_watch: {
    this_week: ExpiryItem[]
    this_month: ExpiryItem[]
    next_quarter: ExpiryItem[]
    total_at_risk: CurrencyMetric
  }
  reorder_suggestions: ReorderSuggestion[]
  heatmap?: HeatmapData
  trends: LineChartData
}

// ----------------------------------------------------------------------------
// Customers Dashboard (Handler 4)
// ----------------------------------------------------------------------------
export interface CustomerSegment {
  name: string
  count: number
  percentage: number
  total_spent: number
  avg_order_value: number
  color: string
}

export interface CustomerGeography {
  region: string
  customer_count: number
  total_spent: number
  percentage: number
  coordinates?: [number, number]
}

export interface CustomerDashboardData {
  summary: {
    total_customers: MetricValue
    active_customers: MetricValue
    new_customers_today: MetricValue
    customer_lifetime_value: CurrencyMetric
    customer_acquisition_cost: CurrencyMetric
    repeat_purchase_rate: PercentageMetric
    churn_rate: PercentageMetric
    avg_order_value: CurrencyMetric
    purchase_frequency: MetricValue
  }
  segments: {
    new: CustomerSegment
    occasional: CustomerSegment
    regular: CustomerSegment
    loyal: CustomerSegment
    vip: CustomerSegment
  }
  geography: CustomerGeography[]
  top_customers: Array<{
    id: number
    name: string
    total_spent: number
    order_count: number
    avg_order: number
    last_purchase: number
    segment: string
  }>
  acquisition_timeline: LineChartData
  retention_curve: LineChartData
  heatmap?: HeatmapData
}

// ----------------------------------------------------------------------------
// Products Dashboard (Handler 5)
// ----------------------------------------------------------------------------
export interface ProductQuadrant {
  name: string
  quadrant: 'stars' | 'niche' | 'volume' | 'dogs'
  revenue: number
  margin: number
  volume: number
}

export interface CategoryPerformance {
  id: number
  name: string
  revenue: number
  profit: number
  margin: number
  growth: number
  product_count: number
  color: string
}

export interface ProductLifecycleItem {
  id: number
  name: string
  stage: 'new' | 'growing' | 'mature' | 'declining'
  revenue_trend: number[]
  days_in_stage: number
}

export interface CrossSellPair {
  product_a: string
  product_b: string
  frequency: number
  lift: number
}

export interface ProductsDashboardData {
  summary: {
    total_products: MetricValue
    active_skus: MetricValue
    avg_margin: PercentageMetric
    top_seller_revenue: CurrencyMetric
    new_products_this_month: MetricValue
    discontinued_this_month: MetricValue
  }
  matrix: ProductQuadrant[]
  category_performance: CategoryPerformance[]
  lifecycle: {
    new: ProductLifecycleItem[]
    growing: ProductLifecycleItem[]
    mature: ProductLifecycleItem[]
    declining: ProductLifecycleItem[]
  }
  top_products: Array<{
    id: number
    name: string
    revenue: number
    profit: number
    margin: number
    units_sold: number
    trend: 'up' | 'down' | 'stable'
  }>
  top_skus: Array<{
    id: number
    name: string
    code: string
    product_name: string
    revenue: number
    profit: number
    margin: number
    units_sold: number
  }>
  cross_sell: CrossSellPair[]
  heatmap?: HeatmapData
}

// ----------------------------------------------------------------------------
// Time Patterns Dashboard (Handler 6)
// ----------------------------------------------------------------------------
export interface DayOfWeekData {
  day: string
  revenue: number
  transactions: number
  avg_ticket: number
  index: number
}

export interface TimePatternsData {
  day_of_week: DayOfWeekData[]
  hour_heatmap: HeatmapData
  seasonal: LineChartData
  year_over_year: LineChartData
  month_over_month: BarChartData
  insights: {
    busiest_day: string
    slowest_day: string
    peak_hour: string
    peak_season: string
    low_season: string
    growth_rate: number
    recommendations: string[]
  }
}

// ----------------------------------------------------------------------------
// Forecasts Dashboard (Handler 7)
// ----------------------------------------------------------------------------
export interface ForecastItem {
  period: string
  predicted: number
  lower_bound?: number
  upper_bound?: number
  confidence: number
}

export interface ReorderForecast {
  sku_id: number
  sku_name: string
  current_stock: number
  daily_run_rate: number
  days_remaining: number
  reorder_date: string
  suggested_quantity: number
  confidence: number
}

export interface ForecastsData {
  sales_forecast: {
    daily: ForecastItem[]
    weekly: ForecastItem[]
    monthly: ForecastItem[]
    quarterly: ForecastItem[]
  }
  inventory_forecast: ReorderForecast[]
  cash_flow_forecast: {
    inflows: ForecastItem[]
    outflows: ForecastItem[]
    net: ForecastItem[]
  }
  confidence_heatmap: HeatmapData
}

// ----------------------------------------------------------------------------
// Financials Dashboard (Handler 8)
// ----------------------------------------------------------------------------
export interface ExpenseCategory {
  name: string
  amount: number
  percentage: number
  color: string
}

export interface ProfitTrend {
  period: string
  gross_profit: number
  operating_profit: number
  net_profit: number
  margin: number
}

export interface FinancialsData {
  cash_flow: {
    cash_at_hand: CurrencyMetric
    bank_balance: CurrencyMetric
    accounts_receivable: CurrencyMetric
    accounts_payable: CurrencyMetric
    net_cash_position: CurrencyMetric
    cash_runway_days: MetricValue
  }
  profit_metrics: {
    gross_profit: CurrencyMetric
    operating_profit: CurrencyMetric
    net_profit: CurrencyMetric
    gross_margin: PercentageMetric
    operating_margin: PercentageMetric
    net_margin: PercentageMetric
  }
  expenses: {
    categories: ExpenseCategory[]
    total: number
    vs_last_month: number
  }
  profit_trends: ProfitTrend[]
  profitability_heatmap: HeatmapData
}

// ----------------------------------------------------------------------------
// Operations Dashboard (Handler 9)
// ----------------------------------------------------------------------------
export interface EmployeePerformance {
  id: number
  name: string
  role: string
  sales: number
  revenue: number
  transactions: number
  avg_ticket: number
  items_sold: number
  profit: number
  margin: number
  customer_satisfaction?: number
  badge?: string
}

export interface TransactionMetric {
  avg_transaction_value: CurrencyMetric
  items_per_transaction: MetricValue
  transaction_count: MetricValue
  peak_hours: Array<{ hour: string; count: number }>
  abandoned_carts: MetricValue
}

export interface SupplierPerformance {
  id: number
  name: string
  on_time_delivery: PercentageMetric
  order_accuracy: PercentageMetric
  avg_lead_time_days: MetricValue
  total_spent: CurrencyMetric
  reliability_score: number
}

export interface OperationsData {
  employees: {
    leaderboard: EmployeePerformance[]
    best_performer: EmployeePerformance
    charts: {
      sales_by_employee: BarChartData
      revenue_by_employee: BarChartData
    }
  }
  transactions: TransactionMetric
  suppliers: SupplierPerformance[]
}

// ----------------------------------------------------------------------------
// Alerts Dashboard (Handler 10)
// ----------------------------------------------------------------------------
export interface AlertCenterData {
  critical: DashboardAlert[]
  warnings: DashboardAlert[]
  info: DashboardAlert[]
  success: DashboardAlert[]
  unread_count: number
  archived_count: number
}