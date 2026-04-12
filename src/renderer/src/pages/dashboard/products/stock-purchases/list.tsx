// stock-purchases.tsx
import ReactDOM from 'react-dom'
import ToastContainer, { ToastMessage } from '@renderer/components/toast/toast-container';
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Supplier = {
  id: number; supplier_name: string; contact_person: string | null
  phone_number: string | null; email: string | null; address: string | null
  is_active: boolean; is_deleted: boolean
}

type SkuImage = {
  path: string; filename: string; original_filename: string;
  mime_type: string; file_size: number; uploaded_at: string
}

type Sku = {
  id: number; sku_name: string; code: string; is_active: boolean; is_deleted: boolean
  images?: SkuImage[]
  product?: { id: number; name: string; is_active: boolean; category?: { id: number; name: string } | null }
}

type ApiStockPurchase = {
  id: number; sync_id: string | null; batch_number: string | null; sku_id: number
  sku: { id: number; sku_name: string; code: string; product_id: number; product_name: string }
  supplier_id: number | null
  supplier: { id: number; supplier_name: string; contact_person: string | null; phone_number: string | null; email: string | null; address: string | null; is_active: boolean } | null
  quantities: { bought: number; sold: number; remaining: number; sell_through_rate: number }
  costs: { price_per_unit: number; shipping_cost: number; landed_cost_per_unit: number; total_landed_cost: number }
  selling_price_range: { min: number; max: number; avg: number }
  financials: { revenue: number; cost_of_sold: number; shipping_paid_on_sales: number; profit: number; profit_margin: number; expected_revenue: { min: number; max: number; avg: number }; expected_profit: number; expected_profit_margin: number; revenue_vs_expected: { vs_min: number; vs_avg: number; vs_max: number } }
  dates: { purchased: number | null; arrived: number | null; created: number; updated: number; manufacture: string | null; expiry: string | null }
  time_metrics: { days_in_inventory: number | null; days_to_expiry: number | null; is_expired: boolean; is_expiring_soon: boolean; first_sale_date: number | null; last_sale_date: number | null; days_since_last_sale: number | null }
  performance: { rating: 'Excellent' | 'Good' | 'Average' | 'Poor'; stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'; is_profitable: boolean; is_fully_sold: boolean; has_sales: boolean }
  is_deleted: boolean; is_sync_required: boolean
}

type StockPurchase = {
  id: number; sku_id: number; quantity: number; price_per_unit: number; total_price_bought: number
  shipping_cost: number | null; min_price: number | null; max_price: number | null
  avg_anticipated_profit_margin: number | null; manufacture_date: string | null; expiry_date: string | null
  batch_number: string | null; purchased_on: number | null; arrived_on: number | null; supplier_id: number | null
  sku?: { id: number; name: string; code: string; product?: { id: number; name: string } | null } | null
  supplier?: { id: number; name: string; contact?: string | null } | null
  total_cost?: number; expected_revenue?: { min: number; max: number; avg: number }
  is_expired?: boolean; days_until_expiry?: number | null
}

type Pagination = {
  page: number; limit: number; total: number; total_pages: number;
  has_next: boolean; has_prev: boolean; returned: number
}

type SortKey = 'purchased_on_desc' | 'purchased_on_asc' | 'expiry_date_asc' | 'expiry_date_desc' | 'price_per_unit_asc' | 'price_per_unit_desc' | 'profit_margin_asc' | 'profit_margin_desc'

type CreatePurchaseForm = {
  sku_id: number | null; quantity: string; price_per_unit: string; total_price_bought: string
  shipping_cost: string; min_price: string; max_price: string; manufacture_date: string
  expiry_date: string; batch_number: string; purchased_on: string; arrived_on: string
  supplier_id: number | null; create_new_supplier: boolean; supplier_name: string
  contact_person: string; phone_number: string; email: string; address: string
}

const defaultForm = (): CreatePurchaseForm => ({
  sku_id: null, quantity: '', price_per_unit: '', total_price_bought: '',
  shipping_cost: '', min_price: '', max_price: '', manufacture_date: '',
  expiry_date: '', batch_number: '',
  purchased_on: new Date().toISOString().split('T')[0],
  arrived_on: new Date().toISOString().split('T')[0],
  supplier_id: null, create_new_supplier: false, supplier_name: '',
  contact_person: '', phone_number: '', email: '', address: '',
})

const LIMIT = 10

const sortLabels: Record<SortKey, string> = {
  purchased_on_desc: 'Newest first', purchased_on_asc: 'Oldest first',
  expiry_date_asc: 'Expiry (earliest)', expiry_date_desc: 'Expiry (latest)',
  price_per_unit_asc: 'Price ↑', price_per_unit_desc: 'Price ↓',
  profit_margin_asc: 'Margin ↑', profit_margin_desc: 'Margin ↓',
}

const sortToApi = (key: SortKey): { sort_by: string; sort_order: 'asc' | 'desc' } => {
  const map: Record<SortKey, { sort_by: string; sort_order: 'asc' | 'desc' }> = {
    purchased_on_desc: { sort_by: 'purchased_on', sort_order: 'desc' },
    purchased_on_asc: { sort_by: 'purchased_on', sort_order: 'asc' },
    expiry_date_asc: { sort_by: 'expiry_date', sort_order: 'asc' },
    expiry_date_desc: { sort_by: 'expiry_date', sort_order: 'desc' },
    price_per_unit_asc: { sort_by: 'price_per_unit', sort_order: 'asc' },
    price_per_unit_desc: { sort_by: 'price_per_unit', sort_order: 'desc' },
    profit_margin_asc: { sort_by: 'profit_margin', sort_order: 'asc' },
    profit_margin_desc: { sort_by: 'profit_margin', sort_order: 'desc' },
  }
  return map[key]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt$ = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v)

const fmtDate = (ts: number | string | null | undefined) => {
  if (!ts) return '—'
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const fmtAgo = (ts: number | null): string => {
  if (!ts) return 'Never'
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return fmtDate(ts)
}

const isExpired = (d: string | null) => !!d && new Date(d) < new Date()

const isExpiringSoon = (d: string | null) => {
  if (!d) return false
  const days = (new Date(d).getTime() - Date.now()) / 86400000
  return days > 0 && days <= 30
}

const normalizePurchase = (apiPurchase: ApiStockPurchase): StockPurchase => ({
  id: apiPurchase.id,
  sku_id: apiPurchase.sku_id,
  quantity: apiPurchase.quantities?.bought ?? 0,
  price_per_unit: apiPurchase.costs?.price_per_unit ?? 0,
  total_price_bought: apiPurchase.costs?.total_landed_cost ?? 0,
  shipping_cost: apiPurchase.costs?.shipping_cost ?? null,
  min_price: apiPurchase.selling_price_range?.min ?? null,
  max_price: apiPurchase.selling_price_range?.max ?? null,
  avg_anticipated_profit_margin: apiPurchase.financials?.expected_profit_margin ?? null,
  manufacture_date: apiPurchase.dates?.manufacture ?? null,
  expiry_date: apiPurchase.dates?.expiry ?? null,
  batch_number: apiPurchase.batch_number,
  purchased_on: apiPurchase.dates?.purchased ?? null,
  arrived_on: apiPurchase.dates?.arrived ?? null,
  supplier_id: apiPurchase.supplier_id,
  sku: apiPurchase.sku ? {
    id: apiPurchase.sku.id, name: apiPurchase.sku.sku_name, code: apiPurchase.sku.code,
    product: apiPurchase.sku.product_name ? { id: apiPurchase.sku.product_id, name: apiPurchase.sku.product_name } : null
  } : null,
  supplier: apiPurchase.supplier ? {
    id: apiPurchase.supplier.id, name: apiPurchase.supplier.supplier_name, contact: apiPurchase.supplier.contact_person
  } : null,
  total_cost: apiPurchase.costs?.total_landed_cost,
  expected_revenue: apiPurchase.financials?.expected_revenue,
  is_expired: apiPurchase.time_metrics?.is_expired,
  days_until_expiry: apiPurchase.time_metrics?.days_to_expiry
})

// ─── SkuAvatar ────────────────────────────────────────────────────────────────

const SkuAvatar = ({ sku, size = 'md' }: { sku?: { name: string; images?: SkuImage[] } | null; size?: 'sm' | 'md' }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const sizeMap = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm' }
  const colors = ['from-violet-400 to-violet-600', 'from-blue-400 to-blue-600', 'from-emerald-400 to-emerald-600', 'from-amber-400 to-amber-600', 'from-pink-400 to-pink-600']
  const name = sku?.name ?? '?'
  const gradient = colors[name.charCodeAt(0) % colors.length]

  useEffect(() => {
    const img = sku?.images?.[0]
    if (!img?.path) { setLoaded(true); return }
    try { const url = window.api.files.readFileAsDataURL((img as any).path); setImgSrc(url) } catch { }
    finally { setLoaded(true) }
  }, [sku])

  if (!loaded) return <div className={`${sizeMap[size]} rounded-lg bg-gray-200 animate-pulse flex-shrink-0`} />

  return (
    <div className={`${sizeMap[size]} rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 shadow-sm`}>
      {imgSrc
        ? <img src={imgSrc} alt={name} className="w-full h-full object-cover" />
        : <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <span className="text-white font-bold">{name.charAt(0).toUpperCase()}</span>
        </div>
      }
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const PurchaseSkeleton = () => (
  <div className="divide-y divide-gray-100">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4 animate-pulse">
        <div className="col-span-1 flex items-center"><div className="w-10 h-10 bg-gray-200 rounded-lg" /></div>
        <div className="col-span-3 space-y-1.5 flex flex-col justify-center"><div className="h-4 bg-gray-200 rounded w-3/4" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
        <div className="col-span-1 flex items-center"><div className="h-7 bg-blue-100 rounded-lg w-12" /></div>
        <div className="col-span-2 flex items-center"><div className="h-4 bg-gray-200 rounded w-24" /></div>
        <div className="col-span-3 flex items-center"><div className="h-5 bg-gray-100 rounded-full w-24" /></div>
        <div className="col-span-2 flex items-center justify-end"><div className="h-8 w-8 bg-gray-200 rounded-full" /></div>
      </div>
    ))}
  </div>
)

// ─── SKU Dropdown ─────────────────────────────────────────────────────────────

const SkuDropdown = ({ value, onChange, error, required }: {
  value: number | null; onChange: (id: number | null, sku?: any) => void; error?: string; required?: boolean
}) => {
  const [skus, setSkus] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.products.getAllSkus({ should_paginate: false } as any)
      .then(r => { if (r.success && r.data) setSkus(r.data.items as any) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    if (open) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const filtered = skus.filter(s => !search || s.sku_name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()) || s.product?.name?.toLowerCase().includes(search.toLowerCase()))
  const selected = skus.find(s => s.id === value)

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-semibold text-gray-600 mb-1">SKU {required && <span className="text-red-500">*</span>}</label>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm text-left focus:outline-none focus:ring-2 transition-all ${error ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`}>
        {loading ? <span className="text-gray-400">Loading SKUs…</span>
          : selected ? (
            <div className="flex items-center gap-2 min-w-0">
              <SkuAvatar sku={{ name: selected.sku_name }} size="sm" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{selected.sku_name}</div>
                <div className="text-xs text-gray-400 font-mono truncate">{selected.code}</div>
              </div>
            </div>
          ) : <span className="text-gray-400">Select a SKU…</span>}
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-2 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && !loading && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, code, product…" className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {value !== null && (
              <button onClick={() => { onChange(null); setOpen(false); setSearch('') }}
                className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50 flex items-center gap-2 italic border-b border-gray-100">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>Clear
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-sm text-gray-400 mb-1">No SKUs found{search ? ` for "${search}"` : ''}</p>
                <p className="text-xs text-blue-600 font-medium">Create a SKU from the Products page first</p>
              </div>
            ) : filtered.map(sku => (
              <button key={sku.id} onClick={() => { onChange(sku.id, sku); setOpen(false); setSearch('') }}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 transition-colors ${value === sku.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <SkuAvatar sku={{ name: sku.sku_name }} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${value === sku.id ? 'text-blue-700' : 'text-gray-800'}`}>{sku.sku_name}</div>
                  <div className="text-xs text-gray-400 font-mono truncate">{sku.code}{sku.product?.name ? ` · ${sku.product.name}` : ''}</div>
                </div>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sku.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                {value === sku.id && <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

// ─── Supplier Section ─────────────────────────────────────────────────────────

const SupplierSection = ({ form, set, errors }: {
  form: CreatePurchaseForm; set: (p: Partial<CreatePurchaseForm>) => void; errors: Record<string, string>
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.products.getAllSuppliers({ should_paginate: false } as any)
      .then(r => { if (r.success && r.data) setSuppliers(r.data.items) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    if (open) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const filtered = suppliers.filter(s => !search || s.supplier_name.toLowerCase().includes(search.toLowerCase()))
  const selected = suppliers.find(s => s.id === form.supplier_id)

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Supplier <span className="font-normal normal-case text-gray-400">(optional)</span></p>
        <button type="button" onClick={() => set({ create_new_supplier: !form.create_new_supplier, supplier_id: null })} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          {form.create_new_supplier ? '← Select existing' : '+ New supplier'}
        </button>
      </div>
      {form.create_new_supplier ? (
        <div className="space-y-3 p-3 bg-blue-50/40 rounded-lg border border-blue-100">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Supplier Name <span className="text-red-500">*</span></label>
            <input value={form.supplier_name} onChange={e => set({ supplier_name: e.target.value })} placeholder="e.g. Acme Supplies Ltd."
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.supplier_name ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}`} />
            {errors.supplier_name && <p className="text-xs text-red-600 mt-1">{errors.supplier_name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Contact Person</label><input value={form.contact_person} onChange={e => set({ contact_person: e.target.value })} placeholder="Name" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label><input value={form.phone_number} onChange={e => set({ phone_number: e.target.value })} placeholder="+1 234 567" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" /></div>
          </div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Email</label><input type="email" value={form.email} onChange={e => set({ email: e.target.value })} placeholder="supplier@example.com" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" /></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Address</label><input value={form.address} onChange={e => set({ address: e.target.value })} placeholder="Street, City" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" /></div>
        </div>
      ) : (
        <div className="relative" ref={ref}>
          <button type="button" onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <span className={selected ? 'text-gray-900 font-medium' : 'text-gray-400'}>{loading ? 'Loading…' : selected ? selected.supplier_name : 'No supplier (optional)'}</span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {open && !loading && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers…" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
              </div>
              <div className="max-h-48 overflow-y-auto py-1">
                <button onClick={() => { set({ supplier_id: null }); setOpen(false); setSearch('') }} className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50 italic border-b border-gray-100">No supplier</button>
                {filtered.length === 0
                  ? <div className="px-3 py-3 text-center text-sm text-gray-400">No suppliers found</div>
                  : filtered.map(s => (
                    <button key={s.id} onClick={() => { set({ supplier_id: s.id }); setOpen(false); setSearch('') }}
                      className={`w-full px-3 py-2.5 text-left text-sm flex items-center justify-between transition-colors ${form.supplier_id === s.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50 text-gray-800'}`}>
                      <div><div className="font-medium">{s.supplier_name}</div>{s.contact_person && <div className="text-xs text-gray-400">{s.contact_person}</div>}</div>
                      {form.supplier_id === s.id && <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Purchase Modal — offcanvas ───────────────────────────────────────────────

const PurchaseModal = ({ open, onClose, onSuccess, editPurchase }: {
  open: boolean; onClose: () => void; onSuccess: (msg: string) => void; editPurchase?: StockPurchase | null
}) => {
  const [form, setForm] = useState<CreatePurchaseForm>(defaultForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const isEdit = !!editPurchase

  useEffect(() => {
    if (!open) return
    if (editPurchase) {
      setForm({
        sku_id: editPurchase.sku_id,
        quantity: String(editPurchase.quantity),
        price_per_unit: String(editPurchase.price_per_unit),
        total_price_bought: String(editPurchase.total_price_bought),
        shipping_cost: editPurchase.shipping_cost != null ? String(editPurchase.shipping_cost) : '',
        min_price: editPurchase.min_price != null ? String(editPurchase.min_price) : '',
        max_price: editPurchase.max_price != null ? String(editPurchase.max_price) : '',
        manufacture_date: editPurchase.manufacture_date ?? '',
        expiry_date: editPurchase.expiry_date ?? '',
        batch_number: editPurchase.batch_number ?? '',
        purchased_on: editPurchase.purchased_on ? new Date(editPurchase.purchased_on * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        arrived_on: editPurchase.arrived_on ? new Date(editPurchase.arrived_on * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        supplier_id: editPurchase.supplier_id || null,
        create_new_supplier: false, supplier_name: '', contact_person: '', phone_number: '', email: '', address: '',
      })
    } else {
      setForm(defaultForm())
    }
    setErrors({})
  }, [open, editPurchase])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  const set = (patch: Partial<CreatePurchaseForm>) => setForm(f => ({ ...f, ...patch }))

  useEffect(() => {
    const qty = parseFloat(form.quantity), price = parseFloat(form.price_per_unit)
    if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) set({ total_price_bought: (qty * price).toFixed(2) })
  }, [form.quantity, form.price_per_unit])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.sku_id) e.sku_id = 'Please select a SKU'
    if (!form.quantity || parseFloat(form.quantity) <= 0) e.quantity = 'Quantity must be greater than 0'
    if (!form.price_per_unit || parseFloat(form.price_per_unit) < 0) e.price_per_unit = 'Enter a valid price'
    if (!form.total_price_bought || parseFloat(form.total_price_bought) < 0) e.total_price_bought = 'Enter total cost'
    if (!form.min_price || parseFloat(form.min_price) < 0) e.min_price = 'Enter a minimum selling price'
    if (form.create_new_supplier && !form.supplier_name.trim()) e.supplier_name = 'Supplier name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      let supplierId = form.supplier_id ?? undefined
      if (form.create_new_supplier && form.supplier_name.trim()) {
        const sRes = await window.api.products.createSupplier({
          supplier_name: form.supplier_name.trim(),
          contact_person: form.contact_person.trim() || undefined,
          phone_number: form.phone_number.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
        })
        if (!sRes.success || !sRes.data?.id) throw new Error(sRes.message || 'Failed to create supplier')
        supplierId = sRes.data.id
      }
      if (isEdit && editPurchase) {
        const res = await window.api.products.updateStockPurchase({
          id: editPurchase.id, quantity: parseInt(form.quantity),
          price_per_unit: parseFloat(form.price_per_unit),
          total_price_bought: parseFloat(form.total_price_bought),
          shipping_cost: form.shipping_cost ? parseFloat(form.shipping_cost) : undefined,
          min_price: parseFloat(form.min_price || '0'),
          max_price: form.max_price ? parseFloat(form.max_price) : undefined,
          manufacture_date: form.manufacture_date || undefined,
          expiry_date: form.expiry_date || undefined,
          batch_number: form.batch_number || undefined,
          purchased_on: form.purchased_on ? new Date(form.purchased_on).getTime() / 1000 : undefined,
          arrived_on: form.arrived_on ? new Date(form.arrived_on).getTime() / 1000 : undefined,
          supplier_id: supplierId,
        })
        if (!res.success) throw new Error(res.message)
        onSuccess('Stock purchase updated successfully!')
      } else {
        const res = await window.api.products.createStockPurchase({
          sku_id: form.sku_id!, quantity: parseInt(form.quantity),
          price_per_unit: parseFloat(form.price_per_unit),
          total_price_bought: parseFloat(form.total_price_bought),
          shipping_cost: form.shipping_cost ? parseFloat(form.shipping_cost) : undefined,
          min_price: parseFloat(form.min_price || '0'),
          max_price: form.max_price ? parseFloat(form.max_price) : undefined,
          manufacture_date: form.manufacture_date || undefined,
          expiry_date: form.expiry_date || undefined,
          batch_number: form.batch_number || undefined,
          purchased_on: form.purchased_on ? new Date(form.purchased_on).getTime() / 1000 : undefined,
          arrived_on: form.arrived_on ? new Date(form.arrived_on).getTime() / 1000 : undefined,
          supplier_id: supplierId,
        })
        if (!res.success) throw new Error(res.message)
        onSuccess('Stock purchase created successfully!')
      }
      onClose()
    } catch (err) {
      setErrors(e => ({ ...e, _general: err instanceof Error ? err.message : 'An error occurred' }))
    } finally {
      setSubmitting(false)
    }
  }

  return ReactDOM.createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9998] bg-black/25 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
      />

      {/* Offcanvas panel */}
      <div
        className={`fixed top-0 right-0 z-[9999] h-full bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out overflow-x-hidden ${open ? 'translate-x-0' : 'translate-x-full'
          }`}
        style={{ width: 'min(480px, 100vw)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                {isEdit ? 'Edit Stock Purchase' : 'New Stock Purchase'}
              </h2>
              {isEdit && <p className="text-xs text-gray-500">Purchase #{editPurchase?.id}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 space-y-5">
          {errors._general && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {errors._general}
            </div>
          )}

          {!isEdit ? (
            <SkuDropdown
              value={form.sku_id}
              onChange={(id) => { set({ sku_id: id }); if (errors.sku_id) setErrors(e => { const n = { ...e }; delete n.sku_id; return n }) }}
              error={errors.sku_id}
              required
            />
          ) : editPurchase?.sku && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-violet-50 rounded-lg border border-violet-200">
              <svg className="w-4 h-4 text-violet-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-violet-800 truncate">{editPurchase.sku.name}</p>
                <p className="text-xs text-violet-600 font-mono">{editPurchase.sku.code}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity <span className="text-red-500">*</span></label>
              <input type="number" min="1" value={form.quantity}
                onChange={e => { set({ quantity: e.target.value }); if (errors.quantity) setErrors(er => { const n = { ...er }; delete n.quantity; return n }) }}
                placeholder="e.g. 100"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.quantity ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`} />
              {errors.quantity && <p className="text-xs text-red-600 mt-1">{errors.quantity}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Price / Unit <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" value={form.price_per_unit}
                onChange={e => { set({ price_per_unit: e.target.value }); if (errors.price_per_unit) setErrors(er => { const n = { ...er }; delete n.price_per_unit; return n }) }}
                placeholder="0.00"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.price_per_unit ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`} />
              {errors.price_per_unit && <p className="text-xs text-red-600 mt-1">{errors.price_per_unit}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Total Cost <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" value={form.total_price_bought}
                onChange={e => { set({ total_price_bought: e.target.value }); if (errors.total_price_bought) setErrors(er => { const n = { ...er }; delete n.total_price_bought; return n }) }}
                placeholder="Auto-calculated"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.total_price_bought ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`} />
              {errors.total_price_bought && <p className="text-xs text-red-600 mt-1">{errors.total_price_bought}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Shipping Cost</label>
              <input type="number" min="0" step="0.01" value={form.shipping_cost} onChange={e => set({ shipping_cost: e.target.value })} placeholder="0.00" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Min Selling Price <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" value={form.min_price}
                onChange={e => { set({ min_price: e.target.value }); if (errors.min_price) setErrors(er => { const n = { ...er }; delete n.min_price; return n }) }}
                placeholder="0.00"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.min_price ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`} />
              {errors.min_price && <p className="text-xs text-red-600 mt-1">{errors.min_price}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Max Selling Price</label>
              <input type="number" min="0" step="0.01" value={form.max_price} onChange={e => set({ max_price: e.target.value })} placeholder="0.00" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Purchased On</label>
              <input type="date" value={form.purchased_on} onChange={e => set({ purchased_on: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Arrived On</label>
              <input type="date" value={form.arrived_on} onChange={e => set({ arrived_on: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Expiry Date</label>
              <input type="date" value={form.expiry_date} onChange={e => set({ expiry_date: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Manufacture Date</label>
              <input type="date" value={form.manufacture_date} onChange={e => set({ manufacture_date: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Batch Number</label>
            <input type="text" value={form.batch_number} onChange={e => set({ batch_number: e.target.value })} placeholder="e.g. BATCH-2024-001" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>

          <SupplierSection form={form} set={set} errors={errors} />

          <div className="h-2" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-5 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow flex items-center gap-2">
            {submitting ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {isEdit ? 'Save Changes' : 'Create Purchase'}
              </>
            )}
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

// ─── Delete Modal — portaled centered confirm ─────────────────────────────────

const DeleteModal = ({ purchase, onConfirm, onCancel }: {
  purchase: StockPurchase; onConfirm: () => void; onCancel: () => void
}) => ReactDOM.createPortal(
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
    style={{ animation: 'fadeIn 0.15s ease-out' }}
    onClick={onCancel}
  >
    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
    <div
      className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden z-10"
      style={{ animation: 'scaleIn 0.15s ease-out' }}
      onClick={e => e.stopPropagation()}
    >
      <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-red-50 to-red-100/40">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Delete Stock Purchase?</h3>
            <p className="text-sm text-gray-500 mt-1">Purchase #{purchase.id} · {fmt$(purchase.total_price_bought)}</p>
          </div>
        </div>
      </div>
      <div className="px-6 py-5">
        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200 mb-5">
          <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-800">This purchase record will be soft-deleted. Data is preserved and can be restored at any time.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold border border-gray-300 rounded-lg transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
    <style>{`
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    `}</style>
  </div>,
  document.body
)

// ─── Purchase Row ─────────────────────────────────────────────────────────────

const PurchaseRow = ({ purchase, expanded, onToggle, onEdit, onDelete, onRestore, isDeleted }: {
  purchase: StockPurchase; expanded: boolean; onToggle: () => void
  onEdit: (p: StockPurchase) => void; onDelete: (p: StockPurchase) => void
  onRestore: (id: number) => void; isDeleted: boolean
}) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false) }
    if (showDropdown) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showDropdown])

  const expired = isExpired(purchase.expiry_date)
  const expiringSoon = isExpiringSoon(purchase.expiry_date)

  return (
    <div className={`group ${isDeleted ? 'opacity-70' : ''}`}>
      <div onClick={onToggle}
        className={`relative grid grid-cols-1 lg:grid-cols-12 items-center gap-3 lg:gap-4 px-4 lg:px-6 py-4 border-b border-gray-100 hover:bg-gray-50/80 transition-all duration-200 cursor-pointer
          ${expanded ? 'bg-blue-50/40' : ''} ${isDeleted ? 'bg-red-50/20' : ''}`}>

        <div className="lg:col-span-1 flex items-center gap-3 lg:gap-0">
          <div className="relative">
            <SkuAvatar sku={purchase.sku ? { name: purchase.sku.name } : null} size="md" />
            {isDeleted && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></div>}
            {expired && !isDeleted && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" /></svg></div>}
            {expiringSoon && !expired && !isDeleted && <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" /></svg></div>}
          </div>
          <div className="lg:hidden flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate">{purchase.sku?.name ?? `Purchase #${purchase.id}`}</div>
            <div className="text-xs text-gray-500 mt-0.5 font-mono">{purchase.sku?.code}</div>
          </div>
        </div>

        <div className="hidden lg:flex lg:col-span-3 flex-col justify-center min-w-0">
          <div className="font-semibold text-gray-900 truncate">{purchase.sku?.name ?? `Purchase #${purchase.id}`}</div>
          <div className="text-xs text-gray-400 mt-0.5 truncate">
            {purchase.sku?.code && <span className="font-mono">{purchase.sku.code}</span>}
            {purchase.sku?.product?.name && <span className="ml-1">· {purchase.sku.product.name}</span>}
          </div>
        </div>

        <div className="hidden lg:flex lg:col-span-1 items-center">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            <span className="text-xs font-semibold text-blue-700">{purchase.quantity}</span>
          </div>
        </div>

        <div className="hidden lg:flex lg:col-span-2 flex-col justify-center">
          <div className="text-sm font-bold text-gray-900">{fmt$(purchase.total_price_bought)}</div>
          <div className="text-xs text-gray-400">{fmt$(purchase.price_per_unit)}/unit</div>
        </div>

        <div className="hidden lg:flex lg:col-span-3 items-center gap-1.5 flex-wrap">
          {purchase.supplier?.name && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 max-w-[110px] truncate">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              {purchase.supplier.name}
            </span>
          )}
          {expired && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">Expired</span>}
          {expiringSoon && !expired && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Expiring soon</span>}
          {purchase.batch_number && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 font-mono">{purchase.batch_number}</span>}
          {!purchase.supplier?.name && !expired && !expiringSoon && !purchase.batch_number && <span className="text-xs text-gray-400">—</span>}
        </div>

        <div className="hidden lg:flex lg:col-span-2 justify-end items-center gap-2">
          <span className="text-xs text-gray-400">{fmtAgo(purchase.purchased_on)}</span>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${expanded ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'}`}>
            <svg className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="bg-gradient-to-br from-blue-50/30 to-gray-50/60 border-b border-gray-200">
          <div className="px-4 lg:px-8 py-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Purchase Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Purchase Details
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Purchase ID', value: `#${purchase.id}`, mono: true },
                  { label: 'Quantity', value: `${purchase.quantity} units` },
                  { label: 'Unit Price', value: fmt$(purchase.price_per_unit) },
                  { label: 'Shipping Cost', value: fmt$(purchase.shipping_cost) },
                  { label: 'Total Cost', value: fmt$(purchase.total_price_bought) },
                  { label: 'Min Sell Price', value: fmt$(purchase.min_price) },
                  { label: 'Max Sell Price', value: fmt$(purchase.max_price) },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}:</span>
                    <span className={`font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Expected Margin:</span>
                  <span className={`font-medium ${purchase.avg_anticipated_profit_margin && purchase.avg_anticipated_profit_margin > 20 ? 'text-green-600' : purchase.avg_anticipated_profit_margin && purchase.avg_anticipated_profit_margin > 10 ? 'text-blue-600' : 'text-amber-600'}`}>
                    {purchase.avg_anticipated_profit_margin != null ? `${(purchase.avg_anticipated_profit_margin * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Dates & Batch */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Timeline & Batch
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Purchased', value: purchase.purchased_on ? fmtDate(purchase.purchased_on) : '—' },
                  { label: 'Arrived', value: purchase.arrived_on ? fmtDate(purchase.arrived_on) : '—' },
                  { label: 'Manufactured', value: purchase.manufacture_date ? fmtDate(purchase.manufacture_date) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}:</span>
                    <span className="font-medium text-gray-900">{value}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Expires:</span>
                  <span className={`font-medium ${expired ? 'text-red-600' : expiringSoon ? 'text-amber-600' : 'text-gray-900'}`}>
                    {purchase.expiry_date ? fmtDate(purchase.expiry_date) : '—'}
                    {expired && ' (Expired)'}
                    {expiringSoon && !expired && ' (Soon)'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Batch Number:</span>
                  <span className="font-mono font-medium text-gray-900">{purchase.batch_number || '—'}</span>
                </div>
              </div>
            </div>

            {/* Supplier & Actions */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                Supplier & Actions
              </h3>
              {purchase.supplier ? (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="font-medium text-gray-900">{purchase.supplier.name}</p>
                  {purchase.supplier.contact && <p className="text-xs text-gray-500 mt-1">Contact: {purchase.supplier.contact}</p>}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No supplier recorded</p>
              )}
              <div className="space-y-2 mt-3">
                {!isDeleted && (
                  <button onClick={(e) => { e.stopPropagation(); onEdit(purchase) }}
                    className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Edit Purchase
                  </button>
                )}
                <div className="relative" ref={dropdownRef}>
                  <button onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown) }}
                    className="w-full px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium border border-gray-300 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                    More Options
                  </button>
                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                      {isDeleted ? (
                        <button onClick={(e) => { e.stopPropagation(); setShowDropdown(false); onRestore(purchase.id) }}
                          className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-green-50 text-green-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          <span className="font-medium">Restore Purchase</span>
                        </button>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setShowDropdown(false); onDelete(purchase) }}
                          className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-red-50 text-red-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          <span className="font-medium">Delete Purchase</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const StockPurchases = () => {
  const [purchases, setPurchases] = useState<StockPurchase[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('purchased_on_desc')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active')
  const [showModal, setShowModal] = useState(false)
  const [editPurchase, setEditPurchase] = useState<StockPurchase | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StockPurchase | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [activeCount, setActiveCount] = useState(0)
  const [deletedCount, setDeletedCount] = useState(0)
  const sortMenuRef = useRef<HTMLDivElement>(null)

  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
  }
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  const loadPurchases = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const { sort_by, sort_order } = sortToApi(sortKey)
      const res = await window.api.products.getAllStockPurchases({
        page, limit: LIMIT,
        is_deleted: activeTab === 'deleted' ? 'yes' : 'no',
        sort_by: sort_by as any, sort_order,
        with_sku_details: true, with_supplier_details: true,
      })
      if (res.success && res.data) {
        setPurchases((res.data.items as ApiStockPurchase[]).map(item => normalizePurchase(item)))
        const pag = res.data.pagination
        if (pag) {
          setPagination({
            page: pag.page ?? page, limit: pag.limit ?? LIMIT, total: pag.total ?? 0,
            total_pages: pag.total_pages ?? Math.ceil((pag.total ?? 0) / LIMIT),
            has_next: pag.has_next ?? false, has_prev: pag.has_prev ?? false,
            returned: pag.returned ?? (res.data.items?.length ?? 0)
          })
        }
      } else {
        addToast(res.message || 'Failed to load stock purchases', 'error')
      }
    } catch (error) {
      addToast('An error occurred while loading stock purchases', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [activeTab, sortKey])

  const loadCounts = useCallback(async () => {
    try {
      const [activeRes, deletedRes] = await Promise.all([
        window.api.products.getAllStockPurchases({ page: 1, limit: 1, is_deleted: 'no' }),
        window.api.products.getAllStockPurchases({ page: 1, limit: 1, is_deleted: 'yes' }),
      ])
      if (activeRes.success && activeRes.data?.pagination) setActiveCount(activeRes.data.pagination.total ?? 0)
      if (deletedRes.success && deletedRes.data?.pagination) setDeletedCount(deletedRes.data.pagination.total ?? 0)
    } catch (error) { console.error('Failed to load counts:', error) }
  }, [])

  useEffect(() => { loadPurchases(currentPage) }, [loadPurchases, currentPage])
  useEffect(() => { loadCounts() }, [loadCounts])
  useEffect(() => {
    if (!pagination) return
    if (activeTab === 'active') setActiveCount(pagination.total)
    else setDeletedCount(pagination.total)
  }, [pagination, activeTab])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setShowSortMenu(false) }
    if (showSortMenu) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showSortMenu])

  const handleTabChange = (tab: 'active' | 'deleted') => {
    if (tab === activeTab) return
    setActiveTab(tab); setCurrentPage(1); setExpandedId(null)
  }

  const handleSortChange = (key: SortKey) => { setSortKey(key); setCurrentPage(1); setShowSortMenu(false) }

  const handleDelete = async (purchase: StockPurchase) => {
    try {
      const res = await window.api.products.softDeleteStockPurchase({ id: purchase.id })
      if (!res.success) throw new Error(res.message)
      addToast(`Purchase #${purchase.id} deleted successfully`, 'success')
      setDeleteTarget(null)
      const newPage = purchases.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
      setCurrentPage(newPage)
      await loadPurchases(newPage)
      await loadCounts()
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed to delete purchase', 'error') }
  }

  const handleRestore = async (id: number) => {
    try {
      const res = await window.api.products.softDeleteStockPurchase({ id, restore: true })
      if (!res.success) throw new Error(res.message)
      addToast(`Purchase #${id} restored successfully`, 'success')
      const newPage = purchases.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
      setCurrentPage(newPage)
      await loadPurchases(newPage)
      await loadCounts()
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed to restore purchase', 'error') }
  }

  const handleSuccess = async (msg: string) => {
    addToast(msg, 'success')
    await loadPurchases(currentPage)
    await loadCounts()
  }

  const goToPage = (page: number) => { setCurrentPage(page); setExpandedId(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const getPaginationRange = (): (number | '…')[] => {
    if (!pagination) return []
    const { page, total_pages } = pagination
    if (total_pages <= 7) return Array.from({ length: total_pages }, (_, i) => i + 1)
    const range: (number | '…')[] = [1]
    if (page > 3) range.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(total_pages - 1, page + 1); i++) range.push(i)
    if (page < total_pages - 2) range.push('…')
    range.push(total_pages)
    return range
  }

  const totalValue = purchases.reduce((sum, p) => sum + p.total_price_bought, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50">
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      <PurchaseModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditPurchase(null) }}
        onSuccess={handleSuccess}
        editPurchase={editPurchase}
      />

      {deleteTarget && (
        <DeleteModal
          purchase={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Stock Purchases</h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{activeCount} active
                  </span>
                  {!loading && purchases.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {fmt$(totalValue)} total
                    </span>
                  )}
                  {deletedCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{deletedCount} deleted
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="relative" ref={sortMenuRef}>
                <button onClick={() => setShowSortMenu(!showSortMenu)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-all shadow-sm whitespace-nowrap">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg>
                  <span className="hidden sm:inline">{sortLabels[sortKey]}</span>
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-30">
                    {[
                      { group: 'Date', keys: ['purchased_on_desc', 'purchased_on_asc'] as SortKey[] },
                      { group: 'Expiry', keys: ['expiry_date_asc', 'expiry_date_desc'] as SortKey[] },
                      { group: 'Price', keys: ['price_per_unit_asc', 'price_per_unit_desc'] as SortKey[] },
                      { group: 'Profit Margin', keys: ['profit_margin_asc', 'profit_margin_desc'] as SortKey[] },
                    ].map(({ group, keys }, gi) => (
                      <div key={group}>
                        {gi > 0 && <div className="border-t border-gray-100 my-1" />}
                        <div className="px-3 py-1.5"><p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{group}</p></div>
                        {keys.map(key => (
                          <button key={key} onClick={() => handleSortChange(key)}
                            className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors ${sortKey === key ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                            {sortLabels[key]}
                            {sortKey === key && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {activeTab === 'active' && (
                <button onClick={() => { setEditPurchase(null); setShowModal(true) }}
                  className="px-3 sm:px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  <span className="hidden sm:inline">Add Purchase</span>
                  <span className="sm:hidden">Add</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-4 sm:px-6 pt-3">
            {[
              { key: 'active' as const, label: 'Active Purchases', count: activeCount, color: 'blue' },
              { key: 'deleted' as const, label: 'Deleted', count: deletedCount, color: 'red' },
            ].map(tab => (
              <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all border-b-2 mr-1 ${activeTab === tab.key
                    ? tab.color === 'blue' ? 'text-blue-600 border-blue-600' : 'text-red-600 border-red-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                  }`}>
                {tab.label}
                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold ${activeTab === tab.key ? tab.color === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                  }`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
            {[
              { label: '', span: 1 }, { label: 'SKU / Product', span: 3 }, { label: 'Qty', span: 1 },
              { label: 'Total Cost', span: 2 }, { label: 'Tags', span: 3 }, { label: 'Purchased', span: 2 },
            ].map(({ label, span }) => (
              <div key={label} className={`col-span-${span}`}>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <PurchaseSkeleton />
          ) : purchases.length === 0 ? (
            <div className="py-16 sm:py-24 px-4 text-center">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${activeTab === 'deleted' ? 'bg-red-50' : 'bg-blue-50'}`}>
                {activeTab === 'deleted'
                  ? <svg className="w-8 h-8 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  : <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                }
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                {activeTab === 'deleted' ? 'No deleted purchases' : 'No stock purchases yet'}
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                {activeTab === 'deleted' ? 'Deleted stock purchases will appear here.' : 'Start tracking your inventory by recording your first stock purchase.'}
              </p>
              {activeTab === 'active' && (
                <button onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add your first purchase
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {purchases.map(purchase => (
                <PurchaseRow
                  key={purchase.id}
                  purchase={purchase}
                  expanded={expandedId === purchase.id}
                  onToggle={() => setExpandedId(expandedId === purchase.id ? null : purchase.id)}
                  onEdit={(p) => { setEditPurchase(p); setShowModal(true) }}
                  onDelete={(p) => setDeleteTarget(p)}
                  onRestore={handleRestore}
                  isDeleted={activeTab === 'deleted'}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && pagination && pagination.total_pages > 1 && (
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-500 order-2 sm:order-1">
              Showing <span className="font-semibold text-gray-700">{(pagination.page - 1) * pagination.limit + 1}</span>
              {' '}–{' '}
              <span className="font-semibold text-gray-700">{Math.min(pagination.page * pagination.limit, pagination.total)}</span>
              {' '}of{' '}
              <span className="font-semibold text-gray-700">{pagination.total}</span>
              {' '}{activeTab === 'deleted' ? 'deleted' : 'active'} purchases
            </p>
            <div className="flex items-center gap-1 order-1 sm:order-2">
              <button onClick={() => goToPage(pagination.page - 1)} disabled={!pagination.has_prev}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                <span className="hidden sm:inline">Prev</span>
              </button>
              <div className="flex items-center gap-1">
                {getPaginationRange().map((item, idx) =>
                  item === '…'
                    ? <span key={`ellipsis-${idx}`} className="px-2 py-2 text-sm text-gray-400 select-none">…</span>
                    : <button key={item} onClick={() => goToPage(item as number)}
                      className={`min-w-[36px] h-9 px-2 text-sm font-semibold rounded-lg transition-all ${item === pagination.page ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {item}
                    </button>
                )}
              </div>
              <button onClick={() => goToPage(pagination.page + 1)} disabled={!pagination.has_next}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                <span className="hidden sm:inline">Next</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}

        {!loading && purchases.length > 0 && pagination && pagination.total_pages <= 1 && (
          <div className="mt-4 sm:mt-6 text-center text-sm text-gray-500">
            Showing all {pagination.total} {activeTab === 'deleted' ? 'deleted' : 'active'} purchases
          </div>
        )}
      </div>
    </div>
  )
}

export default StockPurchases