// src/components/public/sales-point/product-filter-bar.tsx


import type { ProductFilters } from '@renderer/components/public/types/sales'
import React, { useState } from 'react'

interface ProductFiltersBarProps {
  filters: ProductFilters
  onChange: (filters: ProductFilters) => void
  totalCount: number
  loading: boolean
  onDashboard?: () => void
}

export const ProductFiltersBar: React.FC<ProductFiltersBarProps> = ({
  filters,
  onChange,
  totalCount,
  loading,
  onDashboard,
}) => {
  const [localSearch, setLocalSearch] = useState(filters.search)

  const handleSearchCommit = () => {
    onChange({ ...filters, search: localSearch })
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearchCommit()
  }

  const clearSearch = () => {
    setLocalSearch('')
    onChange({ ...filters, search: '' })
  }

  const toggleFilter = (key: keyof ProductFilters, value: any) => {
    onChange({ ...filters, [key]: filters[key] === value ? undefined : value })
  }

  const activeFilterCount = [
    filters.low_stock_only,
    filters.best_seller_only,
    filters.has_sku === 'yes',
  ].filter(Boolean).length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Dashboard button */}
        {onDashboard && (
          <button
            onClick={onDashboard}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </button>
        )}

        {/* Search */}
        <div className="relative flex-1 min-w-52">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            {loading ? (
              <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={handleSearchCommit}
            placeholder="Search products... (Enter to search)"
            className="w-full pl-10 pr-10 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm text-slate-700
              placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
          {localSearch && (
            <button type="button" onClick={clearSearch}
              className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-red-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Result count */}
        <span className="text-sm text-slate-500 shrink-0">
          <span className="font-bold text-slate-700">{totalCount.toLocaleString()}</span> products
        </span>

        {/* Sort */}
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={filters.sort_by ?? 'product_name'}
            onChange={(e) => onChange({ ...filters, sort_by: e.target.value })}
            className="text-sm border-2 border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700
              focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium"
          >
            <option value="product_name">Name A–Z</option>
            <option value="created_on">Newest First</option>
            <option value="items_sold">Best Selling</option>
            <option value="profit_margin">Profit Margin</option>
            <option value="inventory_value">Inventory Value</option>
          </select>
          <button
            onClick={() => onChange({ ...filters, sort_order: filters.sort_order === 'asc' ? 'desc' : 'asc' })}
            className="p-2.5 border-2 border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50
              hover:border-blue-400 transition-colors"
            title={filters.sort_order === 'asc' ? 'Ascending' : 'Descending'}
          >
            {filters.sort_order === 'asc' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-semibold">Filters:</span>
        <Chip label="Has Stock" active={filters.has_sku === 'yes'} icon="📦"
          onClick={() => toggleFilter('has_sku', 'yes')} />
        <Chip label="Best Sellers" active={!!filters.best_seller_only} icon="⭐"
          onClick={() => toggleFilter('best_seller_only', true)} />
        <Chip label="Low Stock" active={!!filters.low_stock_only} icon="⚠️"
          onClick={() => toggleFilter('low_stock_only', true)}
          activeClass="bg-amber-100 text-amber-700 border-amber-300" />

        {activeFilterCount > 0 && (
          <button
            onClick={() => onChange({ search: filters.search, sort_by: filters.sort_by, sort_order: filters.sort_order })}
            className="ml-auto text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}

const Chip: React.FC<{
  label: string
  active: boolean
  onClick: () => void
  icon?: string
  activeClass?: string
}> = ({ label, active, onClick, icon, activeClass = 'bg-blue-100 text-blue-700 border-blue-300' }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
      active ? `${activeClass} shadow-sm` : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-slate-50'
    }`}
  >
    {icon && <span>{icon}</span>}
    {label}
    {active && (
      <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    )}
  </button>
)