// components/dashboard-overview/sales-modal-content.tsx

import React, { useState } from 'react'
import { DashBarChart, DashLineChart } from './charts'
import { useComparison } from './hooks/use-comparison'
import ModalTabs from './modal-tabs'
import PeriodSelector from './period-selector'
import TrendBadge from './trend-badge'
import type { ComparisonPeriod, SalesDashboardData } from './types/types'

const fmt = (v: number) => v.toLocaleString() + ' XAF'

interface SalesModalContentProps {
  data?: SalesDashboardData
  // period: string
  loading?: boolean
  selectedPeriod?: ComparisonPeriod
  onPeriodChange?: (period: ComparisonPeriod) => void
}

const tabs = [
  { id: 'trend', label: 'Trend' },
  { id: 'breakdown', label: 'Breakdown' },
  { id: 'metrics', label: 'Analytics' },
]

const SalesModalContent: React.FC<SalesModalContentProps> = ({ 
  data, 
  // period, 
  loading = false,
  selectedPeriod,
  onPeriodChange
}) => {
  const [activeTab, setActiveTab] = useState('trend')
  const comparison = useComparison(data, selectedPeriod || 'today_vs_yesterday')

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-40 mb-6" />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
        </div>
        <div className="h-48 bg-gray-100 rounded-xl" />
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  const weekData = data.breakdown.slice(-7).map(day => ({
    label: new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short' }),
    revenue: day.total,
    profit: day.products.reduce((sum, p) => sum + p.profit, 0)
  }))

  const monthlyData = data.breakdown.slice(-6).map(day => ({
    label: new Date(day.date).toLocaleDateString('en-GB', { month: 'short' }),
    revenue: day.total,
    profit: day.products.reduce((sum, p) => sum + p.profit, 0)
  }))

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
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Sales', value: fmt(comparison.currentValue), change: comparison.changePercentage },
              { label: 'Transactions', value: data.summary.total_transactions.toString(), change: data.summary.comparison?.change_percentage },
              { label: 'Avg. Ticket Size', value: fmt(data.summary.avg_ticket), change: data.summary.comparison?.change_percentage },
            ].map((m) => (
              <div key={m.label} className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">{m.label}</div>
                <div className="text-xl font-bold text-gray-900">{m.value}</div>
                {m.change !== undefined && <TrendBadge value={m.change} />}
              </div>
            ))}
          </div>

          {/* This week */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-3">This Week — Revenue vs Profit</div>
            <DashLineChart
              data={weekData}
              lines={[
                { key: 'revenue', name: 'Revenue', color: '#3b82f6' },
                { key: 'profit', name: 'Profit', color: '#10b981' },
              ]}
              xKey="label"
              formatter={fmt}
              height={200}
            />
          </div>

          {/* Last 6 months */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-3">Last 6 Months</div>
            <DashLineChart
              data={monthlyData}
              lines={[
                { key: 'revenue', name: 'Revenue', color: '#3b82f6' },
                { key: 'profit', name: 'Profit', color: '#10b981' },
              ]}
              xKey="label"
              formatter={fmt}
              height={200}
            />
          </div>
        </div>
      )}

      {activeTab === 'breakdown' && (
        <div className="space-y-6">
          {/* Payment methods */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-4">Payment Methods (Today)</div>
            <div className="flex items-start gap-6">
              <div className="flex-1">
                {data.payment_methods.labels.map((label, i) => {
                  const percentage = data.payment_methods.data[i]
                  const color = data.payment_methods.colors?.[i] || '#3b82f6'
                  return (
                    <div key={label} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                        <span className="text-sm text-gray-700">{label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-28 bg-gray-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${percentage}%`, background: color }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-8 text-right">{percentage}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Sales by period */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-3">Daily Revenue (This Month)</div>
            <DashBarChart
              data={monthlyData}
              bars={[{ key: 'revenue', name: 'Revenue', color: '#3b82f6' }]}
              xKey="label"
              formatter={fmt}
              height={200}
            />
          </div>
        </div>
      )}

      {activeTab === 'metrics' && (
        <div className="space-y-4">
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Month-to-Date Revenue', value: fmt(data.summary.total), sub: 'Current month' },
              { label: 'Profit Margin', value: `${data.summary.profit_margin.toFixed(1)}%`, sub: 'Current period' },
              { label: 'Cash Sales', value: fmt(data.summary.cash_sales), sub: `${((data.summary.cash_sales / data.summary.total) * 100).toFixed(0)}% of total` },
              { label: 'Debt Sales', value: fmt(data.summary.debt_sales), sub: `${data.summary.debt_percentage.toFixed(0)}% of total` },
              { label: 'Best Day', value: weekData.reduce((max, d) => d.revenue > max.revenue ? d : max, weekData[0])?.label || 'N/A', sub: 'This period' },
              { label: 'Avg Daily Revenue', value: fmt(data.summary.total / (data.breakdown.length || 1)), sub: 'This period' },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                <div className="text-lg font-bold text-gray-900">{item.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Profit trend */}
          <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-blue-900">
                Profit Trend: {comparison.trend === 'up' ? 'Increasing' : comparison.trend === 'down' ? 'Decreasing' : 'Stable'}
              </div>
              <div className="text-xs text-blue-700 mt-0.5">
                {comparison.label}: {comparison.changePercentage > 0 ? '+' : ''}{comparison.changePercentage.toFixed(1)}% 
                ({fmt(comparison.currentValue)} vs {fmt(comparison.previousValue)})
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesModalContent