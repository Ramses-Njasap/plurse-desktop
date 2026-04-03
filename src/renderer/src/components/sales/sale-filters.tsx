import { useEffect, useRef, useState } from 'react'
import type { SaleFiltersType } from '../../pages/dashboard/sales/list'

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mobile_money' | 'credit' | 'other'

interface Props {
  filters: SaleFiltersType
  onChange: (filters: SaleFiltersType) => void
}

const statusOptions: { value: 'pending' | 'completed' | 'cancelled' | 'refunded'; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'amber' },
  { value: 'completed', label: 'Completed', color: 'emerald' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
  { value: 'refunded', label: 'Refunded', color: 'gray' },
]

const paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'credit', label: 'Credit' },
  { value: 'other', label: 'Other' },
]

const datePresets: { value: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year'; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_year', label: 'This Year' },
]

const debtStatusOptions: { value: 'overdue' | 'upcoming' | 'paid' | 'all'; label: string }[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'paid', label: 'Paid' },
  { value: 'all', label: 'All Debt' },
]

const marginStatusOptions: { value: 'above' | 'within' | 'below'; label: string }[] = [
  { value: 'above', label: 'Above Expected' },
  { value: 'within', label: 'Within Expected' },
  { value: 'below', label: 'Below Expected' },
]

const SaleFilters = ({ filters, onChange }: Props) => {
  const [isOpen, setIsOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<SaleFiltersType>(filters)
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
    const cleared: SaleFiltersType = {}
    setLocalFilters(cleared)
    onChange(cleared)
    setIsOpen(false)
    setShowDateCustom(false)
  }

  const activeFilterCount = [
    localFilters.status && localFilters.status.length > 0,
    localFilters.is_debt_sale,
    localFilters.date_preset,
    localFilters.min_price,
    localFilters.max_price,
    localFilters.min_quantity,
    localFilters.max_quantity,
    localFilters.min_margin,
    localFilters.max_margin,
    localFilters.margin_status,
    localFilters.payment_methods && localFilters.payment_methods.length > 0,
    localFilters.is_fully_paid,
    localFilters.debt_status && localFilters.debt_status !== 'all',
    localFilters.search,
    localFilters.customer_id,
    localFilters.employee_id,
    localFilters.product_id,
    localFilters.sku_id,
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
            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Status
              </label>
              <div className="flex flex-wrap gap-1.5">
                {statusOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      const current = localFilters.status || []
                      const newStatus = current.includes(opt.value)
                        ? current.filter(s => s !== opt.value)
                        : [...current, opt.value]
                      setLocalFilters(f => ({ ...f, status: newStatus.length ? newStatus : undefined }))
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      localFilters.status?.includes(opt.value)
                        ? opt.color === 'amber' ? 'bg-amber-50 border-amber-300 text-amber-700' :
                          opt.color === 'emerald' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' :
                          opt.color === 'red' ? 'bg-red-50 border-red-300 text-red-700' :
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
                          date.setHours(23, 59, 59, 999)
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

            {/* Price Range */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Price Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="number"
                    placeholder="Min"
                    value={localFilters.min_price ?? ''}
                    onChange={e => setLocalFilters(f => ({ ...f, min_price: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Max"
                    value={localFilters.max_price ?? ''}
                    onChange={e => setLocalFilters(f => ({ ...f, max_price: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Quantity Range */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Quantity Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="number"
                    placeholder="Min"
                    value={localFilters.min_quantity ?? ''}
                    onChange={e => setLocalFilters(f => ({ ...f, min_quantity: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Max"
                    value={localFilters.max_quantity ?? ''}
                    onChange={e => setLocalFilters(f => ({ ...f, max_quantity: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Margin Range */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Profit Margin
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <input
                    type="number"
                    placeholder="Min %"
                    value={localFilters.min_margin ?? ''}
                    onChange={e => setLocalFilters(f => ({ ...f, min_margin: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Max %"
                    value={localFilters.max_margin ?? ''}
                    onChange={e => setLocalFilters(f => ({ ...f, max_margin: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {marginStatusOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setLocalFilters(f => ({ ...f, margin_status: f.margin_status === opt.value ? undefined : opt.value }))}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      localFilters.margin_status === opt.value
                        ? opt.value === 'above' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' :
                          opt.value === 'within' ? 'bg-blue-50 border-blue-300 text-blue-700' :
                          'bg-amber-50 border-amber-300 text-amber-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Methods */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Payment Methods
              </label>
              <div className="flex flex-wrap gap-1.5">
                {paymentMethodOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      const current = localFilters.payment_methods || []
                      const newMethods = current.includes(opt.value)
                        ? current.filter(m => m !== opt.value)
                        : [...current, opt.value]
                      setLocalFilters(f => ({ ...f, payment_methods: newMethods.length ? newMethods : undefined }))
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      localFilters.payment_methods?.includes(opt.value)
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Debt Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Debt Status
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setLocalFilters(f => ({ ...f, is_debt_sale: f.is_debt_sale === undefined ? true : undefined, debt_status: undefined }))}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    localFilters.is_debt_sale === true && !localFilters.debt_status
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  All Debt
                </button>
                {debtStatusOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setLocalFilters(f => ({ 
                      ...f, 
                      debt_status: f.debt_status === opt.value ? undefined : opt.value,
                      is_debt_sale: true 
                    }))}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      localFilters.debt_status === opt.value
                        ? opt.value === 'overdue' ? 'bg-red-50 border-red-300 text-red-700' :
                          opt.value === 'upcoming' ? 'bg-amber-50 border-amber-300 text-amber-700' :
                          opt.value === 'paid' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' :
                          'bg-blue-50 border-blue-300 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Payment Status
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setLocalFilters(f => ({ ...f, is_fully_paid: true }))}
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    localFilters.is_fully_paid === true
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Fully Paid
                </button>
                <button
                  onClick={() => setLocalFilters(f => ({ ...f, is_fully_paid: false }))}
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    localFilters.is_fully_paid === false
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Partial/Unpaid
                </button>
              </div>
            </div>

            {/* Search */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Search
              </label>
              <input
                type="text"
                placeholder="Search by product, customer, or reference..."
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

export default SaleFilters