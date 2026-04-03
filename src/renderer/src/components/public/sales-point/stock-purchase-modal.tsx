// src/components/public/sales-point/stock-purchase-modal.tsx

import type { UseCart } from '@renderer/components/public/hooks/use-cart'
import { ImageGallery } from '@renderer/components/public/sales-point/image-gallery'
import type { SKU, SKUAttribute, StockPurchase, StockPurchaseFilters } from '@renderer/components/public/types/sales'
import { formatCurrency, formatDate, formatPercent, getExpiryStatus, nanSafe } from '@renderer/components/public/types/utils'
import React, { useEffect, useMemo, useState } from 'react'

type RawStockPurchaseItem = {
  id: number
  sku_id: number
  quantity: number
  price_per_unit: number
  total_price_bought: number
  purchased_on: number | null
  expiry_date: string | null
  batch_number: string | null
  avg_anticipated_profit_margin: number | null
  arrived_on?: number | null
  manufacture_date?: string | null
  shipping_cost?: number | null
  supplier_id?: number | null
  sku?: {
    sku_name?: string
    code?: string
    min_selling_price?: number | null
    max_selling_price?: number | null
    product?: { name?: string } | null
  } | null
  supplier?: { supplier_name?: string } | null
  total_cost?: number
  expected_revenue?: { min: number; max: number; avg: number }
  // New rich fields from updated API
  quantities?: { bought: number; sold: number; remaining: number; sell_through_rate?: number }
  costs?: { price_per_unit: number; shipping_cost: number; landed_cost_per_unit: number; total_landed_cost: number }
  selling_price_range?: { min: number; max: number; avg: number }
  financials?: {
    revenue: number
    cost_of_sold: number
    profit: number
    profit_margin: number
    expected_revenue: { min: number; max: number; avg: number }
    expected_profit_margin: number
  }
  dates?: { purchased: number | null; arrived: number | null; manufacture: string | null; expiry: string | null }
  time_metrics?: { days_in_inventory: number | null; days_to_expiry: number | null; is_expired: boolean; is_expiring_soon: boolean }
  performance?: { rating: string; stock_status: string; is_profitable: boolean }
}

function normalise(item: RawStockPurchaseItem, sku: SKU): StockPurchase {
  // Support both old flat shape and new nested shape
  const qty = item.quantities?.remaining ?? item.quantity
  const isExpired = item.time_metrics?.is_expired ?? false
  const daysUntilExpiry = item.time_metrics?.days_to_expiry ??
    (item.expiry_date
      ? Math.floor((new Date(item.expiry_date).getTime() - Date.now()) / 86_400_000)
      : null)

  const expiryDate = item.dates?.expiry ?? item.expiry_date ?? null
  const costPerUnit = item.costs?.price_per_unit ?? nanSafe(item.price_per_unit)
  const minPrice: number | null = item.selling_price_range?.min ?? item.sku?.min_selling_price ?? null
  const maxPrice: number | null = item.selling_price_range?.max ?? item.sku?.max_selling_price ?? null
  const expectedRevenue = item.financials?.expected_revenue ?? item.expected_revenue ?? { min: 0, max: 0, avg: 0 }

  return {
    id: item.id,
    sku_id: item.sku_id,
    quantity: qty,
    price_per_unit: costPerUnit,
    total_price_bought: item.total_price_bought,
    shipping_cost: item.costs?.shipping_cost ?? item.shipping_cost ?? null,
    min_price: minPrice,
    max_price: maxPrice,
    avg_anticipated_profit_margin: item.avg_anticipated_profit_margin ?? item.financials?.expected_profit_margin ?? null,
    manufacture_date: item.dates?.manufacture ?? item.manufacture_date ?? null,
    expiry_date: expiryDate,
    batch_number: item.batch_number ?? null,
    purchased_on: item.dates?.purchased ?? item.purchased_on ?? null,
    arrived_on: item.dates?.arrived ?? item.arrived_on ?? null,
    supplier_id: item.supplier_id ?? null,
    sku_name: item.sku?.sku_name ?? sku.sku_name,
    sku_code: item.sku?.code ?? sku.code,
    product_name: item.sku?.product?.name ?? sku.product?.name ?? '',
    supplier_name: item.supplier?.supplier_name ?? null,
    calculations: {
      total_cost: nanSafe(item.costs?.total_landed_cost ?? item.total_cost ?? item.total_price_bought),
      cost_per_unit: costPerUnit,
      expected_revenue: expectedRevenue,
      expected_profit: { min: 0, max: 0, avg: 0 },
      roi: { min: 0, max: 0, avg: 0 },
    },
    is_expired: isExpired,
    days_until_expiry: daysUntilExpiry,
    sku: item.sku,
    supplier: item.supplier,
    total_cost: item.costs?.total_landed_cost ?? item.total_cost,
    expected_revenue: expectedRevenue,
    // Extra rich fields
    _landed_cost_per_unit: item.costs?.landed_cost_per_unit ?? costPerUnit,
    _actual_profit_margin: item.financials?.profit_margin ?? null,
    _actual_revenue: item.financials?.revenue ?? null,
    _sell_through_rate: item.quantities?.sell_through_rate ?? null,
    _qty_sold: (item.quantities?.bought ?? item.quantity) - qty,
    _qty_bought: item.quantities?.bought ?? item.quantity,
    _performance_rating: item.performance?.rating ?? null,
  } as StockPurchase & Record<string, any>
}

interface StockPurchaseModalProps {
  sku: SKU
  cart: UseCart
  onClose: () => void
  onAdded?: () => void
}

export const StockPurchaseModal: React.FC<StockPurchaseModalProps> = ({ sku, cart, onClose, onAdded }) => {
  const [purchases, setPurchases] = useState<StockPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<StockPurchaseFilters>({
    search: '',
    exclude_expired: true,
    sort_by: 'purchased_on',
    sort_order: 'desc',
  })

  const doFetch = () => {
    setLoading(true)
    setError('')
    setPurchases([])

    window.api.products
      .getAllStockPurchases({
        sku_id: sku.id,
        is_deleted: 'no' as const,
        with_sku_details: true,
        with_supplier_details: true,
      })
      .then((result) => {
        if (result.success && result.data) {
          const normalised = (result.data.items as unknown as RawStockPurchaseItem[]).map((item) =>
            normalise(item, sku)
          )
          setPurchases(normalised)
        } else {
          setError(result.message ?? 'Failed to load stock batches.')
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unexpected error loading batches.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { doFetch() }, [sku.id])

  const filtered = useMemo<StockPurchase[]>(() => {
    const q = filters.search.trim().toLowerCase()
    let list = purchases.filter((p) => {
      if (q) {
        const inBatch = (p.batch_number ?? '').toLowerCase().includes(q)
        const inSupplier = (p.supplier_name ?? '').toLowerCase().includes(q)
        const inQty = String(p.quantity).includes(q)
        if (!inBatch && !inSupplier && !inQty) return false
      }
      if (filters.exclude_expired && p.is_expired) return false
      if (filters.min_quantity != null && p.quantity < filters.min_quantity) return false
      if (filters.max_quantity != null && p.quantity > filters.max_quantity) return false
      if (filters.min_price != null && p.price_per_unit < filters.min_price) return false
      if (filters.max_price != null && p.price_per_unit > filters.max_price) return false
      return true
    })

    const dir = filters.sort_order === 'asc' ? 1 : -1
    list = [...list].sort((a, b) => {
      switch (filters.sort_by) {
        case 'quantity': return (a.quantity - b.quantity) * dir
        case 'price_per_unit': return (a.price_per_unit - b.price_per_unit) * dir
        case 'expiry_date': {
          const ad = a.days_until_expiry ?? 99_999
          const bd = b.days_until_expiry ?? 99_999
          return (ad - bd) * dir
        }
        default: return ((a.purchased_on ?? 0) - (b.purchased_on ?? 0)) * dir
      }
    })
    return list
  }, [purchases, filters])

  const isInCart = (purchaseId: number) => cart.items.some((i) => i.purchase.id === purchaseId)

  const handleToggleCart = (purchase: StockPurchase) => {
    if (isInCart(purchase.id)) {
      // Find the cart item with this purchase and remove it
      const cartItem = cart.items.find(i => i.purchase.id === purchase.id)
      if (cartItem) {
        cart.removeItem(cartItem.cartId)
      }
    } else {
      // Add to cart
      const defaultPrice =
        nanSafe(purchase.max_price) > 0 ? nanSafe(purchase.max_price) :
        nanSafe(purchase.min_price) > 0 ? nanSafe(purchase.min_price) :
        nanSafe(purchase.price_per_unit)
      cart.addItem(purchase, sku, defaultPrice, 1)
    }
    if (onAdded) onAdded()
  }

  const totalAvailableQty = purchases.reduce((sum, p) => (p.is_expired ? sum : sum + p.quantity), 0)

  const hasActiveFilters = !!filters.search || filters.min_quantity != null ||
    filters.max_quantity != null || filters.min_price != null || filters.max_price != null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white border-b border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden">
              <ImageGallery images={sku.images ?? []} altText={sku.sku_name} className="w-14 h-14" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">{sku.sku_name}</h2>
              <p className="text-slate-400 text-sm mt-0.5">
                {sku.product?.name ?? '—'}
                {sku.code ? <><span className="mx-1">·</span><span className="font-mono text-blue-400">{sku.code}</span></> : null}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!loading && (
              <div className="hidden sm:flex flex-col items-end text-xs">
                <span className="text-slate-400">Available</span>
                <span className="text-white font-bold text-base">{totalAvailableQty.toLocaleString()} units</span>
              </div>
            )}
            {cart.totalItems > 0 && (
              <div className="flex items-center gap-1.5 bg-blue-600/80 px-3 py-1.5 rounded-full text-sm font-semibold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {cart.totalItems} in cart
              </div>
            )}
            <button onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Attributes strip */}
        {sku.attributes && sku.attributes.length > 0 && (
          <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-blue-500 font-bold uppercase tracking-wide mr-1">Attributes:</span>
            {sku.attributes.map((attr: SKUAttribute) => (
              <span key={attr.id}
                className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded-lg font-medium shadow-sm">
                <span className="text-blue-400">{attr.name}:</span> {attr.value}{attr.unit ? ` ${attr.unit}` : ''}
              </span>
            ))}
          </div>
        )}

        {/* Filter bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative flex-1 min-w-44">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Search batch, supplier…"
                className="w-full pl-9 pr-4 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium shrink-0">Qty:</span>
              <input type="number" min={0} placeholder="Min" value={filters.min_quantity ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, min_quantity: e.target.value !== '' ? Number(e.target.value) : undefined }))}
                className="w-14 px-2 py-2 border-2 border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500" />
              <span className="text-slate-400">–</span>
              <input type="number" min={0} placeholder="Max" value={filters.max_quantity ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, max_quantity: e.target.value !== '' ? Number(e.target.value) : undefined }))}
                className="w-14 px-2 py-2 border-2 border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500" />
            </div>

            <select value={filters.sort_by ?? 'purchased_on'}
              onChange={(e) => setFilters((f) => ({ ...f, sort_by: e.target.value as StockPurchaseFilters['sort_by'] }))}
              className="text-xs border-2 border-slate-200 rounded-xl px-2 py-2 bg-white focus:outline-none focus:border-blue-500">
              <option value="purchased_on">By Date</option>
              <option value="quantity">By Qty</option>
              <option value="price_per_unit">By Cost</option>
              <option value="expiry_date">By Expiry</option>
            </select>

            <button onClick={() => setFilters((f) => ({ ...f, sort_order: f.sort_order === 'asc' ? 'desc' : 'asc' }))}
              className="p-2 border-2 border-slate-200 rounded-xl bg-white text-slate-600 hover:border-blue-400 transition-colors">
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

            <button onClick={() => setFilters((f) => ({ ...f, exclude_expired: !f.exclude_expired }))}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                filters.exclude_expired
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}>
              {filters.exclude_expired ? '✓ Hide Expired' : 'Show Expired'}
            </button>

            {hasActiveFilters && (
              <button onClick={() => setFilters((f) => ({ search: '', exclude_expired: f.exclude_expired, sort_by: f.sort_by, sort_order: f.sort_order }))}
                className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
            )}

            <span className="ml-auto text-xs text-slate-400 shrink-0">{filtered.length}/{purchases.length} batches</span>
          </div>
        </div>

        {/* Batch list */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? <LoadingState /> :
           error ? <ErrorState message={error} onRetry={doFetch} /> :
           filtered.length === 0 ? (
             <EmptyState hasPurchases={purchases.length > 0}
               onClearFilters={() => setFilters({ search: '', exclude_expired: false, sort_by: 'purchased_on', sort_order: 'desc' })} />
           ) : (
             <div className="space-y-4">
               {filtered.map((purchase) => (
                 <PurchaseBatchCard
                   key={purchase.id}
                   purchase={purchase}
                   isInCart={isInCart(purchase.id)}
                   onToggle={() => handleToggleCart(purchase)}
                 />
               ))}
             </div>
           )}
        </div>

        {/* Footer */}
        {cart.totalItems > 0 && (
          <div className="px-5 py-3.5 border-t border-slate-100 bg-blue-50 flex items-center justify-between gap-4">
            <p className="text-sm text-blue-700 font-semibold">
              🛒 {cart.totalItems} item{cart.totalItems !== 1 ? 's' : ''} in cart · {formatCurrency(cart.subtotal)}
            </p>
            <button onClick={onClose}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shrink-0">
              Done — Go to Checkout →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Batch card ───────────────────────────────────────────────────────────
const PurchaseBatchCard: React.FC<{
  purchase: StockPurchase & Record<string, any>
  isInCart: boolean
  onToggle: () => void
}> = ({ purchase, isInCart, onToggle }) => {
  const expiry = getExpiryStatus(purchase.expiry_date, purchase.days_until_expiry)
  const costPerUnit = nanSafe(purchase.price_per_unit)
  const landedCost = nanSafe(purchase._landed_cost_per_unit ?? costPerUnit)
  const minPrice = nanSafe(purchase.min_price)
  const maxPrice = nanSafe(purchase.max_price)

  // Profit if sold at min/max
  const marginAtMin = minPrice > 0 ? ((minPrice - landedCost) / minPrice) * 100 : null
  const marginAtMax = maxPrice > 0 ? ((maxPrice - landedCost) / maxPrice) * 100 : null
  const roiValue = nanSafe(purchase._actual_profit_margin ?? purchase.avg_anticipated_profit_margin ?? 0)
  const sellThrough = nanSafe(purchase._sell_through_rate ?? 0)
  const qtySold = nanSafe(purchase._qty_sold ?? 0)
  const qtyBought = nanSafe(purchase._qty_bought ?? purchase.quantity)
  const actualRevenue = nanSafe(purchase._actual_revenue ?? 0)
  const perfRating = purchase._performance_rating

  const sellRangeText =
    minPrice > 0 && maxPrice > 0 ? `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}` :
    maxPrice > 0 ? `≤ ${formatCurrency(maxPrice)}` :
    minPrice > 0 ? `≥ ${formatCurrency(minPrice)}` : '—'

  return (
    <div className={`rounded-2xl border-2 p-5 transition-all ${
      purchase.is_expired ? 'border-red-200 bg-red-50/50' :
      isInCart ? 'border-blue-400 bg-blue-50/40 shadow-md shadow-blue-100/60' :
      'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
    }`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          {/* Top row: batch + status tags */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {purchase.batch_number ? (
              <span className="text-sm font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-lg border border-slate-200">
                Batch: {purchase.batch_number}
              </span>
            ) : (
              <span className="text-xs text-slate-400 italic">No batch number</span>
            )}
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${expiry.bg} ${expiry.color}`}>
              {expiry.label}
            </span>
            {purchase.is_expired && (
              <span className="text-xs bg-red-200 text-red-700 px-2.5 py-1 rounded-full font-bold">EXPIRED</span>
            )}
            {perfRating && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                perfRating === 'Excellent' ? 'bg-emerald-100 text-emerald-700' :
                perfRating === 'Good' ? 'bg-blue-100 text-blue-700' :
                perfRating === 'Average' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {perfRating}
              </span>
            )}
            {purchase.supplier_name && (
              <span className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {purchase.supplier_name}
              </span>
            )}
          </div>

          {/* Primary metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
            <MetricCell
              label="Available"
              value={`${purchase.quantity.toLocaleString()} units`}
              highlight={purchase.quantity > 0 && purchase.quantity < 10}
              sub={qtyBought > 0 ? `${qtySold} sold` : undefined}
            />
            <MetricCell
              label="Cost / Unit"
              value={formatCurrency(costPerUnit)}
              sub={landedCost !== costPerUnit ? `${formatCurrency(landedCost)} landed` : undefined}
            />
            <MetricCell
              label="Sell Range"
              value={sellRangeText}
              valueClass="text-blue-700"
              sub="suggested"
            />
            <MetricCell
              label="Expected ROI"
              value={roiValue > 0 ? formatPercent(roiValue) : '—'}
              valueClass={roiValue > 20 ? 'text-emerald-600' : roiValue > 0 ? 'text-amber-600' : 'text-slate-400'}
            />
          </div>

          {/* Margin preview at min/max price */}
          {(marginAtMin !== null || marginAtMax !== null) && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs text-slate-500 font-semibold">Margin at:</span>
              {marginAtMin !== null && (
                <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                  marginAtMin > 20 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                  marginAtMin > 5 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                  'bg-red-50 border-red-200 text-red-700'
                }`}>
                  Min ({formatCurrency(minPrice)}) → {formatPercent(marginAtMin)}
                </span>
              )}
              {marginAtMax !== null && (
                <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                  marginAtMax > 20 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                  marginAtMax > 5 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                  'bg-red-50 border-red-200 text-red-700'
                }`}>
                  Max ({formatCurrency(maxPrice)}) → {formatPercent(marginAtMax)}
                </span>
              )}
            </div>
          )}

          {/* Secondary metrics: sell-through + revenue (if any sales happened) */}
          {(sellThrough > 0 || actualRevenue > 0) && (
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              {sellThrough > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500">Sell-through:</span>
                  <span className={`font-bold ${sellThrough > 70 ? 'text-emerald-600' : sellThrough > 40 ? 'text-amber-600' : 'text-slate-600'}`}>
                    {sellThrough.toFixed(1)}%
                  </span>
                  <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${sellThrough > 70 ? 'bg-emerald-500' : sellThrough > 40 ? 'bg-amber-500' : 'bg-slate-400'}`}
                      style={{ width: `${Math.min(sellThrough, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {actualRevenue > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500">Revenue so far:</span>
                  <span className="font-bold text-slate-700">{formatCurrency(actualRevenue)}</span>
                </div>
              )}
            </div>
          )}

          {/* Dates */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            {purchase.purchased_on != null && <span>Purchased: {formatDate(purchase.purchased_on)}</span>}
            {purchase.arrived_on != null && <span>Arrived: {formatDate(purchase.arrived_on)}</span>}
            {purchase.manufacture_date && <span>Mfg: {purchase.manufacture_date}</span>}
            {purchase.expiry_date && <span>Expiry: {purchase.expiry_date}</span>}
            {purchase.shipping_cost && nanSafe(purchase.shipping_cost) > 0 && (
              <span>Shipping: {formatCurrency(nanSafe(purchase.shipping_cost))}</span>
            )}
          </div>
        </div>

        {/* Action button - Toggle between Add and Selected */}
        {!purchase.is_expired && (
          <div className="shrink-0">
            <button
              onClick={onToggle}
              className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition-all min-w-[60px] ${
                isInCart
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                  : 'border-blue-300 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600'
              } active:scale-95`}
            >
              {isInCart ? (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs font-bold">Selected</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-xs font-bold">Add</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const MetricCell: React.FC<{
  label: string
  value: string
  valueClass?: string
  highlight?: boolean
  sub?: string
}> = ({ label, value, valueClass = 'text-slate-800', highlight = false, sub }) => (
  <div className={`rounded-xl p-3 border ${highlight ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">{label}</p>
    <p className={`text-sm font-bold ${highlight ? 'text-amber-700' : valueClass}`}>{value}</p>
    {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
  </div>
)

const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
    <svg className="w-10 h-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <p className="text-sm text-slate-500 font-medium">Loading stock batches…</p>
  </div>
)

const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
    <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
      <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <div className="text-center">
      <p className="text-sm text-red-600 font-bold">Failed to load batches</p>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">{message}</p>
    </div>
    <button onClick={onRetry}
      className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors">
      Retry
    </button>
  </div>
)

const EmptyState: React.FC<{ hasPurchases: boolean; onClearFilters: () => void }> = ({ hasPurchases, onClearFilters }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
    <svg className="w-14 h-14 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
    <div className="text-center">
      <p className="text-sm font-bold text-slate-600">
        {hasPurchases ? 'No batches match your filters' : 'No stock batches found'}
      </p>
      <p className="text-xs mt-1">
        {hasPurchases ? 'Try adjusting the filters or showing expired batches.' : 'This SKU has no stock purchases recorded yet.'}
      </p>
    </div>
    {hasPurchases && (
      <button onClick={onClearFilters} className="text-sm text-blue-600 font-bold hover:underline">
        Clear all filters
      </button>
    )}
  </div>
)