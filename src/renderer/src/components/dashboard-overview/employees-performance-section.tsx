import React from 'react'
import type { OperationsData } from './types/types'

interface EmployeePerformanceSectionProps {
  data?: OperationsData
  loading?: boolean
}

const fmt = (v: number) => v.toLocaleString() + ' XAF'

const EmployeePerformanceSection: React.FC<EmployeePerformanceSectionProps> = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 animate-pulse">
        <div className="h-5 bg-gray-100 rounded w-32" />
        {[1,2,3,4].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-6 h-6 bg-gray-100 rounded-full" />
            <div className="w-8 h-8 bg-gray-100 rounded-full" />
            <div className="flex-1">
              <div className="h-4 bg-gray-100 rounded w-24 mb-1" />
              <div className="h-3 bg-gray-100 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const employees = data?.employees?.leaderboard || []
  const sorted = [...employees].sort((a, b) => b.revenue - a.revenue)
  const topRevenue = sorted[0]?.revenue ?? 1

  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Staff Performance</h3>
          <p className="text-xs text-gray-400 mt-0.5">Sales today</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {sorted.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-400">
            No employee data available
          </div>
        ) : (
          sorted.map((emp, i) => (
            <div key={emp.id} className="flex items-center gap-3">
              {/* Rank */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                {i === 0 ? '🥇' : i + 1}
              </div>

              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {emp.name[0]}
              </div>

              {/* Name & bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 truncate">{emp.name}</span>
                  <span className="text-sm font-bold text-gray-900 ml-2">{fmt(emp.revenue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-blue-500"
                      style={{ width: `${(emp.revenue / topRevenue) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-16 text-right">{emp.transactions} txns</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default EmployeePerformanceSection