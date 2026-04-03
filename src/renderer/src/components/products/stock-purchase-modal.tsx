// src/components/products/stock-purchase-modal.tsx


import React from 'react'

export type StockPurchaseFormData = {
  quantity: string
  price_per_unit: string
  total_price_bought: string
  shipping_cost: string
  min_price: string
  max_price: string
  manufacture_date: string
  expiry_date: string
  batch_number: string
  purchased_on: string
  arrived_on: string
  // Supplier fields
  supplier_id: number | null
  create_new_supplier: boolean
  supplier_name: string
  contact_person: string
  phone_number: string
  email: string
  address: string
}

export const defaultStockPurchaseForm = (): StockPurchaseFormData => ({
  quantity: '',
  price_per_unit: '',
  total_price_bought: '',
  shipping_cost: '',
  min_price: '',
  max_price: '',
  manufacture_date: '',
  expiry_date: '',
  batch_number: '',
  purchased_on: new Date().toISOString().split('T')[0],
  arrived_on: new Date().toISOString().split('T')[0],
  supplier_id: null,
  create_new_supplier: false,
  supplier_name: '',
  contact_person: '',
  phone_number: '',
  email: '',
  address: '',
})

type Supplier = {
  id: number
  supplier_name: string
  contact_person: string | null
  phone_number: string | null
}

type Props = {
  skuName: string
  skuCode: string
  purchaseNumber: number // 1-based
  maxPurchases: number
  data: StockPurchaseFormData
  onChange: (data: StockPurchaseFormData) => void
  errors: Record<string, string>
  onClearError: (key: string) => void
  onAddAnother: () => void
  onDone: () => void
  submitting: boolean
  existingPurchaseCount: number // how many already created for this sku
  isLast: boolean
}

const StockPurchaseModal = ({
  skuName,
  skuCode,
  purchaseNumber,
  maxPurchases,
  data,
  onChange,
  errors,
  onClearError,
  onAddAnother,
  onDone,
  submitting,
  existingPurchaseCount,
  isLast,
}: Props) => {
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [supplierSearch, setSupplierSearch] = React.useState('')
  const [supplierDropdownOpen, setSupplierDropdownOpen] = React.useState(false)
  const supplierRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await window.api.products.getAllSuppliers({ is_active: 'yes', should_paginate: false })
        if (res.success && res.data) setSuppliers(res.data.items)
      } catch { /* ignore */ }
    }
    load()
  }, [])

  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) setSupplierDropdownOpen(false)
    }
    if (supplierDropdownOpen) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [supplierDropdownOpen])

  const set = (patch: Partial<StockPurchaseFormData>) => onChange({ ...data, ...patch })

  const filteredSuppliers = suppliers.filter(s =>
    !supplierSearch || s.supplier_name.toLowerCase().includes(supplierSearch.toLowerCase())
  )

  const selectedSupplier = suppliers.find(s => s.id === data.supplier_id)

  // Auto-calculate total when qty and price change
  React.useEffect(() => {
    const qty = parseFloat(data.quantity)
    const price = parseFloat(data.price_per_unit)
    if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
      set({ total_price_bought: (qty * price).toFixed(2) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.quantity, data.price_per_unit])

  const canAddAnother = existingPurchaseCount < maxPurchases - 1

  return (
    <div className="space-y-5">
      {/* SKU info banner */}
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
        <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-emerald-800 truncate">{skuName}</p>
          <p className="text-xs text-emerald-600 font-mono">{skuCode}</p>
        </div>
      </div>

      {/* Purchase # indicator */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock Purchase #{purchaseNumber}</span>
        <span className="text-xs text-gray-400">{existingPurchaseCount}/{maxPurchases} created</span>
      </div>

      {/* Quantity + Price per unit */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Quantity <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={data.quantity}
            onChange={e => { set({ quantity: e.target.value }); onClearError('quantity') }}
            placeholder="e.g. 100"
            className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.quantity ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`}
          />
          {errors.quantity && <p className="text-xs text-red-600 mt-1">{errors.quantity}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Price / Unit <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={data.price_per_unit}
            onChange={e => { set({ price_per_unit: e.target.value }); onClearError('price_per_unit') }}
            placeholder="0.00"
            className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.price_per_unit ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`}
          />
          {errors.price_per_unit && <p className="text-xs text-red-600 mt-1">{errors.price_per_unit}</p>}
        </div>
      </div>

      {/* Total + Shipping */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Total Cost <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={data.total_price_bought}
            onChange={e => { set({ total_price_bought: e.target.value }); onClearError('total_price_bought') }}
            placeholder="Auto-calculated"
            className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.total_price_bought ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`}
          />
          {errors.total_price_bought && <p className="text-xs text-red-600 mt-1">{errors.total_price_bought}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Shipping Cost</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={data.shipping_cost}
            onChange={e => set({ shipping_cost: e.target.value })}
            placeholder="0.00"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Min / Max price */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Min Selling Price <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={data.min_price}
            onChange={e => { set({ min_price: e.target.value }); onClearError('min_price') }}
            placeholder="0.00"
            className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.min_price ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`}
          />
          {errors.min_price && <p className="text-xs text-red-600 mt-1">{errors.min_price}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Max Selling Price</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={data.max_price}
            onChange={e => set({ max_price: e.target.value })}
            placeholder="0.00"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Purchased On</label>
          <input
            type="date"
            value={data.purchased_on}
            onChange={e => set({ purchased_on: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Arrived On</label>
          <input
            type="date"
            value={data.arrived_on}
            onChange={e => set({ arrived_on: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Batch + Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Expiry Date</label>
          <input
            type="date"
            value={data.expiry_date}
            onChange={e => set({ expiry_date: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Batch Number</label>
          <input
            type="text"
            value={data.batch_number}
            onChange={e => set({ batch_number: e.target.value })}
            placeholder="e.g. BATCH-001"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Supplier section */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Supplier (Optional)</p>
          <button
            type="button"
            onClick={() => set({ create_new_supplier: !data.create_new_supplier, supplier_id: null })}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {data.create_new_supplier ? '← Select existing' : '+ New supplier'}
          </button>
        </div>

        {data.create_new_supplier ? (
          <div className="space-y-3 p-3 bg-blue-50/40 rounded-lg border border-blue-100">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Supplier Name <span className="text-red-500">*</span>
              </label>
              <input
                value={data.supplier_name}
                onChange={e => { set({ supplier_name: e.target.value }); onClearError('supplier_name') }}
                placeholder="e.g. Acme Supplies Ltd."
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.supplier_name ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`}
              />
              {errors.supplier_name && <p className="text-xs text-red-600 mt-1">{errors.supplier_name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Person</label>
                <input value={data.contact_person} onChange={e => set({ contact_person: e.target.value })} placeholder="Name" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                <input value={data.phone_number} onChange={e => set({ phone_number: e.target.value })} placeholder="+1 234 567" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
              <input type="email" value={data.email} onChange={e => set({ email: e.target.value })} placeholder="supplier@example.com" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
          </div>
        ) : (
          <div className="relative" ref={supplierRef}>
            <button
              type="button"
              onClick={() => setSupplierDropdownOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm"
            >
              <span className={selectedSupplier ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                {selectedSupplier ? selectedSupplier.supplier_name : 'No supplier (optional)'}
              </span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${supplierDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {supplierDropdownOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="p-2 border-b border-gray-100">
                  <input
                    autoFocus
                    value={supplierSearch}
                    onChange={e => setSupplierSearch(e.target.value)}
                    placeholder="Search suppliers…"
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto py-1">
                  <button
                    onClick={() => { set({ supplier_id: null }); setSupplierDropdownOpen(false); setSupplierSearch('') }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50 italic"
                  >
                    No supplier
                  </button>
                  {filteredSuppliers.length === 0 ? (
                    <div className="px-3 py-3 text-center text-sm text-gray-400">No suppliers found</div>
                  ) : filteredSuppliers.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { set({ supplier_id: s.id }); setSupplierDropdownOpen(false); setSupplierSearch('') }}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${data.supplier_id === s.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50 text-gray-800'}`}
                    >
                      <div>
                        <div>{s.supplier_name}</div>
                        {s.contact_person && <div className="text-xs text-gray-400">{s.contact_person}</div>}
                      </div>
                      {data.supplier_id === s.id && (
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* OR divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">actions</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Action buttons */}
      <div className="space-y-2.5">
        {canAddAnother && (
          <button
            type="button"
            onClick={onAddAnother}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Save & Add Another Stock Purchase
          </button>
        )}

        <button
          type="button"
          onClick={onDone}
          disabled={submitting}
          className="w-full px-4 py-3 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {isLast ? 'Done' : 'Save & Done'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default StockPurchaseModal