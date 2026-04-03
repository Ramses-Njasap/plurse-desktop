import { useEffect, useRef, useState } from 'react'
import type { DatePreset, TransactionFilters, TransactionFilterType } from '../../pages/dashboard/finance/transactions/types'

interface Props {
  filters: TransactionFilters
  onChange: (filters: TransactionFilters) => void
}

const typeOptions: { value: TransactionFilterType; label: string; color: string }[] = [
  { value: 'all', label: 'All Transactions', color: 'gray' },
  { value: 'cashin', label: 'Cash In', color: 'emerald' },
  { value: 'cashout', label: 'Cash Out', color: 'red' },
  { value: 'transfer', label: 'Transfer', color: 'blue' },
]

const datePresets: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_year', label: 'This Year' },
]

const TransactionFilters = ({ filters, onChange }: Props) => {
  const [isOpen, setIsOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<TransactionFilters>(filters)
  const [showDateCustom, setShowDateCustom] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    if (isOpen) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [isOpen])

  const handleApply = () => {
    onChange(localFilters)
    setIsOpen(false)
  }

  const handleClear = () => {
    const cleared: TransactionFilters = {}
    setLocalFilters(cleared)
    onChange(cleared)
    setIsOpen(false)
    setShowDateCustom(false)
  }

  const activeFilterCount = [
    localFilters.transaction_type && localFilters.transaction_type !== 'all',
    localFilters.date_preset,
    localFilters.min_amount,
    localFilters.max_amount,
    localFilters.recorded_by,
    localFilters.search,
  ].filter(Boolean).length

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-all shadow-sm"
      >
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Filters
        {activeFilterCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-500 rounded-full">
            {activeFilterCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-40">
          <div className="max-h-[70vh] overflow-y-auto p-5 space-y-5">
            {/* Transaction Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Transaction Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {typeOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setLocalFilters(f => ({ ...f, transaction_type: opt.value }))}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                      localFilters.transaction_type === opt.value
                        ? opt.color === 'emerald' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' :
                          opt.color === 'red' ? 'bg-red-50 border-red-300 text-red-700' :
                          opt.color === 'blue' ? 'bg-blue-50 border-blue-300 text-blue-700' :
                          'bg-gray-100 border-gray-300 text-gray-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Date
              </label>
              <div className="flex flex-wrap gap-1.5">
                {datePresets.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => {
                      setLocalFilters(f => ({ 
                        ...f, 
                        date_preset: preset.value, 
                        date_from: undefined, 
                        date_to: undefined 
                      }))
                      setShowDateCustom(false)
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      localFilters.date_preset === preset.value
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setLocalFilters(f => ({ ...f, date_preset: undefined }))
                    setShowDateCustom(true)
                  }}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    showDateCustom ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Custom
                </button>
              </div>

              {showDateCustom && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">From</label>
                    <input
                      type="date"
                      value={localFilters.date_from ? new Date(localFilters.date_from * 1000).toISOString().split('T')[0] : ''}
                      onChange={e => {
                        const date = e.target.value ? new Date(e.target.value) : undefined
                        setLocalFilters(f => ({ 
                          ...f, 
                          date_from: date ? Math.floor(date.getTime() / 1000) : undefined,
                          date_preset: undefined 
                        }))
                      }}
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">To</label>
                    <input
                      type="date"
                      value={localFilters.date_to ? new Date(localFilters.date_to * 1000).toISOString().split('T')[0] : ''}
                      onChange={e => {
                        const date = e.target.value ? new Date(e.target.value) : undefined
                        if (date) {
                          date.setHours(23, 59, 59, 999) // End of day
                        }
                        setLocalFilters(f => ({ 
                          ...f, 
                          date_to: date ? Math.floor(date.getTime() / 1000) : undefined,
                          date_preset: undefined 
                        }))
                      }}
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Amount Range */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Amount Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="number"
                    placeholder="Min"
                    value={localFilters.min_amount ?? ''}
                    onChange={e => setLocalFilters(f => ({ ...f, min_amount: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Max"
                    value={localFilters.max_amount ?? ''}
                    onChange={e => setLocalFilters(f => ({ ...f, max_amount: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Search */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Search in Description
              </label>
              <input
                type="text"
                placeholder="Search..."
                value={localFilters.search || ''}
                onChange={e => setLocalFilters(f => ({ ...f, search: e.target.value || undefined }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Clear all
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TransactionFilters