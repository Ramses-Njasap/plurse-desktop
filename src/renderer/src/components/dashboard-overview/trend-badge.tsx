import React from 'react'

interface TrendBadgeProps {
  value: number
  suffix?: string
  size?: 'sm' | 'md'
}

const TrendBadge: React.FC<TrendBadgeProps> = ({ value, suffix = '%', size = 'sm' }) => {
  const isPositive = value > 0
  const isNeutral = value === 0

  const colorClass = isNeutral
    ? 'text-gray-500 bg-gray-100'
    : isPositive
      ? 'text-emerald-700 bg-emerald-50'
      : 'text-red-600 bg-red-50'

  const arrow = isNeutral ? '→' : isPositive ? '↑' : '↓'
  const sizeClass = size === 'md' ? 'text-sm px-2.5 py-1' : 'text-xs px-2 py-0.5'

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full font-semibold ${colorClass} ${sizeClass}`}>
      <span>{arrow}</span>
      <span>
        {Math.abs(value).toFixed(1)}
        {suffix}
      </span>
    </span>
  )
}

export default TrendBadge