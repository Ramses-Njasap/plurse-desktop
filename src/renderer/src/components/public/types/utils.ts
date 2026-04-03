// src/components/public/types/utils.ts

// ─── Utility Helpers v3 ───────────────────────────────────────────────────

export const formatCurrency = (amount: number, currency = 'XAF'): string => {
  if (isNaN(amount) || amount === null || amount === undefined) return '0.00 XAF'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export const formatDate = (timestamp: number | string | null): string => {
  if (!timestamp) return '—'
  const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() / 1000 : timestamp
  if (isNaN(ts)) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const formatDateTime = (timestamp: number | null): string => {
  if (!timestamp) return '—'
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export const getExpiryStatus = (
  expiryDate: string | null,
  daysUntilExpiry: number | null
): { label: string; color: string; bg: string } => {
  if (!expiryDate || expiryDate === '') return { label: 'No Expiry', color: 'text-slate-400', bg: 'bg-slate-100' }
  if (daysUntilExpiry === null) return { label: 'No Expiry', color: 'text-slate-400', bg: 'bg-slate-100' }
  if (daysUntilExpiry < 0) return { label: 'Expired', color: 'text-red-600', bg: 'bg-red-100' }
  if (daysUntilExpiry <= 7)  return { label: `Expires in ${daysUntilExpiry}d`, color: 'text-red-600',    bg: 'bg-red-100' }
  if (daysUntilExpiry <= 30) return { label: `Expires in ${daysUntilExpiry}d`, color: 'text-orange-600', bg: 'bg-orange-100' }
  if (daysUntilExpiry <= 90) return { label: `${daysUntilExpiry}d to expiry`,  color: 'text-yellow-600', bg: 'bg-yellow-100' }
  return { label: `${daysUntilExpiry}d to expiry`, color: 'text-emerald-600', bg: 'bg-emerald-100' }
}

export const getStockStatusBadge = (metrics: {
  is_low_stock: boolean
  is_best_seller: boolean
  is_loss_making: boolean
  is_high_margin: boolean
}): { label: string; className: string } | null => {
  if (metrics.is_best_seller) return { label: '⭐ Best Seller', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
  if (metrics.is_high_margin) return { label: '📈 High Margin', className: 'bg-blue-100 text-blue-700 border-blue-200' }
  if (metrics.is_low_stock)   return { label: '⚠️ Low Stock',  className: 'bg-amber-100 text-amber-700 border-amber-200' }
  if (metrics.is_loss_making) return { label: '📉 Loss Making', className: 'bg-red-100 text-red-700 border-red-200' }
  return null
}

export const generateReceiptNumber = (): string => {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timePart = now.getTime().toString().slice(-6)
  return `RCP-${datePart}-${timePart}`
}

/**
 * Gross Profit Margin — industry standard formula
 *
 *   margin = ((sale_price - cost) / sale_price) × 100
 *
 * This is the GROSS MARGIN (how much of every dollar of revenue is profit).
 * It differs from markup which divides by cost instead of revenue.
 *
 * Important: use the LANDED cost (price_per_unit + allocated shipping)
 * as `costPerUnit` for accuracy. If only price_per_unit is available
 * that is still correct, it just excludes shipping overhead.
 *
 * Returns 0 if salePrice is zero or negative (can't divide by zero).
 */
export const calcProfitMargin = (salePrice: number, costPerUnit: number): number => {
  if (!salePrice || salePrice <= 0) return 0
  return ((salePrice - costPerUnit) / salePrice) * 100
}

/**
 * Markup percentage (cost-based) — different from margin.
 * Useful for displaying "how much above cost" a price is.
 *
 *   markup = ((sale_price - cost) / cost) × 100
 */
export const calcMarkup = (salePrice: number, costPerUnit: number): number => {
  if (!costPerUnit || costPerUnit <= 0) return 0
  return ((salePrice - costPerUnit) / costPerUnit) * 100
}

/**
 * Break-even price — the minimum price to sell at zero profit.
 */
export const calcBreakEven = (costPerUnit: number): number => costPerUnit

/**
 * Target price to achieve a desired margin percentage.
 *   target_price = cost / (1 - desired_margin / 100)
 */
export const calcPriceForMargin = (costPerUnit: number, desiredMarginPct: number): number => {
  if (desiredMarginPct >= 100 || desiredMarginPct < 0) return costPerUnit
  return costPerUnit / (1 - desiredMarginPct / 100)
}

export const getProfitMarginRisk = (
  margin: number,
  minPrice: number | null,
  maxPrice: number | null,
  unitPrice: number,
  // costPerUnit: number
): { label: string; color: string; bg: string; icon: string } => {
  const isAboveMax = maxPrice != null && maxPrice > 0 && unitPrice > maxPrice
  const isBelowMin = minPrice != null && minPrice > 0 && unitPrice < minPrice
  const isLoss     = margin < 0
  const isBreakEven = margin >= 0 && margin < 3
  const isNearZero  = margin >= 3 && margin < 8

  if (isLoss)      return { label: 'Selling at a loss!',   color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       icon: '🔴' }
  if (isBreakEven) return { label: 'Break-even',           color: 'text-red-600',    bg: 'bg-red-50 border-red-200',       icon: '🔴' }
  if (isNearZero)  return { label: 'Very thin margin',     color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: '🟠' }
  if (isBelowMin)  return { label: 'Below min price',      color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   icon: '⚠️' }
  if (isAboveMax)  return { label: 'Above max — great!',   color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200',icon: '🟢' }
  if (margin >= 35) return { label: 'Excellent margin',    color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200',icon: '🟢' }
  if (margin >= 20) return { label: 'Good margin',         color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     icon: '🔵' }
  if (margin >= 12) return { label: 'Acceptable margin',   color: 'text-slate-700',  bg: 'bg-slate-50 border-slate-200',   icon: '⚪' }
  return              { label: 'Low margin',              color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   icon: '🟡' }
}

export const nanSafe = (v: number | null | undefined, fallback = 0): number => {
  if (v === null || v === undefined || isNaN(Number(v))) return fallback
  return Number(v)
}

/**
 * Given a list of stock purchases, returns a profit margin for a given sale price
 * weighted by the quantity of each batch. Use this when a single product has
 * multiple batches with different costs.
 */
export const calcWeightedMargin = (
  batches: Array<{ quantity: number; price_per_unit: number }>,
  salePrice: number
): number => {
  const totalQty = batches.reduce((s, b) => s + b.quantity, 0)
  if (totalQty === 0 || salePrice <= 0) return 0
  const weightedCost = batches.reduce((s, b) => s + b.price_per_unit * b.quantity, 0) / totalQty
  return calcProfitMargin(salePrice, weightedCost)
}