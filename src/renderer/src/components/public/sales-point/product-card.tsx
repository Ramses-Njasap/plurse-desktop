// src/components/public/sales-point/product-card.tsx

import type { Product } from '@renderer/components/public/types/sales'
import { formatCurrency, formatPercent, getStockStatusBadge, nanSafe } from '@renderer/components/public/types/utils'
import React, { useState } from 'react'

interface ProductCardProps {
  product: Product
  onClick: (product: Product) => void
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const badge = getStockStatusBadge(product.metrics)
  const primaryImage = product.images?.find((img) => img.is_primary) ?? product.images?.[0]
  const [imgError, setImgError] = useState(false)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  React.useEffect(() => {
    if (primaryImage?.path) {
      try {
        const src = window.api.files.readFileAsDataURL(primaryImage.path)
        setImgSrc(src)
      } catch {
        setImgError(true)
      }
    }
  }, [primaryImage?.path])

  const margin = nanSafe(product.metrics.avg_sku_profit_margin)
  const remaining = nanSafe(product.metrics.total_items_remaining ?? 0)
  const sold = nanSafe(product.metrics.items_sold ?? product.metrics.total_items_sold ?? 0)
  const invValue = nanSafe(product.metrics.inventory_value)
  const sellThrough = nanSafe(product.metrics.sell_through_rate)
  const daysInv = nanSafe(product.metrics.days_of_inventory)

  const marginColor =
    margin > 30 ? 'text-emerald-600' :
    margin > 15 ? 'text-blue-600' :
    margin > 0  ? 'text-amber-600' : 'text-red-500'

  const marginBg =
    margin > 30 ? 'bg-emerald-50 border-emerald-200' :
    margin > 15 ? 'bg-blue-50 border-blue-200' :
    margin > 0  ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  const stockStatus = product.metrics.stock_status ?? (
    remaining === 0 ? 'Out of Stock' :
    product.metrics.is_low_stock ? 'Low Stock' : 'In Stock'
  )

  const stockColor =
    stockStatus === 'Out of Stock' ? 'text-red-600 bg-red-50' :
    stockStatus === 'Low Stock'    ? 'text-amber-600 bg-amber-50' :
    stockStatus === 'Overstocked'  ? 'text-purple-600 bg-purple-50' :
    'text-emerald-600 bg-emerald-50'

  const canSell = remaining > 0 && product.is_active

  return (
    <button
      onClick={() => onClick(product)}
      disabled={!canSell}
      className={`group relative flex flex-col bg-white rounded-2xl border-2 overflow-hidden text-left
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full transition-all duration-200
        ${canSell
          ? 'border-slate-200 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-100/60 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer'
          : 'border-slate-100 opacity-60 cursor-not-allowed'
        }`}
      style={{ minHeight: 360 }}
    >
      {/* Image area */}
      <div className="relative h-44 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden shrink-0">
        {imgSrc && !imgError ? (
          <>
            {!imgLoaded && <div className="absolute inset-0 bg-slate-100 animate-pulse" />}
            <img
              src={imgSrc}
              alt={product.product_name}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-slate-200 flex items-center justify-center">
              <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="text-xs font-medium">No Image</span>
          </div>
        )}

        {/* Image count */}
        {(product.images?.length ?? 0) > 1 && (
          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
            +{product.images.length - 1}
          </span>
        )}

        {/* Status badge */}
        {badge && (
          <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold border ${badge.className} shadow-sm`}>
            {badge.label}
          </span>
        )}

        {/* SKU count */}
        <span className="absolute top-2 right-2 bg-blue-600/90 text-white text-xs px-2 py-0.5 rounded-full font-semibold shadow">
          {product.sku_count} SKU{product.sku_count !== 1 ? 's' : ''}
        </span>

        {/* Out of stock overlay */}
        {stockStatus === 'Out of Stock' && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-red-100 text-red-600 text-sm font-bold px-4 py-1.5 rounded-full border border-red-200 shadow">
              Out of Stock
            </span>
          </div>
        )}

        {!product.is_active && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-slate-100 text-slate-600 text-sm font-bold px-4 py-1.5 rounded-full border border-slate-200 shadow">
              Inactive
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-colors duration-200" />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3.5 gap-2.5">
        {/* Name + Category */}
        <div>
          <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
            {product.product_name}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 font-medium truncate">{product.category_name}</p>
        </div>

        {/* Stock + Margin row */}
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stockColor}`}>
            {remaining.toLocaleString()} left
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${marginBg} ${marginColor}`}>
            {formatPercent(margin)} margin
          </span>
        </div>

        {/* Key metrics grid */}
        <div className="grid grid-cols-2 gap-1.5">
          <MetricTile
            label="Sold"
            value={`${sold.toLocaleString()}`}
            sub="units"
            icon="📦"
          />
          <MetricTile
            label="Inv. Value"
            value={formatCurrency(invValue)}
            icon="💰"
            valueClass="text-slate-700"
          />
          <MetricTile
            label="Sell-Through"
            value={`${sellThrough.toFixed(0)}%`}
            icon="📈"
            valueClass={sellThrough > 70 ? 'text-emerald-600' : sellThrough > 40 ? 'text-amber-600' : 'text-red-500'}
          />
          <MetricTile
            label="Days Stock"
            value={daysInv > 0 ? `${daysInv}d` : '—'}
            icon="📅"
            valueClass={daysInv > 0 && daysInv < 7 ? 'text-red-500' : daysInv < 30 ? 'text-amber-600' : 'text-slate-600'}
          />
        </div>

        {/* Financial summary */}
        <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Revenue</span>
            <span className="font-bold text-slate-700">{formatCurrency(nanSafe(product.metrics.total_revenue))}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-0.5">
            <span className="text-slate-500">Profit</span>
            <span className={`font-bold ${nanSafe(product.metrics.total_profit) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatCurrency(nanSafe(product.metrics.total_profit))}
            </span>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-auto pt-1.5 border-t border-slate-100 flex items-center justify-between">
          {product.metrics.is_low_stock && remaining > 0 && (
            <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
              <span>⚠️</span> Low
            </span>
          )}
          {product.metrics.is_best_seller && (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <span>⭐</span> Top
            </span>
          )}
          {!product.metrics.is_low_stock && !product.metrics.is_best_seller && <span />}
          <span className={`ml-auto flex items-center gap-1 text-sm font-semibold transition-all
            ${canSell ? 'text-blue-600 group-hover:gap-2' : 'text-slate-400'}`}>
            {canSell ? 'Select' : 'Unavailable'}
            {canSell && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </span>
        </div>
      </div>
    </button>
  )
}

const MetricTile: React.FC<{
  label: string
  value: string
  sub?: string
  icon: string
  valueClass?: string
}> = ({ label, value, sub, icon, valueClass = 'text-slate-800' }) => (
  <div className="bg-white rounded-lg px-2.5 py-2 border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
    <div className="flex items-center gap-1 mb-0.5">
      <span className="text-xs">{icon}</span>
      <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">{label}</span>
    </div>
    <p className={`text-xs font-bold ${valueClass} truncate`}>
      {value}
      {sub && <span className="font-normal text-slate-400 ml-0.5">{sub}</span>}
    </p>
  </div>
)