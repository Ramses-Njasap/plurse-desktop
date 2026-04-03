// src/components/public/sales-point/sku-modal.tsx

import { ImageGallery } from '@renderer/components/public/sales-point/image-gallery'
import type { Product, SKU, SKUFilters } from '@renderer/components/public/types/sales'
import { formatCurrency, formatPercent, nanSafe } from '@renderer/components/public/types/utils'
import React, { useEffect, useMemo, useState } from 'react'

interface SkuModalProps {
  product: Product
  onClose: () => void
  onSelectSku: (sku: SKU) => void
}

export const SkuModal: React.FC<SkuModalProps> = ({ product, onClose, onSelectSku }) => {
  const [skus, setSkus] = useState<SKU[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<SKUFilters>({ search: '', has_stock: undefined, is_active: undefined })

  useEffect(() => {
    const fetchSkus = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await window.api.products.getAllSkus({
          product_id: product.id,
          is_deleted: 'no',
          with_stock_purchases: true,
          with_attributes: true,
          with_images: true,
        })
        if (result.success && result.data) {
          setSkus(result.data.items as SKU[])
        } else {
          setError(result.message ?? 'Failed to load SKUs')
        }
      } catch (e: any) {
        setError(e?.message ?? 'Unexpected error loading SKUs')
      }
      setLoading(false)
    }
    fetchSkus()
  }, [product.id])

  const filteredSkus = useMemo(() => {
    return skus.filter((sku) => {
      const q = filters.search.toLowerCase()
      const matchSearch = !q ||
        sku.sku_name.toLowerCase().includes(q) ||
        sku.code.toLowerCase().includes(q) ||
        sku.attributes?.some((a) => `${a.name} ${a.value}`.toLowerCase().includes(q))

      const purchaseCount = sku.stats?.purchase_count ?? sku.stock_purchases?.length ?? 0
      const matchStock = filters.has_stock === undefined ? true
        : filters.has_stock ? purchaseCount > 0 : purchaseCount === 0
      const matchActive = filters.is_active === undefined ? true : sku.is_active === filters.is_active

      return matchSearch && matchStock && matchActive
    })
  }, [skus, filters])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold">{product.product_name}</h2>
              <p className="text-blue-200 text-sm">{product.category_name} · Choose a SKU variant</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/20 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Product summary bar */}
        <div className="grid grid-cols-5 gap-0 border-b border-slate-100 bg-slate-50/80">
          {[
            {
              label: 'Total Sold',
              value: `${nanSafe(product.metrics.items_sold ?? product.metrics.total_items_sold).toLocaleString()}`,
              sub: 'units',
              icon: '📦',
            },
            {
              label: 'Remaining',
              value: `${nanSafe(product.metrics.total_items_remaining ?? 0).toLocaleString()}`,
              sub: 'units',
              icon: '🏪',
              highlight: product.metrics.is_low_stock,
            },
            {
              label: 'Avg Margin',
              value: formatPercent(nanSafe(product.metrics.avg_sku_profit_margin)),
              icon: '📈',
              valueClass: nanSafe(product.metrics.avg_sku_profit_margin) > 20 ? 'text-emerald-600' : 'text-amber-600',
            },
            {
              label: 'Inv. Value',
              value: formatCurrency(nanSafe(product.metrics.inventory_value)),
              icon: '💰',
            },
            {
              label: 'SKU Variants',
              value: `${skus.length}`,
              sub: 'total',
              icon: '🏷️',
            },
          ].map((item, i) => (
            <div key={i} className={`px-4 py-3 ${i > 0 ? 'border-l border-slate-200' : ''} ${item.highlight ? 'bg-amber-50' : ''}`}>
              <p className="text-[10px] text-slate-400 mb-0.5 font-semibold uppercase tracking-wide flex items-center gap-1">
                <span>{item.icon}</span> {item.label}
              </p>
              <p className={`text-sm font-bold ${(item as any).valueClass ?? 'text-slate-800'}`}>
                {item.value}
                {item.sub && <span className="text-xs font-normal text-slate-400 ml-1">{item.sub}</span>}
              </p>
            </div>
          ))}
        </div>

        {/* Search & filter bar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-white flex-wrap">
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              autoFocus
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search SKUs by name, code, attribute..."
              className="w-full pl-9 pr-4 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <FilterToggle label="Has Stock" active={filters.has_stock === true}
            onClick={() => setFilters((f) => ({ ...f, has_stock: f.has_stock === true ? undefined : true }))} />
          <FilterToggle label="Active Only" active={filters.is_active === true}
            onClick={() => setFilters((f) => ({ ...f, is_active: f.is_active === true ? undefined : true }))} />

          {(filters.search || filters.has_stock !== undefined || filters.is_active !== undefined) && (
            <button onClick={() => setFilters({ search: '', has_stock: undefined, is_active: undefined })}
              className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400 shrink-0">
            {filteredSkus.length}/{skus.length} shown
          </span>
        </div>

        {/* SKU List */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <LoadingState label="Loading SKU variants..." />
          ) : error ? (
            <ErrorState message={error} />
          ) : filteredSkus.length === 0 ? (
            <EmptyState label={skus.length === 0 ? 'No SKUs found for this product' : 'No SKUs match your search'} />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredSkus.map((sku) => (
                <SkuCard key={sku.id} sku={sku} onClick={() => onSelectSku(sku)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const SkuCard: React.FC<{ sku: SKU; onClick: () => void }> = ({ sku, onClick }) => {
  const purchaseCount = sku.stats?.purchase_count ?? sku.stock_purchases?.length ?? 0
  const hasStock = purchaseCount > 0
  const metrics = (sku as any).metrics

  // Aggregate stock info from purchases
  const totalRemaining = sku.stock_purchases?.reduce((s, p) => {
    const rem = (p as any).quantities?.remaining ?? (p as any).quantity ?? 0
    return s + rem
  }, 0) ?? 0

  const avgMargin = nanSafe(metrics?.profit_margin ?? metrics?.avg_profit_margin ?? 0)
  const avgCost = nanSafe(metrics?.avg_cost_per_unit ?? 0)
  const avgSellPrice = nanSafe(metrics?.avg_selling_price ?? 0)
  const totalRevenue = nanSafe(metrics?.total_revenue ?? 0)
  const totalSold = nanSafe(metrics?.total_sold ?? 0)
  const sellThrough = nanSafe(metrics?.sell_through_rate ?? 0)

  const marginColor =
    avgMargin > 30 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    avgMargin > 15 ? 'text-blue-700 bg-blue-50 border-blue-200' :
    avgMargin > 0  ? 'text-amber-700 bg-amber-50 border-amber-200' :
                     'text-red-700 bg-red-50 border-red-200'

  // Price range from stock purchases
  const minSellPrice = sku.stock_purchases?.reduce((min, p) => {
    const mp = nanSafe((p as any).min_price ?? (p as any).sku?.min_selling_price ?? 0)
    return mp > 0 && (min === 0 || mp < min) ? mp : min
  }, 0) ?? 0

  const maxSellPrice = sku.stock_purchases?.reduce((max, p) => {
    const mp = nanSafe((p as any).max_price ?? (p as any).sku?.max_selling_price ?? 0)
    return mp > max ? mp : max
  }, 0) ?? 0

  return (
    <button
      onClick={onClick}
      disabled={!hasStock || !sku.is_active}
      className={`w-full flex gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
        !hasStock || !sku.is_active
          ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
          : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 hover:shadow-lg hover:shadow-blue-100/50 cursor-pointer'
      }`}
    >
      {/* Image */}
      <div className="w-24 h-24 shrink-0">
        <ImageGallery images={sku.images ?? []} altText={sku.sku_name} className="w-24 h-24" thumbSize="sm" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-slate-800">{sku.sku_name}</h4>
              {!sku.is_active && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Inactive</span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{sku.code}</p>
          </div>

          {/* Stock badge */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              hasStock ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {purchaseCount} batch{purchaseCount !== 1 ? 'es' : ''}
            </span>
            {totalRemaining > 0 && (
              <span className="text-xs text-slate-500 font-semibold">
                {totalRemaining.toLocaleString()} units
              </span>
            )}
          </div>
        </div>

        {/* Attributes */}
        {sku.attributes && sku.attributes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {sku.attributes.slice(0, 5).map((attr) => (
              <span key={attr.id}
                className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-lg font-medium">
                <span className="text-blue-400">{attr.name}:</span> {attr.value}{attr.unit ? ` ${attr.unit}` : ''}
              </span>
            ))}
            {sku.attributes.length > 5 && (
              <span className="text-xs text-slate-400">+{sku.attributes.length - 5} more</span>
            )}
          </div>
        )}

        {/* Metrics row */}
        {hasStock && (
          <div className="grid grid-cols-4 gap-2">
            {avgMargin !== 0 && (
              <div className={`text-center px-2 py-1.5 rounded-lg border text-xs font-bold ${marginColor}`}>
                <div className="text-[9px] font-semibold opacity-70 uppercase mb-0.5">Margin</div>
                {formatPercent(avgMargin)}
              </div>
            )}
            {avgCost > 0 && (
              <div className="text-center px-2 py-1.5 rounded-lg border border-slate-100 bg-slate-50 text-xs">
                <div className="text-[9px] text-slate-400 font-semibold uppercase mb-0.5">Avg Cost</div>
                <span className="font-bold text-slate-700">{formatCurrency(avgCost)}</span>
              </div>
            )}
            {(minSellPrice > 0 || maxSellPrice > 0) && (
              <div className="text-center px-2 py-1.5 rounded-lg border border-blue-100 bg-blue-50 text-xs col-span-2">
                <div className="text-[9px] text-blue-400 font-semibold uppercase mb-0.5">Sell Range</div>
                <span className="font-bold text-blue-700">
                  {minSellPrice > 0 ? formatCurrency(minSellPrice) : '—'}
                  {minSellPrice > 0 && maxSellPrice > 0 ? ' – ' : ''}
                  {maxSellPrice > 0 ? formatCurrency(maxSellPrice) : ''}
                </span>
              </div>
            )}
            {totalSold > 0 && (
              <div className="text-center px-2 py-1.5 rounded-lg border border-slate-100 bg-slate-50 text-xs">
                <div className="text-[9px] text-slate-400 font-semibold uppercase mb-0.5">Sold</div>
                <span className="font-bold text-slate-700">{totalSold.toLocaleString()}</span>
              </div>
            )}
            {sellThrough > 0 && (
              <div className={`text-center px-2 py-1.5 rounded-lg border text-xs ${
                sellThrough > 70 ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-slate-50'
              }`}>
                <div className="text-[9px] text-slate-400 font-semibold uppercase mb-0.5">Sell-Thru</div>
                <span className={`font-bold ${sellThrough > 70 ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {sellThrough.toFixed(0)}%
                </span>
              </div>
            )}
            {totalRevenue > 0 && (
              <div className="text-center px-2 py-1.5 rounded-lg border border-slate-100 bg-slate-50 text-xs">
                <div className="text-[9px] text-slate-400 font-semibold uppercase mb-0.5">Revenue</div>
                <span className="font-bold text-slate-700">{formatCurrency(totalRevenue)}</span>
              </div>
            )}
          </div>
        )}

        {/* Bottom */}
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-slate-400">
            {sku.stats?.image_count ?? 0} img · {sku.stats?.attribute_count ?? 0} attr
          </p>
          {hasStock && sku.is_active ? (
            <span className="text-blue-600 text-sm font-bold flex items-center gap-1">
              View Batches
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          ) : (
            <span className="text-xs text-slate-400 italic">
              {!sku.is_active ? 'SKU deactivated' : 'No stock available'}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

const FilterToggle: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button onClick={onClick}
    className={`px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
      active ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
    }`}>
    {label}
  </button>
)

const LoadingState: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4">
    <svg className="w-10 h-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <p className="text-sm text-slate-500 font-medium">{label}</p>
  </div>
)

const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center">
      <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <p className="text-sm text-red-600 font-semibold">Error loading SKUs</p>
    <p className="text-xs text-slate-400">{message}</p>
  </div>
)

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
    <svg className="w-12 h-12 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <p className="text-sm font-semibold">{label}</p>
  </div>
)