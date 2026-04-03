import ToastContainer, { ToastMessage } from '@renderer/components/toast/toast-container'
import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Supplier = {
  id: number
  supplier_name: string
  contact_person: string | null
  phone_number: string | null
  email: string | null
  address: string | null
  is_active: boolean
  is_deleted: boolean
  created_on: number
  updated_on: number
  purchase_stats?: {
    total_purchases: number
    total_quantity: number
    total_spent: number
    avg_profit_margin: number
    last_purchase: number | null
  }
}

type Pagination = {
  page: number
  limit: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
  returned: number
}

type SortKey = 'name_asc' | 'name_desc' | 'date_asc' | 'date_desc' | 'purchases_asc' | 'purchases_desc'
type TabKey = 'active' | 'deleted'

type SupplierFormData = {
  supplier_name: string
  contact_person: string
  phone_number: string
  email: string
  address: string
  is_active: boolean
}

type SupplierModalMode = 'create' | 'edit'

const LIMIT = 20

const sortLabels: Record<SortKey, string> = {
  name_asc: 'A → Z',
  name_desc: 'Z → A',
  date_asc: 'Oldest first',
  date_desc: 'Newest first',
  purchases_asc: 'Fewest purchases',
  purchases_desc: 'Most purchases',
}

const sortToApiParams = (key: SortKey): { sort_by: string; sort_order: 'asc' | 'desc' } => {
  switch (key) {
    case 'name_asc':       return { sort_by: 'supplier_name', sort_order: 'asc' }
    case 'name_desc':      return { sort_by: 'supplier_name', sort_order: 'desc' }
    case 'date_asc':       return { sort_by: 'created_on', sort_order: 'asc' }
    case 'date_desc':      return { sort_by: 'created_on', sort_order: 'desc' }
    case 'purchases_asc':  return { sort_by: 'created_on', sort_order: 'asc' }
    case 'purchases_desc': return { sort_by: 'created_on', sort_order: 'desc' }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (ts: number | null | undefined) => {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatCurrency = (val: number | null | undefined) => {
  if (val == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(val)
}

const formatPercent = (val: number | null | undefined) => {
  if (val == null) return '—'
  return `${(val * 100).toFixed(1)}%`
}

// ─── Supplier Avatar ──────────────────────────────────────────────────────────

const orangeGradients = [
  'from-orange-400 to-orange-600',
  'from-amber-400 to-orange-500',
  'from-orange-500 to-red-500',
  'from-yellow-400 to-orange-500',
  'from-orange-300 to-amber-600',
  'from-red-400 to-orange-500',
  'from-amber-500 to-yellow-600',
  'from-orange-400 to-amber-600',
  'from-orange-500 to-orange-700',
  'from-amber-400 to-amber-600',
]

const getSupplierGradient = (name: string) => {
  const idx = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % orangeGradients.length
  return orangeGradients[idx]
}

const SupplierAvatar = ({ name, size = 'md', isDeleted }: { name: string; size?: 'sm' | 'md' | 'lg'; isDeleted?: boolean }) => {
  const sizeMap = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' }
  const gradient = isDeleted ? 'from-gray-300 to-gray-400' : getSupplierGradient(name)
  const initial = (name || '?').charAt(0).toUpperCase()
  return (
    <div className={`${sizeMap[size]} rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm border border-white/20`}>
      <span className="text-white font-bold">{initial}</span>
    </div>
  )
}

// ─── Supplier Skeleton ────────────────────────────────────────────────────────

const SupplierSkeleton = () => (
  <div className="divide-y divide-gray-100">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 px-4 lg:px-6 py-4 animate-pulse">
        <div className="lg:col-span-1 flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-xl flex-shrink-0" />
          <div className="lg:hidden flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
        <div className="hidden lg:block lg:col-span-3 space-y-1.5">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
        <div className="hidden lg:block lg:col-span-3 space-y-1.5">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
        <div className="hidden lg:block lg:col-span-2">
          <div className="h-6 bg-orange-100 rounded-full w-24" />
        </div>
        <div className="hidden lg:block lg:col-span-2">
          <div className="h-6 bg-gray-100 rounded-full w-20" />
        </div>
        <div className="lg:col-span-1 flex justify-end">
          <div className="h-8 w-8 bg-gray-200 rounded-full" />
        </div>
      </div>
    ))}
  </div>
)

// ─── Supplier Modal (Create/Edit) ─────────────────────────────────────────────

type SupplierModalProps = {
  open: boolean
  mode: SupplierModalMode
  initialData?: Partial<SupplierFormData>
  supplierId?: number
  onClose: () => void
  onSuccess: (message: string) => void
}

const defaultForm = (): SupplierFormData => ({
  supplier_name: '',
  contact_person: '',
  phone_number: '',
  email: '',
  address: '',
  is_active: true,
})

const SupplierModal = ({ open, mode, initialData, supplierId, onClose, onSuccess }: SupplierModalProps) => {
  const [form, setForm] = useState<SupplierFormData>(defaultForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initialData ? { ...defaultForm(), ...initialData } : defaultForm())
      setErrors({})
    }
  }, [open, initialData])

  if (!open) return null

  const set = (patch: Partial<SupplierFormData>) => setForm(f => ({ ...f, ...patch }))
  const clearErr = (k: string) => setErrors(e => { const n = { ...e }; delete n[k]; return n })

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.supplier_name.trim()) errs.supplier_name = 'Supplier name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      if (mode === 'create') {
        const res = await window.api.products.createSupplier({
          supplier_name: form.supplier_name.trim(),
          contact_person: form.contact_person.trim() || undefined,
          phone_number: form.phone_number.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          is_active: form.is_active,
        })
        if (!res.success) throw new Error(res.message)
        onSuccess(`"${form.supplier_name}" has been added`)
      } else {
        const res = await window.api.products.updateSupplier({
          id: supplierId!,
          supplier_name: form.supplier_name.trim(),
          contact_person: form.contact_person.trim() || null,
          phone_number: form.phone_number.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          is_active: form.is_active,
        })
        if (!res.success) throw new Error(res.message)
        onSuccess(`"${form.supplier_name}" has been updated`)
      }
      onClose()
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'An error occurred' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed top-0 left-64 right-0 bottom-0 z-50 flex items-center justify-center p-4"
      style={{ animation: 'fadeIn 0.15s ease-out' }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ animation: 'scaleIn 0.15s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-gray-900">{mode === 'create' ? 'New Supplier' : 'Edit Supplier'}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {errors.submit && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 rounded-lg border border-red-200">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-xs text-red-700 font-medium">{errors.submit}</p>
            </div>
          )}

          {/* Supplier Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.supplier_name}
              onChange={e => { set({ supplier_name: e.target.value }); clearErr('supplier_name') }}
              placeholder="e.g. Acme Supplies Ltd."
              className={`w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.supplier_name ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-orange-500 bg-white'}`}
            />
            {errors.supplier_name && <p className="text-xs text-red-600 mt-1">{errors.supplier_name}</p>}
          </div>

          {/* Contact Person */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contact Person</label>
            <input
              type="text"
              value={form.contact_person}
              onChange={e => set({ contact_person: e.target.value })}
              placeholder="e.g. Jane Smith"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white transition-all"
            />
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone</label>
              <input
                type="text"
                value={form.phone_number}
                onChange={e => set({ phone_number: e.target.value })}
                placeholder="+1 234 567 8900"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set({ email: e.target.value })}
                placeholder="supplier@co.com"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white transition-all"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Address</label>
            <textarea
              value={form.address}
              onChange={e => set({ address: e.target.value })}
              placeholder="123 Industrial Ave, City, Country"
              rows={2}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white resize-none transition-all"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <p className="text-sm font-semibold text-gray-700">Active</p>
              <p className="text-xs text-gray-500">Available for new stock purchases</p>
            </div>
            <button
              type="button"
              onClick={() => set({ is_active: !form.is_active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${form.is_active ? 'bg-orange-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Saving…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {mode === 'create' ? 'Add Supplier' : 'Save Changes'}
              </>
            )}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}

// ─── Supplier Action Modal ────────────────────────────────────────────────────

type SupplierActionModalProps = {
  mode: 'delete' | 'restore'
  supplier: { id: number; supplier_name: string; purchase_count?: number }
  onConfirm: () => void
  onCancel: () => void
}

const SupplierActionModal = ({ mode, supplier, onConfirm, onCancel }: SupplierActionModalProps) => {
  const isDelete = mode === 'delete'
  return (
    <div
      className="fixed top-0 left-64 right-0 bottom-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.15s ease-out' }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
        style={{ animation: 'scaleIn 0.15s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        <div className={`px-6 pt-6 pb-4 ${isDelete ? 'bg-gradient-to-br from-red-50 to-red-100/40' : 'bg-gradient-to-br from-orange-50 to-orange-100/40'}`}>
          <div className="flex items-start gap-4">
            <SupplierAvatar name={supplier.supplier_name} size="lg" isDeleted={!isDelete} />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 truncate">{supplier.supplier_name}</h3>
              {supplier.purchase_count !== undefined && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/80 text-gray-700 border border-gray-200">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    {supplier.purchase_count} stock purchases
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isDelete ? 'bg-red-100' : 'bg-orange-100'}`}>
              {isDelete ? (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              ) : (
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-0.5">{isDelete ? 'Delete Supplier?' : 'Restore Supplier?'}</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                {isDelete
                  ? 'The supplier will be soft-deleted. All stock purchase history linked to this supplier remains intact.'
                  : 'This supplier will be restored and available for new stock purchases again.'}
              </p>
            </div>
          </div>
          <div className={`rounded-lg p-3 mb-5 border ${isDelete ? 'bg-amber-50 border-amber-200' : 'bg-orange-50 border-orange-200'}`}>
            <div className="flex gap-2">
              <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isDelete ? 'text-amber-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className={`text-xs leading-relaxed ${isDelete ? 'text-amber-800' : 'text-orange-800'}`}>
                {isDelete ? 'Purchase history is preserved for inventory and reporting purposes. You can restore at any time.' : 'The supplier will be immediately available for linking to new stock purchases.'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold border border-gray-300 rounded-lg transition-all shadow-sm">Cancel</button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 ${isDelete ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600' : 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600'}`}
            >
              {isDelete ? (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Delete</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Restore</>
              )}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}

// ─── Supplier Card ─────────────────────────────────────────────────────────────

type SupplierCardProps = {
  supplier: Supplier
  expanded: boolean
  onToggle: () => void
  onDelete?: (id: number) => void
  onRestore?: (id: number) => void
  onEdit?: (id: number) => void
}

const SupplierCard = ({ supplier, expanded, onToggle, onDelete, onRestore, onEdit }: SupplierCardProps) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    if (showDropdown) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  const totalPurchases = supplier.purchase_stats?.total_purchases ?? 0

  return (
    <>
      <div className={`group ${supplier.is_deleted ? 'opacity-70' : ''}`}>
        {/* ── Main Row ── */}
        <div
          onClick={onToggle}
          className={`
            relative grid grid-cols-1 lg:grid-cols-12 items-center gap-3 lg:gap-4
            px-4 lg:px-6 py-4 border-b border-gray-100
            hover:bg-gray-50/80 transition-all duration-200 cursor-pointer
            ${expanded ? 'bg-orange-50/40' : ''} ${supplier.is_deleted ? 'bg-red-50/20' : ''}
          `}
        >
          {/* Col 1: Avatar */}
          <div className="lg:col-span-1 flex items-center gap-3 lg:gap-0">
            <SupplierAvatar name={supplier.supplier_name} isDeleted={supplier.is_deleted} />
            {/* Mobile: name inline */}
            <div className="lg:hidden flex-1 min-w-0">
              <div className="font-semibold text-gray-900 truncate">{supplier.supplier_name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{supplier.contact_person || supplier.phone_number || 'No contact'}</div>
            </div>
          </div>

          {/* Col 2: Supplier name + contact person (desktop) */}
          <div className="hidden lg:flex lg:col-span-3 flex-col justify-center min-w-0">
            <div className="font-semibold text-gray-900 truncate">{supplier.supplier_name}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {supplier.contact_person ? supplier.contact_person : `ID: #${String(supplier.id).padStart(4, '0')}`}
            </div>
          </div>

          {/* Col 3: Contact info */}
          <div className="hidden lg:flex lg:col-span-3 flex-col justify-center min-w-0">
            {supplier.phone_number && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                <span className="truncate">{supplier.phone_number}</span>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <span className="truncate">{supplier.email}</span>
              </div>
            )}
            {!supplier.phone_number && !supplier.email && <span className="text-xs text-gray-400 italic">No contact info</span>}
          </div>

          {/* Col 4: Supply stats badge */}
          <div className="hidden lg:flex lg:col-span-2 items-center">
            <div className="px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-100">
              <div className="text-xs font-semibold text-orange-700">{formatCurrency(supplier.purchase_stats?.total_spent)}</div>
              <div className="text-xs text-orange-500">{totalPurchases} purchase{totalPurchases !== 1 ? 's' : ''}</div>
            </div>
          </div>

          {/* Col 5: Status */}
          <div className="hidden lg:flex lg:col-span-2 items-center">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              supplier.is_deleted ? 'bg-red-50 text-red-700 border-red-200'
              : supplier.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${supplier.is_deleted ? 'bg-red-400' : supplier.is_active ? 'bg-emerald-400' : 'bg-gray-400'}`} />
              {supplier.is_deleted ? 'Deleted' : supplier.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Col 6: Toggle */}
          <div className="hidden lg:flex lg:col-span-1 justify-end">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${expanded ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'}`}>
              <svg className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        {/* ── Expanded Panel ── */}
        {expanded && (
          <div className="bg-gradient-to-br from-orange-50/30 to-gray-50/60 border-b border-gray-200">
            <div className="px-4 lg:px-8 py-5 grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Supplier Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  Supplier Info
                </h3>
                <div className="space-y-1.5">
                  {[
                    { label: 'Contact Person', value: supplier.contact_person, icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
                    { label: 'Phone', value: supplier.phone_number, icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
                    { label: 'Email', value: supplier.email, icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
                    { label: 'Address', value: supplier.address, icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
                  ].map(row => (
                    <div key={row.label} className="p-2.5 rounded-lg bg-white/70 hover:bg-white transition-colors">
                      <div className="text-xs text-gray-400 mb-0.5">{row.label}</div>
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={row.icon} /></svg>
                        {row.value || <span className="text-gray-400 italic text-xs">Not provided</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Supply Stats */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Supply Stats
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Total Purchases', value: `${supplier.purchase_stats?.total_purchases ?? 0}`, sub: 'orders', color: 'bg-orange-50 text-orange-700 border-orange-100' },
                    { label: 'Qty Supplied', value: `${supplier.purchase_stats?.total_quantity ?? 0}`, sub: 'units', color: 'bg-amber-50 text-amber-700 border-amber-100' },
                    { label: 'Value Supplied', value: formatCurrency(supplier.purchase_stats?.total_spent), sub: 'total', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                    { label: 'Avg Margin', value: formatPercent(supplier.purchase_stats?.avg_profit_margin), sub: 'profit', color: 'bg-blue-50 text-blue-700 border-blue-100' },
                  ].map(stat => (
                    <div key={stat.label} className={`p-2.5 rounded-lg border ${stat.color}`}>
                      <div className="text-xs opacity-70 mb-0.5">{stat.label}</div>
                      <div className="text-sm font-bold">{stat.value}</div>
                      <div className="text-xs opacity-60">{stat.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="p-2.5 rounded-lg bg-white/70 hover:bg-white transition-colors">
                  <div className="text-xs text-gray-400 mb-0.5">Last Purchase</div>
                  <div className="text-sm font-medium text-gray-900">{formatDate(supplier.purchase_stats?.last_purchase)}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-white/70 hover:bg-white transition-colors">
                  <div className="text-xs text-gray-400 mb-0.5">Supplier Since</div>
                  <div className="text-sm font-medium text-gray-900">{formatDate(supplier.created_on)}</div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={e => { e.stopPropagation(); onEdit?.(supplier.id) }}
                    className="w-full px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Edit Supplier
                  </button>

                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={e => { e.stopPropagation(); setShowDropdown(!showDropdown) }}
                      className="w-full px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium border border-gray-300 rounded-lg transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                      More Options
                    </button>
                    {showDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                        {supplier.is_deleted ? (
                          <button onClick={e => { e.stopPropagation(); setShowDropdown(false); setShowRestoreModal(true) }} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-orange-50 text-orange-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            <span className="font-medium">Restore Supplier</span>
                          </button>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setShowDropdown(false); setShowDeleteModal(true) }} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-red-50 text-red-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            <span className="font-medium">Delete Supplier</span>
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

      {showDeleteModal && (
        <SupplierActionModal
          mode="delete"
          supplier={{ id: supplier.id, supplier_name: supplier.supplier_name, purchase_count: supplier.purchase_stats?.total_purchases }}
          onConfirm={() => { onDelete?.(supplier.id); setShowDeleteModal(false) }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
      {showRestoreModal && (
        <SupplierActionModal
          mode="restore"
          supplier={{ id: supplier.id, supplier_name: supplier.supplier_name, purchase_count: supplier.purchase_stats?.total_purchases }}
          onConfirm={() => { onRestore?.(supplier.id); setShowRestoreModal(false) }}
          onCancel={() => setShowRestoreModal(false)}
        />
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Suppliers = () => {
  const [suppliers, setSuppliers]     = useState<Supplier[]>([])
  const [pagination, setPagination]   = useState<Pagination | null>(null)
  const [expandedId, setExpandedId]   = useState<number | null>(null)
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortKey, setSortKey]         = useState<SortKey>('name_asc')
  const [activeTab, setActiveTab]     = useState<TabKey>('active')
  const [currentPage, setCurrentPage] = useState(1)
  const [showSortMenu, setShowSortMenu]     = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editSupplier, setEditSupplier]     = useState<Supplier | null>(null)
  const [toasts, setToasts]           = useState<ToastMessage[]>([])
  const [activeCount, setActiveCount]   = useState(0)
  const [deletedCount, setDeletedCount] = useState(0)

  const sortMenuRef = useRef<HTMLDivElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
  }
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 350)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [search])

  const loadSuppliers = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const { sort_by, sort_order } = sortToApiParams(sortKey)
      const res = await window.api.products.getAllSuppliers({
        page,
        limit: LIMIT,
        is_deleted: activeTab === 'deleted' ? 'yes' : 'no',
        search: debouncedSearch || undefined,
        sort_by: sort_by as any,
        sort_order,
        with_purchase_stats: true,
        should_paginate: true,
      })
      if (res.success && res.data) {
        const items = (res.data.items as Supplier[])
        setSuppliers(items)
        const pag = res.data.pagination as any
        if (pag) {
          setPagination({
            page:        pag.page        ?? page,
            limit:       pag.limit       ?? LIMIT,
            total:       pag.total       ?? 0,
            total_pages: pag.pages ?? pag.total_pages ?? Math.ceil((pag.total ?? 0) / LIMIT),
            has_next:    pag.has_next    ?? false,
            has_prev:    pag.has_prev    ?? false,
            returned:    pag.returned    ?? items.length,
          })
        }
      } else {
        addToast(res.message || 'Failed to load suppliers', 'error')
      }
    } catch {
      addToast('An error occurred while loading suppliers', 'error')
    } finally {
      setLoading(false)
    }
  }, [activeTab, debouncedSearch, sortKey])

  useEffect(() => { loadSuppliers(currentPage) }, [loadSuppliers, currentPage])

  useEffect(() => {
    if (!pagination) return
    if (activeTab === 'active')  setActiveCount(pagination.total)
    if (activeTab === 'deleted') setDeletedCount(pagination.total)
  }, [pagination, activeTab])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setShowSortMenu(false)
    }
    if (showSortMenu) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showSortMenu])

  const handleTabChange = (tab: TabKey) => {
    if (tab === activeTab) return
    setActiveTab(tab); setCurrentPage(1); setExpandedId(null); setSearch(''); setDebouncedSearch('')
  }

  const handleDelete = async (supplierId: number) => {
    const name = suppliers.find(s => s.id === supplierId)?.supplier_name ?? 'Supplier'
    try {
      const res = await window.api.products.softDeleteSupplier({ id: supplierId })
      if (!res.success) throw new Error(res.message)
      addToast(`"${name}" has been deleted`, 'success')
      const newPage = suppliers.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
      setCurrentPage(newPage)
      await loadSuppliers(newPage)
      setDeletedCount(c => c + 1); setActiveCount(c => Math.max(0, c - 1))
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed to delete supplier', 'error') }
  }

  const handleRestore = async (supplierId: number) => {
    const name = suppliers.find(s => s.id === supplierId)?.supplier_name ?? 'Supplier'
    try {
      const res = await window.api.products.softDeleteSupplier({ id: supplierId, restore: true })
      if (!res.success) throw new Error(res.message)
      addToast(`"${name}" has been restored`, 'success')
      const newPage = suppliers.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
      setCurrentPage(newPage)
      await loadSuppliers(newPage)
      setDeletedCount(c => Math.max(0, c - 1)); setActiveCount(c => c + 1)
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed to restore supplier', 'error') }
  }

  const handleSupplierSuccess = async (message: string) => {
    addToast(message, 'success')
    await loadSuppliers(currentPage)
    setActiveCount(c => c + 1)
  }

  const totalPurchasesOnPage = suppliers.reduce((s, sup) => s + (sup.purchase_stats?.total_purchases ?? 0), 0)

  const goToPage = (page: number) => {
    setCurrentPage(page); setExpandedId(null); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50">
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      <SupplierModal
        open={showCreateModal}
        mode="create"
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleSupplierSuccess}
      />

      <SupplierModal
        open={!!editSupplier}
        mode="edit"
        supplierId={editSupplier?.id}
        initialData={editSupplier ? {
          supplier_name: editSupplier.supplier_name,
          contact_person: editSupplier.contact_person ?? '',
          phone_number: editSupplier.phone_number ?? '',
          email: editSupplier.email ?? '',
          address: editSupplier.address ?? '',
          is_active: editSupplier.is_active,
        } : undefined}
        onClose={() => setEditSupplier(null)}
        onSuccess={async (msg) => { addToast(msg, 'success'); await loadSuppliers(currentPage) }}
      />

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-md flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Suppliers</h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    {activeCount} active
                  </span>
                  {activeTab === 'active' && suppliers.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                      {totalPurchasesOnPage} purchases on page
                    </span>
                  )}
                  {deletedCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      {deletedCount} deleted
                    </span>
                  )}
                  {debouncedSearch && (
                    <span className="text-gray-500 text-xs hidden sm:inline">· Filtered by "{debouncedSearch}"</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search suppliers…"
                  className="w-full sm:w-64 lg:w-72 pl-10 pr-10 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all bg-white"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              {/* Sort */}
              <div className="relative" ref={sortMenuRef}>
                <button
                  onClick={() => setShowSortMenu(s => !s)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-all shadow-sm whitespace-nowrap"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg>
                  <span className="hidden sm:inline">{sortLabels[sortKey]}</span>
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-30">
                    {[
                      { group: 'Alphabetical', keys: ['name_asc', 'name_desc'] as SortKey[] },
                      { group: 'Date Added', keys: ['date_desc', 'date_asc'] as SortKey[] },
                      { group: 'By Purchases', keys: ['purchases_desc', 'purchases_asc'] as SortKey[] },
                    ].map(({ group, keys }, gi) => (
                      <div key={group}>
                        {gi > 0 && <div className="border-t border-gray-100 my-1" />}
                        <div className="px-3 py-1.5"><p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{group}</p></div>
                        {keys.map(k => (
                          <button key={k} onClick={() => { setSortKey(k); setCurrentPage(1); setShowSortMenu(false) }}
                            className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors ${sortKey === k ? 'bg-orange-50 text-orange-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                            {sortLabels[k]}
                            {sortKey === k && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {activeTab === 'active' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-3 sm:px-5 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  <span className="hidden sm:inline">Add Supplier</span>
                  <span className="sm:hidden">Add</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-4 sm:px-6 pt-3">
            {([
              { key: 'active' as TabKey, label: 'Active Suppliers', count: activeCount, color: 'orange' },
              { key: 'deleted' as TabKey, label: 'Deleted', count: deletedCount, color: 'red' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`
                  relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all border-b-2 mr-1
                  ${activeTab === tab.key
                    ? tab.color === 'orange' ? 'text-orange-600 border-orange-600' : 'text-red-600 border-red-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.label}
                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold ${activeTab === tab.key ? tab.color === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
            {[
              { label: 'Avatar', span: 1 },
              { label: 'Supplier Name', span: 3 },
              { label: 'Contact', span: 3 },
              { label: 'Purchases', span: 2 },
              { label: 'Status', span: 2 },
              { label: '', span: 1 },
            ].map(({ label, span }) => (
              <div key={label} className={`col-span-${span}`}>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <SupplierSkeleton />
          ) : suppliers.length === 0 ? (
            <div className="py-16 sm:py-24 px-4 text-center">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${activeTab === 'deleted' ? 'bg-red-50' : 'bg-orange-50'}`}>
                {activeTab === 'deleted' ? (
                  <svg className="w-8 h-8 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                ) : (
                  <svg className="w-8 h-8 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                {debouncedSearch ? 'No suppliers found' : activeTab === 'deleted' ? 'No deleted suppliers' : 'No suppliers yet'}
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                {debouncedSearch ? `No results for "${debouncedSearch}".` : activeTab === 'deleted' ? 'Deleted suppliers will appear here.' : 'Add your first supplier to start tracking stock purchases.'}
              </p>
              {debouncedSearch
                ? <button onClick={() => setSearch('')} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">Clear search</button>
                : activeTab === 'active' && (
                  <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add your first supplier
                  </button>
                )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {suppliers.map(supplier => (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  expanded={expandedId === supplier.id}
                  onToggle={() => setExpandedId(expandedId === supplier.id ? null : supplier.id)}
                  onDelete={handleDelete}
                  onRestore={handleRestore}
                  onEdit={id => setEditSupplier(suppliers.find(s => s.id === id) ?? null)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && pagination && pagination.total_pages > 1 && (
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-500 order-2 sm:order-1">
              Showing{' '}
              <span className="font-semibold text-gray-700">{(pagination.page - 1) * pagination.limit + 1}</span>
              {' '}–{' '}
              <span className="font-semibold text-gray-700">{Math.min(pagination.page * pagination.limit, pagination.total)}</span>
              {' '}of{' '}
              <span className="font-semibold text-gray-700">{pagination.total}</span>
              {' '}{activeTab === 'deleted' ? 'deleted' : 'active'} suppliers
            </p>
            <div className="flex items-center gap-1 order-1 sm:order-2">
              <button onClick={() => goToPage(pagination.page - 1)} disabled={!pagination.has_prev}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                <span className="hidden sm:inline">Prev</span>
              </button>
              <div className="flex items-center gap-1">
                {getPaginationRange().map((item, idx) =>
                  item === '…' ? (
                    <span key={`e-${idx}`} className="px-2 py-2 text-sm text-gray-400">…</span>
                  ) : (
                    <button key={item} onClick={() => goToPage(item as number)}
                      className={`min-w-[36px] h-9 px-2 text-sm font-semibold rounded-lg transition-all ${item === pagination.page ? 'bg-orange-600 text-white shadow-md shadow-orange-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {item}
                    </button>
                  )
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

        {!loading && suppliers.length > 0 && pagination && pagination.total_pages <= 1 && (
          <div className="mt-4 sm:mt-6 text-center text-sm text-gray-500">
            Showing all {pagination.total} {activeTab === 'deleted' ? 'deleted' : 'active'} suppliers
          </div>
        )}
      </div>
    </div>
  )
}

export default Suppliers