// components/dashboard-overview/metric-card.tsx

import React from 'react'
import PeriodSelector from './period-selector'
import TrendBadge from './trend-badge'
import type { ComparisonPeriod, ComparisonResult } from './types/types'

export interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: number
  trendLabel?: string
  icon: React.ReactNode
  iconBg?: string
  loading?: boolean
  alert?: 'warning' | 'critical' | null
  badge?: string
  onClick?: () => void
  showPeriodSelector?: boolean
  selectedPeriod?: ComparisonPeriod
  onPeriodChange?: (period: ComparisonPeriod) => void
  comparisonResult?: ComparisonResult
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon,
  iconBg = 'bg-blue-50',
  loading = false,
  alert = null,
  badge,
  onClick,
  showPeriodSelector = false,
  selectedPeriod,
  onPeriodChange,
  comparisonResult,
}) => {
  const alertBorder =
    alert === 'critical'
      ? 'border-red-300 bg-red-50/30'
      : alert === 'warning'
        ? 'border-amber-300 bg-amber-50/20'
        : 'border-gray-100 bg-white'

  const displayTrend = comparisonResult?.changePercentage ?? trend
  const displayTrendLabel = comparisonResult?.label ?? trendLabel

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-gray-100" />
          <div className="w-16 h-5 rounded-full bg-gray-100" />
        </div>
        <div className="w-24 h-7 rounded bg-gray-100 mb-2" />
        <div className="w-32 h-4 rounded bg-gray-100" />
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`group w-full text-left rounded-2xl border p-5 transition-all duration-200
        hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer
        ${alertBorder}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg} group-hover:scale-110 transition-transform duration-200`}>
          {icon}
        </div>
        <div className="flex items-center gap-1.5">
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
              {badge}
            </span>
          )}
          {showPeriodSelector && selectedPeriod && onPeriodChange && (
            <PeriodSelector
              value={selectedPeriod}
              onChange={onPeriodChange}
              size="sm"
            />
          )}
          {displayTrend !== undefined && (
            <TrendBadge value={displayTrend} />
          )}
        </div>
      </div>

      {/* Value */}
      <div className="mb-1">
        <span className="text-2xl font-bold text-gray-900 tracking-tight">{value}</span>
      </div>

      {/* Title & subtitle */}
      <div className="text-sm font-medium text-gray-600">{title}</div>
      {(subtitle || displayTrendLabel) && (
        <div className="text-xs text-gray-400 mt-0.5">
          {subtitle ?? displayTrendLabel}
        </div>
      )}

      {/* Click hint */}
      <div className="mt-3 flex items-center gap-1 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
        <span>View details</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

export default MetricCard