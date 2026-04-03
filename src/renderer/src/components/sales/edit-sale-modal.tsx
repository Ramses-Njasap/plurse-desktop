import { useState } from 'react'

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mobile_money' | 'credit' | 'other'

type Sale = {
  id: number
  sync_id: string | null
  quantity: number
  total_price: number
  shipping_cost: number | null
  cost_price_snapshot: number
  status: 'pending' | 'completed' | 'cancelled' | 'refunded'
  is_debt_sale: boolean
  balance_due: number | null
  sold_on: number | Date
  updated_on: number | Date
  has_been_canceled: boolean
  reason_for_cancellation: string | null
  has_been_overwritten: boolean
  price_override_reason: string | null
  override_approved_by: number | null
  is_deleted: boolean
  is_sync_required: boolean
  
  customer: {
    id: number
    name: string
    phone: string | null
    email: string | null
    address: string | null
    is_active: boolean
  } | null
  
  employee: {
    id: number
    name: string
    username: string
    role: string
    email: string | null
  } | null
  
  stock_purchase?: {
    id: number
    sku: {
      id: number
      name: string
      code: string
    }
    product: {
      id: number
      name: string
      category_id: number
    } | null
    quantity_bought: number
    price_per_unit: number
    total_cost: number
    shipping_cost: number | null
    min_selling_price: number | null
    max_selling_price: number | null
    batch_number: string | null
    purchased_on: number | null
    expiry_date: string | null
  } | null
  
  payments: Array<{
    id: number
    amount_paid: number
    payment_date: number
    payment_method: PaymentMethod
    reference_number: string | null
    description: string | null
    recorded_by: number | null
    has_been_canceled: boolean
    reason_for_cancellation: string | null
    has_been_overwritten: boolean
    price_override_reason: string | null
    override_approved_by: number | null
  }>
  
  profit_margin: number
  
  payment_metrics: {
    total_paid: number
    remaining_balance: number
    payment_count: number
    is_fully_paid: boolean
    is_overdue: boolean
    overdue_days: number | null
  }
}

interface Props {
  sale: Sale
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

type EditFormData = {
  quantity: number
  total_price: number
  shipping_cost: number
  status: 'pending' | 'completed' | 'cancelled' | 'refunded'
  is_debt_sale: boolean
  balance_due: string | null
}

const EditSaleModal = ({ sale, open, onClose, onSuccess }: Props) => {
  const [form, setForm] = useState<EditFormData>({
    quantity: sale.quantity,
    total_price: sale.total_price,
    shipping_cost: sale.shipping_cost || 0,
    status: sale.status,
    is_debt_sale: sale.is_debt_sale,
    balance_due: sale.balance_due ? new Date(sale.balance_due * 1000).toISOString().split('T')[0] : null,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const set = (patch: Partial<EditFormData>) => {
    setForm(f => ({ ...f, ...patch }))
    // Clear errors for changed fields
    Object.keys(patch).forEach(key => {
      if (errors[key]) {
        setErrors(prev => {
          const next = { ...prev }
          delete next[key]
          return next
        })
      }
    })
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (form.quantity <= 0) errs.quantity = 'Quantity must be greater than 0'
    if (form.total_price <= 0) errs.total_price = 'Total price must be greater than 0'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await window.api.sales.updateSale({
        id: sale.id,
        action: 'overwrite',
        updates: {
          quantity: form.quantity,
          total_price: form.total_price,
          status: form.status,
          is_debt_sale: form.is_debt_sale,
          balance_due: form.balance_due ? new Date(form.balance_due).getTime() / 1000 : null,
        },
        overwrite_reason: 'Manual edit',
      })

      if (!res.success) throw new Error(res.message)
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const productName = sale.stock_purchase?.product?.name || sale.stock_purchase?.sku.name || 'Unknown Product'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ animation: 'fadeIn 0.15s ease-out' }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ animation: 'scaleIn 0.15s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Edit Sale</h2>
              <p className="text-xs text-gray-500">#{String(sale.id).padStart(4, '0')} · {productName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 max-h-[70vh] overflow-y-auto">
          <div className="space-y-5">
            {/* Customer Info (Read-only) */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-600 font-medium">Customer</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{sale.customer?.name || 'Walk-in Customer'}</p>
              {sale.customer?.phone && (
                <p className="text-xs text-gray-600 mt-0.5">{sale.customer.phone}</p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={e => set({ quantity: parseInt(e.target.value) || 1 })}
                className={`w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${
                  errors.quantity ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'
                }`}
              />
              {errors.quantity && <p className="text-xs text-red-600 mt-1">{errors.quantity}</p>}
            </div>

            {/* Total Price */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Total Price <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.total_price}
                  onChange={e => set({ total_price: parseFloat(e.target.value) || 0 })}
                  className={`w-full pl-8 pr-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${
                    errors.total_price ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'
                  }`}
                />
              </div>
              {errors.total_price && <p className="text-xs text-red-600 mt-1">{errors.total_price}</p>}
            </div>

            {/* Shipping Cost */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Shipping Cost
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.shipping_cost}
                  onChange={e => set({ shipping_cost: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['pending', 'completed', 'cancelled', 'refunded'] as const).map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => set({ status })}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                      form.status === status
                        ? status === 'completed' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' :
                          status === 'pending' ? 'bg-amber-50 border-amber-300 text-amber-700' :
                          status === 'cancelled' ? 'bg-red-50 border-red-300 text-red-700' :
                          'bg-gray-100 border-gray-300 text-gray-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Debt Sale Toggle */}
            <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="text-sm font-semibold text-gray-700">Debt Sale</p>
                <p className="text-xs text-gray-500">Customer will pay later</p>
              </div>
              <button
                type="button"
                onClick={() => set({ is_debt_sale: !form.is_debt_sale })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  form.is_debt_sale ? 'bg-amber-500' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                  form.is_debt_sale ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Due Date (if debt sale) */}
            {form.is_debt_sale && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={form.balance_due || ''}
                  onChange={e => set({ balance_due: e.target.value || null })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            )}

            {/* Payment Summary (Read-only) */}
            {sale.payments.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 mb-2">Payment Summary</p>
                <p className="text-sm text-gray-700">
                  Paid: ${sale.payment_metrics.total_paid.toFixed(2)} · 
                  Remaining: ${sale.payment_metrics.remaining_balance.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {sale.payments.length} payment{sale.payments.length > 1 ? 's' : ''} recorded
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow flex items-center gap-2"
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
                Save Changes
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

export default EditSaleModal