// pages/dashboard/overview.tsx

import AlertsFeed from '@renderer/components/dashboard-overview/alerts-feed'
import { DashDonutChart, DashLineChart, Sparkline } from '@renderer/components/dashboard-overview/charts'
import DashboardModal from '@renderer/components/dashboard-overview/dashboard-modal'
import DateRangePicker from '@renderer/components/dashboard-overview/date-range-picker'
import EmployeePerformanceSection from '@renderer/components/dashboard-overview/employees-performance-section'
import GoalTrackingSection from '@renderer/components/dashboard-overview/goal-tracking-section'
import { useComparison } from '@renderer/components/dashboard-overview/hooks/use-comparison'
import MetricCard from '@renderer/components/dashboard-overview/metric-card'
import { dashboardService } from '@renderer/components/dashboard-overview/service'
import TopCustomersTable from '@renderer/components/dashboard-overview/top-customers-table'
import TopProductsTable from '@renderer/components/dashboard-overview/top-products-table'
import type {
  DatePreset as ApiDatePreset,
  ComparisonPeriod,
  CustomerDashboardData,
  DatePreset,
  ModalType,
  OverviewDashboardData,
  PeriodSelection,
  ProductsDashboardData,
  SalesDashboardData
} from '@renderer/components/dashboard-overview/types/types'
import React, { useEffect, useState } from 'react'

// const fmt = (v: number) => v.toLocaleString()
const fmtM = (v: number) => {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'k'
  return v.toLocaleString()
}

// Transform payment methods data for donut chart
const transformPaymentMethods = (salesData: SalesDashboardData | undefined) => {
  if (!salesData?.payment_methods) return []
  
  const { labels, data, colors } = salesData.payment_methods
  return labels.map((label, index) => ({
    name: label,
    value: data[index],
    color: colors?.[index] || '#3b82f6'
  }))
}

// Transform monthly trend data for line chart
const transformMonthlyTrend = (salesData: SalesDashboardData | undefined) => {
  if (!salesData?.breakdown) return []
  
  // Group by month (simplified - would need proper aggregation)
  return salesData.breakdown.slice(0, 6).map((day) => ({
    label: new Date(day.date).toLocaleDateString('en-GB', { month: 'short' }),
    revenue: day.total,
    profit: day.products.reduce((sum, p) => sum + p.profit, 0)
  })).reverse()
}

// Map UI DatePreset to API PeriodSelection
const mapPresetToPeriod = (preset: DatePreset): PeriodSelection => {
  const presetMap: Record<DatePreset, ApiDatePreset> = {
    'today': 'today',
    'yesterday': 'yesterday',
    'this_week': 'this_week',
    'last_week': 'last_week',
    'this_month': 'this_month',
    'last_month': 'last_month',
    'this_quarter': 'this_quarter',
    'last_quarter': 'last_quarter',
    'this_year': 'this_year',
    'last_year': 'last_year',
    'custom': 'custom'
  }
  
  return {
    type: 'day',
    preset: presetMap[preset]
  }
}

// Sparkline data (would need historical data from backend)
const revSparkline = [580000, 620000, 710000, 540000, 820000, 680000, 847500]
const profitSparkline = [139200, 148800, 170400, 129600, 196800, 163200, 203400]
const txSparkline = [32, 38, 41, 29, 44, 39, 47]
const debtSparkline = [3200000, 3400000, 3100000, 3600000, 3800000, 3500000, 3740000]

const DashboardOverview: React.FC = () => {
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [period, setPeriod] = useState<DatePreset>('today')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<ComparisonPeriod>('today_vs_yesterday')
  
  // Data states
  const [overviewData, setOverviewData] = useState<OverviewDashboardData | undefined>(undefined)
  const [salesData, setSalesData] = useState<SalesDashboardData | undefined>(undefined)
  const [productsData, setProductsData] = useState<ProductsDashboardData | undefined>(undefined)
  const [customersData, setCustomersData] = useState<CustomerDashboardData | undefined>(undefined)

  // Get comparison results
  const revenueComparison = useComparison(salesData, selectedPeriod)
  const profitComparison = useComparison(salesData, selectedPeriod)

  // Load all dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Convert UI preset to API period selection
        const periodSelection = mapPresetToPeriod(period)
        const filters = { period: periodSelection }

        // Fetch all dashboard data in parallel
        const [overview, sales, products, customers] = await Promise.allSettled([
          dashboardService.getOverview(filters),
          dashboardService.getSalesDashboard(filters),
          dashboardService.getProductsDashboard(filters),
          dashboardService.getCustomersDashboard(filters)
        ])

        // Handle overview data
        if (overview.status === 'fulfilled' && overview.value.success) {
          setOverviewData(overview.value.data)
        } else {
          console.error('Failed to load overview data:', overview)
          setOverviewData(undefined)
        }

        // Handle sales data
        if (sales.status === 'fulfilled' && sales.value.success) {
          setSalesData(sales.value.data)
        } else {
          console.error('Failed to load sales data:', sales)
          setSalesData(undefined)
        }

        // Handle products data
        if (products.status === 'fulfilled' && products.value.success) {
          setProductsData(products.value.data)
        } else {
          console.error('Failed to load products data:', products)
          setProductsData(undefined)
        }

        // Handle customers data
        if (customers.status === 'fulfilled' && customers.value.success) {
          setCustomersData(customers.value.data)
        } else {
          console.error('Failed to load customers data:', customers)
          setCustomersData(undefined)
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
        console.error('Dashboard data loading error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [period])

  // Transform data for display
  const paymentMethods = transformPaymentMethods(salesData)
  const monthlyTrend = transformMonthlyTrend(salesData)
  
  // Get alerts from overview data
  const criticalAlerts = overviewData?.alerts?.filter(a => a.severity === 'critical').length || 0
  const warningAlerts = overviewData?.alerts?.filter(a => a.severity === 'warning').length || 0

  const open = (type: ModalType) => setActiveModal(type)
  const close = () => setActiveModal(null)

  if (error) {
    return (
      <div className="min-h-full bg-[#f8f9fb] p-6 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Failed to load dashboard</h2>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#f8f9fb] p-6 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Alert badges */}
          {criticalAlerts > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {criticalAlerts} Critical
            </div>
          )}
          {warningAlerts > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              {warningAlerts} Warnings
            </div>
          )}
          <DateRangePicker value={period} onChange={setPeriod} />
        </div>
      </div>

      {/* ── Row 1: Core KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Sales Today */}
        <MetricCard
          title="Sales Today"
          value={fmtM(overviewData?.summary.revenue_today.value || 0)}
          trend={revenueComparison.changePercentage}
          trendLabel={revenueComparison.label}
          icon={
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
          iconBg="bg-blue-50"
          loading={loading}
          onClick={() => open('sales')}
          showPeriodSelector={true}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          comparisonResult={revenueComparison}
        />

        {/* Revenue MTD */}
        <MetricCard
          title="Revenue MTD"
          value={fmtM(overviewData?.summary.revenue_mtd.value || 0)}
          trend={overviewData?.summary.revenue_mtd.change_percentage}
          trendLabel="vs last month"
          icon={
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          }
          iconBg="bg-purple-50"
          loading={loading}
          onClick={() => open('revenue')}
        />

        {/* Gross Profit Today */}
        <MetricCard
          title="Profit Today"
          value={fmtM(overviewData?.summary.profit_today.value || 0)}
          trend={profitComparison.changePercentage}
          trendLabel={profitComparison.label}
          icon={
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
          iconBg="bg-emerald-50"
          loading={loading}
          onClick={() => open('profit')}
          showPeriodSelector={true}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          comparisonResult={profitComparison}
        />

        {/* Outstanding Debts */}
        <MetricCard
          title="Receivables"
          value={fmtM(overviewData?.summary.accounts_receivable.value || 0)}
          trend={overviewData?.summary.accounts_receivable.change_percentage}
          trendLabel="outstanding"
          alert="warning"
          icon={
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          iconBg="bg-amber-50"
          loading={loading}
          onClick={() => open('debt')}
        />

        {/* Inventory Value */}
        <MetricCard
          title="Inventory"
          value={fmtM(overviewData?.summary.inventory_value.value || 0)}
          trend={overviewData?.summary.inventory_value.change_percentage}
          badge={`${(overviewData?.summary.low_stock_count.value || 0) + (overviewData?.summary.out_of_stock_count.value || 0)} alerts`}
          icon={
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
          iconBg="bg-indigo-50"
          loading={loading}
          onClick={() => open('inventory')}
        />

        {/* Active Customers */}
        <MetricCard
          title="Customers Today"
          value={overviewData?.summary.active_customers_today.value || 0}
          trend={overviewData?.summary.active_customers_today.change_percentage}
          subtitle={`${overviewData?.summary.new_customers_today.value || 0} new today`}
          icon={
            <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          iconBg="bg-pink-50"
          loading={loading}
          onClick={() => open('customers')}
        />
      </div>

      {/* ── Row 2: Revenue Chart + Payment Methods ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue + Profit Trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Revenue & Profit Trend</h3>
              <p className="text-xs text-gray-400 mt-0.5">Last 6 months</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> Profit</span>
            </div>
          </div>
          <DashLineChart
            data={monthlyTrend}
            lines={[
              { key: 'revenue', name: 'Revenue', color: '#3b82f6' },
              { key: 'profit', name: 'Profit', color: '#10b981' },
            ]}
            xKey="label"
            formatter={fmtM}
            height={220}
          />
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-gray-900">Payment Methods</h3>
            <p className="text-xs text-gray-400 mt-0.5">Today's breakdown</p>
          </div>
          <DashDonutChart
            data={paymentMethods}
            formatter={(v) => `${v}%`}
            centerLabel="total (in xaf)"
            centerValue={fmtM(overviewData?.summary.revenue_today.value || 0)}
            height={180}
            innerRadius={60}
            outerRadius={90}
          />
          <div className="mt-3 space-y-1.5">
            {paymentMethods.map((m) => (
              <div key={m.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                  <span className="text-gray-600">{m.name}</span>
                </div>
                <span className="font-semibold text-gray-900">{m.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Sparkline mini-cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Revenue (7d)', data: revSparkline, color: '#3b82f6', value: fmtM(overviewData?.summary.revenue_today.value || 847500), sub: 'Today' },
          { label: 'Profit (7d)', data: profitSparkline, color: '#10b981', value: fmtM(overviewData?.summary.profit_today.value || 203400), sub: 'Today' },
          { label: 'Transactions (7d)', data: txSparkline, color: '#8b5cf6', value: overviewData?.summary.transaction_count.value?.toString() || '47', sub: 'Today' },
          { label: 'Receivables (7d)', data: debtSparkline, color: '#f59e0b', value: fmtM(overviewData?.summary.accounts_receivable.value || 3740000), sub: 'Outstanding' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400 font-medium">{item.label}</span>
              <span className="text-sm font-bold text-gray-900">{item.value}</span>
            </div>
            <div className="text-xs text-gray-400 mb-2">{item.sub}</div>
            <Sparkline data={item.data} color={item.color} height={36} />
          </div>
        ))}
      </div>

      {/* ── Row 4: Tables ── */}
      <div className="grid grid-cols-1 gap-4">
        <TopProductsTable data={productsData} />
        <TopCustomersTable data={customersData} />
      </div>

      {/* ── Row 5: Goals + Alerts + Staff ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GoalTrackingSection data={overviewData} />
        <AlertsFeed alerts={overviewData?.alerts} />
        <EmployeePerformanceSection />
      </div>

      {/* ── Modal ── */}
      <DashboardModal 
        type={activeModal} 
        onClose={close} 
        data={{
          overview: overviewData,
          sales: salesData,
          products: productsData,
          customers: customersData
        }}
        loading={loading}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
      />
    </div>
  )
}

export default DashboardOverview