// src/components/public/sales-point/sales-history-modal.tsx

import { formatCurrency, formatDateTime, formatPercent } from '@renderer/components/public/types/utils'
import React, { useEffect, useState } from 'react'

// ============================================================================
// Types
// ============================================================================

interface Sale {
  id: number
  sync_id: string | null
  quantity: number
  total_price: number
  shipping_cost: number | null
  cost_price_snapshot: number
  status: 'pending' | 'completed' | 'cancelled' | 'refunded'
  is_debt_sale: boolean
  balance_due: number | null
  sold_on: number
  updated_on: number
  has_been_canceled: boolean
  reason_for_cancellation: string | null
  has_been_overwritten: boolean
  price_override_reason: string | null
  override_approved_by: number | null
  is_deleted: boolean
  is_sync_required: boolean
  
  // Nested relations
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
      name?: string
      code?: string
    }
    product?: {
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
    payment_method: string
    reference_number: string | null
    description: string | null
    recorded_by: number | null
    has_been_canceled: boolean
    reason_for_cancellation: string | null
    has_been_overwritten: boolean
    price_override_reason: string | null
    override_approved_by: number | null
  }>
  
  // Core metrics
  profit_margin: number
  
  // Payment metrics
  payment_metrics: {
    total_paid: number
    remaining_balance: number
    payment_count: number
    is_fully_paid: boolean
    is_overdue: boolean
    overdue_days: number | null
  }
  
  // Performance metrics
  performance_metrics: {
    days_since_sale: number
    expected_profit: number
    expected_margin: number
    profit_variance: number
    profit_variance_percentage: number
    performance_vs_expected: 'above' | 'within' | 'below'
  }
}

interface Payment {
  id: number
  sale_id: number
  amount_paid: number
  payment_date: number
  payment_method: string
  reference_number: string | null
  description: string | null
  recorded_by: number | null
  has_been_canceled: boolean
  reason_for_cancellation: string | null
  has_been_overwritten: boolean
  price_override_reason: string | null
  override_approved_by: number | null
  created_on: number
  is_deleted: boolean
  
  // Optional nested data
  recorded_by_employee?: {
    id: number
    name: string
    role: string
  } | null
}

interface SaleFilters {
  search: string
  status: 'all' | 'pending' | 'completed' | 'cancelled' | 'refunded'
  paymentStatus: 'all' | 'paid' | 'partial' | 'unpaid' | 'overdue'
  debtStatus: 'all' | 'debt' | 'non-debt'
  datePreset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year' | 'custom' | 'all'
  dateFrom: string
  dateTo: string
  minAmount: string
  maxAmount: string
  customerId: number | null
  employeeId: number | null
  paymentMethod: string | 'all'
  isDebtOnly: boolean
  sortBy: 'sold_on' | 'total_price' | 'profit_margin' | 'customer_name'
  sortOrder: 'asc' | 'desc'
}

interface FilteredStats {
  total_sales: number
  total_revenue: number
  total_profit: number
  avg_margin: number
  total_quantity: number
  debt_total: number
  paid_total: number
  outstanding_total: number
  count: number
}

// ============================================================================
// Payment Modal
// ============================================================================

interface AddPaymentModalProps {
  saleId: number
  onClose: () => void
  onSuccess: () => void
}

const AddPaymentModal: React.FC<AddPaymentModalProps> = ({ saleId, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [description, setDescription] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const PAYMENT_METHODS = [
    { method: 'cash', label: 'Cash', icon: '💵' },
    { method: 'mobile money', label: 'Mobile Money', icon: '📱' },
    { method: 'bank transfer', label: 'Bank Transfer', icon: '🏦' },
    { method: 'credit card', label: 'Credit Card', icon: '💳' },
    { method: 'debit card', label: 'Debit Card', icon: '💳' },
    { method: 'check', label: 'Check', icon: '📝' },
    { method: 'in kind', label: 'In Kind', icon: '🤝' },
    { method: 'other', label: 'Other', icon: '💱' },
  ]

  // In AddPaymentModal component, update handleSubmit:

const handleSubmit = async () => {
  if (!amount || parseFloat(amount) <= 0) {
    setError('Please enter a valid amount')
    return
  }

  setSubmitting(true)
  setError('')

  try {
    const sessionRes = await window.api.employees.getCurrentSession()
    if (!sessionRes.success || !sessionRes.data) {
      setError('No active session')
      setSubmitting(false)
      return
    }

    const result = await window.api.sales.createPayment({
      sale_id: saleId,
      amount_paid: parseFloat(amount),
      payment_date: Math.floor(new Date(paymentDate).getTime() / 1000),
      payment_method: paymentMethod as any,
      reference_number: referenceNumber || undefined,
      description: description || undefined
    })

    if (result.success) {
      // Call onSuccess first
      await onSuccess()
      // Then close
      onClose()
    } else {
      setError(result.message || 'Failed to create payment')
    }
  } catch (e: any) {
    setError(e?.message || 'Unexpected error')
  } finally {
    setSubmitting(false)
  }
}

  const needsReference = ['bank transfer', 'mobile money', 'check', 'credit card', 'debit card'].includes(paymentMethod)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Add Payment</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">XAF</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-16 pr-4 py-3 text-lg font-bold border-2 border-slate-200 rounded-xl
                  focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((pm) => (
                <button
                  key={pm.method}
                  onClick={() => setPaymentMethod(pm.method)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                    paymentMethod === pm.method
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                  title={pm.label}
                >
                  <span className="text-lg">{pm.icon}</span>
                  <span className="text-[10px] font-semibold truncate max-w-full">{pm.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reference */}
          {needsReference && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Reference Number
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Transaction ID / Reference"
                className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl
                  focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          {/* Payment Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Payment Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl
                focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Payment notes..."
              rows={2}
              className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl resize-none
                focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-semibold text-slate-600 border-2 border-slate-200 rounded-xl
                hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !amount}
              className="flex-1 py-3 text-sm font-bold bg-blue-600 text-white rounded-xl
                hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Processing...' : 'Add Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Edit Sale Modal
// ============================================================================

interface EditSaleModalProps {
  sale: Sale
  onClose: () => void
  onUpdated: () => void
}

const EditSaleModal: React.FC<EditSaleModalProps> = ({ sale, onClose, onUpdated }) => {
  const [status, setStatus] = useState(sale.status)
  const [isDebtSale, setIsDebtSale] = useState(sale.is_debt_sale)
  const [balanceDue, setBalanceDue] = useState(sale.balance_due ? new Date(sale.balance_due * 1000).toISOString().split('T')[0] : '')
  const [overrideReason, setOverrideReason] = useState(sale.price_override_reason || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')

    try {
      const updates: any = {
        status,
        is_debt_sale: isDebtSale,
      }

      if (isDebtSale && balanceDue) {
        updates.balance_due = Math.floor(new Date(balanceDue).getTime() / 1000)
      }

      if (overrideReason) {
        updates.price_override_reason = overrideReason
        updates.has_been_overwritten = true
      }

      const result = await window.api.sales.updateSale({
        id: sale.id,
        action: 'overwrite',
        updates,
        overwrite_reason: overrideReason || 'Updated via sales history'
      })

      if (result.success) {
        onUpdated()
        onClose()
      } else {
        setError(result.message || 'Failed to update sale')
      }
    } catch (e: any) {
      setError(e?.message || 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this sale? This action cannot be undone.')) return

    setSubmitting(true)
    setError('')

    try {
      const result = await window.api.sales.updateSale({
        id: sale.id,
        action: 'cancel',
        reason: 'Cancelled by user'
      })

      if (result.success) {
        onUpdated()
        onClose()
      } else {
        setError(result.message || 'Failed to cancel sale')
      }
    } catch (e: any) {
      setError(e?.message || 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Edit Sale #{sale.id}</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl
                focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Debt Sale Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Debt Sale
              </label>
              <p className="text-xs text-slate-400 mt-1">Mark as debt sale</p>
            </div>
            <button
              onClick={() => setIsDebtSale(!isDebtSale)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isDebtSale ? 'bg-blue-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  isDebtSale ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          {/* Balance Due Date */}
          {isDebtSale && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Balance Due Date
              </label>
              <input
                type="date"
                value={balanceDue}
                onChange={(e) => setBalanceDue(e.target.value)}
                className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl
                  focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          {/* Override Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Override Reason <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Reason for price override..."
              rows={2}
              className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl resize-none
                focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="px-4 py-3 text-sm font-semibold text-red-600 border-2 border-red-200 rounded-xl
                hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Cancel Sale
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-semibold text-slate-600 border-2 border-slate-200 rounded-xl
                hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 text-sm font-bold bg-blue-600 text-white rounded-xl
                hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Edit Payment Modal
// ============================================================================

interface EditPaymentModalProps {
  payment: Payment
  onClose: () => void
  onUpdated: () => void
}

const EditPaymentModal: React.FC<EditPaymentModalProps> = ({ payment, onClose, onUpdated }) => {
  const [amount, setAmount] = useState(payment.amount_paid.toString())
  const [paymentMethod, setPaymentMethod] = useState(payment.payment_method)
  const [referenceNumber, setReferenceNumber] = useState(payment.reference_number || '')
  const [description, setDescription] = useState(payment.description || '')
  const [paymentDate, setPaymentDate] = useState(new Date(payment.payment_date * 1000).toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const PAYMENT_METHODS = [
    { method: 'cash', label: 'Cash', icon: '💵' },
    { method: 'mobile money', label: 'Mobile Money', icon: '📱' },
    { method: 'bank transfer', label: 'Bank Transfer', icon: '🏦' },
    { method: 'credit card', label: 'Credit Card', icon: '💳' },
    { method: 'debit card', label: 'Debit Card', icon: '💳' },
    { method: 'check', label: 'Check', icon: '📝' },
    { method: 'in kind', label: 'In Kind', icon: '🤝' },
    { method: 'other', label: 'Other', icon: '💱' },
  ]

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const result = await window.api.sales.updatePayment({
        id: payment.id,
        amount_paid: parseFloat(amount),
        payment_date: Math.floor(new Date(paymentDate).getTime() / 1000),
        payment_method: paymentMethod as any,
        reference_number: referenceNumber || undefined,
        description: description || undefined
      })

      if (result.success) {
        onUpdated()
        onClose()
      } else {
        setError(result.message || 'Failed to update payment')
      }
    } catch (e: any) {
      setError(e?.message || 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this payment?')) return

    setSubmitting(true)
    setError('')

    try {
      const result = await window.api.sales.cancelPayment({
        id: payment.id,
        reason: 'Cancelled by user'
      })

      if (result.success) {
        onUpdated()
        onClose()
      } else {
        setError(result.message || 'Failed to cancel payment')
      }
    } catch (e: any) {
      setError(e?.message || 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  const needsReference = ['bank transfer', 'mobile money', 'check', 'credit card', 'debit card'].includes(paymentMethod)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Edit Payment</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">XAF</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-16 pr-4 py-3 text-lg font-bold border-2 border-slate-200 rounded-xl
                  focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((pm) => (
                <button
                  key={pm.method}
                  onClick={() => setPaymentMethod(pm.method)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                    paymentMethod === pm.method
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <span className="text-lg">{pm.icon}</span>
                  <span className="text-[10px] font-semibold">{pm.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reference */}
          {needsReference && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Reference Number
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl
                  focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          {/* Payment Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Payment Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl
                focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl resize-none
                focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="px-4 py-3 text-sm font-semibold text-red-600 border-2 border-red-200 rounded-xl
                hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Cancel Payment
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-semibold text-slate-600 border-2 border-slate-200 rounded-xl
                hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 text-sm font-bold bg-blue-600 text-white rounded-xl
                hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Sale Details Modal
// ============================================================================

interface SaleDetailsModalProps {
  sale: Sale
  onClose: () => void
  onEdit: () => void
  onAddPayment: () => void
  onPaymentUpdated: () => void
}

const SaleDetailsModal: React.FC<SaleDetailsModalProps> = ({ 
  sale, 
  onClose, 
  onEdit,
  onAddPayment,
  onPaymentUpdated 
}) => {
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(false)
  const [payments, setPayments] = useState<Payment[]>([])

  const loadPayments = async () => {
    setLoading(true)
    try {
      const result = await window.api.sales.getPaymentsBySaleId({ sale_id: sale.id })
      if (result.success && result.data) {
        // Properly map the payment data
        const mappedPayments = result.data.payments.map(p => ({
          id: p.id,
          sale_id: p.sale_id,
          amount_paid: p.amount_paid,
          payment_date: p.payment_date,
          payment_method: p.payment_method,
          reference_number: p.reference_number,
          description: p.description,
          recorded_by: p.recorded_by,
          has_been_canceled: p.has_been_canceled,
          reason_for_cancellation: p.reason_for_cancellation,
          has_been_overwritten: p.has_been_overwritten,
          price_override_reason: p.price_override_reason,
          override_approved_by: p.override_approved_by,
          created_on: p.created_on,
          is_deleted: p.is_deleted,
          recorded_by_employee: p.recorded_by_employee
        }))
        setPayments(mappedPayments)
      }
    } catch (error) {
      console.error('Failed to load payments:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate totals from actual payments
  const totalPaid = payments.reduce((sum, p) => sum + p.amount_paid, 0)
  const remainingBalance = sale.total_price - totalPaid

  // Call loadPayments when sale changes
  useEffect(() => {
    loadPayments()
  }, [sale.id])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700'
      case 'pending': return 'bg-amber-100 text-amber-700'
      case 'cancelled': return 'bg-red-100 text-red-700'
      case 'refunded': return 'bg-purple-100 text-purple-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  const getPaymentMethodIcon = (method: string) => {
    const icons: Record<string, string> = {
      cash: '💰',
      'mobile money': '📱',
      'bank transfer': '🏦',
      'credit card': '💳',
      'debit card': '💳',
      check: '📝',
      'in kind': '🤝',
      other: '💱'
    }
    return icons[method] || '💳'
  }

  const handlePaymentSuccess = async () => {
    await loadPayments() // Reload payments
    if (onPaymentUpdated) {
      onPaymentUpdated() // Notify parent to refresh
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        
        <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Sale #{sale.id}</h2>
                <p className="text-blue-200 text-sm mt-1">{formatDateTime(sale.sold_on)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onEdit}
                  className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  title="Edit Sale"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={onClose} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Quick Stats - Using actual payment data */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="bg-white/10 rounded-xl p-2">
                <p className="text-blue-200 text-[10px]">Total</p>
                <p className="text-white font-bold">{formatCurrency(sale.total_price)}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2">
                <p className="text-blue-200 text-[10px]">Paid</p>
                <p className="text-white font-bold">{formatCurrency(totalPaid)}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2">
                <p className="text-blue-200 text-[10px]">Balance</p>
                <p className={`font-bold ${remainingBalance > 0 ? 'text-amber-300' : 'text-green-300'}`}>
                  {formatCurrency(remainingBalance)}
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-2">
                <p className="text-blue-200 text-[10px]">Margin</p>
                <p className={`font-bold ${sale.profit_margin >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {formatPercent(sale.profit_margin)}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Status Badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${getStatusColor(sale.status)}`}>
                {sale.status.toUpperCase()}
              </span>
              {sale.is_debt_sale && remainingBalance > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
                  DEBT SALE
                </span>
              )}
              {sale.has_been_canceled && (
                <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">
                  CANCELLED
                </span>
              )}
            </div>

            {/* Customer Info */}
            {sale.customer && (
              <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-xs text-blue-600 font-semibold mb-1">Customer</p>
                <p className="font-bold text-slate-800">{sale.customer.name}</p>
                {sale.customer.phone && (
                  <p className="text-sm text-slate-600">{sale.customer.phone}</p>
                )}
                {sale.customer.email && (
                  <p className="text-sm text-slate-600">{sale.customer.email}</p>
                )}
              </div>
            )}

            {/* Product Details */}
            {sale.stock_purchase && (
              <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500 font-semibold mb-1">Product</p>
                <p className="font-bold text-slate-800">{sale.stock_purchase.product?.name || 'Unknown Product'}</p>
                <p className="text-sm text-slate-600">
                  SKU: {sale.stock_purchase.sku.name || 'Unknown'} ({sale.stock_purchase.sku.code || 'N/A'})
                </p>
                {sale.stock_purchase.batch_number && (
                  <p className="text-sm text-slate-600">Batch: {sale.stock_purchase.batch_number}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span>Quantity: <span className="font-bold">{sale.quantity}</span></span>
                  <span>Unit Price: <span className="font-bold">{formatCurrency(sale.total_price / sale.quantity)}</span></span>
                </div>
              </div>
            )}

            {/* Employee */}
            {sale.employee && (
              <div className="mb-4 p-3 bg-purple-50 rounded-xl border border-purple-200">
                <p className="text-xs text-purple-600 font-semibold mb-1">Sold By</p>
                <p className="font-bold text-slate-800">{sale.employee.name}</p>
                <p className="text-sm text-slate-600">{sale.employee.role}</p>
              </div>
            )}

            {/* Payments Section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800">Payments</h3>
                <button
                  onClick={onAddPayment}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Payment
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-4">
                  <svg className="w-6 h-6 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : payments.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-sm">
                  No payments recorded yet
                </div>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <button
                      key={payment.id}
                      onClick={() => setSelectedPayment(payment)}
                      className="w-full flex items-center justify-between p-3 bg-white border-2 border-slate-200 rounded-xl hover:border-blue-400 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-lg">{getPaymentMethodIcon(payment.payment_method)}</span>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-slate-800">{formatCurrency(payment.amount_paid)}</p>
                          <p className="text-xs text-slate-400">{formatDateTime(payment.payment_date)}</p>
                          {payment.recorded_by_employee && (
                            <p className="text-[10px] text-slate-400">by {payment.recorded_by_employee.name}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {payment.reference_number && (
                          <span className="text-xs text-slate-400 block">Ref: {payment.reference_number}</span>
                        )}
                        {payment.has_been_canceled && (
                          <span className="text-xs text-red-500">Cancelled</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Summary */}
            {payments.length > 0 && (
              <div className="mb-4 p-3 bg-green-50 rounded-xl border border-green-200">
                <p className="text-xs text-green-600 font-semibold mb-1">Payment Summary</p>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total Paid:</span>
                  <span className="font-bold text-slate-800">{formatCurrency(totalPaid)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-600">Remaining Balance:</span>
                  <span className={`font-bold ${remainingBalance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {formatCurrency(remainingBalance)}
                  </span>
                </div>
              </div>
            )}

            {/* Override Info */}
            {sale.has_been_overwritten && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-xs text-amber-700 font-semibold">Price Override</p>
                <p className="text-sm text-amber-600">{sale.price_override_reason || 'No reason provided'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Payment Modal */}
      {selectedPayment && (
        <EditPaymentModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onUpdated={handlePaymentSuccess}
        />
      )}
    </>
  )
}

// ============================================================================
// Main Sales History Modal
// ============================================================================

interface SalesHistoryModalProps {
  onClose: () => void
}

export const SalesHistoryModal: React.FC<SalesHistoryModalProps> = ({ onClose }) => {
  const [sales, setSales] = useState<Sale[]>([])
  const [filteredSales, setFilteredSales] = useState<Sale[]>([])
  const [filteredStats, setFilteredStats] = useState<FilteredStats>({
    total_sales: 0,
    total_revenue: 0,
    total_profit: 0,
    avg_margin: 0,
    total_quantity: 0,
    debt_total: 0,
    paid_total: 0,
    outstanding_total: 0,
    count: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [showEditSale, setShowEditSale] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>([])
  const [employees, setEmployees] = useState<Array<{ id: number; name: string }>>([])

  // Filter state
  const [filters, setFilters] = useState<SaleFilters>({
    search: '',
    status: 'all',
    paymentStatus: 'all',
    debtStatus: 'all',
    datePreset: 'all',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    customerId: null,
    employeeId: null,
    paymentMethod: 'all',
    isDebtOnly: false,
    sortBy: 'sold_on',
    sortOrder: 'desc'
  })

  const [tempFilters, setTempFilters] = useState<SaleFilters>(filters)

  // Load sales data
  const loadSales = async (pageNum: number, append = false) => {
    try {
      const result = await window.api.sales.getAllSales({
        page: pageNum,
        limit: 50,
        include_customer: true,
        include_employee: true,
        include_payments: true,
        include_product_details: true,
        sort_by: 'sold_on',
        sort_order: 'desc'
      })

      if (result.success && result.data) {
        const newSales = result.data.sales as Sale[]
        if (append) {
          setSales(prev => [...prev, ...newSales])
        } else {
          setSales(newSales)
        }
        setHasMore(result.data.pagination?.has_next ?? false)
      } else {
        setError(result.message || 'Failed to load sales')
      }
    } catch (e: any) {
      setError(e?.message || 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  // Load customers for filter
  const loadCustomers = async () => {
    try {
      const result = await window.api.customers.getAllCustomers({ limit: 100 })
      if (result.success && result.data) {
        setCustomers(result.data.customers.map(c => ({ id: c.id, name: c.name })))
      }
    } catch (error) {
      console.error('Failed to load customers:', error)
    }
  }

  // Load employees for filter
  const loadEmployees = async () => {
    try {
      const result = await window.api.employees.get()
      if (result.success && result.data) {
        setEmployees(result.data.employees.map(e => ({ id: e.id, name: e.username })))
      }
    } catch (error) {
      console.error('Failed to load employees:', error)
    }
  }

  useEffect(() => {
    loadSales(1)
    loadCustomers()
    loadEmployees()
  }, [])

  // Calculate stats for filtered sales

// In the main SalesHistoryModal component, replace the calculateFilteredStats function:

const calculateFilteredStats = (filtered: Sale[]) => {
  const totalRevenue = filtered.reduce((sum, s) => sum + s.total_price, 0)
  
  // Fix profit calculation - profit_margin is already a percentage
  // profit = (margin percentage / 100) * total_price
  const totalProfit = filtered.reduce((sum, s) => sum + ((s.profit_margin / 100) * s.total_price), 0)
  
  const totalQuantity = filtered.reduce((sum, s) => sum + s.quantity, 0)
  
  // Debt total - sum of all debt sales (full amounts)
  const debtTotal = filtered
    .filter(s => s.is_debt_sale)
    .reduce((sum, s) => sum + s.total_price, 0)
  
  // Paid total - sum of all payments made (from payment_metrics)
  const paidTotal = filtered.reduce((sum, s) => sum + (s.payment_metrics?.total_paid || 0), 0)
  
  // Outstanding total - sum of all remaining balances
  const outstandingTotal = filtered.reduce((sum, s) => sum + (s.payment_metrics?.remaining_balance || 0), 0)
  
  // Average margin
  const avgMargin = filtered.length > 0 
    ? filtered.reduce((sum, s) => sum + (s.profit_margin || 0), 0) / filtered.length 
    : 0

  setFilteredStats({
    total_sales: filtered.length,
    total_revenue: totalRevenue,
    total_profit: totalProfit,
    avg_margin: avgMargin,
    total_quantity: totalQuantity,
    debt_total: debtTotal,
    paid_total: paidTotal,
    outstanding_total: outstandingTotal,
    count: filtered.length
  })
}

  // Apply filters
  useEffect(() => {
    if (sales.length === 0) {
      setFilteredSales([])
      calculateFilteredStats([])
      return
    }

    let filtered = [...sales]

    // Search filter
    if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        filtered = filtered.filter(s => 
            // Search by ID
            s.id.toString().includes(searchLower) ||
            // Search by customer name
            s.customer?.name?.toLowerCase().includes(searchLower) ||
            s.customer?.phone?.toLowerCase().includes(searchLower) ||
            s.customer?.email?.toLowerCase().includes(searchLower) ||
            // Search by employee
            s.employee?.name?.toLowerCase().includes(searchLower) ||
            s.employee?.username?.toLowerCase().includes(searchLower) ||
            // Search by product
            s.stock_purchase?.product?.name?.toLowerCase().includes(searchLower) ||
            // Search by SKU
            s.stock_purchase?.sku.name?.toLowerCase().includes(searchLower) ||
            s.stock_purchase?.sku.code?.toLowerCase().includes(searchLower) ||
            // Search by batch number
            s.stock_purchase?.batch_number?.toLowerCase().includes(searchLower) ||
            // Search by payment reference
            s.payments?.some(p => 
            p.reference_number?.toLowerCase().includes(searchLower) ||
            p.description?.toLowerCase().includes(searchLower)
            )
        )
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(s => s.status === filters.status)
    }

    // Payment status filter
    if (filters.paymentStatus !== 'all') {
      switch (filters.paymentStatus) {
        case 'paid':
          filtered = filtered.filter(s => s.payment_metrics.is_fully_paid)
          break
        case 'partial':
          filtered = filtered.filter(s => !s.payment_metrics.is_fully_paid && s.payment_metrics.total_paid > 0)
          break
        case 'unpaid':
          filtered = filtered.filter(s => s.payment_metrics.total_paid === 0)
          break
        case 'overdue':
          filtered = filtered.filter(s => s.payment_metrics.is_overdue)
          break
      }
    }

    if (filters.debtStatus === 'debt') {
        filtered = filtered.filter(s => s.is_debt_sale)
    } else if (filters.debtStatus === 'non-debt') {
        filtered = filtered.filter(s => !s.is_debt_sale)
    }

    // Date filter
    if (filters.datePreset !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
      
      let fromTimestamp: number | null = null
      let toTimestamp: number | null = null

      switch (filters.datePreset) {
        case 'today':
          fromTimestamp = today
          toTimestamp = Math.floor(Date.now() / 1000)
          break
        case 'yesterday':
          fromTimestamp = today - 86400
          toTimestamp = today
          break
        case 'this_week':
          const startOfWeek = new Date(now)
          startOfWeek.setDate(now.getDate() - now.getDay())
          startOfWeek.setHours(0, 0, 0, 0)
          fromTimestamp = Math.floor(startOfWeek.getTime() / 1000)
          toTimestamp = Math.floor(Date.now() / 1000)
          break
        case 'this_month':
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
          fromTimestamp = Math.floor(startOfMonth.getTime() / 1000)
          toTimestamp = Math.floor(Date.now() / 1000)
          break
        case 'this_year':
          const startOfYear = new Date(now.getFullYear(), 0, 1)
          fromTimestamp = Math.floor(startOfYear.getTime() / 1000)
          toTimestamp = Math.floor(Date.now() / 1000)
          break
        case 'custom':
          if (filters.dateFrom) {
            fromTimestamp = Math.floor(new Date(filters.dateFrom).getTime() / 1000)
          }
          if (filters.dateTo) {
            toTimestamp = Math.floor(new Date(filters.dateTo).getTime() / 1000) + 86399
          }
          break
      }

      if (fromTimestamp !== null) {
        filtered = filtered.filter(s => s.sold_on >= fromTimestamp!)
      }
      if (toTimestamp !== null) {
        filtered = filtered.filter(s => s.sold_on <= toTimestamp!)
      }
    }

    // Amount range filter
    if (filters.minAmount) {
      const min = parseFloat(filters.minAmount)
      filtered = filtered.filter(s => s.total_price >= min)
    }
    if (filters.maxAmount) {
      const max = parseFloat(filters.maxAmount)
      filtered = filtered.filter(s => s.total_price <= max)
    }

    // Customer filter
    if (filters.customerId) {
      filtered = filtered.filter(s => s.customer?.id === filters.customerId)
    }

    // Employee filter
    if (filters.employeeId) {
      filtered = filtered.filter(s => s.employee?.id === filters.employeeId)
    }

    // Payment method filter
    if (filters.paymentMethod !== 'all') {
      filtered = filtered.filter(s => 
        s.payments.some(p => p.payment_method === filters.paymentMethod)
      )
    }

    // Debt only filter
    if (filters.isDebtOnly) {
      filtered = filtered.filter(s => s.is_debt_sale)
    }

    // Calculate stats
    calculateFilteredStats(filtered)

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0
      switch (filters.sortBy) {
        case 'sold_on':
          comparison = a.sold_on - b.sold_on
          break
        case 'total_price':
          comparison = a.total_price - b.total_price
          break
        case 'profit_margin':
          comparison = a.profit_margin - b.profit_margin
          break
        case 'customer_name':
          comparison = (a.customer?.name || '').localeCompare(b.customer?.name || '')
          break
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison
    })

    setFilteredSales(filtered)
  }, [sales, filters])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    loadSales(nextPage, true)
  }

  const applyFilters = () => {
    setFilters(tempFilters)
    setShowFilters(false)
  }

  const resetFilters = () => {
    const defaultFilters: SaleFilters = {
      search: '',
      status: 'all',
      paymentStatus: 'all',
      debtStatus: 'all',
      datePreset: 'all',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
      customerId: null,
      employeeId: null,
      paymentMethod: 'all',
      isDebtOnly: false,
      sortBy: 'sold_on',
      sortOrder: 'desc'
    }
    setTempFilters(defaultFilters)
    setFilters(defaultFilters)
    setShowFilters(false)
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (filters.search) count++
    if (filters.status !== 'all') count++
    if (filters.paymentStatus !== 'all') count++
    if (filters.datePreset !== 'all') count++
    if (filters.minAmount) count++
    if (filters.maxAmount) count++
    if (filters.customerId) count++
    if (filters.employeeId) count++
    if (filters.paymentMethod !== 'all') count++
    if (filters.isDebtOnly) count++
    return count
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700'
      case 'pending': return 'bg-amber-100 text-amber-700'
      case 'cancelled': return 'bg-red-100 text-red-700'
      case 'refunded': return 'bg-purple-100 text-purple-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  const getPaymentStatusBadge = (sale: Sale) => {
    if (sale.payment_metrics.is_fully_paid) {
      return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Paid</span>
    } else if (sale.payment_metrics.total_paid > 0) {
      return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Partial</span>
    } else if (sale.payment_metrics.is_overdue) {
      return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Overdue</span>
    } else {
      return <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">Unpaid</span>
    }
  }

  const isFiltered = getActiveFilterCount() > 0

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        
        <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Sales History</h2>
                <p className="text-blue-200 text-sm mt-1">View and manage all sales transactions</p>
              </div>
              <button onClick={onClose} className="text-white/70 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Stats Summary */}
            {!loading && !error && (
  <div className="mt-4">
    {isFiltered && (
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
          Filtered Results
        </span>
        <span className="text-blue-200 text-sm">
          Showing {filteredStats.count} of {sales.length} sales
        </span>
      </div>
    )}

    <div className="grid grid-cols-7 gap-3">
      {/* Revenue */}
      {/* <div className="bg-white/10 rounded-xl p-2">
        <p className="text-blue-200 text-[10px]">Revenue</p>
        <p className="text-white font-bold text-sm">
          {formatCurrency(filteredStats.total_revenue)}
        </p>
      </div> */}
      
      {/* Profit */}
      {/* <div className="bg-white/10 rounded-xl p-2">
        <p className="text-blue-200 text-[10px]">Profit</p>
        <p className={`text-white font-bold text-sm ${
          filteredStats.total_profit >= 0 ? 'text-green-300' : 'text-red-300'
        }`}>
          {formatCurrency(filteredStats.total_profit)}
        </p>
      </div> */}
      
      {/* Margin */}
      {/* <div className="bg-white/10 rounded-xl p-2">
        <p className="text-blue-200 text-[10px]">Margin</p>
        <p className={`text-white font-bold text-sm ${
          filteredStats.avg_margin >= 20 ? 'text-green-300' :
          filteredStats.avg_margin >= 10 ? 'text-blue-300' :
          filteredStats.avg_margin >= 0 ? 'text-amber-300' : 'text-red-300'
        }`}>
          {formatPercent(filteredStats.avg_margin)}
        </p>
      </div> */}
      
      {/* Quantity */}
      {/* <div className="bg-white/10 rounded-xl p-2">
        <p className="text-blue-200 text-[10px]">Quantity</p>
        <p className="text-white font-bold text-sm">
          {filteredStats.total_quantity}
        </p>
      </div> */}
      
      {/* Debt Total */}
      {/* <div className="bg-white/10 rounded-xl p-2">
        <p className="text-blue-200 text-[10px]">Debt</p>
        <p className="text-amber-300 font-bold text-sm">
          {formatCurrency(filteredStats.debt_total)}
        </p>
      </div> */}
      
      {/* Paid Total */}
      {/* <div className="bg-white/10 rounded-xl p-2">
        <p className="text-blue-200 text-[10px]">Paid</p>
        <p className="text-green-300 font-bold text-sm">
          {formatCurrency(filteredStats.paid_total)}
        </p>
      </div> */}
      
      {/* Outstanding */}
      {/* <div className="bg-white/10 rounded-xl p-2">
        <p className="text-blue-200 text-[10px]">Outstanding</p>
        <p className={`font-bold text-sm ${
          filteredStats.outstanding_total > 0 ? 'text-amber-300' : 'text-green-300'
        }`}>
          {formatCurrency(filteredStats.outstanding_total)}
        </p>
      </div> */}
    </div>

    {/* Validation Check */}
    {Math.abs(filteredStats.paid_total + filteredStats.outstanding_total - filteredStats.total_revenue) > 1 && (
      <div className="mt-2 bg-yellow-500/20 text-yellow-200 text-xs p-2 rounded-lg">
        Note: Paid + Outstanding ({formatCurrency(filteredStats.paid_total + filteredStats.outstanding_total)}) 
        should equal Revenue ({formatCurrency(filteredStats.total_revenue)})
      </div>
    )}
  </div>
)}
          </div>

          {/* Filter Bar */}
          <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-48">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" 
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={tempFilters.search}
                  onChange={(e) => {
      setTempFilters({ ...tempFilters, search: e.target.value })
    }}
    onKeyDown={(e) => {
      if (e.key === 'Enter') {
        applyFilters() // Apply filters on Enter key
      }
    }}
                  placeholder="Search by customer, employee, product, SKU..."
                  className="w-full pl-9 pr-4 py-2 text-sm border-2 border-slate-200 rounded-xl
                    focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>


              {/* Filter Toggle Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                  showFilters || getActiveFilterCount() > 0
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Filters
                {getActiveFilterCount() > 0 && (
                  <span className="bg-white text-blue-600 px-1.5 py-0.5 rounded-full text-xs font-bold">
                    {getActiveFilterCount()}
                  </span>
                )}
              </button>

              {/* Results Count */}
              <span className="ml-auto text-sm text-slate-500">
                Showing <span className="font-bold text-slate-700">{filteredSales.length}</span> of {sales.length} sales
              </span>
            </div>

            {/* Expanded Filters Panel */}
            {showFilters && (
              <div className="mt-4 p-4 bg-white rounded-xl border-2 border-slate-200 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Status Filter */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Status
                    </label>
                    <select
                      value={tempFilters.status}
                      onChange={(e) => setTempFilters({ ...tempFilters, status: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                        focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Debt Status
                    </label>
                    <select
                        value={tempFilters.debtStatus}
                        onChange={(e) => setTempFilters({ ...tempFilters, debtStatus: e.target.value as any })}
                        className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                        focus:outline-none focus:border-blue-500"
                    >
                        <option value="all">All Sales</option>
                        <option value="debt">Debt Sales Only</option>
                        <option value="non-debt">Non-Debt Sales Only</option>
                    </select>
                </div>

                  {/* Payment Status Filter */}
                  {/* <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Payment Status
                    </label>
                    <select
                      value={tempFilters.paymentStatus}
                      onChange={(e) => setTempFilters({ ...tempFilters, paymentStatus: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                        focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All</option>
                      <option value="paid">Fully Paid</option>
                      <option value="partial">Partial</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div> */}

                  {/* Date Preset */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Date Range
                    </label>
                    <select
                      value={tempFilters.datePreset}
                      onChange={(e) => setTempFilters({ ...tempFilters, datePreset: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                        focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="this_week">This Week</option>
                      <option value="this_month">This Month</option>
                      <option value="this_year">This Year</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>

                  {/* Customer Filter */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Customer
                    </label>
                    <select
                      value={tempFilters.customerId || ''}
                      onChange={(e) => setTempFilters({ ...tempFilters, customerId: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                        focus:outline-none focus:border-blue-500"
                    >
                      <option value="">All Customers</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Employee Filter */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Employee
                    </label>
                    <select
                      value={tempFilters.employeeId || ''}
                      onChange={(e) => setTempFilters({ ...tempFilters, employeeId: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                        focus:outline-none focus:border-blue-500"
                    >
                      <option value="">All Employees</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Method Filter */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Payment Method
                    </label>
                    <select
                      value={tempFilters.paymentMethod}
                      onChange={(e) => setTempFilters({ ...tempFilters, paymentMethod: e.target.value })}
                      className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                        focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All Methods</option>
                      <option value="cash">Cash</option>
                      <option value="mobile money">Mobile Money</option>
                      <option value="bank transfer">Bank Transfer</option>
                      <option value="credit card">Credit Card</option>
                      <option value="debit card">Debit Card</option>
                      <option value="check">Check</option>
                      <option value="in kind">In Kind</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Custom Date Range */}
                  {tempFilters.datePreset === 'custom' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                          From Date
                        </label>
                        <input
                          type="date"
                          value={tempFilters.dateFrom}
                          onChange={(e) => setTempFilters({ ...tempFilters, dateFrom: e.target.value })}
                          className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                            focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                          To Date
                        </label>
                        <input
                          type="date"
                          value={tempFilters.dateTo}
                          onChange={(e) => setTempFilters({ ...tempFilters, dateTo: e.target.value })}
                          className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                            focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Amount Range */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Min Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">XAF</span>
                      <input
                        type="number"
                        min="0"
                        value={tempFilters.minAmount}
                        onChange={(e) => setTempFilters({ ...tempFilters, minAmount: e.target.value })}
                        placeholder="Min"
                        className="w-full pl-12 pr-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                          focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Max Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">XAF</span>
                      <input
                        type="number"
                        min="0"
                        value={tempFilters.maxAmount}
                        onChange={(e) => setTempFilters({ ...tempFilters, maxAmount: e.target.value })}
                        placeholder="Max"
                        className="w-full pl-12 pr-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                          focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Sort Options */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Sort By
                    </label>
                    <select
                      value={tempFilters.sortBy}
                      onChange={(e) => setTempFilters({ ...tempFilters, sortBy: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                        focus:outline-none focus:border-blue-500"
                    >
                      <option value="sold_on">Date</option>
                      <option value="total_price">Amount</option>
                      <option value="profit_margin">Margin</option>
                      <option value="customer_name">Customer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Sort Order
                    </label>
                    <select
                      value={tempFilters.sortOrder}
                      onChange={(e) => setTempFilters({ ...tempFilters, sortOrder: e.target.value as 'asc' | 'desc' })}
                      className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                        focus:outline-none focus:border-blue-500"
                    >
                      <option value="desc">Newest First</option>
                      <option value="asc">Oldest First</option>
                    </select>
                  </div>

                  {/* Debt Only Toggle */}
                  {/* <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Debt Sales Only
                      </label>
                      <p className="text-[10px] text-slate-400">Show only debt sales</p>
                    </div>
                    <button
                      onClick={() => setTempFilters({ ...tempFilters, isDebtOnly: !tempFilters.isDebtOnly })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        tempFilters.isDebtOnly ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          tempFilters.isDebtOnly ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div> */}
                </div>

                {/* Filter Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 border-2 border-slate-200 rounded-xl
                      hover:bg-slate-50 transition-colors"
                  >
                    Reset All
                  </button>
                  <button
                    onClick={applyFilters}
                    className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl
                      hover:bg-blue-700 transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <svg className="w-10 h-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-slate-500 mt-4">Loading sales...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-red-600 font-semibold mt-4">Failed to load sales</p>
                <p className="text-xs text-slate-400 mt-1">{error}</p>
                <button
                  onClick={() => loadSales(1)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <svg className="w-16 h-16 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold mt-4">No sales found</p>
                <p className="text-xs mt-1">Try adjusting your filters or make a new sale</p>
                <button
                  onClick={resetFilters}
                  className="mt-4 px-4 py-2 text-sm font-semibold text-blue-600 border-2 border-blue-200 rounded-xl
                    hover:bg-blue-50 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSales.map((sale) => (
                  <button
                    key={sale.id}
                    onClick={() => setSelectedSale(sale)}
                    className="w-full flex items-center gap-4 p-4 bg-white border-2 border-slate-200 rounded-xl
                      hover:border-blue-400 hover:bg-blue-50/30 transition-all text-left"
                  >
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl ${getStatusColor(sale.status)} flex items-center justify-center shrink-0`}>
                      <span className="text-xl">
                        {sale.is_debt_sale ? '💳' : sale.status === 'completed' ? '✅' : '⏳'}
                      </span>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getStatusColor(sale.status)}`}>
                          #{sale.id}
                        </span>
                        {getPaymentStatusBadge(sale)}
                        <span className="text-xs text-slate-400">
                          {formatDateTime(sale.sold_on)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-1">
                        <div>
                          <p className="font-bold text-slate-800">
                            {formatCurrency(sale.total_price)}
                            {sale.payment_metrics.remaining_balance > 0 && (
                              <span className="text-xs font-normal text-amber-600 ml-2">
                                (Due: {formatCurrency(sale.payment_metrics.remaining_balance)})
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-slate-500">
                            {sale.customer?.name || 'Walk-in Customer'} • {sale.quantity} item{sale.quantity !== 1 ? 's' : ''}
                          </p>
                          {sale.stock_purchase?.product && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {sale.stock_purchase.product.name}
                            </p>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <p className={`text-sm font-bold ${
                            sale.profit_margin >= 20 ? 'text-emerald-600' :
                            sale.profit_margin >= 10 ? 'text-blue-600' :
                            sale.profit_margin >= 0 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {formatPercent(sale.profit_margin)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {sale.employee?.name || 'Unknown'}
                          </p>
                        </div>
                      </div>

                      {/* Payment Methods */}
                      {sale.payments.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          {Array.from(new Set(sale.payments.map(p => p.payment_method))).map(method => {
                            const icons: Record<string, string> = {
                              cash: '💰', 'mobile money': '📱', 'bank transfer': '🏦',
                              'credit card': '💳', 'debit card': '💳', check: '📝',
                              'in kind': '🤝', other: '💱'
                            }
                            return (
                              <span key={method} className="text-xs bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span>{icons[method] || '💳'}</span>
                                <span className="text-slate-600">{method}</span>
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}

                {hasMore && (
                  <button
                    onClick={handleLoadMore}
                    className="w-full py-3 text-sm font-semibold text-blue-600 border-2 border-blue-200 rounded-xl
                      hover:bg-blue-50 transition-colors"
                  >
                    Load More
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sale Details Modal */}
      {selectedSale && (
        <SaleDetailsModal
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onEdit={() => {
            setShowEditSale(true)
          }}
          onAddPayment={() => {
            setShowAddPayment(true)
          }}
          onPaymentUpdated={() => {
            loadSales(1)
          }}
        />
      )}

      {/* Add Payment Modal */}
      {showAddPayment && selectedSale && (
        <AddPaymentModal
          saleId={selectedSale.id}
          onClose={() => setShowAddPayment(false)}
          onSuccess={() => {
            setShowAddPayment(false)
            loadSales(1)
          }}
        />
      )}

      {/* Edit Sale Modal */}
      {showEditSale && selectedSale && (
        <EditSaleModal
          sale={selectedSale}
          onClose={() => setShowEditSale(false)}
          onUpdated={() => {
            setShowEditSale(false)
            loadSales(1)
          }}
        />
      )}
    </>
  )
}