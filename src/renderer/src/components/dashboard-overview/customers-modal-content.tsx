// components/dashboard-overview/customers-modal-content.tsx

import React, { useState } from 'react'
import { DashDonutChart, DashLineChart } from './charts'
import { useComparison } from './hooks/use-comparison'
import ModalTabs from './modal-tabs'
import PeriodSelector from './period-selector'
import TrendBadge from './trend-badge'
import type { ComparisonPeriod, CustomerDashboardData, SalesDashboardData } from './types/types'

const fmt = (v: number) => v.toLocaleString() + ' XAF'

interface CustomersModalContentProps {
  data?: CustomerDashboardData
  salesData?: SalesDashboardData
  loading?: boolean
  selectedPeriod?: ComparisonPeriod
  onPeriodChange?: (period: ComparisonPeriod) => void
}

const tabs = [
  { id: 'trend', label: 'Trend' },
  { id: 'segments', label: 'Segments' },
  { id: 'metrics', label: 'Metrics' },
]

const CustomersModalContent: React.FC<CustomersModalContentProps> = ({ 
  data, 
  salesData,
  loading = false,
  selectedPeriod,
  onPeriodChange
}) => {
  const [activeTab, setActiveTab] = useState('trend')
  const comparison = useComparison(salesData, selectedPeriod || 'today_vs_yesterday')

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-40 mb-6" />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
        </div>
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  // Transform data for the chart
  const acquisitionData = data.acquisition_timeline.labels.map((label, i) => ({
    label,
    new_customers: data.acquisition_timeline.datasets[0].data[i],
    active: data.acquisition_timeline.datasets[0].data[i] * 3 // Approximation
  }))

  // Transform segment data for donut chart
  const segmentData = [
    { name: 'New', value: data.segments.new.percentage, color: '#8b5cf6', count: data.segments.new.count, avg_order: data.segments.new.avg_order_value },
    { name: 'Occasional', value: data.segments.occasional.percentage, color: '#3b82f6', count: data.segments.occasional.count, avg_order: data.segments.occasional.avg_order_value },
    { name: 'Regular', value: data.segments.regular.percentage, color: '#10b981', count: data.segments.regular.count, avg_order: data.segments.regular.avg_order_value },
    { name: 'Loyal', value: data.segments.loyal.percentage, color: '#f59e0b', count: data.segments.loyal.count, avg_order: data.segments.loyal.avg_order_value },
    { name: 'VIP', value: data.segments.vip.percentage, color: '#ef4444', count: data.segments.vip.count, avg_order: data.segments.vip.avg_order_value },
  ]

  return (
    <div>
      <div className="flex justify-end mb-4">
        {selectedPeriod && onPeriodChange && (
          <PeriodSelector
            value={selectedPeriod}
            onChange={onPeriodChange}
            size="sm"
          />
        )}
      </div>

      <ModalTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'trend' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Customers', value: data.summary.total_customers.formatted, change: data.summary.total_customers.change_percentage },
              { label: 'New Customers', value: data.summary.new_customers_today.formatted, change: comparison.changePercentage },
              { label: 'Repeat Rate', value: data.summary.repeat_purchase_rate.formatted, change: data.summary.repeat_purchase_rate.change_percentage },
            ].map((m) => (
              <div key={m.label} className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">{m.label}</div>
                <div className="text-xl font-bold text-gray-900">{m.value}</div>
                {m.change !== undefined && <TrendBadge value={m.change} />}
              </div>
            ))}
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-700 mb-3">Customer Growth</div>
            <DashLineChart
              data={acquisitionData}
              lines={[
                { key: 'active', name: 'Active Customers', color: '#3b82f6' },
                { key: 'new_customers', name: 'New Customers', color: '#10b981', dashed: true },
              ]}
              xKey="label"
              height={200}
            />
          </div>
        </div>
      )}

      {activeTab === 'segments' && (
        <div className="space-y-5">
          <div className="flex items-start gap-6">
            <DashDonutChart
              data={segmentData}
              formatter={(v) => `${v.toFixed(1)}%`}
              centerLabel="segments"
              centerValue={segmentData.length.toString()}
              height={200}
              innerRadius={50}
              outerRadius={80}
            />
            <div className="flex-1 space-y-2 pt-2">
              {segmentData.map((s) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-sm text-gray-700">{s.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">{s.count}</span>
                    <span className="text-xs text-gray-400 ml-1">customers</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {segmentData.map((s) => (
              <div key={s.name} className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                  <span className="text-sm font-medium text-gray-800">{s.name}</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="text-gray-500">{s.count} customers</div>
                  <div className="font-semibold text-gray-900">Avg {fmt(s.avg_order)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'metrics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Customer Lifetime Value', value: data.summary.customer_lifetime_value.formatted, sub: 'Average per customer' },
              { label: 'Avg. Order Value', value: data.summary.avg_order_value.formatted, sub: 'This month' },
              { label: 'Purchase Frequency', value: data.summary.purchase_frequency.formatted, sub: 'Per month per customer' },
              { label: 'Churn Rate', value: data.summary.churn_rate.formatted, sub: 'Last 30 days' },
            ].map((m) => (
              <div key={m.label} className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">{m.label}</div>
                <div className="text-xl font-bold text-gray-900">{m.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{m.sub}</div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 rounded-xl p-4">
            <div className="text-sm font-semibold text-blue-900 mb-1">💡 Insight</div>
            <div className="text-xs text-blue-700">
              {comparison.label}: Customer activity is {comparison.trend === 'up' ? 'up' : comparison.trend === 'down' ? 'down' : 'stable'} 
              ({comparison.changePercentage > 0 ? '+' : ''}{comparison.changePercentage.toFixed(1)}%)
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomersModalContent