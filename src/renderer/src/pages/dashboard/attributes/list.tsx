// pages/dashboard/attributes/list.tsx

import ToastContainer, { ToastMessage } from '@renderer/components/toast/toast-container'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

// ─── Types ────────────────────────────────────────────────────────────────────

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

type Pagination = {
  page: number
  limit: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
  returned: number
}

type SortKey = 'name_asc' | 'name_desc' | 'date_asc' | 'date_desc' | 'skus_asc' | 'skus_desc'
type TabKey = 'active' | 'deleted'

const LIMIT = 20

const sortLabels: Record<SortKey, string> = {
  name_asc: 'A → Z',
  name_desc: 'Z → A',
  date_asc: 'Oldest first',
  date_desc: 'Newest first',
  skus_asc: 'Fewest SKUs',
  skus_desc: 'Most SKUs',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const AttributeSkeleton = () => (
  <div className="divide-y divide-gray-100">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4 animate-pulse">
        <div className="col-span-1 flex items-center">
          <div className="w-9 h-9 bg-gray-200 rounded-xl" />
        </div>
        <div className="col-span-3 space-y-1.5 flex flex-col justify-center">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
        <div className="col-span-2 flex items-center">
          <div className="h-6 bg-violet-100 rounded-full w-20" />
        </div>
        <div className="col-span-2 flex items-center">
          <div className="h-6 bg-gray-100 rounded-full w-16" />
        </div>
        <div className="col-span-2 flex items-center">
          <div className="h-6 bg-emerald-100 rounded-full w-14" />
        </div>
        <div className="col-span-2 flex items-center justify-end gap-2">
          <div className="h-8 w-16 bg-gray-200 rounded-lg" />
          <div className="h-8 w-8 bg-gray-200 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
)

// ─── Attribute Icon ───────────────────────────────────────────────────────────

const AttributeIcon = ({ name, isDeleted }: { name: string; isDeleted?: boolean }) => {
  const colors = [
    'from-blue-400 to-blue-600',
    'from-violet-400 to-violet-600',
    'from-pink-400 to-pink-600',
    'from-orange-400 to-orange-600',
    'from-teal-400 to-teal-600',
    'from-rose-400 to-rose-600',
    'from-cyan-400 to-cyan-600',
    'from-indigo-400 to-indigo-600',
    'from-emerald-400 to-emerald-600',
    'from-orange-400 to-orange-600',
  ]
  const gradient = isDeleted ? 'from-gray-300 to-gray-400' : colors[name.charCodeAt(0) % colors.length]
  const initial = (name || '?').charAt(0).toUpperCase()

  return (
    <div
      className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm flex-shrink-0`}
    >
      <span className="text-white text-sm font-bold">{initial}</span>
    </div>
  )
}

// ─── Delete / Restore Confirmation Modal ──────────────────────────────────────

const ConfirmModal = ({
  mode,
  attribute,
  onConfirm,
  onCancel,
}: {
  mode: 'delete' | 'restore'
  attribute: Attribute
  onConfirm: () => void
  onCancel: () => void
}) => {
  const isDelete = mode === 'delete'

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onCancel}
      style={{ animation: 'fadeIn 0.15s ease-out' }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden z-10"
        style={{ animation: 'scaleIn 0.15s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-6 pt-6 pb-4 ${isDelete
              ? 'bg-gradient-to-br from-red-50 to-red-100/40'
              : 'bg-gradient-to-br from-green-50 to-green-100/40'
            }`}
        >
          <div className="flex items-start gap-4">
            <AttributeIcon name={attribute.attribute_name} isDeleted={!isDelete} />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 truncate">{attribute.attribute_name}</h3>
              <div className="flex items-center gap-2 mt-1.5">
                {attribute.unit && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/80 text-gray-700 border border-gray-200">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Unit: {attribute.unit}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/80 text-gray-700 border border-gray-200">
                  {attribute.sku_count ?? 0} SKUs
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-4">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isDelete ? 'bg-red-100' : 'bg-green-100'
                }`}
            >
              {isDelete ? (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-0.5">
                {isDelete ? 'Delete Attribute?' : 'Restore Attribute?'}
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                {isDelete
                  ? 'This attribute will be soft-deleted. All associated SKU attribute values will also be removed.'
                  : 'This will restore the attribute and make it available for use in SKUs again.'}
              </p>
            </div>
          </div>

          <div
            className={`rounded-lg p-3 mb-5 border ${isDelete ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
              }`}
          >
            <div className="flex gap-2">
              <svg
                className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isDelete ? 'text-blue-600' : 'text-green-600'}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={
                    isDelete
                      ? 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                      : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                  }
                />
              </svg>
              <p className={`text-xs leading-relaxed ${isDelete ? 'text-amber-800' : 'text-green-800'}`}>
                {isDelete
                  ? 'Data is preserved for record-keeping. You can restore this attribute at any time.'
                  : 'The attribute will be immediately available for new SKU assignments after restoration.'}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold border border-gray-300 rounded-lg transition-all shadow-sm hover:shadow"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 ${isDelete
                  ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600'
                  : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600'
                }`}
            >
              {isDelete ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Restore
                </>
              )}
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
}

// ─── Create / Edit Offcanvas ──────────────────────────────────────────────────

type OffcanvasProps = {
  open: boolean
  attributeId: number | null
  onClose: () => void
  onSaved: () => void
  addToast: (msg: string, type: 'success' | 'error') => void
}

const AttributeOffcanvas = ({ open, attributeId, onClose, onSaved, addToast }: OffcanvasProps) => {
  const isCreate = attributeId === null

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attribute, setAttribute] = useState<Attribute | null>(null)

  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)

  // Reset / load on open
  useEffect(() => {
    if (!open) return
    setErrors({})
    setDirty(false)

    if (isCreate) {
      setAttribute(null)
      setName('')
      setUnit('')
      setIsActive(true)
      return
    }

    const load = async () => {
      setLoading(true)
      try {
        const res = await window.api.products.getAttributeById({ id: attributeId! })
        if (res.success && res.data) {
          const a = res.data as unknown as Attribute
          setAttribute(a)
          setName(a.attribute_name)
          setUnit(a.unit ?? '')
          setIsActive(a.is_active)
        }
      } catch {
        addToast('Failed to load attribute', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, attributeId])

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Attribute name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      if (isCreate) {
        const res = await window.api.products.createAttribute({
          attribute_name: name.trim(),
          unit: unit.trim() || undefined,
          is_active: isActive,
        } as any)
        if (!res.success) throw new Error(res.message)
        addToast(`Attribute "${name.trim()}" created!`, 'success')
      } else {
        const res = await window.api.products.updateAttribute({
          id: attributeId!,
          attribute_name: name.trim(),
          unit: unit.trim() || undefined,
          is_active: isActive,
        } as any)
        if (!res.success) throw new Error(res.message)
        addToast(`Attribute "${name.trim()}" updated!`, 'success')
      }
      setDirty(false)
      onSaved()
      if (isCreate) onClose()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save attribute', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (attribute) {
      setName(attribute.attribute_name)
      setUnit(attribute.unit ?? '')
      setIsActive(attribute.is_active)
    } else {
      setName('')
      setUnit('')
      setIsActive(true)
    }
    setDirty(false)
    setErrors({})
  }

  const set = (patch: { name?: string; unit?: string; isActive?: boolean }) => {
    if (patch.name !== undefined) setName(patch.name)
    if (patch.unit !== undefined) setUnit(patch.unit)
    if (patch.isActive !== undefined) setIsActive(patch.isActive)
    setDirty(true)
  }

  const formatDate = (ts: number) =>
    new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  return ReactDOM.createPortal(
    <>
      {/* Backdrop — full viewport */}
      <div
        className={`fixed inset-0 z-[9998] bg-black/25 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
      />

      {/* Panel — fully off-screen when closed */}
      <div
        className={`fixed top-0 right-0 z-[9999] h-full bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'
          }`}
        style={{ width: 'min(440px, 100vw)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                {isCreate ? 'New Attribute' : 'Edit Attribute'}
              </h2>
              {!isCreate && attribute && (
                <p className="text-xs text-gray-500">ID #{String(attributeId).padStart(4, '0')}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Editing
              </span>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Loading attribute…</span>
              </div>
            </div>
          ) : (
            <>
              {/* Hero / stats (edit mode only) */}
              {!isCreate && attribute && (
                <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-gray-50/80 to-white border-b border-gray-100">
                  <div className="flex items-center gap-4">
                    <AttributeIcon name={attribute.attribute_name} isDeleted={attribute.is_deleted} />
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{attribute.attribute_name}</h3>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${attribute.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${attribute.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          {attribute.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {attribute.is_deleted && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                            Deleted
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="bg-violet-50 rounded-xl p-3 text-center">
                      <div className="text-xl font-bold text-violet-700">{attribute.sku_count ?? 0}</div>
                      <div className="text-xs text-violet-600 mt-0.5">SKUs</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-sm font-bold text-gray-700">{formatDate(attribute.created_on)}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Created</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-sm font-bold text-gray-700">{formatDate(attribute.updated_on)}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Updated</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Form */}
              <div className="px-5 py-5 space-y-5">
                {/* Attribute Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Attribute Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      set({ name: e.target.value })
                      setErrors((er) => { const n = { ...er }; delete n.name; return n })
                    }}
                    placeholder="e.g. Color, Size, Material"
                    className={`w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.name
                        ? 'border-red-300 focus:ring-red-400 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500 bg-white'
                      }`}
                  />
                  {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
                </div>

                {/* Unit */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Unit <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
                  </label>
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                    </svg>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => set({ unit: e.target.value })}
                      placeholder="e.g. kg, cm, oz, L"
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Units appear alongside attribute values (e.g. Weight: 2 <em>kg</em>)
                  </p>
                </div>

                {/* Suggestions */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Common attributes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: 'Color', unit: '' },
                      { name: 'Size', unit: '' },
                      { name: 'Weight', unit: 'kg' },
                      { name: 'Material', unit: '' },
                      { name: 'Length', unit: 'cm' },
                      { name: 'Volume', unit: 'L' },
                      { name: 'Width', unit: 'cm' },
                      { name: 'Voltage', unit: 'V' },
                    ].map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => { set({ name: s.name, unit: s.unit }); setErrors({}) }}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 text-xs font-medium rounded-lg border border-gray-200 hover:border-blue-200 transition-all"
                      >
                        {s.name}
                        {s.unit && <span className="text-gray-400 ml-1">({s.unit})</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Active</p>
                    <p className="text-xs text-gray-500">Available for assignment to SKUs</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => set({ isActive: !isActive })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isActive ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>

                {/* Deleted warning */}
                {!isCreate && attribute?.is_deleted && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-red-700 font-medium">
                      This attribute has been deleted. Restore it to make edits.
                    </p>
                  </div>
                )}
              </div>

              {/* Save/Discard bar */}
              {dirty && (
                <div className="px-5 py-3 bg-blue-50 border-y border-blue-100 flex items-center gap-3">
                  <p className="text-xs text-blue-700 font-medium flex-1">You have unsaved changes</p>
                  <button
                    onClick={handleDiscard}
                    className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold border border-gray-300 rounded-lg transition-all shadow-sm"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all shadow flex items-center gap-1.5"
                  >
                    {saving ? (
                      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    Save Changes
                  </button>
                </div>
              )}

              <div className="h-6" />
            </>
          )}
        </div>

        {/* Footer (create mode) */}
        {isCreate && !loading && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50/50 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow flex items-center gap-2"
            >
              {saving ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              {saving ? 'Creating…' : 'Create Attribute'}
            </button>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}

// ─── Attribute Row ────────────────────────────────────────────────────────────

const AttributeRow = ({
  attribute,
  onEdit,
  onDelete,
  onRestore,
}: {
  attribute: Attribute
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  onRestore: (id: number) => void
}) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false)
    }
    if (showDropdown) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showDropdown])

  const formatDate = (ts: number) =>
    new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <>
      <div
        className={`group grid grid-cols-12 items-center gap-4 px-6 py-4 hover:bg-gray-50/80 transition-all duration-150 ${attribute.is_deleted ? 'opacity-70 bg-red-50/20' : ''
          }`}
      >
        {/* Icon */}
        <div className="col-span-1">
          <AttributeIcon name={attribute.attribute_name} isDeleted={attribute.is_deleted} />
        </div>

        {/* Name + ID */}
        <div className="col-span-3 min-w-0">
          <div className="font-semibold text-gray-900 truncate">{attribute.attribute_name}</div>
          <div className="text-xs text-gray-500 mt-0.5">ID #{String(attribute.id).padStart(4, '0')}</div>
        </div>

        {/* Unit */}
        <div className="col-span-2">
          {attribute.unit ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-100 text-xs font-semibold text-violet-700">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
              {attribute.unit}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">No unit</span>
          )}
        </div>

        {/* SKU Count */}
        <div className="col-span-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 rounded-lg border border-violet-100">
            <svg className="w-3.5 h-3.5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span className="text-xs font-semibold text-violet-700">
              {attribute.sku_count ?? 0} {(attribute.sku_count ?? 0) === 1 ? 'SKU' : 'SKUs'}
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="col-span-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${attribute.is_deleted
                ? 'bg-red-50 text-red-700 border-red-200'
                : attribute.is_active
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${attribute.is_deleted ? 'bg-red-400' : attribute.is_active ? 'bg-emerald-400' : 'bg-gray-400'
                }`}
            />
            {attribute.is_deleted ? 'Deleted' : attribute.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Actions */}
        <div className="col-span-2 flex items-center justify-end gap-2">
          <span className="text-xs text-gray-400 hidden xl:inline">{formatDate(attribute.created_on)}</span>

          {!attribute.is_deleted && (
            <button
              onClick={() => onEdit(attribute.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-all shadow-sm hover:shadow"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown((s) => !s)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-all shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20">
                {attribute.is_deleted ? (
                  <button
                    onClick={() => { setShowDropdown(false); setShowRestoreModal(true) }}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-green-50 text-green-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="font-medium">Restore</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => { setShowDropdown(false); onEdit(attribute.id) }}
                      className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-50 text-gray-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span className="font-medium">Edit</span>
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={() => { setShowDropdown(false); setShowDeleteModal(true) }}
                      className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-red-50 text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="font-medium">Delete</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <ConfirmModal
          mode="delete"
          attribute={attribute}
          onConfirm={() => { onDelete(attribute.id); setShowDeleteModal(false) }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
      {showRestoreModal && (
        <ConfirmModal
          mode="restore"
          attribute={attribute}
          onConfirm={() => { onRestore(attribute.id); setShowRestoreModal(false) }}
          onCancel={() => setShowRestoreModal(false)}
        />
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Attributes = () => {
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name_asc')
  const [activeTab, setActiveTab] = useState<TabKey>('active')
  const [currentPage, setCurrentPage] = useState(1)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const [activeCount, setActiveCount] = useState(0)
  const [deletedCount, setDeletedCount] = useState(0)

  const [offcanvasOpen, setOffcanvasOpen] = useState(false)
  const [offcanvasId, setOffcanvasId] = useState<number | null>(null)

  const sortMenuRef = useRef<HTMLDivElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addToast = useCallback((message: string, type: ToastMessage['type']) => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 350)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [search])

  const loadAttributes = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const sortMap: Record<SortKey, { sort_by: string; sort_order: 'asc' | 'desc' }> = {
          name_asc: { sort_by: 'attribute_name', sort_order: 'asc' },
          name_desc: { sort_by: 'attribute_name', sort_order: 'desc' },
          date_asc: { sort_by: 'created_on', sort_order: 'asc' },
          date_desc: { sort_by: 'created_on', sort_order: 'desc' },
          skus_asc: { sort_by: 'sku_count', sort_order: 'asc' },
          skus_desc: { sort_by: 'sku_count', sort_order: 'desc' },
        }
        const { sort_by, sort_order } = sortMap[sortKey]

        const res = await window.api.products.getAllAttributes({
          page,
          limit: LIMIT,
          include_deleted: activeTab === 'deleted',
          search: debouncedSearch || undefined,
          sort_by: sort_by as any,
          sort_order,
          should_paginate: true,
          with_sku_count: true,
        } as any)

        if (res.success && res.data) {
          const all = res.data.items as Attribute[]
          const items = all.filter((a) => (activeTab === 'deleted' ? a.is_deleted : !a.is_deleted))
          setAttributes(items)

          const pag = res.data.pagination as any
          if (pag) {
            setPagination({
              page: pag.page ?? page,
              limit: pag.limit ?? LIMIT,
              total: pag.total ?? 0,
              total_pages: pag.total_pages ?? pag.pages ?? Math.ceil((pag.total ?? 0) / LIMIT),
              has_next: pag.has_next ?? false,
              has_prev: pag.has_prev ?? false,
              returned: pag.returned ?? items.length,
            })
          }
        } else {
          addToast(res.message || 'Failed to load attributes', 'error')
        }
      } catch {
        addToast('An error occurred while loading attributes', 'error')
      } finally {
        setLoading(false)
      }
    },
    [activeTab, debouncedSearch, sortKey, addToast]
  )

  useEffect(() => {
    loadAttributes(currentPage)
  }, [loadAttributes, currentPage])

  useEffect(() => {
    if (!pagination) return
    if (activeTab === 'active') setActiveCount(pagination.total)
    if (activeTab === 'deleted') setDeletedCount(pagination.total)
  }, [pagination, activeTab])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node))
        setShowSortMenu(false)
    }
    if (showSortMenu) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showSortMenu])

  const handleTabChange = (tab: TabKey) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    setCurrentPage(1)
    setSearch('')
    setDebouncedSearch('')
  }

  const handleSortChange = (key: SortKey) => {
    setSortKey(key)
    setCurrentPage(1)
    setShowSortMenu(false)
  }

  const handleDelete = async (id: number) => {
    const name = attributes.find((a) => a.id === id)?.attribute_name ?? 'Attribute'
    try {
      const res = await window.api.products.softDeleteAttribute({ id })
      if (!res.success) throw new Error(res.message)
      addToast(`"${name}" has been deleted`, 'success')
      const newPage = attributes.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
      setCurrentPage(newPage)
      await loadAttributes(newPage)
      setDeletedCount((c) => c + 1)
      setActiveCount((c) => Math.max(0, c - 1))
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete attribute', 'error')
    }
  }

  const handleRestore = async (id: number) => {
    const name = attributes.find((a) => a.id === id)?.attribute_name ?? 'Attribute'
    try {
      const res = await window.api.products.softDeleteAttribute({ id, restore: true } as any)
      if (!res.success) throw new Error(res.message)
      addToast(`"${name}" has been restored`, 'success')
      const newPage = attributes.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
      setCurrentPage(newPage)
      await loadAttributes(newPage)
      setDeletedCount((c) => Math.max(0, c - 1))
      setActiveCount((c) => c + 1)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to restore attribute', 'error')
    }
  }

  const handleEdit = (id: number) => {
    setOffcanvasId(id)
    setOffcanvasOpen(true)
  }

  const handleCreate = () => {
    setOffcanvasId(null)
    setOffcanvasOpen(true)
  }

  const handleSaved = async () => {
    await loadAttributes(currentPage)
    if (offcanvasId === null) setActiveCount((c) => c + 1)
  }

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

      <AttributeOffcanvas
        open={offcanvasOpen}
        attributeId={offcanvasId}
        onClose={() => setOffcanvasOpen(false)}
        onSaved={handleSaved}
        addToast={addToast}
      />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Attributes</h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    {activeCount} active
                  </span>
                  {deletedCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      {deletedCount} deleted
                    </span>
                  )}
                  {debouncedSearch && (
                    <span className="text-gray-500 text-xs hidden sm:inline">
                      · Filtered by "{debouncedSearch}"
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search attributes…"
                  className="w-full sm:w-56 lg:w-64 pl-10 pr-10 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Sort */}
              <div className="relative" ref={sortMenuRef}>
                <button
                  onClick={() => setShowSortMenu((s) => !s)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-all shadow-sm whitespace-nowrap"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                  <span className="hidden sm:inline">{sortLabels[sortKey]}</span>
                  <svg
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showSortMenu ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-30">
                    {[
                      { group: 'Alphabetical', keys: ['name_asc', 'name_desc'] as SortKey[] },
                      { group: 'Date Created', keys: ['date_desc', 'date_asc'] as SortKey[] },
                      { group: 'By SKUs', keys: ['skus_desc', 'skus_asc'] as SortKey[] },
                    ].map(({ group, keys }, gi) => (
                      <div key={group}>
                        {gi > 0 && <div className="border-t border-gray-100 my-1" />}
                        <div className="px-3 py-1.5">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{group}</p>
                        </div>
                        {keys.map((k) => (
                          <button
                            key={k}
                            onClick={() => handleSortChange(k)}
                            className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors ${sortKey === k
                                ? 'bg-blue-50 text-blue-700 font-semibold'
                                : 'hover:bg-gray-50 text-gray-700'
                              }`}
                          >
                            {sortLabels[k]}
                            {sortKey === k && (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add button */}
              {activeTab === 'active' && (
                <button
                  onClick={handleCreate}
                  className="px-3 sm:px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Add Attribute</span>
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
            {([
              { key: 'active' as TabKey, label: 'Active Attributes', count: activeCount, color: 'blue' },
              { key: 'deleted' as TabKey, label: 'Deleted', count: deletedCount, color: 'red' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all border-b-2 mr-1 ${activeTab === tab.key
                    ? tab.color === 'blue'
                      ? 'text-blue-600 border-blue-500'
                      : 'text-red-600 border-red-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {tab.label}
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold ${activeTab === tab.key
                      ? tab.color === 'blue'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-500'
                    }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
            {[
              { label: '', span: 1 },
              { label: 'Attribute Name', span: 3 },
              { label: 'Unit', span: 2 },
              { label: 'SKUs', span: 2 },
              { label: 'Status', span: 2 },
              { label: '', span: 2 },
            ].map(({ label, span }, idx) => (
              <div key={idx} className={`col-span-${span}`}>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>

          {/* Body */}
          {loading ? (
            <AttributeSkeleton />
          ) : attributes.length === 0 ? (
            <div className="py-16 sm:py-24 px-4 text-center">
              <div
                className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${activeTab === 'deleted' ? 'bg-red-50' : 'bg-blue-50'
                  }`}
              >
                {activeTab === 'deleted' ? (
                  <svg className="w-8 h-8 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                {debouncedSearch
                  ? 'No attributes found'
                  : activeTab === 'deleted'
                    ? 'No deleted attributes'
                    : 'No attributes yet'}
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                {debouncedSearch
                  ? `No results for "${debouncedSearch}".`
                  : activeTab === 'deleted'
                    ? 'Deleted attributes will appear here.'
                    : 'Attributes define variant properties like Color, Size, or Material for your SKUs.'}
              </p>
              {debouncedSearch ? (
                <button
                  onClick={() => setSearch('')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  Clear search
                </button>
              ) : (
                activeTab === 'active' && (
                  <button
                    onClick={handleCreate}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add your first attribute
                  </button>
                )
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {attributes.map((attr) => (
                <AttributeRow
                  key={attr.id}
                  attribute={attr}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRestore={handleRestore}
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
              <span className="font-semibold text-gray-700">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>
              {' '}–{' '}
              <span className="font-semibold text-gray-700">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>
              {' '}of{' '}
              <span className="font-semibold text-gray-700">{pagination.total}</span>
              {' '}{activeTab === 'deleted' ? 'deleted' : 'active'} attributes
            </p>

            <div className="flex items-center gap-1 order-1 sm:order-2">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={!pagination.has_prev}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {getPaginationRange().map((item, idx) =>
                  item === '…' ? (
                    <span key={`e-${idx}`} className="px-2 py-2 text-sm text-gray-400 select-none">…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => goToPage(item as number)}
                      className={`min-w-[36px] h-9 px-2 text-sm font-semibold rounded-lg transition-all ${item === pagination.page
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={!pagination.has_next}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <span className="hidden sm:inline">Next</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {!loading && attributes.length > 0 && pagination && pagination.total_pages <= 1 && (
          <div className="mt-4 sm:mt-6 text-center text-sm text-gray-500">
            Showing all {pagination.total} {activeTab === 'deleted' ? 'deleted' : 'active'} attributes
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  )
}

export default Attributes