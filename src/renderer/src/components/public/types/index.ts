// src/components/public/types/index.ts

// ─── Sales Page v2 — Barrel Exports ─────────────────────────────────────────

// Pages
export { CheckoutPage } from '@renderer/pages/public/sales-point/checkout'
export { SalesPage } from '@renderer/pages/public/sales-point/list'

// Components
export { CartPanel } from '@renderer/components/public/sales-point/cart-panel'
export { CustomerSelector } from '@renderer/components/public/sales-point/customer-selector'
export { ImageGallery } from '@renderer/components/public/sales-point/image-gallery'
export { ProductCard } from '@renderer/components/public/sales-point/product-card'
export { ProductFiltersBar } from '@renderer/components/public/sales-point/product-filter-bar'
export { Receipt } from '@renderer/components/public/sales-point/receipt'
export { SkuModal } from '@renderer/components/public/sales-point/sku-modal'
export { StockPurchaseModal } from '@renderer/components/public/sales-point/stock-purchase-modal'

// Hooks
export { useCart } from '@renderer/components/public/hooks/use-cart'

// Types
export type { CartItem, CartSummary, Customer, PaymentMethodValue, Product, ProductFilters, SKU, SKUFilters, StockPurchase, StockPurchaseFilters } from '@renderer/components/public/types/sales'

// Utils
export {
    calcProfitMargin, formatCurrency, formatDate, formatDateTime, formatPercent, generateReceiptNumber, getProfitMarginRisk
} from './utils'
