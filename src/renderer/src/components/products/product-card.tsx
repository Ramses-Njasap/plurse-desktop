// src/components/products/product-card.tsx

import ProductImage from './product-image'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductMetrics = {
  total_items_bought: number
  total_items_sold: number
  total_items_remaining: number
  inventory_value: number
  total_revenue: number
  total_cost: number
  total_profit: number
  profit_margin: number
  sku_count: number
  avg_sku_profit_margin: number
  sell_through_rate: number
  days_of_inventory: number
  is_low_stock: boolean
  is_high_margin: boolean
  is_loss_making: boolean
  is_best_seller: boolean
  stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
}

type Product = {
  id: number
  product_name: string
  category_id: number
  category_name: string
  description: string | null
  created_on: number
  updated_on: number
  is_active: boolean
  is_deleted: boolean
  sku_count: number
  images?: Array<any>
  skus?: Array<any>
  metrics: ProductMetrics
}

type Props = {
  product: Product
  expanded: boolean
  onToggle: () => void
  onDelete: (id: number) => void
  onRestore: (id: number) => void
  onEdit: (id: number) => void
  onSync: (id: number) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (val: number | null | undefined) => {
  if (val == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(val)
}

const fmtPct = (val: number | null | undefined) => {
  if (val == null) return '—'
  return `${val.toFixed(1)}%`
}

const fmtNum = (val: number | null | undefined) => {
  if (val == null) return '—'
  return new Intl.NumberFormat('en-US').format(val)
}

const stockDot = (status: ProductMetrics['stock_status'] | undefined) => {
  switch (status) {
    case 'Out of Stock': return { dot: 'bg-red-500',     text: 'text-red-600' }
    case 'Low Stock':    return { dot: 'bg-amber-400',   text: 'text-amber-600' }
    case 'In Stock':     return { dot: 'bg-emerald-500', text: 'text-emerald-700' }
    case 'Overstocked':  return { dot: 'bg-blue-500',    text: 'text-blue-700' }
    default:             return { dot: 'bg-gray-300',    text: 'text-gray-500' }
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Bar = ({ value, danger = false }: { value: number; danger?: boolean }) => (
  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
    <div
      className={`h-full rounded-full ${danger ? 'bg-red-400' : 'bg-blue-500'}`}
      style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
    />
  </div>
)

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-400">{label}</span>
    <span className="text-xs font-semibold text-gray-900">{value}</span>
  </div>
)

// ─── Component ────────────────────────────────────────────────────────────────

const ProductCard = ({ product, expanded, onToggle, onDelete, onRestore, onEdit, onSync }: Props) => {
  const m = product.metrics
  const { dot, text: statusText } = stockDot(m?.stock_status)
  const isDeleted = product.is_deleted
  const profitColor = m?.is_loss_making ? 'text-red-500' : m?.is_high_margin ? 'text-emerald-600' : 'text-gray-900'

  return (
    <div className={`group border-b border-gray-100 last:border-0 transition-colors duration-150 ${expanded ? 'bg-gray-50/80' : 'hover:bg-gray-50/50'}`}>

      {/* ── Collapsed Row ─────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-12 items-center gap-4 px-5 py-3 cursor-pointer select-none"
        onClick={onToggle}
      >
        {/* Image */}
        <div className="col-span-1">
          <div className={`w-10 h-10 rounded-lg overflow-hidden border transition-colors ${expanded ? 'border-blue-200' : 'border-gray-200'}`}>
            <ProductImage images={product.images} productName={product.product_name} size="sm" isDeleted={isDeleted} />
          </div>
        </div>

        {/* Name + category */}
        <div className="col-span-3 min-w-0">
          <p className={`text-sm font-semibold truncate leading-tight ${isDeleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
            {product.product_name}
          </p>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {product.category_name}
            <span className="mx-1.5 text-gray-300">·</span>
            <span className="font-mono">#{String(product.id).padStart(4, '0')}</span>
          </p>
        </div>

        {/* SKU count */}
        <div className="col-span-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {product.sku_count} SKU{product.sku_count !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Metrics strip */}
        <div className="col-span-3 flex items-center gap-5">
          <div>
            <p className="text-xs text-gray-400 leading-none">Revenue</p>
            <p className="text-xs font-semibold text-gray-900 mt-0.5">{fmt(m?.total_revenue)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 leading-none">Margin</p>
            <p className={`text-xs font-semibold mt-0.5 ${profitColor}`}>{fmtPct(m?.profit_margin)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 leading-none">Stock</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
              <p className={`text-xs font-medium ${statusText}`}>{m?.stock_status ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="col-span-2">
          <span className={`text-xs font-medium ${isDeleted ? 'text-red-400' : product.is_active ? 'text-gray-700' : 'text-gray-400'}`}>
            {isDeleted ? 'Deleted' : product.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Chevron */}
        <div className="col-span-1 flex justify-end">
          <svg className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180 text-blue-500' : 'text-gray-300 group-hover:text-gray-500'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* ── Expanded Panel ─────────────────────────────────────────────────── */}
      {expanded && (
        <div className="flex border-t border-gray-100" onClick={e => e.stopPropagation()}>

          {/* LEFT: Details */}
          <div className="flex-1 min-w-0 px-5 py-4 space-y-5 overflow-hidden">

            {/* Active flags — only render if at least one is true */}
            {(m?.is_best_seller || m?.is_high_margin || m?.is_low_stock || m?.is_loss_making) && (
              <div className="flex flex-wrap gap-1.5">
                {m?.is_best_seller && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-900 text-white text-xs font-medium">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Best Seller
                  </span>
                )}
                {m?.is_high_margin && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    High Margin
                  </span>
                )}
                {m?.is_low_stock && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-200 text-amber-600 text-xs font-medium">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    Low Stock
                  </span>
                )}
                {m?.is_loss_making && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-red-200 text-red-500 text-xs font-medium">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                    Loss Making
                  </span>
                )}
              </div>
            )}

            {/* Stats — two columns */}
            <div className="grid grid-cols-2 gap-x-8">
              {/* Inventory */}
              <div>
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-2">Inventory</p>
                <Stat label="In Stock"     value={fmtNum(m?.total_items_remaining)} />
                <Stat label="Total Bought" value={fmtNum(m?.total_items_bought)} />
                <Stat label="Total Sold"   value={fmtNum(m?.total_items_sold)} />
                <Stat label="Value"        value={fmt(m?.inventory_value)} />
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Sell-through</span>
                    <span className="font-medium text-gray-600">{fmtPct(m?.sell_through_rate)}</span>
                  </div>
                  <Bar value={m?.sell_through_rate ?? 0} />
                </div>
                {m?.days_of_inventory != null && (
                  <p className="text-xs text-gray-400 mt-2">
                    <span className="font-semibold text-gray-600">{Math.round(m.days_of_inventory)}</span> days of inventory remaining
                  </p>
                )}
              </div>

              {/* Financials */}
              <div>
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-2">Financials</p>
                <Stat label="Revenue" value={fmt(m?.total_revenue)} />
                <Stat label="Cost"    value={fmt(m?.total_cost)} />
                <Stat label="Profit"  value={fmt(m?.total_profit)} />
                <Stat label="Margin"  value={fmtPct(m?.profit_margin)} />
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Profit margin</span>
                    <span className={`font-medium ${profitColor}`}>{fmtPct(m?.profit_margin)}</span>
                  </div>
                  <Bar value={Math.max(0, m?.profit_margin ?? 0)} danger={m?.is_loss_making} />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Avg SKU margin <span className="font-semibold text-gray-600">{fmtPct(m?.avg_sku_profit_margin)}</span>
                </p>
              </div>
            </div>

            {/* SKU list */}
            {product.skus && product.skus.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-2">
                  SKUs · {product.sku_count}
                </p>
                <div className="space-y-1.5">
                  {product.skus.map((sku: any) => {
                    const sm = sku.metrics
                    const remaining = sm?.total_remaining ?? sm?.total_items_remaining ?? null
                    const sold      = sm?.total_sold ?? sm?.total_items_sold ?? null
                    const margin    = sm?.profit_margin ?? null
                    const status    = sm?.stock_status ?? null
                    const { dot: sd, text: st } = stockDot(status)

                    return (
                      <div key={sku.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white border border-gray-100">
                        {/* Thumb */}
                        <div className="w-7 h-7 rounded overflow-hidden border border-gray-100 flex-shrink-0">
                          {sku.images?.[0] ? (
                            <img
                              src={(() => { try { return window.api.files.readFileAsDataURL((sku.images[0] as any).path) ?? '' } catch { return '' } })()}
                              alt={sku.sku_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">{(sku.sku_name ?? '?').charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                        </div>

                        {/* Name / code */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{sku.sku_name}</p>
                          <p className="text-xs text-gray-400 font-mono leading-tight">{sku.code}</p>
                        </div>

                        {/* Attribute chips */}
                        {sku.attributes?.length > 0 && (
                          <div className="hidden sm:flex gap-1">
                            {sku.attributes.slice(0, 2).map((a: any) => (
                              <span key={a.id} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-xs">
                                {a.value ?? a.display_value}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Numbers */}
                        <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                          {remaining != null && (
                            <div className="text-right hidden md:block">
                              <p className="font-semibold text-gray-800">{fmtNum(remaining)}</p>
                              <p className="text-gray-400">left</p>
                            </div>
                          )}
                          {sold != null && (
                            <div className="text-right hidden md:block">
                              <p className="font-semibold text-blue-600">{fmtNum(sold)}</p>
                              <p className="text-gray-400">sold</p>
                            </div>
                          )}
                          {margin != null && (
                            <div className="text-right">
                              <p className={`font-semibold ${margin < 0 ? 'text-red-500' : 'text-gray-800'}`}>{fmtPct(margin)}</p>
                              <p className="text-gray-400">margin</p>
                            </div>
                          )}
                          {status && (
                            <div className="hidden lg:flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${sd}`} />
                              <span className={`text-xs ${st}`}>{status}</span>
                            </div>
                          )}
                        </div>

                        {/* Active indicator */}
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sku.is_active ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Action sidebar — always fully visible */}
          <div className="w-36 flex-shrink-0 border-l border-gray-100 flex flex-col py-4 px-3">

            {!isDeleted ? (
              <>
                {/* Primary */}
                <button
                  onClick={() => onEdit(product.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>

                {/* Secondary */}
                <button
                  onClick={() => onSync(product.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 mt-1.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-white text-gray-600 text-xs font-semibold transition-colors"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync
                </button>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Destructive — muted until hover */}
                <button
                  onClick={() => onDelete(product.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 text-xs font-semibold transition-all"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onRestore(product.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-semibold transition-colors"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Restore
                </button>
                <div className="flex-1" />
                <p className="text-xs text-gray-300 text-center leading-relaxed">This product is deleted</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductCard