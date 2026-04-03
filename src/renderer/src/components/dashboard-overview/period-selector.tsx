// components/dashboard-overview/components/period-selector.tsx

import React, { useState } from 'react'
import type { ComparisonPeriod } from './types/types'

interface PeriodSelectorProps {
  value: ComparisonPeriod
  onChange: (period: ComparisonPeriod) => void
  className?: string
  size?: 'sm' | 'md'
}

const periodGroups = [
  {
    label: 'Today',
    periods: [
      { value: 'today_vs_yesterday', label: 'vs Yesterday' },
      { value: 'today_vs_2days', label: 'vs 2 days ago' },
      { value: 'today_vs_3days', label: 'vs 3 days ago' },
      { value: 'today_vs_4days', label: 'vs 4 days ago' },
      { value: 'today_vs_5days', label: 'vs 5 days ago' },
      { value: 'today_vs_6days', label: 'vs 6 days ago' },
      { value: 'today_vs_7days', label: 'vs 7 days ago' },
    ]
  },
  {
    label: 'Week',
    periods: [
      { value: 'this_week_vs_last_week', label: 'vs Last Week' },
      { value: 'this_week_vs_2weeks', label: 'vs 2 weeks ago' },
      { value: 'this_week_vs_3weeks', label: 'vs 3 weeks ago' },
    ]
  },
  {
    label: 'Month',
    periods: [
      { value: 'this_month_vs_last_month', label: 'vs Last Month' },
      { value: 'this_month_vs_3months', label: 'vs 3 months ago' },
      { value: 'this_month_vs_6months', label: 'vs 6 months ago' },
    ]
  },
  {
    label: 'Year',
    periods: [
      { value: 'this_year_vs_last_year', label: 'vs Last Year' },
      { value: 'this_year_vs_2years', label: 'vs 2 years ago' },
    ]
  }
]

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ 
  value, 
  onChange, 
  className = '',
  size = 'sm' 
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const getCurrentLabel = () => {
    for (const group of periodGroups) {
      const found = group.periods.find(p => p.value === value)
      if (found) return found.label
    }
    return 'Select Period'
  }

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-1 text-xs' 
    : 'px-3 py-1.5 text-sm'

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 ${sizeClasses} bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors`}
      >
        <span>{getCurrentLabel()}</span>
        <svg 
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px] max-h-96 overflow-y-auto">
            {periodGroups.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 bg-gray-50 border-b border-gray-100">
                  {group.label}
                </div>
                {group.periods.map((period) => (
                  <button
                    key={period.value}
                    onClick={() => {
                      onChange(period.value as ComparisonPeriod)
                      setIsOpen(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${
                      value === period.value 
                        ? 'bg-blue-50 text-blue-600 font-medium' 
                        : 'text-gray-700'
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default PeriodSelector