// Realistic mock data that mirrors the actual API shapes
// Replace with real API calls via window.api.dashboard.*

export const mockOverviewData = {
  summary: {
    revenue_today: { value: 847500, formatted: 'XAF 847,500', change_percentage: 12.4, trend: 'up' },
    revenue_mtd: { value: 18340000, formatted: 'XAF 18,340,000', change_percentage: 8.7, trend: 'up' },
    profit_today: { value: 203400, formatted: 'XAF 203,400', change_percentage: 5.2, trend: 'up' },
    profit_mtd: { value: 4402000, formatted: 'XAF 4,402,000', change_percentage: -2.1, trend: 'down' },
    cash_at_hand: { value: 1250000, formatted: 'XAF 1,250,000', change_percentage: 0, trend: 'stable' },
    accounts_receivable: { value: 3740000, formatted: 'XAF 3,740,000', change_percentage: 14.3, trend: 'up' },
    accounts_payable: { value: 980000, formatted: 'XAF 980,000', change_percentage: -3.2, trend: 'down' },
    inventory_value: { value: 22180000, formatted: 'XAF 22,180,000', change_percentage: 2.1, trend: 'up' },
    low_stock_count: { value: 14, change_percentage: 0, trend: 'stable' },
    out_of_stock_count: { value: 3, change_percentage: 0, trend: 'stable' },
    active_customers_today: { value: 47, change_percentage: 11.9, trend: 'up' },
    new_customers_today: { value: 6, change_percentage: 20, trend: 'up' },
    avg_transaction_value: { value: 18032, formatted: 'XAF 18,032', change_percentage: 3.4, trend: 'up' },
    transaction_count: { value: 47, change_percentage: 11.9, trend: 'up' },
  },
  kpis: {
    revenue_target: { value: 18340000, target: 25000000, progress_percentage: 73, on_track: true, trend: 'up' },
    profit_target: { value: 4402000, target: 6000000, progress_percentage: 73, on_track: true, trend: 'up' },
    customer_target: { value: 412, target: 500, progress_percentage: 82, on_track: true, trend: 'up' },
    inventory_target: { value: 22180000, target: 20000000, progress_percentage: 110, on_track: false, trend: 'up' },
  },
  alerts: [
    { id: '1', type: 'inventory', severity: 'critical', title: 'Out of Stock', message: '3 top-selling SKUs are out of stock', timestamp: Date.now(), read: false, actionable: true },
    { id: '2', type: 'debt', severity: 'warning', title: 'Overdue Debt', message: '5 customers have debts overdue by 30+ days (XAF 740,000)', timestamp: Date.now(), read: false, actionable: true },
    { id: '3', type: 'inventory', severity: 'warning', title: 'Low Stock Alert', message: '14 products are below reorder threshold', timestamp: Date.now(), read: false, actionable: true },
    { id: '4', type: 'sales', severity: 'info', title: 'Sales Milestone', message: 'You hit XAF 800k today — best Tuesday this month!', timestamp: Date.now(), read: true, actionable: false },
  ],
}

export const mockSalesTrendData = [
  { label: 'Mon', revenue: 620000, profit: 148000 },
  { label: 'Tue', revenue: 847500, profit: 203400 },
  { label: 'Wed', revenue: 0, profit: 0 },
  { label: 'Thu', revenue: 0, profit: 0 },
  { label: 'Fri', revenue: 0, profit: 0 },
  { label: 'Sat', revenue: 0, profit: 0 },
  { label: 'Sun', revenue: 0, profit: 0 },
]

export const mockMonthlyTrend = [
  { label: 'Sep', revenue: 14200000, profit: 3268000 },
  { label: 'Oct', revenue: 16700000, profit: 3840100 },
  { label: 'Nov', revenue: 15400000, profit: 3542000 },
  { label: 'Dec', revenue: 19800000, profit: 5148000 },
  { label: 'Jan', revenue: 17200000, profit: 3956000 },
  { label: 'Feb', revenue: 18340000, profit: 4402000 },
]

export const mockPaymentMethods = [
  { name: 'Cash', value: 42, color: '#3b82f6' },
  { name: 'Bank Transfer', value: 31, color: '#8b5cf6' },
  { name: 'POS', value: 19, color: '#10b981' },
  { name: 'Debt/Credit', value: 8, color: '#f59e0b' },
]

export const mockTopProducts = [
  { id: 1, product_name: 'Indomie Super Pack (40×70g)', revenue: 384000, profit: 96000, margin: 25.0, units_sold: 480, trend: 'up' as const, stock_status: 'In Stock' },
  { id: 2, product_name: 'Peak Milk Evaporated 400g', revenue: 271200, profit: 81360, margin: 30.0, units_sold: 240, trend: 'up' as const, stock_status: 'Low Stock' },
  { id: 3, product_name: 'Dangote Sugar 1kg', revenue: 189000, profit: 37800, margin: 20.0, units_sold: 420, trend: 'stable' as const, stock_status: 'In Stock' },
  { id: 4, product_name: 'Sunlight Dish Wash 750ml', revenue: 156000, profit: 46800, margin: 30.0, units_sold: 300, trend: 'down' as const, stock_status: 'In Stock' },
  { id: 5, product_name: 'Milo 400g Tin', revenue: 142500, profit: 35625, margin: 25.0, units_sold: 95, trend: 'up' as const, stock_status: 'Out of Stock' },
]

export const mockTopCustomers = [
  { id: 1, name: 'Balogun Wholesale Ltd', total_spent: 2840000, order_count: 42, outstanding_debt: 380000, last_purchase: Date.now() - 86400000, segment: 'VIP' },
  { id: 2, name: 'Mama Ngozi Store', total_spent: 1620000, order_count: 31, outstanding_debt: 0, last_purchase: Date.now() - 172800000, segment: 'Loyal' },
  { id: 3, name: 'Alhaji Supplies Co.', total_spent: 1380000, order_count: 18, outstanding_debt: 145000, last_purchase: Date.now() - 259200000, segment: 'Regular' },
  { id: 4, name: 'TechMart Kano', total_spent: 980000, order_count: 12, outstanding_debt: 215000, last_purchase: Date.now() - 345600000, segment: 'Regular' },
  { id: 5, name: 'Grace & Co Distributors', total_spent: 760000, order_count: 9, outstanding_debt: 0, last_purchase: Date.now() - 432000000, segment: 'Occasional' },
]

export const mockInventoryStatus = {
  in_stock: 142,
  low_stock: 14,
  out_of_stock: 3,
  overstocked: 8,
}

export const mockInventoryAging = [
  { range: '0–30 days', value: 45, color: '#10b981', items_count: 76 },
  { range: '31–60 days', value: 30, color: '#3b82f6', items_count: 51 },
  { range: '61–90 days', value: 15, color: '#f59e0b', items_count: 25 },
  { range: '90+ days', value: 10, color: '#ef4444', items_count: 17 },
]

export const mockEmployeePerformance = [
  { id: 1, name: 'Chidera A.', role: 'cashier', sales: 18, revenue: 342000, transactions: 18, avg_ticket: 19000, profit: 82080, margin: 24.0 },
  { id: 2, name: 'Fatima B.', role: 'cashier', sales: 14, revenue: 267500, transactions: 14, avg_ticket: 19107, profit: 64200, margin: 24.0 },
  { id: 3, name: 'Emeka O.', role: 'manager', sales: 9, revenue: 188000, transactions: 9, avg_ticket: 20889, profit: 47000, margin: 25.0 },
  { id: 4, name: 'Aisha M.', role: 'cashier', sales: 6, revenue: 50000, transactions: 6, avg_ticket: 8333, profit: 10200, margin: 20.4 },
]

export const mockDebtSummary = {
  total_outstanding: 3740000,
  overdue_30_plus: 740000,
  overdue_count: 5,
  due_this_week: 380000,
  debtors: [
    { id: 1, name: 'Balogun Wholesale Ltd', amount: 380000, days_overdue: 12, status: 'overdue' as const },
    { id: 2, name: 'TechMart Kano', amount: 215000, days_overdue: 38, status: 'overdue' as const },
    { id: 3, name: 'Alhaji Supplies Co.', amount: 145000, days_overdue: 5, status: 'pending' as const },
    { id: 4, name: 'Kola Traders', amount: 95000, days_overdue: 67, status: 'overdue' as const },
    { id: 5, name: 'Sunrise Provisions', amount: 85000, days_overdue: 22, status: 'overdue' as const },
  ]
}