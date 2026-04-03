// src/components/products/edit-product-modal.tsx

import React from 'react';
import CategorySelect from './category-select';
import ProductImage from './product-image';

// ─── Types (aligned with getProductById in preload/index.d.ts) ───────────────

type Attribute = {
  id: number
  attribute_name: string
  unit: string | null
  is_active: boolean
  is_deleted: boolean
  created_on: number
  updated_on: number
  sku_count?: number
  unit_display: string
}

// getProductById → skus[n].attributes
type SkuAttribute = {
  id: number
  attribute_id?: number
  name: string
  value: string
  unit: string | null
  display_value?: string
  is_active?: boolean
}

// getProductById → skus[n].recent_purchases — nested shape
type RecentPurchase = {
  id: number
  sync_id?: string | null
  batch_number: string | null
  quantities: { bought: number; sold: number; remaining: number }
  pricing: {
    price_per_unit: number
    landed_cost_per_unit: number
    total_price: number
    shipping_cost: number
    selling_price_range: { min: number; max: number }
  }
  financials: { revenue: number; cost: number; shipping_paid: number; profit: number; margin: number }
  dates: { purchased: number | null; arrived: number | null; manufacture: string | null; expiry: string | null }
  supplier: { id: number; name: string; contact: string | null; email: string | null; phone: string | null; is_active: boolean } | null
  performance: { sale_count: number; sell_through_rate: number; days_on_hand: number }
}

// getProductById → skus[n].metrics
type SkuMetrics = {
  total_bought: number
  total_sold: number
  total_remaining: number
  total_revenue: number
  total_cost: number
  total_shipping_paid: number
  total_profit: number
  profit_margin: number
  avg_cost_per_unit: number
  avg_selling_price: number
  avg_profit_per_unit: number
  sell_through_rate: number
  days_of_inventory: number
  is_low_stock: boolean
  is_high_margin: boolean
  is_loss_making: boolean
  is_best_seller: boolean
  stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
}

type Sku = {
  id: number
  sync_id?: string | null
  sku_name: string
  code: string
  created_on?: number
  updated_on?: number
  is_active: boolean
  is_deleted?: boolean
  images: Array<any>
  attributes: SkuAttribute[]
  recent_purchases: RecentPurchase[]
  total_purchases?: number
  total_batches?: number
  metrics: SkuMetrics
  batch_summary?: {
    oldest_batch: string | null
    newest_batch: string | null
    total_batches: number
    active_batches: number
  }
}

// getProductById → metrics (richer than list)
type ProductMetrics = {
  total_items_bought: number
  total_items_sold: number
  total_items_remaining: number
  total_revenue: number
  total_cost: number
  total_shipping_paid: number
  total_profit: number
  profit_margin: number
  avg_cost_per_unit: number
  avg_selling_price: number
  avg_profit_per_unit: number
  avg_sku_profit_margin: number
  sell_through_rate: number
  days_of_inventory: number
  is_low_stock: boolean
  is_high_margin: boolean
  is_loss_making: boolean
  is_best_seller: boolean
  stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
  // convenience alias used in UI
  inventory_value?: number
}

type Product = {
  id: number
  sync_id?: string | null
  product_name: string
  description: string | null
  // getProductById returns category as object, not flat fields
  category: { id: number; name: string; is_active: boolean; hierarchy?: Array<{ id: number; name: string }> } | null
  is_active: boolean
  is_deleted: boolean
  created_on: number
  updated_on: number
  images: Array<any>
  skus: Sku[]
  sku_count: number
  active_sku_count?: number
  metrics: ProductMetrics
  summary: {
    total_skus: number
    active_skus: number
    total_images: number
    total_attributes: number
    total_purchases: number
    total_sales?: number
    total_suppliers?: number
    last_purchase: number | null
    last_sale?: number | null
  }
  analytics?: any
}

type Props = {
  productId: number
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (ts: number | null | undefined) => {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatCurrency = (val: number | null | undefined) => {
  if (val == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'XAF', minimumFractionDigits: 2 }).format(val)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TabButton = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
  >
    {children}
  </button>
)

const Field = ({
  label, value, onChange, error, onClearError, type = 'text', placeholder, required, textarea, disabled
}: {
  label: string; value: string; onChange?: (v: string) => void; error?: string; onClearError?: () => void
  type?: string; placeholder?: string; required?: boolean; textarea?: boolean; disabled?: boolean
}) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {textarea ? (
      <textarea
        value={value}
        onChange={e => { onChange?.(e.target.value); onClearError?.() }}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 resize-none transition-all
          ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}
          ${error ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`}
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={e => { onChange?.(e.target.value); onClearError?.() }}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all
          ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}
          ${error ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`}
      />
    )}
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
)

// ─── SKU Editor ───────────────────────────────────────────────────────────────

const SkuEditor = ({
  sku, attributes, productId, onSaved, addToast
}: {
  sku: Sku | null
  attributes: Attribute[]
  productId: number
  onSaved: (updated: Sku) => void
  addToast: (msg: string, type: 'success' | 'error') => void
}) => {
  const isNew = sku === null
  const [name, setName] = React.useState(sku?.sku_name ?? '')
  const [code, setCode] = React.useState(sku?.code ?? '')
  const [isActive, setIsActive] = React.useState(sku?.is_active ?? true)
  const [attrRows, setAttrRows] = React.useState<{ attribute_id: number | null; value: string }[]>(
    sku?.attributes?.length
      ? sku.attributes.map(a => ({ attribute_id: a.attribute_id ?? null, value: a.value }))
      : [{ attribute_id: null, value: '' }]
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'SKU name is required'
    if (!code.trim()) e.code = 'SKU code is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        product_id: productId,
        sku_name: name.trim(),
        code: code.trim(),
        is_active: isActive,
        attributes: attrRows
          .filter(r => r.attribute_id && r.value.trim())
          .map(r => ({ attribute_id: r.attribute_id!, value: r.value.trim() })),
      }
      let res: any
      if (isNew) {
        res = await window.api.products.createSku(payload)
      } else {
        res = await window.api.products.updateSku({ id: sku!.id, ...payload })
      }
      if (!res.success) throw new Error(res.message)
      addToast(`SKU "${name}" ${isNew ? 'created' : 'updated'}!`, 'success')
      onSaved(res.data?.sku ?? { ...sku!, sku_name: name, code, is_active: isActive })
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save SKU', 'error')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-800">{isNew ? 'New SKU' : `Edit: ${sku.sku_name}`}</h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Active</span>
          <button
            onClick={() => setIsActive(a => !a)}
            className={`relative w-9 h-5 rounded-full transition-colors ${isActive ? 'bg-blue-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isActive ? 'left-4' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU Name" value={name} onChange={setName} error={errors.name} onClearError={() => setErrors(e => ({ ...e, name: '' }))} placeholder="e.g. Small Red" required />
        <Field label="SKU Code" value={code} onChange={setCode} error={errors.code} onClearError={() => setErrors(e => ({ ...e, code: '' }))} placeholder="e.g. PROD-001-ABC" required />
      </div>

      {attributes.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-600">SKU Attributes</label>
            <button
              type="button"
              onClick={() => setAttrRows(r => [...r, { attribute_id: null, value: '' }])}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
            >
              + Add row
            </button>
          </div>
          <div className="space-y-2">
            {attrRows.map((row, i) => (
              <div key={i} className="flex gap-2 items-start">
                <select
                  value={row.attribute_id ?? ''}
                  onChange={e => setAttrRows(r => r.map((x, j) => j === i ? { ...x, attribute_id: Number(e.target.value) || null } : x))}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select attribute…</option>
                  {attributes.map(a => <option key={a.id} value={a.id}>{a.attribute_name}</option>)}
                </select>
                <input
                  value={row.value}
                  onChange={e => setAttrRows(r => r.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                  placeholder="Value"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {attrRows.length > 1 && (
                  <button onClick={() => setAttrRows(r => r.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <p className="text-xs text-amber-700">No attributes defined. Add attributes first to set SKU attribute values.</p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2">
          {saving ? (
            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          )}
          {saving ? 'Saving…' : isNew ? 'Create SKU' : 'Save SKU'}
        </button>
      </div>
    </div>
  )
}

// ─── Purchase Row ─────────────────────────────────────────────────────────────

const PurchaseRow = ({ purchase }: { purchase: RecentPurchase }) => (
  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-1">
    <div className="flex items-center justify-between">
      <span className="font-semibold text-gray-800">Purchase #{purchase.id}</span>
      <span className="font-semibold text-emerald-700">{formatCurrency(purchase.pricing.total_price)}</span>
    </div>
    <div className="grid grid-cols-3 gap-2 text-gray-600">
      <div><span className="text-gray-400">Bought:</span> {purchase.quantities.bought}</div>
      <div><span className="text-gray-400">Sold:</span> {purchase.quantities.sold}</div>
      <div><span className="text-gray-400">Remaining:</span> {purchase.quantities.remaining}</div>
      <div><span className="text-gray-400">Unit:</span> {formatCurrency(purchase.pricing.price_per_unit)}</div>
      <div><span className="text-gray-400">Ship:</span> {formatCurrency(purchase.pricing.shipping_cost)}</div>
      <div><span className="text-gray-400">Batch:</span> {purchase.batch_number || '—'}</div>
      <div><span className="text-gray-400">Bought on:</span> {formatDate(purchase.dates.purchased)}</div>
      <div><span className="text-gray-400">Arrived:</span> {formatDate(purchase.dates.arrived)}</div>
      <div><span className="text-gray-400">Expires:</span> {purchase.dates.expiry || '—'}</div>
    </div>
    {purchase.supplier && (
      <div className="pt-1 border-t border-gray-200">
        <span className="text-gray-400">Supplier:</span>{' '}
        <span className="font-medium text-gray-700">{purchase.supplier.name}</span>
      </div>
    )}
  </div>
)

// ─── Main Modal ───────────────────────────────────────────────────────────────

const EditProductModal = ({ productId, open, onClose, onSuccess }: Props) => {
  const [product, setProduct] = React.useState<Product | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [tab, setTab] = React.useState<'details' | 'skus'>('details')
  const [toasts, setToasts] = React.useState<{ id: string; message: string; type: 'success' | 'error' }[]>([])

  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [categoryId, setCategoryId] = React.useState<number | null>(null)
  const [isActive, setIsActive] = React.useState(true)
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  const [attributes, setAttributes] = React.useState<Attribute[]>([])
  const [selectedSkuId, setSelectedSkuId] = React.useState<number | 'new' | null>(null)

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  const loadProduct = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.products.getProductById({ id: productId, include_deleted: true })
      if (res.success && res.data) {
        const p = res.data as unknown as Product
        setProduct(p)
        setName(p.product_name)
        setDescription(p.description ?? '')
        setCategoryId(p.category?.id ?? null)
        setIsActive(p.is_active)
      }
    } catch { addToast('Failed to load product', 'error') }
    finally { setLoading(false) }
  }, [productId])

  const loadAttributes = React.useCallback(async () => {
    try {
      const res = await window.api.products.getAllAttributes?.({ is_active: 'yes' })
      if (res?.success && res.data) setAttributes(res.data.items ?? [])
    } catch { /* ignore */ }
  }, [])

  React.useEffect(() => {
    if (open) { loadProduct(); loadAttributes() }
  }, [open, loadProduct, loadAttributes])

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  const validateProduct = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Product name is required'
    if (!categoryId) e.category = 'Category is required'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSaveProduct = async () => {
    if (!validateProduct() || !product) return
    setSaving(true)
    try {
      const res = await window.api.products.updateProduct({
        id: product.id,
        product_name: name.trim(),
        description: description.trim() || '',
        category_id: categoryId!,
        is_active: isActive,
      })
      if (!res.success) throw new Error(res.message)
      addToast('Product updated!', 'success')
      setProduct(prev => prev ? {
        ...prev,
        product_name: name,
        description: description || null,
        category: prev.category ? { ...prev.category, id: categoryId! } : null,
        is_active: isActive,
      } : prev)
      onSuccess()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update product', 'error')
    } finally { setSaving(false) }
  }

  const handleSkuSaved = (updatedSku: Sku) => {
    setProduct(prev => {
      if (!prev) return prev
      const existing = prev.skus.find(s => s.id === updatedSku.id)
      const skus = existing
        ? prev.skus.map(s => s.id === updatedSku.id ? updatedSku : s)
        : [...prev.skus, updatedSku]
      return { ...prev, skus, sku_count: skus.length }
    })
    setSelectedSkuId(updatedSku.id)
    onSuccess()
  }

  const handleDeleteSku = async (skuId: number) => {
    if (!confirm('Delete this SKU? This cannot be undone.')) return
    try {
      const res = await window.api.products.softDeleteSku?.({ id: skuId })
      if (!res?.success) throw new Error(res?.message)
      setProduct(prev => {
        if (!prev) return prev
        const skus = prev.skus.filter(s => s.id !== skuId)
        return { ...prev, skus, sku_count: skus.length }
      })
      if (selectedSkuId === skuId) setSelectedSkuId(null)
      addToast('SKU deleted', 'success')
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed to delete SKU', 'error') }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-[60] space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white pointer-events-auto ${t.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
            {t.type === 'success'
              ? <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
            {t.message}
          </div>
        ))}
      </div>

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {product && (
              <ProductImage images={product.images} productName={product.product_name} size="md" />
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">
                {loading ? 'Loading…' : product?.product_name ?? 'Product'}
              </h2>
              {product && (
                <p className="text-xs text-gray-500">
                  ID: #{String(product.id).padStart(4, '0')} · {product.category?.name} · {product.sku_count} SKU{product.sku_count !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-gray-100 bg-gray-50/60 flex-shrink-0">
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <TabButton active={tab === 'details'} onClick={() => setTab('details')}>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Product Details
              </div>
            </TabButton>
            <TabButton active={tab === 'skus'} onClick={() => setTab('skus')}>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                SKUs
                {product && (
                  <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                    {product.sku_count}
                  </span>
                )}
              </div>
            </TabButton>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Loading product…
              </div>
            </div>
          ) : !product ? (
            <div className="flex items-center justify-center py-24 text-gray-400">Product not found</div>
          ) : (
            <>
              {/* ── Details Tab ── */}
              {tab === 'details' && (
                <div className="p-6 space-y-6">
                  {/* Stats row — now uses real rich metric names */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Inventory Value', value: formatCurrency(product.metrics?.total_items_remaining * (product.metrics?.avg_cost_per_unit ?? 0)), color: 'blue' },
                      { label: 'Items Sold', value: product.metrics?.total_items_sold ?? 0, color: 'emerald' },
                      { label: 'Profit Margin', value: `${((product.metrics?.profit_margin ?? 0) * 100).toFixed(1)}%`, color: 'violet' },
                      { label: 'SKU Count', value: product.sku_count, color: 'amber' },
                    ].map(stat => (
                      <div key={stat.label} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
                        <div className="text-sm font-bold text-gray-900">{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field
                      label="Product Name" value={name} onChange={setName} required
                      error={formErrors.name} onClearError={() => setFormErrors(e => ({ ...e, name: '' }))}
                      placeholder="Enter product name"
                      disabled={product.is_deleted}
                    />
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <CategorySelect
                        value={categoryId}
                        onChange={v => { setCategoryId(v); setFormErrors(e => ({ ...e, category: '' })) }}
                        error={formErrors.category}
                      />
                    </div>
                  </div>

                  <Field
                    label="Description" value={description} onChange={setDescription}
                    placeholder="Optional product description…" textarea
                    disabled={product.is_deleted}
                  />

                  <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50/60">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Active Status</p>
                      <p className="text-xs text-gray-500">Inactive products won't appear in sales points</p>
                    </div>
                    <button
                      onClick={() => !product.is_deleted && setIsActive(a => !a)}
                      disabled={product.is_deleted}
                      className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${isActive ? 'bg-blue-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isActive ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    {[
                      { label: 'Created On', value: formatDate(product.created_on) },
                      { label: 'Last Updated', value: formatDate(product.updated_on) },
                      { label: 'Total Revenue', value: formatCurrency(product.metrics?.total_revenue) },
                    ].map(row => (
                      <div key={row.label} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="text-gray-400 mb-0.5">{row.label}</div>
                        <div className="font-semibold text-gray-700">{row.value}</div>
                      </div>
                    ))}
                  </div>

                  {product.is_deleted && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <p className="text-sm text-red-700 font-medium">This product has been deleted. Restore it to make edits.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── SKUs Tab ── */}
              {tab === 'skus' && (
                <div className="flex h-full min-h-[500px]">
                  <div className="w-56 flex-shrink-0 border-r border-gray-200 bg-gray-50/50 flex flex-col">
                    <div className="p-3 border-b border-gray-200">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SKUs ({product.sku_count})</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {product.skus.map(sku => (
                        <button
                          key={sku.id}
                          onClick={() => setSelectedSkuId(selectedSkuId === sku.id ? null : sku.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group ${selectedSkuId === sku.id ? 'bg-white shadow-sm border border-gray-200' : 'hover:bg-white/70'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sku.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                            <span className="text-sm font-semibold text-gray-800 truncate">{sku.sku_name}</span>
                          </div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5 truncate">{sku.code}</div>
                        </button>
                      ))}
                    </div>
                    {!product.is_deleted && product.sku_count < 5 && (
                      <div className="p-2 border-t border-gray-200">
                        <button
                          onClick={() => setSelectedSkuId('new')}
                          className={`w-full px-3 py-2 rounded-lg border-2 border-dashed text-xs font-semibold transition-all flex items-center justify-center gap-1.5
                            ${selectedSkuId === 'new' ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-300 hover:border-blue-300 text-gray-500 hover:text-blue-600'}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          Add SKU
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-5">
                    {selectedSkuId === null && (
                      <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-16">
                        <svg className="w-12 h-12 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <p className="text-sm font-medium">Select a SKU to view or edit</p>
                        <p className="text-xs mt-1">or create a new one</p>
                      </div>
                    )}

                    {selectedSkuId === 'new' && (
                      <SkuEditor sku={null} attributes={attributes} productId={product.id} onSaved={handleSkuSaved} addToast={addToast} />
                    )}

                    {typeof selectedSkuId === 'number' && (() => {
                      const sku = product.skus.find(s => s.id === selectedSkuId)
                      if (!sku) return null
                      return (
                        <div className="space-y-5">
                          {/* SKU Metrics — updated to new field names */}
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: 'Remaining', value: sku.metrics?.total_remaining ?? 0 },
                              { label: 'Items Sold', value: sku.metrics?.total_sold ?? 0 },
                              { label: 'Avg Cost', value: formatCurrency(sku.metrics?.avg_cost_per_unit) },
                            ].map(m => (
                              <div key={m.label} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-center">
                                <div className="text-xs text-gray-400">{m.label}</div>
                                <div className="text-sm font-bold text-gray-900 mt-0.5">{m.value}</div>
                              </div>
                            ))}
                          </div>

                          <SkuEditor sku={sku} attributes={attributes} productId={product.id} onSaved={handleSkuSaved} addToast={addToast} />

                          {!product.is_deleted && (
                            <div className="flex justify-end">
                              <button
                                onClick={() => handleDeleteSku(sku.id)}
                                className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Delete this SKU
                              </button>
                            </div>
                          )}

                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                Stock Purchases ({sku.recent_purchases?.length ?? 0})
                              </h4>
                            </div>
                            {sku.recent_purchases && sku.recent_purchases.length > 0 ? (
                              <div className="space-y-2">
                                {sku.recent_purchases.map(p => <PurchaseRow key={p.id} purchase={p} />)}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-8 border border-dashed border-gray-200 rounded-xl text-gray-400 text-xs">
                                No stock purchases recorded
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && product && tab === 'details' && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
              Cancel
            </button>
            {!product.is_deleted && (
              <button
                onClick={handleSaveProduct}
                disabled={saving}
                className="px-5 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow flex items-center gap-2"
              >
                {saving ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                )}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default EditProductModal