import { useState } from 'react'
import ProductImage from '../products/product-image'
import EditSaleModal from './edit-sale-modal'

// ─── Types ────────────────────────────────────────────────────────────────────

type SaleStatus = 'pending' | 'completed' | 'cancelled' | 'refunded'
type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mobile_money' | 'credit' | 'other'

type Sale = {
  id: number
  sync_id: string | null
  quantity: number
  total_price: number
  shipping_cost: number | null
  cost_price_snapshot: number
  status: SaleStatus
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
  
  stock_purchase: {
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
  
  performance_metrics: {
    days_since_sale: number
    expected_profit: number
    expected_margin: number
    profit_variance: number
    profit_variance_percentage: number
    performance_vs_expected: 'above' | 'within' | 'below'
  }
  
  override_info: {
    reason: string | null
    approved_by: number | null
  } | null
}

type Props = {
  sale: Sale
  expanded: boolean
  onToggle: () => void
  onCancel: (id: number, reason: string) => void
  onRestore: (id: number) => void
  onEdit: (id: number) => void
  onPayment: (id: number) => void
  onUpdated?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toTimestamp = (date: number | Date | null | undefined): number | null => {
  if (!date) return null
  return typeof date === 'object' ? date.getTime() / 1000 : date
}

const fmt = (val: number | null | undefined) => {
  if (val == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(val)
}

const fmtPct = (val: number | null | undefined) => {
  if (val == null) return '—'
  return `${(val * 100).toFixed(1)}%`
}

const fmtDate = (ts: number | Date | null | undefined) => {
  if (!ts) return '—'
  const timestamp = typeof ts === 'object' ? ts.getTime() / 1000 : ts
  return new Date(timestamp * 1000).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

const statusColor = (status: SaleStatus, isDeleted: boolean) => {
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

// ─── Sub-components ───────────────────────────────────────────────────────────

const Bar = ({ value, good = false }: { value: number; good?: boolean }) => (
  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
    <div
      className={`h-full rounded-full ${good ? 'bg-emerald-500' : 'bg-blue-500'}`}
      style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
    />
  </div>
)

const Stat = ({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-400">{label}</span>
    <span className={`text-xs font-semibold ${highlight ? 'text-blue-600' : 'text-gray-900'}`}>{value}</span>
  </div>
)

// ─── Component ────────────────────────────────────────────────────────────────

const SaleCard = ({ sale, expanded, onToggle, onCancel, onRestore, onEdit, onPayment, onUpdated }: Props) => {
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  
  const isDeleted = sale.is_deleted || sale.has_been_canceled
  const status = statusColor(sale.status, isDeleted)
  const profitColor = sale.profit_margin < 0 ? 'text-red-500' : sale.performance_metrics?.performance_vs_expected === 'above' ? 'text-emerald-600' : 'text-gray-900'
  const productName = sale.stock_purchase?.product?.name ?? sale.stock_purchase?.sku.name ?? 'Unknown Product'
  const customerName = sale.customer?.name ?? 'Walk-in Customer'

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowEditModal(true)
  }

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowCancelModal(true)
  }

  const handleCancelConfirm = () => {
    if (cancelReason.trim()) {
      onCancel(sale.id, cancelReason)
      setShowCancelModal(false)
      setCancelReason('')
    }
  }

  const handleEditSuccess = () => {
    setShowEditModal(false)
    if (onUpdated) onUpdated()
    if (onEdit) onEdit(sale.id)
  }

  return (
    <>
      <div className={`group border-b border-gray-100 last:border-0 transition-colors duration-150 ${expanded ? 'bg-gray-50/80' : 'hover:bg-gray-50/50'}`}>

        {/* ── Collapsed Row ─────────────────────────────────────────────────── */}
        <div
          className="grid grid-cols-12 items-center gap-4 px-5 py-3 cursor-pointer select-none"
          onClick={onToggle}
        >
          {/* Product */}
          <div className="col-span-3 min-w-0 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg overflow-hidden border flex-shrink-0 ${expanded ? 'border-blue-200' : 'border-gray-200'}`}>
              {sale.stock_purchase?.sku?.id ? (
                <ProductImage 
                  images={[]} 
                  productName={productName} 
                  size="sm" 
                  isDeleted={isDeleted}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">?</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold truncate leading-tight ${isDeleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {productName}
              </p>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {sale.stock_purchase?.sku.code ?? `#${String(sale.id).padStart(4, '0')}`}
              </p>
            </div>
          </div>

          {/* Customer */}
          <div className="col-span-2 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">{customerName}</p>
            {sale.customer?.phone && (
              <p className="text-xs text-gray-400 truncate">{sale.customer.phone}</p>
            )}
          </div>

          {/* Quantity */}
          <div className="col-span-1">
            <span className="text-sm font-semibold text-gray-900">{sale.quantity}</span>
          </div>

          {/* Price */}
          <div className="col-span-1">
            <span className="text-sm font-semibold text-gray-900">{fmt(sale.total_price)}</span>
          </div>

          {/* Margin */}
          <div className="col-span-1">
            <span className={`text-sm font-semibold ${profitColor}`}>
              {fmtPct(sale.profit_margin)}
            </span>
          </div>

          {/* Status */}
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {sale.is_deleted ? 'Cancelled' : sale.status}
              </span>
              {sale.is_debt_sale && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                  sale.payment_metrics?.is_overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {sale.payment_metrics?.is_overdue ? '⚠️ Overdue' : '💳 Debt'}
                </span>
              )}
            </div>
          </div>

          {/* Payment summary */}
          <div className="col-span-1">
            <div className="flex items-center gap-1">
              {sale.payments?.slice(0, 2).map(p => (
                <span key={p.id} className="text-xs" title={`${p.payment_method}: ${fmt(p.amount_paid)}`}>
                  {paymentMethodIcon(p.payment_method)}
                </span>
              ))}
              {(sale.payments?.length ?? 0) > 2 && (
                <span className="text-xs text-gray-400">+{sale.payments!.length - 2}</span>
              )}
            </div>
            {sale.payment_metrics && !sale.payment_metrics.is_fully_paid && (
              <p className="text-xs text-amber-600 mt-0.5">
                {fmt(sale.payment_metrics.remaining_balance)} due
              </p>
            )}
          </div>

          {/* Chevron */}
          <div className="col-span-1 flex justify-end">
            <svg className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180 text-blue-500' : 'text-gray-300 group-hover:text-gray-500'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* ── Expanded Panel ─────────────────────────────────────────────────── */}
        {expanded && (
          <div className="flex border-t border-gray-100" onClick={e => e.stopPropagation()}>

            {/* LEFT: Details */}
            <div className="flex-1 min-w-0 px-5 py-4 space-y-5 overflow-hidden">

              {/* Performance flags */}
              {(sale.performance_metrics?.performance_vs_expected !== 'within' || sale.profit_margin > 0.3 || sale.profit_margin < 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {sale.performance_metrics?.performance_vs_expected === 'above' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-xs font-medium border border-emerald-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      Above Expected
                    </span>
                  )}
                  {sale.performance_metrics?.performance_vs_expected === 'below' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-xs font-medium border border-red-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      </svg>
                      Below Expected
                    </span>
                  )}
                  {sale.profit_margin > 0.3 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      High Margin
                    </span>
                  )}
                  {sale.profit_margin < 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-red-200 text-red-500 text-xs font-medium">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Loss Making
                    </span>
                  )}
                  {sale.is_debt_sale && sale.payment_metrics?.is_overdue && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-xs font-medium border border-red-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Overdue by {sale.payment_metrics.overdue_days}d
                    </span>
                  )}
                </div>
              )}

              {/* Stats — two columns */}
              <div className="grid grid-cols-2 gap-x-8">
                {/* Sale Details */}
                <div>
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-2">Sale Details</p>
                  <Stat label="Date" value={fmtDate(sale.sold_on)} />
                  <Stat label="Sold by" value={sale.employee?.name ?? 'Unknown'} />
                  <Stat label="Quantity" value={sale.quantity.toString()} />
                  <Stat label="Unit Price" value={fmt(sale.total_price / sale.quantity)} />
                  {sale.shipping_cost ? (
                    <Stat label="Shipping" value={fmt(sale.shipping_cost)} />
                  ) : null}
                  <Stat label="Total" value={fmt(sale.total_price)} highlight />
                </div>

                {/* Financials */}
                <div>
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-2">Financials</p>
                  <Stat label="Cost of Goods" value={fmt(sale.cost_price_snapshot * sale.quantity)} />
                  <Stat label="Gross Profit" value={fmt(sale.total_price - (sale.cost_price_snapshot * sale.quantity))} />
                  <Stat label="Margin" value={fmtPct(sale.profit_margin)} />
                  {sale.performance_metrics && (
                    <>
                      <Stat label="Expected Margin" value={fmtPct(sale.performance_metrics.expected_margin)} />
                      <Stat 
                        label="Variance" 
                        value={`${sale.performance_metrics.profit_variance_percentage > 0 ? '+' : ''}${sale.performance_metrics.profit_variance_percentage.toFixed(1)}%`}
                        highlight={sale.performance_metrics.profit_variance_percentage > 0}
                      />
                    </>
                  )}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Margin vs expected</span>
                      <span className={`font-medium ${profitColor}`}>
                        {sale.performance_metrics?.performance_vs_expected === 'above' ? 'Above' :
                         sale.performance_metrics?.performance_vs_expected === 'below' ? 'Below' : 'Within'}
                      </span>
                    </div>
                    <Bar 
                      value={Math.min(1, Math.max(0, (sale.profit_margin + 0.5) / 1.5))} 
                      good={sale.profit_margin > 0.2}
                    />
                  </div>
                </div>
              </div>

              {/* Payments section */}
              {sale.payments && sale.payments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-2">
                    Payments · {sale.payment_metrics?.payment_count ?? sale.payments.length} / {sale.payment_metrics?.is_fully_paid ? 'Paid' : `${fmt(sale.payment_metrics?.remaining_balance ?? 0)} remaining`}
                  </p>
                  <div className="space-y-1.5">
                    {sale.payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{paymentMethodIcon(p.payment_method)}</span>
                          <div>
                            <p className="text-xs font-medium text-gray-800">{p.payment_method}</p>
                            <p className="text-xs text-gray-400">{fmtDate(p.payment_date)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{fmt(p.amount_paid)}</p>
                          {p.reference_number && (
                            <p className="text-xs text-gray-400">Ref: {p.reference_number}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Batch info */}
              {sale.stock_purchase?.batch_number && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <span className="text-xs text-gray-600">Batch: <span className="font-mono font-medium">{sale.stock_purchase.batch_number}</span></span>
                </div>
              )}
            </div>

            {/* RIGHT: Action sidebar — always fully visible */}
            <div className="w-36 flex-shrink-0 border-l border-gray-100 flex flex-col py-4 px-3">

              {!isDeleted ? (
                <>
                  {/* Primary - Edit */}
                  {/* <button
                    onClick={handleEditClick}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button> */}

                  {/* Secondary - Add Payment (if debt and not fully paid) */}
                  {sale.is_debt_sale && !sale.payment_metrics?.is_fully_paid && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onPayment(sale.id); }}
                      className="flex items-center gap-2 w-full px-3 py-2 mt-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Payment
                    </button>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Destructive — Cancel */}
                  <button
                    onClick={handleCancelClick}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 text-xs font-semibold transition-all"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel Sale
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRestore(sale.id); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-semibold transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Restore
                  </button>
                  <div className="flex-1" />
                  <p className="text-xs text-gray-300 text-center leading-relaxed">This sale is cancelled</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
          onClick={() => setShowCancelModal(false)}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowCancelModal(false)} />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            style={{ animation: 'scaleIn 0.15s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 bg-red-50">
              <h3 className="text-sm font-bold text-gray-900">Cancel Sale</h3>
              <p className="text-xs text-gray-500 mt-1">Sale #{sale.id}</p>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 mb-4">Are you sure you want to cancel this sale? This action can be undone later.</p>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Reason for cancellation</label>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="e.g. Customer returned item, Wrong product, etc."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCancelConfirm}
                  disabled={!cancelReason.trim()}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <EditSaleModal
          sale={sale}
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </>
  )
}

export default SaleCard