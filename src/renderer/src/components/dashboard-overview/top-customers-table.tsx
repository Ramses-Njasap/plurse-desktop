import React, { useState } from 'react'
import type { CustomerDashboardData } from './types/types'

interface TopCustomersTableProps {
  data?: CustomerDashboardData
  loading?: boolean
}

const fmt = (v: number) => v.toLocaleString() + ' XAF'
const timeAgo = (ts: number) => {
  if (!ts) return 'N/A'
  const d = Math.floor((Date.now() - ts * 1000) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

const segmentColors: Record<string, string> = {
  VIP: 'bg-yellow-100 text-yellow-800',
  Loyal: 'bg-blue-100 text-blue-700',
  Regular: 'bg-purple-100 text-purple-700',
  Occasional: 'bg-gray-100 text-gray-600',
  New: 'bg-emerald-100 text-emerald-700',
}

type FilterType = 'all' | 'debt' | 'no_debt'

const TopCustomersTable: React.FC<TopCustomersTableProps> = ({ data, loading = false }) => {
  const [filter, setFilter] = useState<FilterType>('all')

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-48" />
        <div className="h-64 bg-gray-100 rounded" />
      </div>
    )
  }

  const customers = data?.top_customers || []

  
  const filtered = customers.filter((c) => {
    const hasDebt = c.total_spent > 0 // This would need actual debt data
    if (filter === 'debt') return hasDebt
    if (filter === 'no_debt') return !hasDebt
    return true
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Top Customers</h3>
          <p className="text-xs text-gray-400 mt-0.5">By total spend</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['all', 'debt', 'no_debt'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'all' ? 'All' : f === 'debt' ? 'Has Debt' : 'Cleared'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-400 font-medium">
              <th className="text-left px-5 py-3">Customer</th>
              <th className="text-right px-5 py-3">Total Spent</th>
              <th className="text-right px-5 py-3">Orders</th>
              <th className="text-right px-5 py-3">Avg Order</th>
              <th className="text-right px-5 py-3">Last Purchase</th>
              <th className="text-center px-5 py-3">Segment</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-sm text-gray-400">
                  No customers to display
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {c.name[0]}
                      </div>
                      <span className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors max-w-[140px] truncate">
                        {c.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-semibold text-gray-900">{fmt(c.total_spent)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm text-gray-700">{c.order_count}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm text-gray-700">{fmt(c.avg_order)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-xs text-gray-500">{timeAgo(c.last_purchase)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${segmentColors[c.segment] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.segment}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default TopCustomersTable