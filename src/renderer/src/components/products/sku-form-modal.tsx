// src/components/products/sku-modal.tsx


import React from 'react'

export type SkuAttribute = {
  attribute_id: number
  value: string
}

export type SkuFormData = {
  sku_name: string
  code: string
  is_active: boolean
  images: Array<{ image_data: string; filename: string }>
  sku_attributes: SkuAttribute[]
}

type Attribute = {
  id: number
  attribute_name: string
  unit: string | null
}

type Props = {
  productName: string
  skuNumber: number
  data: SkuFormData
  onChange: (data: SkuFormData) => void
  errors: Record<string, string>
  onClearError: (key: string) => void
  onAddAnother: () => void
  onAddStockPurchases: () => void
  onDone: () => void
  submitting: boolean
  isUpdate: boolean
  canAddAnother: boolean
}

const generateSkuCode = (productName: string, skuNumber: number) => {
  const base = productName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(3, 'X')
  const num = String(skuNumber).padStart(3, '0')
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `${base}-${num}-${rand}`
}

const SkuFormModal = ({
  productName,
  skuNumber,
  data,
  onChange,
  errors,
  onClearError,
  onAddAnother,
  onAddStockPurchases,
  onDone,
  submitting,
  isUpdate,
  canAddAnother,
}: Props) => {
  const [attributes, setAttributes] = React.useState<Attribute[]>([])
  const [attributesLoaded, setAttributesLoaded] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await window.api.products.getAllAttributes({ is_active: 'yes', should_paginate: false })
        if (res.success && res.data) setAttributes(res.data.items)
      } catch { /* ignore */ }
      finally { setAttributesLoaded(true) }
    }
    load()
  }, [])

  const set = (patch: Partial<SkuFormData>) => onChange({ ...data, ...patch })

  const handleAutoCode = () => {
    set({ code: generateSkuCode(productName, skuNumber) })
    onClearError('code')
  }

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const readers = files.map(file => new Promise<{ image_data: string; filename: string }>(resolve => {
      const r = new FileReader()
      r.onloadend = () => resolve({ image_data: r.result as string, filename: file.name })
      r.readAsDataURL(file)
    }))
    Promise.all(readers).then(newImages => {
      set({ images: [...data.images, ...newImages] })
    })
    if (e.target) e.target.value = ''
  }

  const removeImage = (idx: number) => {
    set({ images: data.images.filter((_, i) => i !== idx) })
  }

  const addAttributeRow = () => {
    if (attributes.length === 0) return
    const usedIds = data.sku_attributes.map(a => a.attribute_id)
    const unused = attributes.find(a => !usedIds.includes(a.id))
    if (!unused) return
    set({ sku_attributes: [...data.sku_attributes, { attribute_id: unused.id, value: '' }] })
  }

  const removeAttributeRow = (idx: number) => {
    set({ sku_attributes: data.sku_attributes.filter((_, i) => i !== idx) })
  }

  const setAttributeField = (idx: number, field: keyof SkuAttribute, val: string | number) => {
    const updated = data.sku_attributes.map((a, i) => i === idx ? { ...a, [field]: val } : a)
    set({ sku_attributes: updated })
  }

  return (
    <div className="space-y-5">
      {/* Product info banner */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
        <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="text-xs font-semibold text-blue-800 truncate">{productName}</p>
      </div>

      {/* SKU Name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          SKU Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.sku_name}
          onChange={e => { set({ sku_name: e.target.value }); onClearError('sku_name') }}
          placeholder="e.g. Blue / XL"
          className={`w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.sku_name ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`}
        />
        {errors.sku_name && <p className="text-xs text-red-600 mt-1">{errors.sku_name}</p>}
      </div>

      {/* SKU Code */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-semibold text-gray-700">
            SKU Code <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={handleAutoCode}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Auto-generate
          </button>
        </div>
        <input
          type="text"
          value={data.code}
          onChange={e => { set({ code: e.target.value }); onClearError('code') }}
          placeholder="e.g. SHOE-001-BLU"
          className={`w-full px-4 py-3 rounded-lg border font-mono text-sm focus:outline-none focus:ring-2 transition-all ${errors.code ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`}
        />
        {errors.code && <p className="text-xs text-red-600 mt-1">{errors.code}</p>}
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <p className="text-sm font-semibold text-gray-700">Active</p>
          <p className="text-xs text-gray-500">Available for sale</p>
        </div>
        <button
          type="button"
          onClick={() => set({ is_active: !data.is_active })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${data.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${data.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Images */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">Images</label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add images
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageAdd} />
        {data.images.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {data.images.map((img, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group">
                <img src={img.image_data} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Click to add images
          </button>
        )}
      </div>

      {/* SKU Attributes */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">SKU Attributes</p>
          {attributesLoaded && attributes.length > 0 && (
            <button
              type="button"
              onClick={addAttributeRow}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add attribute
            </button>
          )}
        </div>

        {!attributesLoaded ? (
          <div className="h-10 bg-gray-100 animate-pulse rounded-lg" />
        ) : attributes.length === 0 ? (
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-amber-700">No attributes found. You can add SKU attributes later after creating attributes in the system.</p>
          </div>
        ) : data.sku_attributes.length === 0 ? (
          <button
            type="button"
            onClick={addAttributeRow}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add an attribute (e.g. Color: Blue)
          </button>
        ) : (
          <div className="space-y-2">
            {data.sku_attributes.map((attr, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <select
                  value={attr.attribute_id}
                  onChange={e => setAttributeField(idx, 'attribute_id', Number(e.target.value))}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {attributes.map(a => (
                    <option key={a.id} value={a.id} disabled={data.sku_attributes.some((x, xi) => xi !== idx && x.attribute_id === a.id)}>
                      {a.attribute_name}{a.unit ? ` (${a.unit})` : ''}
                    </option>
                  ))}
                </select>
                <input
                  value={attr.value}
                  onChange={e => setAttributeField(idx, 'value', e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <button
                  onClick={() => removeAttributeRow(idx)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
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
        {canAddAnother && !isUpdate && (
          <button
            type="button"
            onClick={onAddAnother}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-violet-300 hover:border-violet-400 hover:bg-violet-50 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {isUpdate ? 'Save & Add Another SKU' : 'Save & Add Another SKU'}
          </button>
        )}

        <button
          type="button"
          onClick={onAddStockPurchases}
          disabled={submitting}
          className="w-full px-4 py-3 rounded-lg border-2 border-emerald-300 hover:border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-sm font-semibold text-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          {isUpdate ? 'Save & Add Stock Purchases' : 'Save & Add Stock Purchases'}
        </button>

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
              {isUpdate ? 'Save Changes' : 'Done'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default SkuFormModal