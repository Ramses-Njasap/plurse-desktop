import React from 'react'
import type { OverviewDashboardData } from './types/types'

interface GoalTrackingSectionProps {
  data?: OverviewDashboardData
  loading?: boolean
}

const fmt = (v: number) => {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M' + ' XAF'
  if (v >= 1000) return (v / 1000).toFixed(0) + 'k' + ' XAF'
  return v.toLocaleString() + ' XAF'
}

const GoalTrackingSection: React.FC<GoalTrackingSectionProps> = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 animate-pulse">
        <div className="h-5 bg-gray-100 rounded w-32" />
        {[1,2,3,4].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-gray-100 rounded w-full" />
            <div className="h-2 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  const kpis = data?.kpis
  if (!kpis) return null

  const items = [
    {
      label: 'Revenue Target',
      current: fmt(kpis.revenue_target.value),
      target: fmt(kpis.revenue_target.target),
      progress: kpis.revenue_target.progress_percentage,
      on_track: kpis.revenue_target.on_track,
      color: 'bg-blue-500',
    },
    {
      label: 'Profit Target',
      current: fmt(kpis.profit_target.value),
      target: fmt(kpis.profit_target.target),
      progress: kpis.profit_target.progress_percentage,
      on_track: kpis.profit_target.on_track,
      color: 'bg-emerald-500',
    },
    {
      label: 'Customer Target',
      current: data?.summary.active_customers_today.formatted || '0',
      target: kpis.customer_target.formatted,
      progress: kpis.customer_target.progress_percentage,
      on_track: kpis.customer_target.on_track,
      color: 'bg-purple-500',
    },
    {
      label: 'Inventory Value',
      current: fmt(data?.summary.inventory_value.value || 0),
      target: fmt(kpis.inventory_target.target),
      progress: kpis.inventory_target.progress_percentage,
      on_track: kpis.inventory_target.on_track,
      color: 'bg-amber-500',
      warning: data?.summary.inventory_value.value > kpis.inventory_target.target 
        ? 'Overstocked by ' + Math.round((data.summary.inventory_value.value / kpis.inventory_target.target) * 100) + '%'
        : 'Understocked by ' + Math.round(100 - ((data.summary.inventory_value.value / kpis.inventory_target.target) * 100)) + '%',
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Monthly Goals</h3>
          <p className="text-xs text-gray-400 mt-0.5">February progress</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-700">{item.label}</span>
              <div className="flex items-center gap-1.5">
                {item.warning ? (
                  <span className="text-xs text-amber-600">{item.warning}</span>
                ) : item.on_track ? (
                  <span className="text-xs text-emerald-600 font-medium">✓ On track</span>
                ) : (
                  <span className="text-xs text-red-500 font-medium">↓ Behind</span>
                )}
                <span className="text-xs font-bold text-gray-900">{item.progress.toFixed(0)}%</span>
              </div>
            </div>
            <div className="bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${item.progress < 20 ? 'bg-red-500' : item.progress < 75 ? item.color : 'bg-green-500'} transition-all duration-500`}
                style={{ width: `${Math.min(item.progress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">{item.current}</span>
              <span className="text-xs text-gray-400">Target: {item.target}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default GoalTrackingSection