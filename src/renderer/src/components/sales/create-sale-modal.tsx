import React from 'react'
import CustomerSelector from './customer-selector'
import SkuSelector from './sku-selector'

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mobile_money' | 'credit' | 'other'

type SaleFormData = {
  // SKU selection
  stock_purchase_id: number | null
  sku_id: number | null
  sku_name: string | null
  quantity: number
  unit_price: number
  total_price: number
  shipping_cost: number
  
  // Customer
  customer_id: number | null
  create_new_customer: boolean
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_address: string
  
  // Sale settings
  is_debt_sale: boolean
  balance_due: string | null // date string
  status: 'pending' | 'completed'
  
  // Payment
  payment: {
    amount_paid: number
    payment_method: PaymentMethod
    reference_number: string
    description: string
  }
}

const defaultSaleForm = (): SaleFormData => ({
  stock_purchase_id: null,
  sku_id: null,
  sku_name: '',
  quantity: 1,
  unit_price: 0,
  total_price: 0,
  shipping_cost: 0,
  customer_id: null,
  create_new_customer: false,
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  customer_address: '',
  is_debt_sale: false,
  balance_due: null,
  status: 'completed',
  payment: {
    amount_paid: 0,
    payment_method: 'cash',
    reference_number: '',
    description: '',
  },
})

type Layer = 'main' | 'sku' | 'customer'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

// ─── Panel Wrapper ────────────────────────────────────────────────────────────

type PanelProps = {
  title: string
  subtitle?: string
  icon: React.ReactNode
  iconBg: string
  badge?: string
  badgeColor?: string
  depth: number
  isTop: boolean
  totalDepth: number
  onBack?: () => void
  onClose: () => void
  children: React.ReactNode
}

const STACK_OFFSET = 22
const SCALE_STEP = 0.03

const ModalPanel = ({ title, subtitle, icon, iconBg, badge, badgeColor = 'bg-emerald-100 text-emerald-700', depth, isTop, totalDepth, onBack, onClose, children }: PanelProps) => {
  const levelsFromTop = totalDepth - 1 - depth
  const translateY = -levelsFromTop * STACK_OFFSET
  const scale = 1 - levelsFromTop * SCALE_STEP
  const opacity = levelsFromTop === 0 ? 1 : Math.max(0.55, 1 - levelsFromTop * 0.15)

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
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ opacity: 0.4 + (i + 1) * 0.2 }} />
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

// ─── Main Sale Form ───────────────────────────────────────────────────────────

type SaleFormProps = {
  data: SaleFormData
  onChange: (d: SaleFormData) => void
  errors: Record<string, string>
  onClearError: (k: string) => void
  onSelectSku: () => void
  onSelectCustomer: () => void
  onCreateSale: () => void
  submitting: boolean
}

const SaleForm = ({ data, onChange, errors, onClearError, onSelectSku, onSelectCustomer, onCreateSale, submitting }: SaleFormProps) => {
  const set = (patch: Partial<SaleFormData>) => onChange({ ...data, ...patch })

  // Auto-calculate total when quantity or unit price changes
  React.useEffect(() => {
    if (data.quantity > 0 && data.unit_price > 0) {
      const total = (data.quantity * data.unit_price) + data.shipping_cost
      set({ total_price: total })
      if (!data.is_debt_sale) {
        set({ payment: { ...data.payment, amount_paid: total } })
      }
    }
  }, [data.quantity, data.unit_price, data.shipping_cost])

  return (
    <div className="space-y-5">

      {/* SKU Selection */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Product / SKU <span className="text-red-500">*</span>
        </label>
        {data.stock_purchase_id ? (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <p className="text-sm font-semibold text-gray-800">SKU #{data.sku_id}</p>
              <p className="text-xs text-gray-500">Qty: {data.quantity} × ${data.unit_price.toFixed(2)}</p>
            </div>
            <button
              onClick={() => set({ stock_purchase_id: null, sku_id: null })}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Change
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSelectSku}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Select a product / SKU
          </button>
        )}
        {errors.stock_purchase_id && <p className="text-xs text-red-600 mt-1">{errors.stock_purchase_id}</p>}
      </div>

      {/* Quantity and Price */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity *</label>
          <input
            type="number"
            min="1"
            value={data.quantity}
            onChange={e => { set({ quantity: parseInt(e.target.value) || 1 }); onClearError('quantity') }}
            className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.quantity ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-emerald-500 bg-white'}`}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Unit Price *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={data.unit_price}
            onChange={e => { set({ unit_price: parseFloat(e.target.value) || 0 }); onClearError('unit_price') }}
            className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${errors.unit_price ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-emerald-500 bg-white'}`}
          />
        </div>
      </div>

      {/* Shipping */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Shipping Cost</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={data.shipping_cost}
          onChange={e => set({ shipping_cost: parseFloat(e.target.value) || 0 })}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
      </div>

      {/* Total */}
      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-700">Total Price</span>
          <span className="text-lg font-bold text-emerald-800">${data.total_price.toFixed(2)}</span>
        </div>
      </div>

      {/* Customer Selection */}
      <div className="border-t border-gray-100 pt-4">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Customer</label>
        {data.customer_id ? (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <p className="text-sm font-semibold text-gray-800">{data.customer_name}</p>
              {data.customer_phone && <p className="text-xs text-gray-500">{data.customer_phone}</p>}
            </div>
            <button
              onClick={() => set({ customer_id: null, customer_name: '' })}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Change
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSelectCustomer}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {data.create_new_customer ? 'Add new customer details' : 'Select a customer (optional)'}
          </button>
        )}
      </div>

      {/* Debt Sale Toggle */}
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <p className="text-sm font-semibold text-gray-700">Debt Sale</p>
          <p className="text-xs text-gray-500">Customer will pay later</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const newDebt = !data.is_debt_sale
            set({ 
              is_debt_sale: newDebt,
              payment: { 
                ...data.payment, 
                amount_paid: newDebt ? 0 : data.total_price 
              }
            })
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${data.is_debt_sale ? 'bg-amber-500' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${data.is_debt_sale ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Payment Section */}
      {!data.is_debt_sale && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">Payment</p>
          
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Amount Paid</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={data.payment.amount_paid}
              onChange={e => set({ payment: { ...data.payment, amount_paid: parseFloat(e.target.value) || 0 } })}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
            {data.payment.amount_paid < data.total_price && (
              <p className="text-xs text-amber-600 mt-1">
                Partial payment: ${(data.total_price - data.payment.amount_paid).toFixed(2)} remaining
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Method</label>
            <select
              value={data.payment.payment_method}
              onChange={e => set({ payment: { ...data.payment, payment_method: e.target.value as PaymentMethod } })}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="transfer">Bank Transfer</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="credit">Store Credit</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reference Number (optional)</label>
            <input
              value={data.payment.reference_number}
              onChange={e => set({ payment: { ...data.payment, reference_number: e.target.value } })}
              placeholder="e.g. Transaction ID"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>
        </div>
      )}

      {/* Debt Due Date */}
      {data.is_debt_sale && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Due Date (optional)</label>
          <input
            type="date"
            value={data.balance_due || ''}
            onChange={e => set({ balance_due: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>
      )}

      {/* Create Sale Button */}
      <button
        type="button"
        onClick={onCreateSale}
        disabled={submitting}
        className="w-full mt-4 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Complete Sale
          </>
        )}
      </button>
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

const CreateSaleModal = ({ open, onClose, onSuccess }: Props) => {
  const [formData, setFormData] = React.useState<SaleFormData>(defaultSaleForm())
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [layers, setLayers] = React.useState<Layer[]>(['main'])
  const [submitting, setSubmitting] = React.useState(false)

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setFormData(defaultSaleForm())
      setErrors({})
      setLayers(['main'])
      setSubmitting(false)
    }
  }, [open])

  if (!open) return null

  const currentLayer = layers[layers.length - 1]
  const totalDepth = layers.length

  // ── Validation ─────────────────────────────────────────────────────────────

  const validateSale = (): boolean => {
    const errs: Record<string, string> = {}
    if (!formData.stock_purchase_id) errs.stock_purchase_id = 'Please select a product'
    if (formData.quantity <= 0) errs.quantity = 'Quantity must be greater than 0'
    if (formData.unit_price <= 0) errs.unit_price = 'Unit price must be greater than 0'
    
    if (formData.create_new_customer) {
      if (!formData.customer_name.trim()) errs.customer_name = 'Customer name is required'
    }
    
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── API helpers ────────────────────────────────────────────────────────────

  const handleCreateSale = async () => {
    if (!validateSale()) return

    setSubmitting(true)
    try {
      // Get current employee ID from session
      const sessionRes = await window.api.employees.getCurrentSession()
      if (!sessionRes.success || !sessionRes.data?.employee.id) {
        throw new Error('Could not get current user')
      }

      // Create or get customer
      let customerId = formData.customer_id
      if (formData.create_new_customer && formData.customer_name) {
        const customerRes = await window.api.customers.createCustomer({
          name: formData.customer_name,
          phone: formData.customer_phone || undefined,
          email: formData.customer_email || undefined,
          address: formData.customer_address || undefined,
        })
        if (!customerRes.success || !customerRes.data?.id) {
          throw new Error(customerRes.message || 'Failed to create customer')
        }
        customerId = customerRes.data.id
      }

      // Create the sale
      const saleRes = await window.api.sales.createSale({
        issued_by: sessionRes.data.employee.id,
        customer_id: customerId || 1, // Default to walk-in customer if none selected
        stock_purchased_id: formData.stock_purchase_id!,
        quantity: formData.quantity,
        total_price: formData.total_price,
        status: formData.status,
        balance_due: formData.balance_due ? new Date(formData.balance_due).getTime() / 1000 : undefined,
        sold_on: Math.floor(Date.now() / 1000),
        is_debt_sale: formData.is_debt_sale,
        payment: {
          amount_paid: formData.payment.amount_paid,
          payment_date: Math.floor(Date.now() / 1000),
          payment_method: formData.payment.payment_method,
          reference_number: formData.payment.reference_number || undefined,
          description: formData.payment.description || undefined,
          recorded_by: sessionRes.data.employee.id,
        }
      })

      if (!saleRes.success) throw new Error(saleRes.message)

      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to create sale' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    if (layers.length > 1) {
      setLayers(l => l.slice(0, -1))
    } else {
      onClose()
    }
  }

  return (
    <div
      className="fixed top-0 left-64 right-0 bottom-0 z-50 flex items-center justify-center p-4"
      style={{ animation: 'fadeIn 0.15s ease-out' }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md" style={{ height: 'min(92vh, 720px)' }}>

        {/* ── Main Panel ── */}
        {layers.includes('main') && (
          <ModalPanel
            depth={0}
            isTop={currentLayer === 'main'}
            totalDepth={totalDepth}
            title="New Sale"
            icon={
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5 3.5l3 3L17 9M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
            onClose={onClose}
          >
            <SaleForm
              data={formData}
              onChange={setFormData}
              errors={errors}
              onClearError={k => setErrors(e => { const n = { ...e }; delete n[k]; return n })}
              onSelectSku={() => setLayers(l => [...l, 'sku'])}
              onSelectCustomer={() => setLayers(l => [...l, 'customer'])}
              onCreateSale={handleCreateSale}
              submitting={submitting}
            />
          </ModalPanel>
        )}

        {/* ── SKU Selector Panel ── */}
        {layers.includes('sku') && (
          <ModalPanel
            depth={1}
            isTop={currentLayer === 'sku'}
            totalDepth={totalDepth}
            title="Select Product / SKU"
            icon={
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            }
            iconBg="bg-gradient-to-br from-violet-500 to-violet-600"
            onBack={handleBack}
            onClose={onClose}
          >
            <SkuSelector
              onSelect={(stockPurchaseId, skuId, skuName, unitPrice) => {
                setFormData(f => ({
                  ...f,
                  stock_purchase_id: stockPurchaseId,
                  sku_id: skuId,
                  sku_name: skuName,
                  unit_price: unitPrice,
                  total_price: unitPrice * f.quantity + f.shipping_cost,
                }))
                handleBack()
              }}
            />
          </ModalPanel>
        )}

        {/* ── Customer Selector Panel ── */}
        {layers.includes('customer') && (
          <ModalPanel
            depth={1}
            isTop={currentLayer === 'customer'}
            totalDepth={totalDepth}
            title="Select Customer"
            icon={
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
            iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
            onBack={handleBack}
            onClose={onClose}
          >
            <CustomerSelector
              onCreateNew={() => {
                setFormData(f => ({ ...f, create_new_customer: true, customer_id: null }))
                handleBack()
              }}
              onSelect={(customerId, name, phone) => {
                setFormData(f => ({
                  ...f,
                  customer_id: customerId,
                  customer_name: name,
                  customer_phone: phone || '',
                  create_new_customer: false,
                }))
                handleBack()
              }}
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

export default CreateSaleModal