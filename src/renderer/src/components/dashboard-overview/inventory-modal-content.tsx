// components/dashboard-overview/inventory-modal-content.tsx

import React, { useState } from 'react'
import { DashBarChart } from './charts'
import { useComparison } from './hooks/use-comparison'
import ModalTabs from './modal-tabs'
import PeriodSelector from './period-selector'
import type { ComparisonPeriod, InventoryDashboardData, SalesDashboardData } from './types/types'

const fmt = (v: number) => v.toLocaleString() + ' XAF'

interface InventoryModalContentProps {
  data?: InventoryDashboardData
  salesData?: SalesDashboardData
  loading?: boolean
  selectedPeriod?: ComparisonPeriod
  onPeriodChange?: (period: ComparisonPeriod) => void
}

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'aging', label: 'Aging Analysis' },
  { id: 'alerts', label: 'Alerts' },
]

const statusColors: Record<string, string> = {
  'In Stock': 'bg-emerald-100 text-emerald-700',
  'Low Stock': 'bg-amber-100 text-amber-700',
  'Out of Stock': 'bg-red-100 text-red-700',
  'Overstocked': 'bg-blue-100 text-blue-700',
}

const InventoryModalContent: React.FC<InventoryModalContentProps> = ({ 
  data, 
  salesData,
  loading = false,
  selectedPeriod,
  onPeriodChange
}) => {
  const [activeTab, setActiveTab] = useState('overview')
  const comparison = useComparison(salesData, selectedPeriod || 'today_vs_yesterday')

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-40 mb-6" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 bg-gray-100 rounded-xl col-span-2" />
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!data) return null

  const total = 
    data.status_breakdown.in_stock +
    data.status_breakdown.low_stock +
    data.status_breakdown.out_of_stock +
    data.status_breakdown.overstocked

  const statusItems = [
    { label: 'In Stock', count: data.status_breakdown.in_stock, color: '#10b981', bar: 'bg-emerald-500' },
    { label: 'Low Stock', count: data.status_breakdown.low_stock, color: '#f59e0b', bar: 'bg-amber-400' },
    { label: 'Out of Stock', count: data.status_breakdown.out_of_stock, color: '#ef4444', bar: 'bg-red-500' },
    { label: 'Overstocked', count: data.status_breakdown.overstocked, color: '#3b82f6', bar: 'bg-blue-500' },
  ]

  const healthScore = data.summary.health_score.score
  const healthColor = 
    healthScore >= 90 ? '#10b981' :
    healthScore >= 75 ? '#3b82f6' :
    healthScore >= 50 ? '#f59e0b' :
    healthScore >= 25 ? '#f97316' : '#ef4444'

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

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Health score + summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-xl p-4 col-span-2 ${
              healthScore >= 75 ? 'bg-emerald-50' :
              healthScore >= 50 ? 'bg-amber-50' : 'bg-red-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-xs font-medium mb-1 ${
                    healthScore >= 75 ? 'text-emerald-600' :
                    healthScore >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    Inventory Health Score
                  </div>
                  <div className="text-3xl font-bold" style={{ color: healthColor }}>
                    {healthScore}<span className="text-lg">/100</span>
                  </div>
                  <div className={`text-xs mt-0.5 ${
                    healthScore >= 75 ? 'text-emerald-600' :
                    healthScore >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {data.summary.health_score.level === 'excellent' && 'Excellent — Stock levels are optimal'}
                    {data.summary.health_score.level === 'good' && 'Good — Minor reorder actions needed'}
                    {data.summary.health_score.level === 'fair' && 'Fair — Review slow-moving items'}
                    {data.summary.health_score.level === 'poor' && 'Poor — Immediate attention required'}
                    {data.summary.health_score.level === 'critical' && 'Critical — Stock crisis!'}
                  </div>
                </div>
                <div className="relative w-20 h-20">
                  <svg viewBox="0 0 36 36" className="rotate-[-90deg]">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke={healthColor} strokeWidth="3"
                      strokeDasharray={`${healthScore}, 100`} />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Total Inventory Value</div>
              <div className="text-xl font-bold text-gray-900">{data.summary.total_value.formatted}</div>
              <div className="text-xs text-gray-400 mt-0.5">Across {total} SKUs</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Days of Inventory</div>
              <div className="text-xl font-bold text-gray-900">{data.summary.days_of_inventory.formatted}</div>
              <div className="text-xs text-gray-400 mt-0.5">At current sell rate</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Turnover Rate</div>
              <div className="text-xl font-bold text-gray-900">{data.summary.turnover_rate.formatted}×</div>
              <div className="text-xs text-gray-400 mt-0.5">Per year</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Dead Stock Value</div>
              <div className="text-xl font-bold text-red-600">{data.summary.dead_stock_value.formatted}</div>
              <div className="text-xs text-gray-400 mt-0.5">{data.summary.dead_stock_value.value > 0 ? `${data.summary.slow_movers_count.value} SKUs at risk` : 'No dead stock'}</div>
            </div>
          </div>

          {/* Status breakdown */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-3">Stock Status Breakdown ({total} SKUs)</div>
            <div className="space-y-2.5">
              {statusItems.map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-gray-600">{s.label}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${s.bar}`}
                      style={{ width: `${(s.count / total) * 100}%` }}
                    />
                  </div>
                  <div className="w-8 text-sm font-semibold text-gray-900 text-right">{s.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'aging' && (
        <div className="space-y-6">
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-4">Inventory Aging Distribution</div>
            <DashBarChart
              data={data.aging_analysis}
              bars={[{ key: 'percentage', name: '% of Inventory', color: '#3b82f6' }]}
              xKey="range"
              formatter={(v) => `${v}%`}
              height={200}
            />
          </div>

          <div className="space-y-2">
            {data.aging_analysis.map((bucket) => (
              <div key={bucket.range} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: bucket.color }} />
                  <span className="text-sm text-gray-700 font-medium">{bucket.range}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">{bucket.items_count} SKUs</span>
                  <span className="font-bold text-gray-900">{bucket.percentage}%</span>
                </div>
              </div>
            ))}
          </div>

          {data.summary.slow_movers_count.value > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-amber-800">⚠️ At Risk</div>
              <div className="text-xs text-amber-700 mt-1">
                {data.summary.slow_movers_count.value} SKUs have been in inventory for 90+ days. 
                Consider running promotions or returning to supplier.
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="text-sm font-semibold text-gray-700">Reorder Suggestions</div>
          {data.reorder_suggestions.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              No reorder suggestions at this time
            </div>
          ) : (
            <div className="space-y-2">
              {data.reorder_suggestions.map((item) => (
                <div
                  key={item.sku_id}
                  className={`flex items-center justify-between p-3.5 rounded-xl border ${
                    item.urgency === 'immediate'
                      ? 'border-red-200 bg-red-50'
                      : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{item.sku_name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.supplier_name || 'No supplier'}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        item.urgency === 'immediate' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {item.urgency === 'immediate' ? '🔴 Immediate' : '🟡 Soon'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {item.current_stock} left → Order {item.suggested_order}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default InventoryModalContent