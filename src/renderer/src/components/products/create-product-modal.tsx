// src/components/products/create-product-modal.tsx


import React from 'react'
import CategorySelect from './category-select'
import SkuFormModal, { SkuFormData } from './sku-form-modal'
import StockPurchaseModal, { StockPurchaseFormData, defaultStockPurchaseForm } from './stock-purchase-modal'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductFormData = {
  product_name: string
  category_id: number | null
  description: string
  is_active: boolean
  images: Array<{ image_data: string; filename: string }>
}

const defaultProductForm = (): ProductFormData => ({
  product_name: '',
  category_id: null,
  description: '',
  is_active: true,
  images: [],
})

const defaultSkuForm = (): SkuFormData => ({
  sku_name: '',
  code: '',
  is_active: true,
  images: [],
  sku_attributes: [],
})

type SkuEntry = {
  id?: number          // if already saved
  data: SkuFormData
  errors: Record<string, string>
  stockPurchases: StockPurchaseEntry[]
  createdId?: number
}

type StockPurchaseEntry = {
  id?: number
  data: StockPurchaseFormData
  errors: Record<string, string>
  createdId?: number
}

// which "layer" is active
type Layer = 'product' | 'sku' | 'stockPurchase'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const MAX_SKUS = 5
const MAX_STOCK_PURCHASES = 5

// ─── Utility ─────────────────────────────────────────────────────────────────

const generateSkuCode = (productName: string, skuNumber: number): string => {
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

// ─── Modal Panel wrapper ──────────────────────────────────────────────────────

type PanelProps = {
  title: string
  subtitle?: string
  icon: React.ReactNode
  iconBg: string
  badge?: string
  badgeColor?: string
  depth: number            // 0 = product, 1 = sku, 2 = stockPurchase
  isTop: boolean
  totalDepth: number
  onBack?: () => void
  onClose: () => void
  children: React.ReactNode
}

const STACK_OFFSET = 22
const SCALE_STEP   = 0.03

const ModalPanel = ({ title, subtitle, icon, iconBg, badge, badgeColor = 'bg-blue-100 text-blue-700', depth, isTop, totalDepth, onBack, onClose, children }: PanelProps) => {
  const levelsFromTop = totalDepth - 1 - depth
  const translateY    = -levelsFromTop * STACK_OFFSET
  const scale         = 1 - levelsFromTop * SCALE_STEP
  const opacity       = levelsFromTop === 0 ? 1 : Math.max(0.55, 1 - levelsFromTop * 0.15)

  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-4"
      style={{ pointerEvents: isTop ? 'auto' : 'none' }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{
          transform: `translateY(${translateY}px) scale(${scale})`,
          opacity,
          transition: 'transform 0.25s ease, opacity 0.25s ease',
          transformOrigin: 'top center',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2.5">
            {depth > 0 && (
              <div className="flex items-center gap-1">
                {Array.from({ length: depth }).map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400" style={{ opacity: 0.4 + (i + 1) * 0.2 }} />
                ))}
              </div>
            )}
            <div className={`w-7 h-7 ${iconBg} rounded-lg flex items-center justify-center shadow-sm`}>
              {icon}
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">{title}</h2>
              {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {badge && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}>
                {badge}
              </span>
            )}
            {onBack ? (
              <button
                onClick={onBack}
                title="Go back"
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {/* Body */}
        <div className="px-5 py-5 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Product Form ─────────────────────────────────────────────────────────────

type ProductFormProps = {
  data: ProductFormData
  onChange: (d: ProductFormData) => void
  errors: Record<string, string>
  onClearError: (k: string) => void
  onAddAnother: () => void
  onAddSkus: () => void
  onJustThis: () => void
  submitting: boolean
  productId?: number // if already created
}

const ProductForm = ({ data, onChange, errors, onClearError, onAddAnother, onAddSkus, onJustThis, submitting }: ProductFormProps) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const set = (patch: Partial<ProductFormData>) => onChange({ ...data, ...patch })

  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const readers = files.map(file => new Promise<{ image_data: string; filename: string }>(resolve => {
      const r = new FileReader()
      r.onloadend = () => resolve({ image_data: r.result as string, filename: file.name })
      r.readAsDataURL(file)
    }))
    Promise.all(readers).then(imgs => set({ images: [...data.images, ...imgs] }))
    if (e.target) e.target.value = ''
  }

  return (
    <div className="space-y-5">
      {/* Product Name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Product Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.product_name}
          onChange={e => { set({ product_name: e.target.value }); onClearError('product_name') }}
          placeholder="e.g. Running Shoes"
          className={`w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.product_name ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`}
        />
        {errors.product_name && <p className="text-xs text-red-600 mt-1">{errors.product_name}</p>}
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Category <span className="text-red-500">*</span>
        </label>
        <CategorySelect
          value={data.category_id}
          onChange={id => { set({ category_id: id }); onClearError('category_id') }}
          error={errors.category_id}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Description <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          value={data.description}
          onChange={e => set({ description: e.target.value })}
          placeholder="Describe the product…"
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white transition-all"
        />
      </div>

      {/* Images */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">Images</label>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImages} />
        {data.images.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {data.images.map((img, idx) => (
              <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 group">
                <img src={img.image_data} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => set({ images: data.images.filter((_, i) => i !== idx) })}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-blue-300 hover:text-blue-400 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
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
            Click to add product images
          </button>
        )}
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <p className="text-sm font-semibold text-gray-700">Active</p>
          <p className="text-xs text-gray-500">Visible in the store</p>
        </div>
        <button
          type="button"
          onClick={() => set({ is_active: !data.is_active })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${data.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${data.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* OR divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">what's next?</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Action buttons */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={onAddAnother}
          disabled={submitting}
          className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-sm font-semibold text-gray-600 hover:text-blue-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Another Product
        </button>

        <button
          type="button"
          onClick={onAddSkus}
          disabled={submitting}
          className="w-full px-4 py-3 rounded-lg border-2 border-violet-300 hover:border-violet-400 bg-violet-50 hover:bg-violet-100 text-sm font-semibold text-violet-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Add SKUs to This Product
        </button>

        <button
          type="button"
          onClick={onJustThis}
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
              Just This Product
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

const CreateProductModal = ({ open, onClose, onSuccess }: Props) => {
  // Product layer
  const [productData, setProductData] = React.useState<ProductFormData>(defaultProductForm())
  const [productErrors, setProductErrors] = React.useState<Record<string, string>>({})
  const [productId, setProductId] = React.useState<number | null>(null)

  // SKU layer – array of sku entries (up to MAX_SKUS)
  const [skus, setSkus] = React.useState<SkuEntry[]>([])
  const [activeSkuIndex, setActiveSkuIndex] = React.useState(0)

  // Stock purchase layer – currently editing within activeSkuIndex
  const [activePurchaseIndex, setActivePurchaseIndex] = React.useState(0)

  // Layer stack
  const [layers, setLayers] = React.useState<Layer[]>(['product'])

  const [submitting, setSubmitting] = React.useState(false)

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setProductData(defaultProductForm())
      setProductErrors({})
      setProductId(null)
      setSkus([])
      setActiveSkuIndex(0)
      setActivePurchaseIndex(0)
      setLayers(['product'])
      setSubmitting(false)
    }
  }, [open])

  if (!open) return null

  const currentLayer = layers[layers.length - 1]
  const totalDepth = layers.length

  // ── Validation ─────────────────────────────────────────────────────────────

  const validateProduct = (): boolean => {
    const errs: Record<string, string> = {}
    if (!productData.product_name.trim()) errs.product_name = 'Product name is required'
    if (!productData.category_id) errs.category_id = 'Please select a category'
    setProductErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateSku = (entry: SkuEntry): { valid: boolean; errors: Record<string, string> } => {
    const errs: Record<string, string> = {}
    if (!entry.data.sku_name.trim()) errs.sku_name = 'SKU name is required'
    if (!entry.data.code.trim()) errs.code = 'SKU code is required'
    return { valid: Object.keys(errs).length === 0, errors: errs }
  }

  const validatePurchase = (entry: StockPurchaseEntry): { valid: boolean; errors: Record<string, string> } => {
    const errs: Record<string, string> = {}
    if (!entry.data.quantity || parseFloat(entry.data.quantity) <= 0) errs.quantity = 'Quantity must be > 0'
    if (!entry.data.price_per_unit || parseFloat(entry.data.price_per_unit) < 0) errs.price_per_unit = 'Enter a valid price'

    if (!entry.data.total_price_bought || parseFloat(entry.data.total_price_bought) < 0) errs.total_price_bought = 'Enter total cost'
    if (!entry.data.min_price || parseFloat(entry.data.min_price) < 0) errs.min_price = 'Enter min selling price'
    if (entry.data.create_new_supplier && !entry.data.supplier_name.trim()) errs.supplier_name = 'Supplier name is required'
    return { valid: Object.keys(errs).length === 0, errors: errs }
  }

  // ── API helpers ────────────────────────────────────────────────────────────

  const saveProduct = async (): Promise<number | null> => {
    if (productId) return productId
    const res = await window.api.products.createProduct({
      product_name: productData.product_name.trim(),
      category_id: productData.category_id!,
      description: productData.description.trim() || undefined,
      is_active: productData.is_active,
      images: productData.images.length > 0 ? productData.images.map(i => ({ image_data: i.image_data, original_filename: i.filename })) : undefined,
    })
    if (!res.success || !res.data?.id) throw new Error(res.message || 'Failed to create product')
    setProductId(res.data.id)
    return res.data.id
  }

  const saveSku = async (pid: number, entry: SkuEntry): Promise<number> => {
    if (entry.createdId) {
      // Update existing
      await window.api.products.updateSku({
        id: entry.createdId,
        sku_name: entry.data.sku_name.trim(),
        code: entry.data.code.trim(),
        is_active: entry.data.is_active,
        update_images: entry.data.images.length > 0,
        images: entry.data.images.map(i => ({ image_data: i.image_data })),
        update_attributes: entry.data.sku_attributes.length > 0,
        sku_attributes: entry.data.sku_attributes.map(a => ({ attribute_id: a.attribute_id, value: a.value })),
      })
      return entry.createdId
    }
    const res = await window.api.products.createSku({
      product_id: pid,
      sku_name: entry.data.sku_name.trim(),
      code: entry.data.code.trim(),
      is_active: entry.data.is_active,
      images: entry.data.images.length > 0 ? entry.data.images.map(i => ({ image_data: i.image_data })) : undefined,
      sku_attributes: entry.data.sku_attributes.length > 0
        ? entry.data.sku_attributes.map(a => ({ attribute_id: a.attribute_id, value: a.value }))
        : undefined,
    })
    if (!res.success || !res.data?.id) throw new Error(res.message || 'Failed to create SKU')
    return res.data.id
  }

  const savePurchase = async (skuId: number, entry: StockPurchaseEntry): Promise<number> => {
    if (entry.createdId) return entry.createdId
    
    let supplierId: number | undefined = entry.data.supplier_id ?? undefined

    // Create supplier first if needed
    if (entry.data.create_new_supplier && entry.data.supplier_name.trim()) {
      const sRes = await window.api.products.createSupplier({
        supplier_name: entry.data.supplier_name.trim(),
        contact_person: entry.data.contact_person.trim() || undefined,
        phone_number: entry.data.phone_number.trim() || undefined,
        email: entry.data.email.trim() || undefined,
        address: entry.data.address.trim() || undefined,
      })
      if (!sRes.success || !sRes.data?.id) throw new Error(sRes.message || 'Failed to create supplier')
      supplierId = sRes.data.id
    }

    const res = await window.api.products.createStockPurchase({
      sku_id: skuId,
      quantity: parseInt(entry.data.quantity),
      price_per_unit: parseFloat(entry.data.price_per_unit),
      total_price_bought: parseFloat(entry.data.total_price_bought),
      shipping_cost: entry.data.shipping_cost ? parseFloat(entry.data.shipping_cost) : undefined,
      min_price: parseFloat(entry.data.min_price || '0'),
      max_price: entry.data.max_price ? parseFloat(entry.data.max_price) : undefined,
      manufacture_date: entry.data.manufacture_date || undefined,
      expiry_date: entry.data.expiry_date || undefined,
      batch_number: entry.data.batch_number || undefined,
      purchased_on: entry.data.purchased_on ? new Date(entry.data.purchased_on).getTime() / 1000 : undefined,
      arrived_on: entry.data.arrived_on ? new Date(entry.data.arrived_on).getTime() / 1000 : undefined,
      supplier_id: supplierId,
    })
    if (!res.success || !res.data?.id) throw new Error(res.message || 'Failed to create stock purchase')
    return res.data.id
  }

  // ── Product actions ────────────────────────────────────────────────────────

  const handleAddAnother = async () => {
    if (!validateProduct()) return
    setSubmitting(true)
    try {
      await saveProduct()
      onSuccess?.()
      // Reset for new product
      setProductData(defaultProductForm())
      setProductErrors({})
      setProductId(null)
      setSkus([])
      setActiveSkuIndex(0)
      setActivePurchaseIndex(0)
      setLayers(['product'])
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddSkus = async () => {
    if (!validateProduct()) return
    setSubmitting(true)
    try {
      await saveProduct()
      // Push sku layer with first empty entry
      if (skus.length === 0) {
        const code = generateSkuCode(productData.product_name, 1)
        setSkus([{ data: { ...defaultSkuForm(), code }, errors: {}, stockPurchases: [] }])
        setActiveSkuIndex(0)
      }
      setLayers(l => [...l, 'sku'])
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleJustThis = async () => {
    if (!validateProduct()) return
    setSubmitting(true)
    try {
      await saveProduct()
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  // ── SKU actions ────────────────────────────────────────────────────────────

  const getActiveSku = (): SkuEntry | undefined => skus[activeSkuIndex]
  const updateActiveSku = (patch: Partial<SkuEntry>) => {
    setSkus(prev => prev.map((s, i) => i === activeSkuIndex ? { ...s, ...patch } : s))
  }

  const handleSkuAddAnother = async () => {
    const active = getActiveSku()
    if (!active) return
    const { valid, errors } = validateSku(active)
    if (!valid) { updateActiveSku({ errors }); return }

    setSubmitting(true)
    try {
      const pid = productId!
      const skuId = await saveSku(pid, active)
      updateActiveSku({ createdId: skuId, errors: {} })

      if (skus.length < MAX_SKUS) {
        const nextNumber = skus.length + 1
        const code = generateSkuCode(productData.product_name, nextNumber)
        const newSkus = [...skus, { data: { ...defaultSkuForm(), code }, errors: {}, stockPurchases: [] }]
        setSkus(newSkus)
        setActiveSkuIndex(newSkus.length - 1)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkuAddStockPurchases = async () => {
    const active = getActiveSku()
    if (!active) return
    const { valid, errors } = validateSku(active)
    if (!valid) { updateActiveSku({ errors }); return }

    setSubmitting(true)
    try {
      const pid = productId!
      const skuId = await saveSku(pid, active)
      updateActiveSku({ createdId: skuId, errors: {} })

      // Init stock purchases for this sku
      if (active.stockPurchases.length === 0) {
        updateActiveSku({ stockPurchases: [{ data: defaultStockPurchaseForm(), errors: {} }] })
        setActivePurchaseIndex(0)
      } else {
        setActivePurchaseIndex(active.stockPurchases.length - 1)
      }
      setLayers(l => [...l, 'stockPurchase'])
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkuDone = async () => {
    const active = getActiveSku()
    if (!active) { onClose(); onSuccess?.(); return }
    const { valid, errors } = validateSku(active)
    if (!valid) { updateActiveSku({ errors }); return }

    setSubmitting(true)
    try {
      const pid = productId!
      const skuId = await saveSku(pid, active)
      updateActiveSku({ createdId: skuId, errors: {} })
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Stock Purchase actions ─────────────────────────────────────────────────

  const getActivePurchase = (): StockPurchaseEntry | undefined => {
    const sku = getActiveSku()
    return sku?.stockPurchases[activePurchaseIndex]
  }

  const updateActivePurchase = (patch: Partial<StockPurchaseEntry>) => {
    setSkus(prev => prev.map((s, si) => {
      if (si !== activeSkuIndex) return s
      return {
        ...s,
        stockPurchases: s.stockPurchases.map((p, pi) =>
          pi === activePurchaseIndex ? { ...p, ...patch } : p
        )
      }
    }))
  }

  const handlePurchaseAddAnother = async () => {
    const purchase = getActivePurchase()
    if (!purchase) return
    const { valid, errors } = validatePurchase(purchase)
    if (!valid) { updateActivePurchase({ errors }); return }

    setSubmitting(true)
    try {
      const skuId = getActiveSku()!.createdId!
      const pid = await savePurchase(skuId, purchase)
      updateActivePurchase({ createdId: pid, errors: {} })

      const sku = getActiveSku()!
      if (sku.stockPurchases.length < MAX_STOCK_PURCHASES) {
        const newPurchases = [...sku.stockPurchases, { data: defaultStockPurchaseForm(), errors: {} }]
        setSkus(prev => prev.map((s, si) => si === activeSkuIndex ? { ...s, stockPurchases: newPurchases } : s))
        setActivePurchaseIndex(newPurchases.length - 1)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePurchaseDone = async () => {
    const purchase = getActivePurchase()
    if (!purchase) { onClose(); onSuccess?.(); return }
    const { valid, errors } = validatePurchase(purchase)
    if (!valid) { updateActivePurchase({ errors }); return }

    setSubmitting(true)
    try {
      const skuId = getActiveSku()!.createdId!
      const pid = await savePurchase(skuId, purchase)
      updateActivePurchase({ createdId: pid, errors: {} })
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Back navigation ────────────────────────────────────────────────────────

  const handleBack = () => {
    if (layers.length > 1) {
      setLayers(l => l.slice(0, -1))
    } else {
      onClose()
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  const activeSku = getActiveSku()
  const activePurchase = getActivePurchase()
  const createdSkuCount = skus.filter(s => !!s.createdId).length
  const skuCanAddAnother = skus.length < MAX_SKUS && createdSkuCount < MAX_SKUS - 1

  return (
    <div
      className="fixed top-0 left-64 right-0 bottom-0 z-50 flex items-center justify-center p-4"
      style={{ animation: 'fadeIn 0.15s ease-out' }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md" style={{ height: 'min(92vh, 720px)' }}>

        {/* ── Product Panel (depth 0) ── */}
        {layers.includes('product') && (
          <ModalPanel
            depth={0}
            isTop={currentLayer === 'product'}
            totalDepth={totalDepth}
            title={productId ? 'Product Created ✓' : 'New Product'}
            subtitle={productId ? `ID #${productId}` : undefined}
            icon={
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
            iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
            onClose={onClose}
          >
            <ProductForm
              data={productData}
              onChange={setProductData}
              errors={productErrors}
              onClearError={k => setProductErrors(e => { const n = { ...e }; delete n[k]; return n })}
              onAddAnother={handleAddAnother}
              onAddSkus={handleAddSkus}
              onJustThis={handleJustThis}
              submitting={submitting}
            />
          </ModalPanel>
        )}

        {/* ── SKU Panel (depth 1) ── */}
        {layers.includes('sku') && activeSku && (
          <ModalPanel
            depth={1}
            isTop={currentLayer === 'sku'}
            totalDepth={totalDepth}
            title={activeSku.createdId ? `SKU #${activeSkuIndex + 1} ✓` : `SKU #${activeSkuIndex + 1}`}
            subtitle={productData.product_name}
            icon={
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            }
            iconBg="bg-gradient-to-br from-violet-500 to-violet-600"
            badge={`${activeSkuIndex + 1}/${MAX_SKUS}`}
            badgeColor="border border-violet-200 bg-violet-100 text-violet-700"
            onBack={handleBack}
            onClose={onClose}
          >
            <SkuFormModal
              productName={productData.product_name}
              skuNumber={activeSkuIndex + 1}
              data={activeSku.data}
              onChange={d => updateActiveSku({ data: d })}
              errors={activeSku.errors}
              onClearError={k => updateActiveSku({ errors: { ...activeSku.errors, [k]: undefined } as any })}
              onAddAnother={handleSkuAddAnother}
              onAddStockPurchases={handleSkuAddStockPurchases}
              onDone={handleSkuDone}
              submitting={submitting}
              isUpdate={!!activeSku.createdId}
              canAddAnother={skuCanAddAnother}
            />
          </ModalPanel>
        )}

        {/* ── Stock Purchase Panel (depth 2) ── */}
        {layers.includes('stockPurchase') && activePurchase && activeSku && (
          <ModalPanel
            depth={2}
            isTop={currentLayer === 'stockPurchase'}
            totalDepth={totalDepth}
            title={`Stock Purchase #${activePurchaseIndex + 1}`}
            subtitle={activeSku.data.sku_name}
            icon={
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            }
            iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
            badge={`${activePurchaseIndex + 1}/${MAX_STOCK_PURCHASES}`}
            badgeColor="border border-emerald-200 bg-emerald-100 text-emerald-700"
            onBack={handleBack}
            onClose={onClose}
          >
            <StockPurchaseModal
              skuName={activeSku.data.sku_name}
              skuCode={activeSku.data.code}
              purchaseNumber={activePurchaseIndex + 1}
              maxPurchases={MAX_STOCK_PURCHASES}
              data={activePurchase.data}
              onChange={d => updateActivePurchase({ data: d })}
              errors={activePurchase.errors}
              onClearError={k => updateActivePurchase({ errors: { ...activePurchase.errors, [k]: undefined } as any })}
              onAddAnother={handlePurchaseAddAnother}
              onDone={handlePurchaseDone}
              submitting={submitting}
              existingPurchaseCount={activeSku.stockPurchases.filter(p => !!p.createdId).length}
              isLast={activePurchaseIndex === activeSku.stockPurchases.length - 1}
            />
          </ModalPanel>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  )
}

export default CreateProductModal