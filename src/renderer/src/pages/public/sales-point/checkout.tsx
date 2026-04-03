// src/pages/public/sales-point/checkout.tsx

import type { UseCart } from '@renderer/components/public/hooks/use-cart'
import { CustomerSelector } from '@renderer/components/public/sales-point/customer-selector'
import { Receipt } from '@renderer/components/public/sales-point/receipt'
import type { Customer, PaymentMethodValue } from '@renderer/components/public/types/sales'
import {
  calcProfitMargin,
  formatCurrency,
  formatPercent,
  generateReceiptNumber,
  getExpiryStatus,
  getProfitMarginRisk,
  nanSafe,
} from '@renderer/components/public/types/utils'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

const PAYMENT_METHODS = [
  { methods: 'cash',          description: 'Payment made in cash',                               icon: '💵' },
  { methods: 'mobile money',  description: 'Payment via mobile money services',                   icon: '📱' },
  { methods: 'bank transfer', description: 'Payment through bank transfer',                       icon: '🏦' },
  { methods: 'credit card',   description: 'Payment using credit card',                           icon: '💳' },
  { methods: 'debit card',    description: 'Payment using debit card',                            icon: '💳' },
  { methods: 'check',         description: 'Payment by check',                                    icon: '📝' },
  { methods: 'in kind',       description: 'Payment with goods or services instead of money',     icon: '🤝' },
  { methods: 'other',         description: 'Other payment methods',                               icon: '💱' },
] as const

interface CheckoutPageProps {
  cart: UseCart
  onBack: () => void
  onSaleComplete: () => void
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ cart, onBack, onSaleComplete }) => {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [description, setDescription] = useState('')
  const [balanceDueDate, setBalanceDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [receiptData, setReceiptData] = useState<any | null>(null)

  // Per-item price and qty overrides keyed by cartId
  const [itemPrices, setItemPrices] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    cart.items.forEach((item) => {
      const defaultPrice =
        nanSafe(item.purchase.max_price) > 0 ? nanSafe(item.purchase.max_price) :
        nanSafe(item.purchase.min_price)  > 0 ? nanSafe(item.purchase.min_price) :
        nanSafe(item.purchase.price_per_unit)
      init[item.cartId] = item.unitPrice || defaultPrice
    })
    return init
  })

  const [itemQtys, setItemQtys] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    cart.items.forEach((item) => { init[item.cartId] = item.quantity })
    return init
  })

  // Raw string values for price inputs so we don't clobber typing
  const [itemPriceRaw, setItemPriceRaw] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    cart.items.forEach((item) => {
      const defaultPrice =
        nanSafe(item.purchase.max_price) > 0 ? nanSafe(item.purchase.max_price) :
        nanSafe(item.purchase.min_price)  > 0 ? nanSafe(item.purchase.min_price) :
        nanSafe(item.purchase.price_per_unit)
      init[item.cartId] = String(item.unitPrice || defaultPrice || '')
    })
    return init
  })

  // Sync when cart changes (new items added)
  useEffect(() => {
    setItemPrices((prev) => {
      const next = { ...prev }
      cart.items.forEach((item) => {
        if (!(item.cartId in next)) {
          const defaultPrice =
            nanSafe(item.purchase.max_price) > 0 ? nanSafe(item.purchase.max_price) :
            nanSafe(item.purchase.min_price)  > 0 ? nanSafe(item.purchase.min_price) :
            nanSafe(item.purchase.price_per_unit)
          next[item.cartId] = defaultPrice
        }
      })
      Object.keys(next).forEach((k) => { if (!cart.items.find((i) => i.cartId === k)) delete next[k] })
      return next
    })
    setItemQtys((prev) => {
      const next = { ...prev }
      cart.items.forEach((item) => { if (!(item.cartId in next)) next[item.cartId] = item.quantity })
      Object.keys(next).forEach((k) => { if (!cart.items.find((i) => i.cartId === k)) delete next[k] })
      return next
    })
    setItemPriceRaw((prev) => {
      const next = { ...prev }
      cart.items.forEach((item) => {
        if (!(item.cartId in next)) {
          const defaultPrice =
            nanSafe(item.purchase.max_price) > 0 ? nanSafe(item.purchase.max_price) :
            nanSafe(item.purchase.min_price)  > 0 ? nanSafe(item.purchase.min_price) :
            nanSafe(item.purchase.price_per_unit)
          next[item.cartId] = String(defaultPrice || '')
        }
      })
      Object.keys(next).forEach((k) => { if (!cart.items.find((i) => i.cartId === k)) delete next[k] })
      return next
    })
  }, [cart.items])

  const subtotal = useMemo(() =>
    cart.items.reduce((sum, item) => {
      const price = itemPrices[item.cartId] ?? item.unitPrice
      const qty = itemQtys[item.cartId] ?? item.quantity
      return sum + price * qty
    }, 0),
    [cart.items, itemPrices, itemQtys]
  )

  const paid = parseFloat(amountPaid) || 0
  const isDebt = paid > 0 && paid < subtotal
  const change = paid > subtotal ? paid - subtotal : 0
  const remainingBalance = paid < subtotal ? subtotal - paid : 0

  const handlePriceRawChange = useCallback((cartId: string, raw: string) => {
    setItemPriceRaw((prev) => ({ ...prev, [cartId]: raw }))
    const n = parseFloat(raw)
    if (!isNaN(n) && n >= 0) {
      setItemPrices((prev) => ({ ...prev, [cartId]: n }))
    } else if (raw === '' || raw === '.') {
      setItemPrices((prev) => ({ ...prev, [cartId]: 0 }))
    }
  }, [])

  const handlePriceSet = useCallback((cartId: string, value: number) => {
    setItemPrices((prev) => ({ ...prev, [cartId]: value }))
    setItemPriceRaw((prev) => ({ ...prev, [cartId]: String(value) }))
  }, [])

  const handleQtyChange = useCallback((cartId: string, val: number) => {
    setItemQtys((prev) => ({ ...prev, [cartId]: Math.max(1, val) }))
  }, [])

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
          total_price: totalPrice, // Always store the full sale price
          status: (itemIsDebt ? 'pending' : 'completed') as 'pending' | 'completed',
          is_debt_sale: itemIsDebt,
          balance_due:
            itemIsDebt && balanceDueDate
              ? Math.floor(new Date(balanceDueDate).getTime() / 1000)
              : undefined,
          sold_on: Math.floor(Date.now() / 1000),
          payment: {
            amount_paid: itemAmountPaid, // Store what was actually paid
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
          errors.push(`${item.productName} (${item.sku.sku_name}): ${result.message ?? 'Unknown error'}`)
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
        amountPaid: paid, // Amount customer paid
        totalPrice: subtotal, // Full sale amount
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

  const needsReference = ['bank transfer', 'mobile money', 'check', 'credit card', 'debit card'].includes(paymentMethod)
  const selectedPaymentMeta = PAYMENT_METHODS.find((p) => p.methods === paymentMethod)

  if (receiptData) {
    return (
      <Receipt
        receiptData={receiptData}
        onClose={() => { setReceiptData(null); onSaleComplete() }}
        onNewSale={() => { cart.clearCart(); setReceiptData(null); onSaleComplete() }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/20 relative z-10">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-600 border-2 border-slate-200
              hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all font-semibold text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Products
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold text-slate-800">Checkout</h1>
            <p className="text-xs text-slate-400">
              {cart.totalItems} item{cart.totalItems !== 1 ? 's' : ''} · {formatCurrency(subtotal)}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-5 gap-8 relative z-20">
        {/* Left */}
        <div className="lg:col-span-3 space-y-6">
          {/* Items Editor */}
          <Section title="Order Items" subtitle={`${cart.items.length} line item${cart.items.length !== 1 ? 's' : ''}`}>
            <div className="space-y-5">
              {cart.items.map((item) => {
                const price = itemPrices[item.cartId] ?? item.unitPrice
                const rawVal = itemPriceRaw[item.cartId] ?? String(price)
                const qty = itemQtys[item.cartId] ?? item.quantity
                // Use landed cost (cost_per_unit includes shipping) for accurate margin
                const cost = nanSafe(
                  (item.purchase as any)._landed_cost_per_unit ??
                  item.purchase.price_per_unit
                )
                const margin = calcProfitMargin(price, cost)
                const risk = getProfitMarginRisk(
                  margin, item.purchase.min_price, item.purchase.max_price, price,
                )
                const minP = nanSafe(item.purchase.min_price)
                const maxP = nanSafe(item.purchase.max_price)
                const expiry = getExpiryStatus(item.purchase.expiry_date, item.purchase.days_until_expiry)
                const lineTotal = price * qty

                // Margin at suggested prices
                const marginAtMin = minP > 0 ? calcProfitMargin(minP, cost) : null
                const marginAtMax = maxP > 0 ? calcProfitMargin(maxP, cost) : null

                // Price status relative to range
                const isBelowMin = minP > 0 && price < minP
                const isAboveMax = maxP > 0 && price > maxP
                const isInRange = minP > 0 && maxP > 0 && price >= minP && price <= maxP

                return (
                  <div key={item.cartId}
                    className="bg-white border-2 border-slate-200 rounded-2xl p-5 hover:border-blue-200 transition-colors shadow-sm">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 text-base">{item.productName}</h4>
                        <p className="text-sm text-slate-500">{item.sku.sku_name}</p>
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
                      <button onClick={() => cart.removeItem(item.cartId)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                        title="Remove">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Price range guidance panel */}
                    {(minP > 0 || maxP > 0) && (
                      <div className={`mb-4 rounded-xl border-2 p-3.5 ${
                        isBelowMin ? 'bg-red-50 border-red-200' :
                        isAboveMax ? 'bg-emerald-50 border-emerald-200' :
                        isInRange  ? 'bg-blue-50 border-blue-200' :
                        'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-base">
                            {isBelowMin ? '⚠️' : isAboveMax ? '🟢' : isInRange ? 'ℹ️' : 'ℹ️'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold ${
                              isBelowMin ? 'text-red-700' : isAboveMax ? 'text-emerald-700' : 'text-blue-700'
                            }`}>
                              {isBelowMin
                                ? `Price is below minimum recommended (${formatCurrency(minP)})`
                                : isAboveMax
                                ? `Price is above maximum recommended — excellent!`
                                : isInRange
                                ? 'Price is within the recommended range'
                                : 'Suggested selling price range'}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Cost: <span className="font-bold text-slate-700">{formatCurrency(cost)}</span>
                              {(item.purchase as any)._landed_cost_per_unit &&
                               nanSafe((item.purchase as any)._landed_cost_per_unit) !== nanSafe(item.purchase.price_per_unit) && (
                                <span className="ml-1">(landed: <span className="font-bold">{formatCurrency(nanSafe((item.purchase as any)._landed_cost_per_unit))}</span>)</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Quick-set price buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {minP > 0 && (
                            <button onClick={() => handlePriceSet(item.cartId, minP)}
                              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                              <span>Min:</span> {formatCurrency(minP)}
                              {marginAtMin !== null && (
                                <span className="ml-1 opacity-70">({formatPercent(marginAtMin)})</span>
                              )}
                            </button>
                          )}
                          {minP > 0 && maxP > 0 && (
                            <button
                              onClick={() => handlePriceSet(item.cartId, Math.round((minP + maxP) / 2 * 100) / 100)}
                              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border-2 border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                              <span>Mid:</span> {formatCurrency(Math.round((minP + maxP) / 2 * 100) / 100)}
                              {(calcProfitMargin((minP + maxP) / 2, cost) > 0) && (
                                <span className="ml-1 opacity-70">({formatPercent(calcProfitMargin((minP + maxP) / 2, cost))})</span>
                              )}
                            </button>
                          )}
                          {maxP > 0 && (
                            <button onClick={() => handlePriceSet(item.cartId, maxP)}
                              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border-2 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                              <span>Max:</span> {formatCurrency(maxP)}
                              {marginAtMax !== null && (
                                <span className="ml-1 opacity-70">({formatPercent(marginAtMax)})</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Qty + price controls */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Quantity */}
                      <div>
                        <label className="block text-xs text-slate-500 font-semibold mb-1.5 uppercase tracking-wide">
                          Quantity
                        </label>
                        <div className="flex items-center border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500 bg-white">
                          <button onClick={() => handleQtyChange(item.cartId, qty - 1)}
                            className="w-10 h-11 flex items-center justify-center text-slate-500 hover:bg-slate-100 text-xl font-bold">
                            −
                          </button>
                          <input type="number" min={1} max={item.purchase.quantity} value={qty}
                            onChange={(e) => handleQtyChange(item.cartId, parseInt(e.target.value) || 1)}
                            className="flex-1 text-center font-bold text-slate-800 text-base h-11 focus:outline-none bg-transparent" />
                          <button onClick={() => handleQtyChange(item.cartId, qty + 1)}
                            className="w-10 h-11 flex items-center justify-center text-slate-500 hover:bg-slate-100 text-xl font-bold">
                            +
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 text-center">
                          {item.purchase.quantity} available
                        </p>
                      </div>

                      {/* Unit Price */}
                      <div>
                        <label className="block text-xs text-slate-500 font-semibold mb-1.5 uppercase tracking-wide">
                          Unit Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm pointer-events-none">$</span>
                          <input
                            type="number" min={0} step={0.01}
                            value={rawVal}
                            onChange={(e) => handlePriceRawChange(item.cartId, e.target.value)}
                            onBlur={() => {
                              // Normalize on blur
                              const n = parseFloat(rawVal)
                              if (!isNaN(n)) setItemPriceRaw((prev) => ({ ...prev, [item.cartId]: String(n) }))
                            }}
                            className={`w-full pl-8 pr-4 py-3 border-2 rounded-xl text-slate-800 font-bold
                              focus:outline-none focus:ring-2 text-base transition-colors bg-white ${
                              isBelowMin
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                                : isAboveMax
                                ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-100'
                                : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
                            }`}
                          />
                        </div>
                        {minP > 0 && maxP > 0 && (
                          <p className="text-[10px] text-slate-400 mt-1 text-center">
                            Range: {formatCurrency(minP)} – {formatCurrency(maxP)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Live profit margin indicator */}
                    <div className={`mt-3 flex items-center justify-between px-4 py-2.5 rounded-xl border ${risk.bg} transition-all`}>
                      <div className={`flex items-center gap-2 text-sm font-semibold ${risk.color}`}>
                        <span>{risk.icon}</span>
                        <span>{risk.label}</span>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-extrabold ${risk.color}`}>{formatPercent(margin)}</p>
                        <p className="text-xs text-slate-400">Line: {formatCurrency(lineTotal)}</p>
                      </div>
                    </div>

                    {/* Margin formula hint (educational) */}
                    {price > 0 && cost > 0 && (
                      <p className="mt-1.5 text-[10px] text-slate-400 text-right">
                        Margin = (Sale − Cost) / Sale × 100 = ({formatCurrency(price)} − {formatCurrency(cost)}) / {formatCurrency(price)} × 100
                      </p>
                    )}
                  </div>
                )
              })}

              {cart.isEmpty && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                  <svg className="w-12 h-12 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17" />
                  </svg>
                  <p className="font-semibold">Cart is empty</p>
                  <button onClick={onBack} className="text-blue-600 text-sm font-bold hover:underline">
                    ← Go back to add items
                  </button>
                </div>
              )}
            </div>
          </Section>

          {/* Customer */}
          <Section title="Customer" subtitle="Optional — required for debt tracking">
            <div className="bg-white">
              <CustomerSelector value={customer} onChange={setCustomer} />
            </div>
          </Section>

          {/* Notes */}
          <Section title="Notes" subtitle="Optional description for this sale">
            <div className="bg-white">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Bulk order, discount applied, special instructions..."
                rows={3}
                className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl resize-none
                  focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100
                  text-slate-700 placeholder:text-slate-400 bg-white" />
            </div>
          </Section>
        </div>

        {/* Right — payment panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden sticky top-24 shadow-xl">
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
                    <button key={pm.methods} type="button" onClick={() => setPaymentMethod(pm.methods)}
                      title={pm.description}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-semibold
                        transition-all text-left bg-white ${
                          paymentMethod === pm.methods
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                        }`}>
                      <span className="text-base">{pm.icon}</span>
                      <span className="capitalize leading-tight">{pm.methods}</span>
                    </button>
                  ))}
                </div>
                {selectedPaymentMeta && (
                  <p className="text-xs text-slate-400 mt-2 flex items-start gap-1">
                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {selectedPaymentMeta.description}
                  </p>
                )}
              </div>

              {/* Reference */}
              {needsReference && (
                <div>
                  <label className="block text-xs text-slate-500 font-semibold mb-1.5 uppercase tracking-wide">
                    Reference / Transaction ID
                  </label>
                  <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder={paymentMethod === 'check' ? 'Cheque number' : 'Transaction reference'}
                    className="w-full px-4 py-2.5 text-sm border-2 border-slate-200 rounded-xl bg-white
                      focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </div>
              )}

              {/* Amount paid */}
              <div>
                <label className="block text-xs text-slate-500 font-semibold mb-1.5 uppercase tracking-wide">
                  Amount Paid
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg pointer-events-none">$</span>
                  <input type="number" min={0} step={0.01} value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder={subtotal.toFixed(2)}
                    className="w-full pl-10 pr-4 py-4 text-xl font-extrabold border-2 border-slate-200 rounded-xl bg-white
                      focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800" />
                </div>
                <button type="button" onClick={() => setAmountPaid(subtotal.toFixed(2))}
                  className="mt-1.5 text-xs text-blue-600 font-semibold hover:underline">
                  Exact amount ({formatCurrency(subtotal)})
                </button>
              </div>

              {/* Change / Debt / Settled */}
              {paid > 0 && (
                <div className={`rounded-xl border-2 p-4 ${
                  change > 0 ? 'bg-emerald-50 border-emerald-200' :
                  isDebt     ? 'bg-amber-50 border-amber-300' :
                               'bg-blue-50 border-blue-200'
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

              {/* Submit */}
              <button onClick={handleSubmit}
                disabled={submitting || cart.isEmpty || paid <= 0 || (isDebt && !customer)}
                className="w-full py-4 bg-blue-600 text-white text-base font-extrabold rounded-xl
                  hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all
                  shadow-lg shadow-blue-200 flex items-center justify-center gap-3">
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

              {paid <= 0 && !cart.isEmpty && (
                <p className="text-center text-xs text-slate-400">Enter the amount paid above to confirm</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const Section: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title, subtitle, children,
}) => (
  <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
      <h3 className="font-extrabold text-slate-800 text-base">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    <div className="p-6 bg-white">{children}</div>
  </div>
)