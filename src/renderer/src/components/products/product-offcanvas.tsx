// src/components/products/product-offcanvas.tsx

import React from 'react'
import ReactDOM from 'react-dom'
import CategorySelect from './category-select'
import ProductImage from './product-image'

// ─── Types ────────────────────────────────────────────────────────────────────

type SkuAttribute = {
  id: number; attribute_id?: number; name: string; value: string
  unit: string | null; display_value?: string; is_active?: boolean; sync_id?: string | null
}

type RecentPurchase = {
  id: number; batch_number: string | null
  quantities: { bought: number; sold: number; remaining: number }
  pricing: { price_per_unit: number; landed_cost_per_unit: number; total_price: number; shipping_cost: number; selling_price_range: { min: number; max: number } }
  financials: { revenue: number; cost: number; shipping_paid: number; profit: number; margin: number }
  dates: { purchased: number | null; arrived: number | null; manufacture: string | null; expiry: string | null }
  supplier: { id: number; name: string; contact: string | null; email: string | null; phone: string | null; is_active: boolean } | null
  performance: { sale_count: number; sell_through_rate: number; days_on_hand: number }
}

type SkuMetrics = {
  total_bought: number; total_sold: number; total_remaining: number
  total_revenue: number; total_cost: number; total_shipping_paid: number
  total_profit: number; profit_margin: number; avg_cost_per_unit: number
  avg_selling_price: number; avg_profit_per_unit: number; sell_through_rate: number
  days_of_inventory: number; is_low_stock: boolean; is_high_margin: boolean
  is_loss_making: boolean; is_best_seller: boolean
  stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
}

type Sku = {
  id: number; sync_id?: string | null; sku_name: string; code: string
  created_on?: number; updated_on?: number; is_active: boolean; is_deleted?: boolean
  images: Array<any>; attributes: SkuAttribute[]; recent_purchases: RecentPurchase[]
  total_purchases?: number; total_batches?: number; metrics: SkuMetrics
  batch_summary?: { oldest_batch: string | null; newest_batch: string | null; total_batches: number; active_batches: number }
}

type ProductMetrics = {
  total_items_bought: number; total_items_sold: number; total_items_remaining: number
  total_revenue: number; total_cost: number; total_shipping_paid: number
  total_profit: number; profit_margin: number; avg_cost_per_unit: number
  avg_selling_price: number; avg_profit_per_unit: number; avg_sku_profit_margin: number
  sell_through_rate: number; days_of_inventory: number; is_low_stock: boolean
  is_high_margin: boolean; is_loss_making: boolean; is_best_seller: boolean
  stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
}

type Product = {
  id: number; sync_id?: string | null; product_name: string; description: string | null
  category: { id: number; name: string; is_active: boolean; hierarchy?: Array<{ id: number; name: string }> } | null
  is_active: boolean; is_deleted: boolean; created_on: number; updated_on: number
  images: Array<any>; skus: Sku[]; sku_count: number; active_sku_count?: number
  metrics: ProductMetrics
  summary: { total_skus: number; active_skus: number; total_images: number; total_attributes: number; total_purchases: number; total_sales?: number; total_suppliers?: number; last_purchase: number | null; last_sale?: number | null }
  analytics?: any
}

type Attribute = {
  id: number; attribute_name: string; unit: string | null; is_active: boolean
  is_deleted: boolean; created_on: number; updated_on: number; sku_count?: number; unit_display: string
}

type Props = {
  productId: number | null; open: boolean; onClose: () => void
  onUpdated?: () => void; onSync?: (id: number) => void
}

type EditForm = {
  product_name: string; description: string; category_id: number | null; is_active: boolean
}

type SortKey = 'name_asc' | 'name_desc' | 'active_first' | 'inactive_first' | 'cost_asc' | 'cost_desc'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (ts: number | null | undefined) => {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatCurrency = (val: number | null | undefined) => {
  if (val == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'XAF', minimumFractionDigits: 2 }).format(val)
}

const sortSkus = (skus: Sku[], key: SortKey): Sku[] => {
  const s = [...skus]
  switch (key) {
    case 'name_asc':       return s.sort((a, b) => a.sku_name.localeCompare(b.sku_name))
    case 'name_desc':      return s.sort((a, b) => b.sku_name.localeCompare(a.sku_name))
    case 'active_first':   return s.sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0))
    case 'inactive_first': return s.sort((a, b) => (a.is_active ? 1 : 0) - (b.is_active ? 1 : 0))
    case 'cost_asc':       return s.sort((a, b) => (a.metrics?.avg_cost_per_unit ?? 0) - (b.metrics?.avg_cost_per_unit ?? 0))
    case 'cost_desc':      return s.sort((a, b) => (b.metrics?.avg_cost_per_unit ?? 0) - (a.metrics?.avg_cost_per_unit ?? 0))
    default: return s
  }
}

// ─── SKU Detail Modal — portaled to body ──────────────────────────────────────

type SkuModalProps = {
  sku: Sku; attributes: Attribute[]; productId: number
  onClose: () => void; onUpdated?: () => void
}

const SkuDetailModal = ({ sku, attributes, productId, onClose, onUpdated }: SkuModalProps) => {
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [name, setName] = React.useState(sku.sku_name)
  const [code, setCode] = React.useState(sku.code)
  const [isActive, setIsActive] = React.useState(sku.is_active)
  const [attrRows, setAttrRows] = React.useState<{ attribute_id: number | null; value: string }[]>(
    sku.attributes?.length ? sku.attributes.map(a => ({ attribute_id: a.attribute_id ?? null, value: a.value })) : []
  )
  const [dirty, setDirty] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const set = (patch: { name?: string; code?: string; isActive?: boolean }) => {
    if (patch.name !== undefined) setName(patch.name)
    if (patch.code !== undefined) setCode(patch.code)
    if (patch.isActive !== undefined) setIsActive(patch.isActive)
    setDirty(true)
  }

  const handleDiscard = () => {
    setName(sku.sku_name); setCode(sku.code); setIsActive(sku.is_active)
    setAttrRows(sku.attributes?.length ? sku.attributes.map(a => ({ attribute_id: a.attribute_id ?? null, value: a.value })) : [])
    setDirty(false); setEditing(false); setErrors({})
  }

  const handleSave = async () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'SKU name is required'
    if (!code.trim()) errs.code = 'SKU code is required'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSaving(true)
    try {
      const res = await window.api.products.updateSku({
        id: sku.id, product_id: productId, sku_name: name.trim(), code: code.trim(), is_active: isActive,
        update_attributes: true,
        sku_attributes: attrRows.filter(r => r.attribute_id && r.value.trim()).map(r => ({ attribute_id: r.attribute_id!, value: r.value.trim() })),
      })
      if (!res.success) throw new Error(res.message)
      setDirty(false); setEditing(false); onUpdated?.()
    } catch (err) { console.error(err) } finally { setSaving(false) }
  }

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      onClick={onClose}
      style={{ animation: 'fadeIn 0.15s ease-out' }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden z-10 flex flex-col"
        style={{ animation: 'scaleIn 0.18s ease-out', maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0 ${editing ? 'bg-blue-50/60' : 'bg-gray-50/60'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900">SKU Detail</span>
            {editing && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Editing
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {!editing && (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {editing ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">SKU Name <span className="text-red-500">*</span></label>
                <input value={name} onChange={e => set({ name: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">SKU Code <span className="text-red-500">*</span></label>
                <input value={code} onChange={e => set({ code: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.code ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
                {errors.code && <p className="text-xs text-red-600 mt-1">{errors.code}</p>}
              </div>
              <div className="flex items-center justify-between py-2.5 px-3.5 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Active</p>
                  <p className="text-xs text-gray-500">Available for sale</p>
                </div>
                <button type="button" onClick={() => { setIsActive(a => !a); setDirty(true) }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {attributes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-600">Attributes</label>
                    <button type="button"
                      onClick={() => { const unused = attributes.find(a => !attrRows.find(r => r.attribute_id === a.id)); if (unused) { setAttrRows(r => [...r, { attribute_id: unused.id, value: '' }]); setDirty(true) } }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold">+ Add</button>
                  </div>
                  <div className="space-y-2">
                    {attrRows.map((row, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <select value={row.attribute_id ?? ''}
                          onChange={e => { setAttrRows(r => r.map((x, j) => j === i ? { ...x, attribute_id: Number(e.target.value) || null } : x)); setDirty(true) }}
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option value="">Select…</option>
                          {attributes.map(a => <option key={a.id} value={a.id}>{a.attribute_name}{a.unit ? ` (${a.unit})` : ''}</option>)}
                        </select>
                        <input value={row.value}
                          onChange={e => { setAttrRows(r => r.map((x, j) => j === i ? { ...x, value: e.target.value } : x)); setDirty(true) }}
                          placeholder="Value"
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                        <button onClick={() => { setAttrRows(r => r.filter((_, j) => j !== i)); setDirty(true) }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-all flex-shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                    {attrRows.length === 0 && (
                      <button type="button"
                        onClick={() => { const a = attributes[0]; if (a) { setAttrRows([{ attribute_id: a.id, value: '' }]); setDirty(true) } }}
                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all">
                        + Add an attribute
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="text-center pb-2">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-gray-200 shadow-sm mx-auto mb-3">
                  {sku.images?.[0] ? (
                    <img src={(() => { try { return window.api.files.readFileAsDataURL((sku.images[0] as any).path) ?? '' } catch { return '' } })()} alt={sku.sku_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center">
                      <span className="text-white text-lg font-bold">{sku.sku_name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <h3 className="text-base font-bold text-gray-900">{sku.sku_name}</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{sku.code}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sku.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${sku.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {sku.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {sku.metrics?.stock_status && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {sku.metrics.stock_status}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-blue-700">{sku.metrics?.total_remaining ?? 0}</div>
                  <div className="text-xs text-blue-600">Remaining</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-emerald-700">{sku.metrics?.total_sold ?? 0}</div>
                  <div className="text-xs text-emerald-600">Sold</div>
                </div>
                <div className="bg-violet-50 rounded-lg p-2.5 text-center">
                  <div className="text-sm font-bold text-violet-700">{formatCurrency(sku.metrics?.avg_cost_per_unit)}</div>
                  <div className="text-xs text-violet-600">Avg Cost</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                  <div className="text-sm font-bold text-amber-700">{`${((sku.metrics?.profit_margin ?? 0) * 100).toFixed(1)}%`}</div>
                  <div className="text-xs text-amber-600">Margin</div>
                </div>
              </div>
              {sku.attributes && sku.attributes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Attributes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sku.attributes.map(a => (
                      <span key={a.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                        <span className="text-gray-400">{a.name}:</span> {a.value}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {sku.recent_purchases && sku.recent_purchases.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Purchases</p>
                  <div className="space-y-1.5">
                    {sku.recent_purchases.slice(0, 3).map((p: any) => {
                      const totalPrice   = p.pricing?.total_price ?? p.total_price_bought ?? null
                      const unitPrice    = p.pricing?.price_per_unit ?? p.price_per_unit ?? null
                      const bought       = p.quantities?.bought ?? p.quantity ?? null
                      const remaining    = p.quantities?.remaining ?? null
                      const margin       = p.financials?.margin ?? p.avg_anticipated_profit_margin ?? null
                      const supplierName = p.supplier?.name ?? p.supplier_name ?? null
                      return (
                        <div key={p.id} className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-700">#{p.id}</span>
                            <span className="font-semibold text-emerald-700">{formatCurrency(totalPrice)}</span>
                          </div>
                          <div className="flex gap-3 text-gray-500">
                            {bought != null && <span>Bought: <span className="text-gray-700 font-medium">{bought}</span></span>}
                            {remaining != null && <span>Remaining: <span className="text-gray-700 font-medium">{remaining}</span></span>}
                          </div>
                          <div className="flex gap-3 text-gray-500 mt-0.5">
                            {unitPrice != null && <span>Unit: <span className="text-gray-700 font-medium">{formatCurrency(unitPrice)}</span></span>}
                            {margin != null && <span>Margin: <span className="text-gray-700 font-medium">{((margin ?? 0) * 100).toFixed(1)}%</span></span>}
                          </div>
                          {supplierName && <div className="mt-1 text-gray-500">Supplier: <span className="text-gray-700 font-medium">{supplierName}</span></div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {editing && dirty && (
          <div className="px-5 pb-5 pt-2 flex gap-2.5 flex-shrink-0 border-t border-gray-100">
            <button onClick={handleDiscard} className="flex-1 px-3 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold border border-gray-300 rounded-lg transition-all">
              Discard
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 px-3 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2">
              {saving
                ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              }
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }
      `}</style>
    </div>,
    document.body
  )
}

// ─── Main Offcanvas ────────────────────────────────────────────────────────────

const ProductOffcanvas = ({ productId, open, onClose, onUpdated, onSync }: Props) => {
  const [product, setProduct] = React.useState<Product | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [attributes, setAttributes] = React.useState<Attribute[]>([])
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)
  const [form, setForm] = React.useState<EditForm>({ product_name: '', description: '', category_id: null, is_active: true })
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({})
  const [skuSearch, setSkuSearch] = React.useState('')
  const [skuSort, setSkuSort] = React.useState<SortKey>('name_asc')
  const [showSortMenu, setShowSortMenu] = React.useState(false)
  const [selectedSku, setSelectedSku] = React.useState<Sku | null>(null)
  const sortMenuRef = React.useRef<HTMLDivElement>(null)

  const sortLabels: Record<SortKey, string> = {
    name_asc: 'A → Z', name_desc: 'Z → A',
    active_first: 'Active first', inactive_first: 'Inactive first',
    cost_asc: 'Lowest cost', cost_desc: 'Highest cost',
  }

  React.useEffect(() => {
    if (!open || !productId) return
    setEditing(false); setDirty(false); setSelectedSku(null)
    setSkuSearch(''); setSkuSort('name_asc'); setFormErrors({})
    const load = async () => {
      setLoading(true)
      try {
        const [prodRes, attrRes] = await Promise.all([
          window.api.products.getProductById({ id: productId, include_deleted: true }),
          window.api.products.getAllAttributes?.({ is_active: 'yes', should_paginate: false }).catch(() => ({ success: false, data: null }))
        ])
        if (prodRes.success && prodRes.data) {
          const p = prodRes.data as unknown as Product
          setProduct(p)
          setForm({ product_name: p.product_name, description: p.description ?? '', category_id: p.category?.id ?? null, is_active: p.is_active })
        }
        if (attrRes?.success && attrRes.data) setAttributes(attrRes.data.items ?? [])
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    load()
  }, [open, productId])

  // Lock body scroll
  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setShowSortMenu(false) }
    if (showSortMenu) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showSortMenu])

  const setF = (patch: Partial<EditForm>) => { setForm(f => ({ ...f, ...patch })); setDirty(true) }

  const handleDiscard = () => {
    if (!product) return
    setForm({ product_name: product.product_name, description: product.description ?? '', category_id: product.category?.id ?? null, is_active: product.is_active })
    setDirty(false); setEditing(false); setFormErrors({})
  }

  const handleSave = async () => {
    if (!product) return
    const errs: Record<string, string> = {}
    if (!form.product_name.trim()) errs.product_name = 'Product name is required'
    if (!form.category_id) errs.category_id = 'Category is required'
    setFormErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSaving(true)
    try {
      const res = await window.api.products.updateProduct({
        id: product.id, product_name: form.product_name.trim(),
        description: form.description.trim() || undefined,
        category_id: form.category_id!, is_active: form.is_active,
      })
      if (!res.success) throw new Error(res.message)
      setDirty(false); setEditing(false); onUpdated?.()
      const prodRes = await window.api.products.getProductById({ id: product.id, include_deleted: true })
      if (prodRes.success && prodRes.data) {
        const p = prodRes.data as unknown as Product
        setProduct(p)
        setForm({ product_name: p.product_name, description: p.description ?? '', category_id: p.category?.id ?? null, is_active: p.is_active })
      }
    } catch (err) { console.error(err) } finally { setSaving(false) }
  }

  const filteredSkus = sortSkus(
    (product?.skus ?? []).filter(s =>
      !skuSearch || s.sku_name.toLowerCase().includes(skuSearch.toLowerCase()) || s.code.toLowerCase().includes(skuSearch.toLowerCase())
    ),
    skuSort
  )

  const isPendingSync = !product?.sync_id

  return ReactDOM.createPortal(
    <>
      {/* Backdrop — full viewport */}
      <div
        className={`fixed inset-0 z-[9998] bg-black/25 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-[9999] h-full bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out overflow-x-hidden ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: 'min(520px, 100vw)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Product Details</h2>
              {product && <p className="text-xs text-gray-500">#{String(product.id).padStart(4, '0')}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && !loading && product && !product.is_deleted && (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-all shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
            {editing && (
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Editing
              </span>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Loading product…</span>
              </div>
            </div>
          ) : !product ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">Product not found</div>
          ) : (
            <>
              {/* Hero */}
              <div className={`px-5 pt-5 pb-4 ${editing ? 'bg-blue-50/40' : 'bg-gradient-to-b from-gray-50/80 to-white'} transition-colors`}>
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-gray-200 shadow-sm">
                      <ProductImage images={product.images} productName={product.product_name} size="lg" isDeleted={product.is_deleted} />
                    </div>
                    {product.is_deleted && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {editing ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Product Name <span className="text-red-500">*</span></label>
                          <input value={form.product_name} onChange={e => setF({ product_name: e.target.value })}
                            className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white ${formErrors.product_name ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
                          {formErrors.product_name && <p className="text-xs text-red-600 mt-1">{formErrors.product_name}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Category <span className="text-red-500">*</span></label>
                          <CategorySelect value={form.category_id} onChange={v => setF({ category_id: v })} error={formErrors.category_id} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                          <textarea value={form.description} onChange={e => setF({ description: e.target.value })} rows={3} placeholder="Describe the product…"
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white" />
                        </div>
                        <div className="flex items-center justify-between py-2.5 px-3.5 bg-white rounded-lg border border-gray-200">
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Active</p>
                            <p className="text-xs text-gray-500">Visible in the store</p>
                          </div>
                          <button type="button" onClick={() => setF({ is_active: !form.is_active })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}>
                            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 break-words">{product.product_name}</h3>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${product.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${product.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {product.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {product.is_deleted && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">Deleted</span>}
                          {product.metrics?.is_best_seller && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                              Best Seller
                            </span>
                          )}
                          {product.metrics?.is_low_stock && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">Low Stock</span>}
                          {product.metrics?.is_high_margin && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">High Margin</span>}
                        </div>
                        {product.category && <p className="text-xs text-gray-500 mt-1.5">Category: <span className="font-medium text-gray-700">{product.category.name}</span></p>}
                        {product.description && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{product.description}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Save / Discard bar */}
              {editing && dirty && (
                <div className="px-5 py-3 bg-blue-50 border-y border-blue-100 flex items-center gap-3 flex-shrink-0">
                  <p className="text-xs text-blue-700 font-medium flex-1">You have unsaved changes</p>
                  <button onClick={handleDiscard} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold border border-gray-300 rounded-lg transition-all shadow-sm">Discard</button>
                  <button onClick={handleSave} disabled={saving}
                    className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all shadow flex items-center gap-1.5">
                    {saving
                      ? <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                    Save Changes
                  </button>
                </div>
              )}

              {/* Stats */}
              <div className="px-5 py-4 grid grid-cols-4 gap-3 border-b border-gray-100">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-blue-700">{product.sku_count}</div>
                  <div className="text-xs text-blue-600 mt-0.5">SKUs</div>
                </div>
                <div className="bg-violet-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-violet-700">{product.metrics?.total_items_sold ?? 0}</div>
                  <div className="text-xs text-violet-600 mt-0.5">Sold</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-emerald-700">{product.metrics?.total_items_remaining ?? 0}</div>
                  <div className="text-xs text-emerald-600 mt-0.5">Remaining</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <div className="text-sm font-bold text-amber-700">{`${((product.metrics?.profit_margin ?? 0) * 100).toFixed(1)}%`}</div>
                  <div className="text-xs text-amber-600 mt-0.5">Margin</div>
                </div>
              </div>

              {/* Financial details */}
              <div className="px-5 py-4 border-b border-gray-100 space-y-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Financial Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Total Revenue</div>
                    <div className="font-medium text-gray-900">{formatCurrency(product.metrics?.total_revenue)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Total Profit</div>
                    <div className="font-medium text-gray-900">{formatCurrency(product.metrics?.total_profit)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Avg Cost / Unit</div>
                    <div className="font-medium text-gray-900">{formatCurrency(product.metrics?.avg_cost_per_unit)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Created</div>
                    <div className="font-medium text-gray-900">{formatDate(product.created_on)}</div>
                  </div>
                </div>
                {isPendingSync && onSync && (
                  <button onClick={() => onSync(product.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-sm font-semibold rounded-lg transition-all">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync Now
                  </button>
                )}
              </div>

              {product.is_deleted && (
                <div className="mx-5 mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <div>
                      <h4 className="text-sm font-semibold text-red-800">Product Deleted</h4>
                      <p className="text-xs text-red-600 mt-1">This product is marked as deleted and no longer visible in the storefront.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* SKUs section */}
              {product.skus && product.skus.length > 0 && (
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      SKUs ({product.skus.length})
                    </h4>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input value={skuSearch} onChange={e => setSkuSearch(e.target.value)} placeholder="Search SKUs…"
                        className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all" />
                    </div>
                    <div className="relative" ref={sortMenuRef}>
                      <button onClick={() => setShowSortMenu(s => !s)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-all whitespace-nowrap">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg>
                        Sort
                      </button>
                      {showSortMenu && (
                        <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20">
                          {(Object.keys(sortLabels) as SortKey[]).map(key => (
                            <button key={key} onClick={() => { setSkuSort(key); setShowSortMenu(false) }}
                              className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between transition-colors ${skuSort === key ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                              {sortLabels[key]}
                              {skuSort === key && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {filteredSkus.length === 0 ? (
                    <div className="py-6 text-center text-xs text-gray-400">No SKUs match your search</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredSkus.map(sku => (
                        <button key={sku.id} onClick={() => setSelectedSku(sku)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all group text-left">
                          <div className="w-9 h-9 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 shadow-sm">
                            {sku.images?.[0] ? (
                              <img src={(() => { try { return window.api.files.readFileAsDataURL((sku.images[0] as any).path) ?? '' } catch { return '' } })()} alt={sku.sku_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">{sku.sku_name.charAt(0).toUpperCase()}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">{sku.sku_name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500 font-mono">{sku.code}</span>
                              <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${sku.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${sku.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                                {sku.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-xs font-semibold text-gray-900">{formatCurrency(sku.metrics?.avg_cost_per_unit)}</div>
                            <div className="text-xs text-gray-400">avg cost</div>
                          </div>
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="h-6" />
            </>
          )}
        </div>
      </div>

      {selectedSku && product && (
        <SkuDetailModal
          sku={selectedSku}
          attributes={attributes}
          productId={product.id}
          onClose={() => setSelectedSku(null)}
          onUpdated={() => {
            setSelectedSku(null); onUpdated?.()
            window.api.products.getProductById({ id: product.id, include_deleted: true }).then(res => {
              if (res.success && res.data) setProduct(res.data as unknown as Product)
            })
          }}
        />
      )}
    </>,
    document.body
  )
}

export default ProductOffcanvas