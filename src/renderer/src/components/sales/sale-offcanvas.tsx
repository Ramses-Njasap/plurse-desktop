import React from 'react'
import EditSaleModal from './edit-sale-modal'

// ─── Types ────────────────────────────────────────────────────────────────────

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

type Props = {
  saleId: number | null
  open: boolean
  onClose: () => void
  onUpdated?: () => void
}

type PaymentModalProps = {
  sale: Sale
  onClose: () => void
  onSuccess: () => void
  offcanvasRef: React.RefObject<HTMLDivElement | null>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toTimestamp = (date: number | Date | null | undefined): number | null => {
  if (!date) return null
  return typeof date === 'object' ? date.getTime() / 1000 : date
}

const formatDate = (ts: number | Date | null | undefined) => {
  if (!ts) return '—'
  const timestamp = typeof ts === 'object' ? ts.getTime() / 1000 : ts
  return new Date(timestamp * 1000).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatCurrency = (val: number | null | undefined) => {
  if (val == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'XAF' }).format(val)
}

const statusColor = (status: string, isDeleted: boolean) => {
  if (isDeleted) return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' }
  switch (status) {
    case 'completed': return { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' }
    case 'pending':   return { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-400' }
    case 'cancelled': return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' }
    case 'refunded':  return { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' }
    default:          return { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' }
  }
}

const paymentMethodIcon = (method: PaymentMethod) => {
  switch (method) {
    case 'cash': return '💵'
    case 'card': return '💳'
    case 'transfer': return '🏦'
    case 'mobile_money': return '📱'
    case 'credit': return '📝'
    default: return '💰'
  }
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

const PaymentModal = ({ sale, onClose, onSuccess, offcanvasRef }: PaymentModalProps) => {
  const [amount, setAmount] = React.useState(sale.payment_metrics?.remaining_balance || 0)
  const [method, setMethod] = React.useState<PaymentMethod>('cash')
  const [reference, setReference] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const getStyle = (): React.CSSProperties => {
    if (!offcanvasRef.current) {
      return { 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 70 
      }
    }
    const rect = offcanvasRef.current.getBoundingClientRect()
    return { 
      position: 'fixed', 
      top: rect.top, 
      left: rect.left, 
      width: rect.width, 
      height: rect.height, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 70 
    }
  }

  const handleSubmit = async () => {
    if (amount <= 0) return
    setSubmitting(true)
    try {
      const sessionRes = await window.api.employees.getCurrentSession()
      if (!sessionRes.success || !sessionRes.data?.employee.id) {
        throw new Error('Could not get current user')
      }

      const res = await window.api.sales.createPayment({
        sale_id: sale.id,
        amount_paid: amount,
        payment_date: Math.floor(Date.now() / 1000),
        payment_method: method,
        reference_number: reference || undefined,
        description: description || undefined,
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

  return (
    <div style={getStyle()} onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-sm overflow-hidden"
        style={{ animation: 'scaleIn 0.18s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 bg-blue-50/60">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Add Payment</h3>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Sale #{sale.id} · Remaining: {formatCurrency(sale.payment_metrics?.remaining_balance)}
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Amount *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={sale.payment_metrics?.remaining_balance}
              value={amount}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Method</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reference (optional)</label>
            <input
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="Transaction ID"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || amount <= 0}
            className="w-full mt-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              'Record Payment'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Offcanvas ───────────────────────────────────────────────────────────

const SaleOffcanvas = ({ saleId, open, onClose, onUpdated }: Props) => {
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const [sale, setSale] = React.useState<Sale | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [showPaymentModal, setShowPaymentModal] = React.useState(false)
  const [showEditModal, setShowEditModal] = React.useState(false)

  const normalizeSale = (saleData: any): Sale => {
    // Normalize customer
    const customer = saleData.customer ? {
      id: saleData.customer.id,
      name: saleData.customer.name,
      phone: saleData.customer.phone ?? null,
      email: saleData.customer.email ?? null,
      address: saleData.customer.address ?? null,
      is_active: saleData.customer.is_active,
    } : null

    // Normalize employee
    const employee = saleData.employee ? {
      id: saleData.employee.id,
      name: saleData.employee.name,
      username: saleData.employee.username,
      role: saleData.employee.role,
      email: saleData.employee.email ?? null,
    } : null

    // Normalize stock purchase
    const stock_purchase = saleData.stock_purchase ? {
      id: saleData.stock_purchase.id,
      sku: {
        id: saleData.stock_purchase.sku.id,
        name: saleData.stock_purchase.sku.name,
        code: saleData.stock_purchase.sku.code,
      },
      product: saleData.stock_purchase.product ? {
        id: saleData.stock_purchase.product.id,
        name: saleData.stock_purchase.product.name,
        category_id: saleData.stock_purchase.product.category_id,
      } : null,
      quantity_bought: saleData.stock_purchase.quantity_bought,
      price_per_unit: saleData.stock_purchase.price_per_unit,
      total_cost: saleData.stock_purchase.total_cost,
      shipping_cost: saleData.stock_purchase.shipping_cost ?? null,
      min_selling_price: saleData.stock_purchase.min_selling_price ?? null,
      max_selling_price: saleData.stock_purchase.max_selling_price ?? null,
      batch_number: saleData.stock_purchase.batch_number ?? null,
      purchased_on: saleData.stock_purchase.purchased_on ?? null,
      expiry_date: saleData.stock_purchase.expiry_date ?? null,
    } : null

    // Normalize payments
    const payments = saleData.payments?.map((p: any) => ({
      id: p.id,
      amount_paid: p.amount_paid,
      payment_date: p.payment_date,
      payment_method: p.payment_method as PaymentMethod,
      reference_number: p.reference_number ?? null,
      description: p.description ?? null,
      recorded_by: p.recorded_by ?? null,
      has_been_canceled: p.has_been_canceled,
      reason_for_cancellation: p.reason_for_cancellation ?? null,
      has_been_overwritten: p.has_been_overwritten,
      price_override_reason: p.price_override_reason ?? null,
      override_approved_by: p.override_approved_by ?? null,
    })) || []

    return {
      id: saleData.id,
      sync_id: saleData.sync_id,
      quantity: saleData.quantity,
      total_price: saleData.total_price,
      shipping_cost: saleData.shipping_cost ?? null,
      cost_price_snapshot: saleData.cost_price_snapshot,
      status: saleData.status as 'pending' | 'completed' | 'cancelled' | 'refunded',
      is_debt_sale: saleData.is_debt_sale,
      balance_due: saleData.balance_due ?? null,
      sold_on: saleData.sold_on,
      updated_on: saleData.updated_on,
      has_been_canceled: saleData.has_been_canceled,
      reason_for_cancellation: saleData.reason_for_cancellation ?? null,
      has_been_overwritten: saleData.has_been_overwritten,
      price_override_reason: saleData.price_override_reason ?? null,
      override_approved_by: saleData.override_approved_by ?? null,
      is_deleted: saleData.is_deleted,
      is_sync_required: saleData.is_sync_required,
      customer,
      employee,
      stock_purchase,
      payments,
      profit_margin: saleData.profit_margin,
      payment_metrics: saleData.payment_metrics ? {
        total_paid: saleData.payment_metrics.total_paid,
        remaining_balance: saleData.payment_metrics.remaining_balance,
        payment_count: saleData.payment_metrics.payment_count,
        is_fully_paid: saleData.payment_metrics.is_fully_paid,
        is_overdue: saleData.payment_metrics.is_overdue,
        overdue_days: saleData.payment_metrics.overdue_days ?? null,
      } : {
        total_paid: 0,
        remaining_balance: 0,
        payment_count: 0,
        is_fully_paid: false,
        is_overdue: false,
        overdue_days: null,
      },
    }
  }

  React.useEffect(() => {
    if (!open || !saleId) return
    const load = async () => {
      setLoading(true)
      try {
        const res = await window.api.sales.getSaleById({ 
          id: saleId,
          include_deleted: true
        })
        if (res.success && res.data?.sales?.[0]) {
          setSale(normalizeSale(res.data.sales[0]))
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, saleId])

  if (!open) return null

  const status = sale ? statusColor(sale.status, sale.is_deleted) : { bg: '', text: '', dot: '' }

  const handleEditSuccess = () => {
    setShowEditModal(false)
    // Reload sale data
    if (sale) {
      window.api.sales.getSaleById({ id: sale.id }).then(res => {
        if (res.success && res.data?.sales?.[0]) {
          setSale(normalizeSale(res.data.sales[0]))
        }
      })
    }
    if (onUpdated) onUpdated()
  }

  return (
    <>
      <div
        className={`fixed top-0 left-64 right-0 bottom-0 z-40 bg-black/25 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={`fixed top-0 right-0 z-50 h-full bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: 'min(520px, 100vw)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5 3.5l3 3L17 9M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Sale Details</h2>
              {sale && <p className="text-xs text-gray-500">#{String(sale.id).padStart(4, '0')}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sale && !sale.is_deleted && sale.is_debt_sale && !sale.payment_metrics?.is_fully_paid && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Payment
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Loading sale…</span>
              </div>
            </div>
          ) : !sale ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">Sale not found</div>
          ) : (
            <>
              {/* Hero section */}
              <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-gray-50/80 to-white">
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-gray-200 shadow-sm bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">
                        {sale.stock_purchase?.product?.name?.charAt(0) || sale.stock_purchase?.sku.name?.charAt(0) || 'S'}
                      </span>
                    </div>
                    {sale.is_deleted && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 break-words">
                      {sale.stock_purchase?.product?.name || sale.stock_purchase?.sku.name || 'Unknown Product'}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${status.bg} ${status.text}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {sale.is_deleted ? 'Cancelled' : sale.status}
                      </span>
                      {sale.is_debt_sale && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                          sale.payment_metrics?.is_overdue 
                            ? 'bg-red-100 text-red-700 border-red-200' 
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${sale.payment_metrics?.is_overdue ? 'bg-red-500' : 'bg-amber-400'}`} />
                          {sale.payment_metrics?.is_overdue ? 'Overdue' : 'Debt Sale'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      SKU: <span className="font-mono font-medium">{sale.stock_purchase?.sku.code}</span>
                      {sale.stock_purchase?.batch_number && ` · Batch: ${sale.stock_purchase.batch_number}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="px-5 py-4 grid grid-cols-4 gap-3 border-b border-gray-100">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-blue-700">{sale.quantity}</div>
                  <div className="text-xs text-blue-600 mt-0.5">Qty</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <div className="text-sm font-bold text-emerald-700">{formatCurrency(sale.total_price)}</div>
                  <div className="text-xs text-emerald-600 mt-0.5">Total</div>
                </div>
                <div className="bg-violet-50 rounded-xl p-3 text-center">
                  <div className="text-sm font-bold text-violet-700">{`${(sale.profit_margin * 100).toFixed(1)}%`}</div>
                  <div className="text-xs text-violet-600 mt-0.5">Margin</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <div className="text-sm font-bold text-amber-700">{formatCurrency(sale.total_price - (sale.cost_price_snapshot * sale.quantity))}</div>
                  <div className="text-xs text-amber-600 mt-0.5">Profit</div>
                </div>
              </div>

              {/* Customer info */}
              <div className="px-5 py-4 border-b border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Customer</h4>
                {sale.customer ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">{sale.customer.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{sale.customer.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        {sale.customer.phone && <span>{sale.customer.phone}</span>}
                        {sale.customer.email && <span>· {sale.customer.email}</span>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Walk-in Customer</p>
                )}
              </div>

              {/* Employee and dates */}
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Sold by</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{sale.employee?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{sale.employee?.role}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Date</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{formatDate(sale.sold_on)}</p>
                    {(() => {
                      const soldOn = toTimestamp(sale.sold_on)
                      const updatedOn = toTimestamp(sale.updated_on)
                      return soldOn !== updatedOn && (
                        <p className="text-xs text-gray-500">Updated {formatDate(sale.updated_on)}</p>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {/* Payment summary */}
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payments</h4>
                  {sale.payment_metrics && (
                    <span className={`text-xs font-medium ${sale.payment_metrics.is_fully_paid ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {sale.payment_metrics.is_fully_paid ? 'Fully Paid' : `${formatCurrency(sale.payment_metrics.remaining_balance)} remaining`}
                    </span>
                  )}
                </div>
                
                {sale.payments && sale.payments.length > 0 ? (
                  <div className="space-y-2">
                    {sale.payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{paymentMethodIcon(p.payment_method)}</span>
                          <div>
                            <p className="text-xs font-medium text-gray-800">{p.payment_method}</p>
                            <p className="text-xs text-gray-400">{formatDate(p.payment_date)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(p.amount_paid)}</p>
                          {p.reference_number && (
                            <p className="text-xs text-gray-400">Ref: {p.reference_number}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-3">No payments recorded</p>
                )}
              </div>

              {/* Cancellation info */}
              {sale.reason_for_cancellation && (
                <div className="mx-5 mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-semibold text-red-800">Sale Cancelled</h4>
                      <p className="text-xs text-red-600 mt-1">{sale.reason_for_cancellation}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!sale.is_deleted && (
                <div className="px-5 py-4 flex gap-3">
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Sale
                  </button>
                </div>
              )}

              <div className="h-6" />
            </>
          )}
        </div>
      </div>

      {showPaymentModal && sale && (
        <PaymentModal
          sale={sale}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            onUpdated?.()
            // Reload sale data
            window.api.sales.getSaleById({ id: sale.id }).then(res => {
              if (res.success && res.data?.sales?.[0]) {
                setSale(normalizeSale(res.data.sales[0]))
              }
            })
          }}
          offcanvasRef={panelRef}
        />
      )}

      {showEditModal && sale && (
        <EditSaleModal
          sale={sale}
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      <style>{`@keyframes scaleIn { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }`}</style>
    </>
  )
}

export default SaleOffcanvas