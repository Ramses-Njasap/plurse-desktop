// src/pages/public/sales-point/make-sales.tsx

import { useCart } from '@renderer/components/public/hooks/use-cart'
import { CartPanel } from '@renderer/components/public/sales-point/cart-panel'
import { CustomerSelector } from '@renderer/components/public/sales-point/customer-selector'
import { Receipt } from '@renderer/components/public/sales-point/receipt'
import { StockPurchaseModal } from '@renderer/components/public/sales-point/stock-purchase-modal'
import type { Customer, PaymentMethodValue, SKU, StockPurchase } from '@renderer/components/public/types/sales'
import {
  calcProfitMargin,
  formatCurrency,
  formatPercent,
  generateReceiptNumber,
  getExpiryStatus,
  getProfitMarginRisk,
  nanSafe,
} from '@renderer/components/public/types/utils'
import React, { useCallback, useEffect, useState } from 'react'


const PAYMENT_METHODS = [
  { methods: 'cash', description: 'Payment made in cash', icon: '💵' },
  { methods: 'mobile money', description: 'Payment made via mobile money services', icon: '📱' },
  { methods: 'bank transfer', description: 'Payment made through bank transfer', icon: '🏦' },
  { methods: 'credit card', description: 'Payment made using credit card', icon: '💳' },
  { methods: 'debit card', description: 'Payment made using debit card', icon: '💳' },
  { methods: 'check', description: 'Payment made by check', icon: '📝' },
  { methods: 'in kind', description: 'Payment made with goods or services instead of money', icon: '🤝' },
  { methods: 'other', description: 'Other payment methods', icon: '💱' },
] as const

// ─── Props ────────────────────────────────────────────────────────────────
// Matches the original v1 signature so existing callers need zero changes.
// The initial purchase + sku are pre-loaded into the cart on mount.
interface NewSalePageProps {
  purchase: StockPurchase
  sku: SKU
  onBack: () => void
}

export const NewSalePage: React.FC<NewSalePageProps> = ({ purchase, sku, onBack }) => {
  const cart = useCart()

  // ── Payment / customer ──────────────────────────────────────────────
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [description, setDescription] = useState('')
  const [balanceDueDate, setBalanceDueDate] = useState('')

  // ── Per-item price / qty overrides ──────────────────────────────────
  const [itemPrices, setItemPrices] = useState<Record<string, number>>({})
  const [itemQtys, setItemQtys] = useState<Record<string, number>>({})

  // ── Add-more modal state ─────────────────────────────────────────────
  const [addMoreSkuModal, setAddMoreSkuModal] = useState(false)
  const [addMoreSku, setAddMoreSku] = useState<SKU | null>(null)

  // ── UI ───────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [receiptData, setReceiptData] = useState<any | null>(null)

  // ── Seed cart with the initial purchase on first mount ───────────────
  useEffect(() => {
    if (cart.isEmpty) {
      const defaultPrice =
        nanSafe(purchase.max_price) > 0
          ? nanSafe(purchase.max_price)
          : nanSafe(purchase.min_price) > 0
          ? nanSafe(purchase.min_price)
          : nanSafe(purchase.price_per_unit)
      cart.addItem(purchase, sku, defaultPrice, 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sync per-item state when cart changes ────────────────────────────
  useEffect(() => {
    setItemPrices((prev) => {
      const next = { ...prev }
      cart.items.forEach((item) => {
        if (!(item.cartId in next)) {
          const maxP = nanSafe(item.purchase.max_price)
          const minP = nanSafe(item.purchase.min_price)
          const cost = nanSafe(item.purchase.price_per_unit)
          next[item.cartId] = maxP > 0 ? maxP : minP > 0 ? minP : cost
        }
      })
      Object.keys(next).forEach((k) => {
        if (!cart.items.find((i) => i.cartId === k)) delete next[k]
      })
      return next
    })
    setItemQtys((prev) => {
      const next = { ...prev }
      cart.items.forEach((item) => {
        if (!(item.cartId in next)) next[item.cartId] = item.quantity
      })
      Object.keys(next).forEach((k) => {
        if (!cart.items.find((i) => i.cartId === k)) delete next[k]
      })
      return next
    })
  }, [cart.items])

  // ── Totals ───────────────────────────────────────────────────────────
  const subtotal = cart.items.reduce((sum, item) => {
    const price = itemPrices[item.cartId] ?? item.unitPrice
    const qty = itemQtys[item.cartId] ?? item.quantity
    return sum + price * qty
  }, 0)

  const paid = parseFloat(amountPaid) || 0
  const isDebt = paid > 0 && paid < subtotal
  const change = paid > subtotal ? paid - subtotal : 0
  const remainingBalance = paid < subtotal ? subtotal - paid : 0

  // ── Handlers ─────────────────────────────────────────────────────────
  const handlePriceChange = useCallback((cartId: string, raw: string) => {
    const n = parseFloat(raw)
    setItemPrices((prev) => ({ ...prev, [cartId]: isNaN(n) ? 0 : Math.max(0, n) }))
  }, [])

  const handleQtyChange = useCallback((cartId: string, val: number) => {
    setItemQtys((prev) => ({ ...prev, [cartId]: Math.max(1, val) }))
  }, [])

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (cart.isEmpty) { setSubmitError('Cart is empty.'); return }
    if (paid <= 0) { setSubmitError('Please enter the amount paid.'); return }
    if (isDebt && !customer) { setSubmitError('A customer is required for debt sales.'); return }

    setSubmitting(true)
    setSubmitError('')

    try {
      const sessionRes = await window.api.employees.getCurrentSession()
      if (!sessionRes.success || !sessionRes.data) {
        setSubmitError('No active session. Please log in again.')
        setSubmitting(false)
        return
      }
      const employeeId = sessionRes.data.employee.id

      const saleIds: number[] = []
      const errors: string[] = []

      for (const item of cart.items) {
        const unitPrice = itemPrices[item.cartId] ?? item.unitPrice
        const qty = itemQtys[item.cartId] ?? item.quantity
        const totalPrice = unitPrice * qty
        const itemAmountPaid =
          subtotal > 0 ? Math.min((paid / subtotal) * totalPrice, totalPrice) : totalPrice
        const itemIsDebt = itemAmountPaid < totalPrice

        const payload = {
          issued_by: employeeId,
          customer_id: customer?.id ?? 0,
          stock_purchased_id: item.purchase.id,
          quantity: qty,
          total_price: totalPrice,
          status: (itemIsDebt ? 'pending' : 'completed') as 'pending' | 'completed',
          is_debt_sale: itemIsDebt,
          balance_due:
            itemIsDebt && balanceDueDate
              ? Math.floor(new Date(balanceDueDate).getTime() / 1000)
              : undefined,
          sold_on: Math.floor(Date.now() / 1000),
          payment: {
            amount_paid: itemAmountPaid,
            payment_method: paymentMethod,
            reference_number: referenceNumber || undefined,
            description: description || undefined,
            recorded_by: employeeId,
          },
        }

        const result = await window.api.sales.createSale(payload)
        if (result.success && result.data) {
          saleIds.push(result.data.sale_id ?? result.data.id ?? 0)
        } else {
          errors.push(
            `${item.productName} (${item.sku.sku_name}): ${result.message ?? 'Unknown error'}`
          )
        }
      }

      if (saleIds.length === 0) {
        setSubmitError('All sales failed:\n' + errors.join('\n'))
        setSubmitting(false)
        return
      }

      const receiptItems = cart.items.map((item) => ({
        ...item,
        unitPrice: itemPrices[item.cartId] ?? item.unitPrice,
        quantity: itemQtys[item.cartId] ?? item.quantity,
      }))

      setReceiptData({
        receiptNumber: generateReceiptNumber(),
        saleIds,
        items: receiptItems,
        customer,
        paymentMethod,
        amountPaid: paid,
        totalPrice: subtotal,
        isDebt,
        remainingBalance,
        change,
        referenceNumber,
        description,
        soldAt: Math.floor(Date.now() / 1000),
        partialErrors: errors,
      })
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Unexpected error.')
    } finally {
      setSubmitting(false)
    }
  }

  const needsReference = [
    'bank transfer', 'mobile money', 'check', 'credit card', 'debit card',
  ].includes(paymentMethod)

  const selectedPaymentMeta = PAYMENT_METHODS.find((p) => p.methods === paymentMethod)

  // ── Receipt screen ────────────────────────────────────────────────────
  if (receiptData) {
    return (
      <Receipt
        receiptData={receiptData}
        onClose={() => { cart.clearCart(); setReceiptData(null); onBack() }}
        onNewSale={() => { cart.clearCart(); setReceiptData(null); onBack() }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/20">

      {/* ── Top bar ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-600 border-2 border-slate-200
              hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all font-semibold text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="w-px h-6 bg-slate-200" />
          <div className="flex-1">
            <h1 className="text-xl font-extrabold text-slate-800 leading-none">New Sale</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {cart.items.length} item{cart.items.length !== 1 ? 's' : ''} · {formatCurrency(subtotal)}
            </p>
          </div>
          {/* Add more items button */}
          <button
            onClick={() => setAddMoreSkuModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border-2 border-blue-200
              text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add More Items
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* ── Left: items + customer + notes ─────────────────────── */}
        <div className="lg:col-span-3 space-y-6">

          {/* Order items */}
          <Section title="Order Items" subtitle={`${cart.items.length} line item${cart.items.length !== 1 ? 's' : ''}`}>
            <div className="space-y-4">
              {cart.items.map((item) => {
                const price = itemPrices[item.cartId] ?? item.unitPrice
                const qty = itemQtys[item.cartId] ?? item.quantity
                const cost = nanSafe(item.purchase.price_per_unit)
                const margin = calcProfitMargin(price, cost)
                const risk = getProfitMarginRisk(
                  margin,
                  item.purchase.min_price,
                  item.purchase.max_price,
                  price
                )
                const minP = nanSafe(item.purchase.min_price)
                const maxP = nanSafe(item.purchase.max_price)
                const expiry = getExpiryStatus(item.purchase.expiry_date, item.purchase.days_until_expiry)

                return (
                  <div
                    key={item.cartId}
                    className="bg-white border-2 border-slate-200 rounded-2xl p-5 hover:border-blue-200 transition-colors"
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 text-base truncate">{item.productName}</h4>
                        <p className="text-sm text-slate-500 truncate">{item.sku.sku_name}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {item.sku.attributes?.slice(0, 4).map((a: any) => (
                            <span key={a.id}
                              className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-md">
                              {a.name}: {a.value}
                            </span>
                          ))}
                          {item.purchase.batch_number && (
                            <span className="text-xs bg-slate-100 text-slate-500 font-mono px-2 py-0.5 rounded-md">
                              Batch: {item.purchase.batch_number}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${expiry.bg} ${expiry.color}`}>
                            {expiry.label}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => cart.removeItem(item.cartId)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                        title="Remove"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Price suggestion hint */}
                    {(minP > 0 || maxP > 0) && (
                      <div className="flex items-center gap-2 mb-3 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                        <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                          Suggested:{' '}
                          {minP > 0 && (
                            <button onClick={() => handlePriceChange(item.cartId, String(minP))}
                              className="font-bold text-blue-600 hover:underline">{formatCurrency(minP)}</button>
                          )}
                          {minP > 0 && maxP > 0 && ' – '}
                          {maxP > 0 && (
                            <button onClick={() => handlePriceChange(item.cartId, String(maxP))}
                              className="font-bold text-blue-600 hover:underline">{formatCurrency(maxP)}</button>
                          )}
                          <span className="text-slate-400 ml-1">(click to apply)</span>
                        </span>
                        <span className="ml-auto shrink-0">
                          Cost: <span className="font-bold text-slate-700">{formatCurrency(cost)}</span>
                        </span>
                      </div>
                    )}

                    {/* Qty + price controls */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-500 font-semibold mb-1.5 uppercase tracking-wide">
                          Quantity
                        </label>
                        <div className="flex items-center border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500">
                          <button onClick={() => handleQtyChange(item.cartId, qty - 1)}
                            className="w-10 h-11 flex items-center justify-center text-slate-500 hover:bg-slate-100 text-xl font-bold transition-colors">
                            −
                          </button>
                          <input
                            type="number" min={1} max={item.purchase.quantity} value={qty}
                            onChange={(e) => handleQtyChange(item.cartId, parseInt(e.target.value) || 1)}
                            className="flex-1 text-center font-bold text-slate-800 text-base h-11 focus:outline-none bg-transparent"
                          />
                          <button onClick={() => handleQtyChange(item.cartId, qty + 1)}
                            className="w-10 h-11 flex items-center justify-center text-slate-500 hover:bg-slate-100 text-xl font-bold transition-colors">
                            +
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 text-center">{item.purchase.quantity} available</p>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-500 font-semibold mb-1.5 uppercase tracking-wide">
                          Unit Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm pointer-events-none">$</span>
                          <input
                            type="number" min={0} step={0.01} value={price || ''}
                            onChange={(e) => handlePriceChange(item.cartId, e.target.value)}
                            className="w-full pl-8 pr-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 font-bold
                              focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-base"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Live profit margin */}
                    <div className={`mt-3 flex items-center justify-between px-4 py-2.5 rounded-xl border ${risk.bg} transition-all`}>
                      <div className={`flex items-center gap-2 text-sm font-semibold ${risk.color}`}>
                        <span className="text-base">{risk.icon}</span>
                        <span>{risk.label}</span>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-extrabold ${risk.color}`}>{formatPercent(margin)}</p>
                        <p className="text-xs text-slate-400">Line: {formatCurrency(price * qty)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Add more items CTA inside the section */}
              <button
                onClick={() => setAddMoreSkuModal(true)}
                className="w-full py-4 border-2 border-dashed border-blue-200 rounded-2xl text-blue-500
                  hover:border-blue-400 hover:bg-blue-50 transition-all text-sm font-bold flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Another Item
              </button>
            </div>
          </Section>

          {/* Customer */}
          <Section title="Customer" subtitle="Optional — required for debt sales">
            <CustomerSelector value={customer} onChange={setCustomer} />
          </Section>

          {/* Notes */}
          <Section title="Notes" subtitle="Optional">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Bulk order, discount applied, special instructions…"
              rows={3}
              className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl resize-none
                focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100
                text-slate-700 placeholder:text-slate-400"
            />
          </Section>
        </div>

        {/* ── Right: payment panel ────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden sticky top-24">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <h3 className="text-white font-extrabold text-lg">Payment</h3>
              <p className="text-blue-200 text-sm">Complete the transaction</p>
            </div>

            <div className="p-5 space-y-5">

              {/* Line items summary */}
              <div className="space-y-2">
                {cart.items.map((item) => {
                  const price = itemPrices[item.cartId] ?? item.unitPrice
                  const qty = itemQtys[item.cartId] ?? item.quantity
                  return (
                    <div key={item.cartId} className="flex justify-between text-sm text-slate-600">
                      <span className="truncate max-w-[60%]">{item.productName} × {qty}</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(price * qty)}</span>
                    </div>
                  )
                })}
                <div className="flex justify-between text-lg font-extrabold text-slate-800 pt-3 border-t-2 border-slate-100">
                  <span>Total</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              </div>

              {/* Payment method */}
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wide">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm.methods}
                      type="button"
                      onClick={() => setPaymentMethod(pm.methods)}
                      title={pm.description}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-semibold
                        transition-all text-left ${
                          paymentMethod === pm.methods
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                    >
                      <span className="text-base">{pm.icon}</span>
                      <span className="capitalize leading-tight">{pm.methods}</span>
                    </button>
                  ))}
                </div>
                {selectedPaymentMeta && (
                  <p className="text-xs text-slate-400 mt-2 flex items-start gap-1">
                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {selectedPaymentMeta.description}
                  </p>
                )}
              </div>

              {/* Reference (non-cash only) */}
              {needsReference && (
                <div>
                  <label className="block text-xs text-slate-500 font-semibold mb-1.5 uppercase tracking-wide">
                    Reference / Transaction ID
                  </label>
                  <input
                    type="text" value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder={paymentMethod === 'check' ? 'Cheque number' : 'Transaction reference'}
                    className="w-full px-4 py-2.5 text-sm border-2 border-slate-200 rounded-xl
                      focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              )}

              {/* Amount paid */}
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-1.5 uppercase tracking-wide">
                  Amount Paid
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg pointer-events-none">$</span>
                  <input
                    type="number" min={0} step={0.01} value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder={subtotal.toFixed(2)}
                    className="w-full pl-10 pr-4 py-4 text-xl font-extrabold border-2 border-slate-200 rounded-xl
                      focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800"
                  />
                </div>
                <button type="button" onClick={() => setAmountPaid(subtotal.toFixed(2))}
                  className="mt-1.5 text-xs text-blue-600 font-semibold hover:underline">
                  Exact amount ({formatCurrency(subtotal)})
                </button>
              </div>

              {/* Auto-detected: change / debt / settled */}
              {paid > 0 && (
                <div className={`rounded-xl border-2 p-4 ${
                  change > 0 ? 'bg-emerald-50 border-emerald-200'
                  : isDebt ? 'bg-amber-50 border-amber-300'
                  : 'bg-blue-50 border-blue-200'
                }`}>
                  {change > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">💰</span>
                        <div>
                          <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Change to give</p>
                          <p className="text-emerald-700 text-xs">Customer overpaid</p>
                        </div>
                      </div>
                      <p className="text-2xl font-extrabold text-emerald-700">{formatCurrency(change)}</p>
                    </div>
                  )}
                  {isDebt && (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">⚠️</span>
                          <div>
                            <p className="text-xs text-amber-700 font-bold uppercase tracking-wide">Debt Sale</p>
                            <p className="text-amber-600 text-xs">Balance recorded as outstanding</p>
                          </div>
                        </div>
                        <p className="text-2xl font-extrabold text-amber-700">{formatCurrency(remainingBalance)}</p>
                      </div>
                      <div className="mt-3 pt-3 border-t border-amber-200">
                        <label className="block text-xs text-amber-700 font-semibold mb-1.5">
                          Payment Due Date <span className="font-normal text-amber-500">(optional)</span>
                        </label>
                        <input type="date" value={balanceDueDate}
                          onChange={(e) => setBalanceDueDate(e.target.value)}
                          className="w-full px-3 py-2 text-sm border-2 border-amber-200 rounded-xl bg-white
                            focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                      </div>
                      {!customer && (
                        <p className="mt-2 text-xs text-amber-700 font-semibold flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          A customer is required for debt sales
                        </p>
                      )}
                    </>
                  )}
                  {!change && !isDebt && (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">✅</span>
                      <p className="text-sm font-bold text-blue-700">Exact payment — fully settled</p>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {submitError && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium whitespace-pre-line">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {submitError}
                  </div>
                </div>
              )}

              {/* Confirm */}
              <button
                onClick={handleSubmit}
                disabled={submitting || cart.isEmpty || paid <= 0 || (isDebt && !customer)}
                className="w-full py-4 bg-blue-600 text-white text-base font-extrabold rounded-xl
                  hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all
                  shadow-lg shadow-blue-200 flex items-center justify-center gap-3"
              >
                {submitting ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing…
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {isDebt ? `Confirm Debt Sale · ${formatCurrency(subtotal)}` : `Confirm Sale · ${formatCurrency(subtotal)}`}
                  </>
                )}
              </button>

              {paid <= 0 && (
                <p className="text-center text-xs text-slate-400">Enter the amount paid above to confirm</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating cart widget (shows when items > 1) ─────────── */}
      {cart.items.length > 1 && (
        <CartPanel cart={cart} onCheckout={() => {}} onClear={cart.clearCart} hideCheckout />
      )}

      {/* ── Add-more: SKU picker modal ──────────────────────────── */}
      {addMoreSkuModal && (
        // We reuse the SkuModal but need a product — show a product-picker prompt instead
        // The simplest approach: close the sku modal and let user pick from a product
        // For now open a lightweight product-search-then-sku flow
        <AddMoreModal
          onClose={() => setAddMoreSkuModal(false)}
          onSkuSelected={(newSku) => {
            setAddMoreSku(newSku)
            setAddMoreSkuModal(false)
          }}
        />
      )}

      {addMoreSku && (
        <StockPurchaseModal
          sku={addMoreSku}
          cart={cart}
          onClose={() => setAddMoreSku(null)}
          onAdded={() => {}}
        />
      )}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────
const Section: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title, subtitle, children,
}) => (
  <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
      <h3 className="font-extrabold text-slate-800 text-base">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    <div className="p-6">{children}</div>
  </div>
)

// ─── AddMoreModal — lightweight product search to pick an extra SKU ───────
const AddMoreModal: React.FC<{
  onClose: () => void
  onSkuSelected: (sku: SKU) => void
}> = ({ onClose, onSkuSelected }) => {
  const [search, setSearch] = useState('')
  const [skus, setSkus] = useState<SKU[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!search.trim()) { setSkus([]); return }
      setLoading(true)
      try {
        const result = await window.api.products.getAllSkus({
          search: search.trim(),
          has_stock: true,
          is_active: true,
          limit: 20,
        })
        if (result.success && result.data) {
          setSkus(result.data.items as SKU[])
        }
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [search])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="p-5 border-b border-slate-100 bg-slate-800 text-white flex items-center justify-between gap-3">
          <h2 className="font-bold text-base">Add Another Item</h2>
          <button onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              autoFocus type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU name, code or product…"
              className="w-full pl-9 pr-4 py-2.5 text-sm border-2 border-slate-200 rounded-xl
                focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-10 gap-3 text-slate-400">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Searching…</span>
            </div>
          )}
          {!loading && search && skus.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-10">No SKUs found for "{search}"</p>
          )}
          {!loading && !search && (
            <p className="text-center text-sm text-slate-400 py-10">Type to search for a SKU or product</p>
          )}
          {!loading && skus.length > 0 && (
            <div className="space-y-2">
              {skus.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSkuSelected(s)}
                  className="w-full text-left px-4 py-3 rounded-xl border-2 border-slate-200
                    hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  <p className="font-bold text-slate-800 text-sm group-hover:text-blue-700">
                    {s.sku_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">{s.product?.name ?? '—'}</span>
                    {s.code && (
                      <span className="text-xs font-mono text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                        {s.code}
                      </span>
                    )}
                  </div>
                  {s.attributes && s.attributes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.attributes.slice(0, 3).map((a: any) => (
                        <span key={a.id}
                          className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {a.name}: {a.value}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}