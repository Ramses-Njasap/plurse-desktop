// src/components/public/sales-point/cart-panel.tsx


import type { UseCart } from '@renderer/components/public/hooks/use-cart'
import { calcProfitMargin, formatCurrency, getProfitMarginRisk, nanSafe } from '@renderer/components/public/types/utils'
import React from 'react'

interface CartPanelProps {
  hideCheckout?: boolean
  cart: UseCart
  onCheckout: () => void
  onClear: () => void
}

export const CartPanel: React.FC<CartPanelProps> = ({ cart, onCheckout, onClear, hideCheckout = false }) => {
  if (cart.isEmpty) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 w-80 bg-white rounded-2xl shadow-2xl border-2 border-blue-200
      overflow-hidden transition-all">
      {/* Header */}
      <div className="bg-blue-600 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="font-bold text-sm">Cart</span>
          <span className="bg-white/30 text-white text-xs px-2 py-0.5 rounded-full font-bold">
            {cart.totalItems} item{cart.totalItems !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={onClear}
          className="text-blue-200 hover:text-white text-xs font-semibold hover:underline transition-colors">
          Clear
        </button>
      </div>

      {/* Items */}
      <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
        {cart.items.map((item) => {
          const cost = nanSafe(item.purchase.price_per_unit)
          const margin = calcProfitMargin(item.unitPrice, cost)
          const risk = getProfitMarginRisk(
            margin,
            item.purchase.min_price,
            item.purchase.max_price,
            item.unitPrice,
            // cost
          )

          return (
            <div key={item.cartId} className="px-4 py-3 bg-white">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{item.productName}</p>
                  <p className="text-xs text-slate-400 truncate">{item.sku.sku_name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {/* Qty control */}
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => item.quantity > 1 && cart.updateItem(item.cartId, { quantity: item.quantity - 1 })}
                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 text-sm font-bold"
                      >−</button>
                      <span className="w-8 text-center text-xs font-bold text-slate-700">{item.quantity}</span>
                      <button
                        onClick={() => cart.updateItem(item.cartId, { quantity: item.quantity + 1 })}
                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 text-sm font-bold"
                      >+</button>
                    </div>
                    <span className="text-xs text-slate-500">× {formatCurrency(item.unitPrice)}</span>
                  </div>
                  {/* Margin indicator */}
                  <div className={`mt-1.5 text-[10px] font-semibold flex items-center gap-1 ${risk.color}`}>
                    <span>{risk.icon}</span>
                    <span>{risk.label} ({margin.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="text-sm font-bold text-slate-800">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </p>
                  <button
                    onClick={() => cart.removeItem(item.cartId)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-slate-600 font-medium">Subtotal</span>
          <span className="text-base font-bold text-slate-800">{formatCurrency(cart.subtotal)}</span>
        </div>
        {!hideCheckout && (
          <button
            onClick={onCheckout}
            className="w-full py-3 bg-blue-600 text-white font-bold text-sm rounded-xl
              hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Checkout · {formatCurrency(cart.subtotal)}
          </button>
        )}
      </div>
    </div>
  )
}