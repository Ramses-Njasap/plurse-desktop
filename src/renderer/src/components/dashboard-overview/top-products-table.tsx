import React from 'react'
import type { ProductsDashboardData } from './types/types'

interface TopProductsTableProps {
  data?: ProductsDashboardData
  loading?: boolean
}

const fmt = (v: number) => v.toLocaleString() + ' XAF'

const stockColors: Record<string, string> = {
  'In Stock': 'text-emerald-700 bg-emerald-50',
  'Low Stock': 'text-amber-700 bg-amber-50',
  'Out of Stock': 'text-red-700 bg-red-50',
  'Overstocked': 'text-blue-700 bg-blue-50',
}

const trendIcon = (t?: 'up' | 'down' | 'stable') => {
  if (t === 'up') return <span className="text-emerald-500 font-bold">↑</span>
  if (t === 'down') return <span className="text-red-500 font-bold">↓</span>
  return <span className="text-gray-400">→</span>
}

const TopProductsTable: React.FC<TopProductsTableProps> = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-48" />
        <div className="h-64 bg-gray-100 rounded" />
      </div>
    )
  }

  const products = data?.top_products || []

  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Top Products</h3>
          <p className="text-xs text-gray-400 mt-0.5">By revenue today</p>
        </div>
        <button className="text-xs text-blue-600 font-medium hover:underline">View all →</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-400 font-medium">
              <th className="text-left px-5 py-3">#</th>
              <th className="text-left px-5 py-3">Product</th>
              <th className="text-right px-5 py-3">Revenue</th>
              <th className="text-right px-5 py-3">Profit</th>
              <th className="text-right px-5 py-3">Margin</th>
              <th className="text-right px-5 py-3">Units</th>
              <th className="text-center px-5 py-3">Trend</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-sm text-gray-400">
                  No products to display
                </td>
              </tr>
            ) : (
              products.map((p, i) => (
                <tr
                  key={p.id}
                  className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors group"
                >
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-sm font-medium text-gray-900 max-w-[180px] truncate group-hover:text-blue-700 transition-colors">
                      {p.name}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-semibold text-gray-900">{fmt(p.revenue)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-semibold text-emerald-600">{fmt(p.profit)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-medium text-gray-700">{p.margin.toFixed(1)}%</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm text-gray-700">{p.units_sold}</span>
                  </td>
                  <td className="px-5 py-3.5 text-center text-base">
                    {trendIcon(p.trend)}
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

export default TopProductsTable