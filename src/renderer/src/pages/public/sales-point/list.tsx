// src/pages/public/sales-point/list.tsx

import { useCart } from '@renderer/components/public/hooks/use-cart'
import { CartPanel } from '@renderer/components/public/sales-point/cart-panel'
import { ProductCard } from '@renderer/components/public/sales-point/product-card'
import { ProductFiltersBar } from '@renderer/components/public/sales-point/product-filter-bar'
import { SalesHistoryModal } from '@renderer/components/public/sales-point/sales-history-modal'
import { SkuModal } from '@renderer/components/public/sales-point/sku-modal'
import { StockPurchaseModal } from '@renderer/components/public/sales-point/stock-purchase-modal'
import { AddTransactionModal, MyTransactionsModal } from '@renderer/components/public/sales-point/transaction-modals'
import type { Product, ProductFilters, SKU } from '@renderer/components/public/types/sales'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckoutPage } from './checkout'

interface SalesPageProps {
  onNavigateDashboard?: () => void
}

const PAGE_SIZE = 24

export const SalesPage: React.FC<SalesPageProps> = ({  }) => {
  const cart = useCart()
  const transactionDropdownRef = useRef<HTMLDivElement>(null)

  // View state
  const [view, setView] = useState<'products' | 'checkout'>('products')

  // Modal states
  const [showTransactionMenu, setShowTransactionMenu] = useState(false)
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [showMyTransactions, setShowMyTransactions] = useState(false)
  const [showSalesHistory, setShowSalesHistory] = useState(false)

  // Products
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    sort_by: 'product_name',
    sort_order: 'asc',
  })

  // Modals
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedSku, setSelectedSku] = useState<SKU | null>(null)

  // Categories
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])

  // Click outside handler for transaction dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (transactionDropdownRef.current && !transactionDropdownRef.current.contains(e.target as Node)) {
        setShowTransactionMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchProducts = useCallback(async (currentFilters: ProductFilters, currentPage: number, append = false) => {
    if (!append) setLoading(true)
    else setLoadingMore(true)
    setError('')

    try {
      const searchTerm = currentFilters.search?.trim()
      
      const result = await window.api.products.getAllProducts({
        page: currentPage,
        limit: PAGE_SIZE,
        search: searchTerm || undefined,
        category_id: currentFilters.category_id,
        has_sku: currentFilters.has_sku,
        low_stock_only: currentFilters.low_stock_only,
        best_seller_only: currentFilters.best_seller_only,
        sort_by: (currentFilters.sort_by as any) || 'product_name',
        sort_order: currentFilters.sort_order || 'asc',
        include_images: true,
        include_skus: true
      })

      if (result.success && result.data) {
        let newProducts = result.data.products as Product[]
        
        // Client-side filtering across all fields if needed
        if (searchTerm && newProducts.length > 0) {
          const searchLower = searchTerm.toLowerCase()
          newProducts = newProducts.filter(product => {
            // Search in product name
            if (product.product_name.toLowerCase().includes(searchLower)) return true
            
            // Search in category name
            if (product.category_name?.toLowerCase().includes(searchLower)) return true
            
            // Search in description
            if (product.description?.toLowerCase().includes(searchLower)) return true
            
            // Search in SKUs
            if (product.skus?.some(sku => 
              sku.sku_name?.toLowerCase().includes(searchLower) ||
              sku.code?.toLowerCase().includes(searchLower) ||
              sku.attributes?.some(attr => 
                attr.name?.toLowerCase().includes(searchLower) ||
                attr.value?.toLowerCase().includes(searchLower)
              )
            )) return true
            
            return false
          })
        }

        if (append) {
          setProducts((prev) => [...prev, ...newProducts])
        } else {
          setProducts(newProducts)
        }
        setHasNext(result.data.pagination?.has_next ?? false)
        setTotalCount(result.data.pagination?.total ?? newProducts.length)
      } else {
        setError(result.message ?? 'Failed to load products')
      }
    } catch (e: any) {
      setError(e?.message ?? 'Unexpected error loading products')
    }

    setLoading(false)
    setLoadingMore(false)
  }, [])

  // Initial load + refetch on filter change
  useEffect(() => {
    setPage(1)
    fetchProducts(filters, 1, false)
  }, [filters, fetchProducts])

  // Fetch categories for filter
  useEffect(() => {
    window.api.products.getCategories({ nested: false }).then((res) => {
      if (res.success && res.data) {
        setCategories(
          res.data.categories.map((c: any) => ({ id: c.id, name: c.category_name }))
        )
      }
    }).catch(() => {})
  }, [])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchProducts(filters, nextPage, true)
  }

  const handleFiltersChange = (newFilters: ProductFilters) => {
    setFilters(newFilters)
  }

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product)
  }

  const handleSkuSelect = (sku: SKU) => {
    setSelectedSku(sku)
    setSelectedProduct(null)
  }

  const handleStockModalClose = () => {
    setSelectedSku(null)
  }

  const handleCheckout = () => {
    setView('checkout')
  }

  const handleCheckoutBack = () => {
    setView('products')
  }

  const handleSaleComplete = () => {
    cart.clearCart()
    setView('products')
  }

  // Checkout view
  if (view === 'checkout') {
    return (
      <CheckoutPage
        cart={cart}
        onBack={handleCheckoutBack}
        onSaleComplete={handleSaleComplete}
      />
    )
  }

  // Products view
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 leading-none">Point of Sale</h1>
                <p className="text-xs text-slate-400 mt-0.5">Select products to start a sale</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Sales History Button */}
              <button
                onClick={() => setShowSalesHistory(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl
                  hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all font-semibold text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History
              </button>

              {/* Transactions Dropdown */}
              <div className="relative" ref={transactionDropdownRef}>
                <button
                  onClick={() => setShowTransactionMenu(!showTransactionMenu)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl
                    hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all font-semibold text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Transactions
                  <svg className={`w-4 h-4 transition-transform ${showTransactionMenu ? 'rotate-180' : ''}`} 
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showTransactionMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border-2 border-slate-200 overflow-hidden z-50">
                    <button
                      onClick={() => {
                        setShowTransactionMenu(false)
                        setShowAddTransaction(true)
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">Add Transaction</p>
                        <p className="text-xs text-slate-500">Record cash in/out</p>
                      </div>
                    </button>
                    
                    <div className="border-t border-slate-100" />
                    
                    <button
                      onClick={() => {
                        setShowTransactionMenu(false)
                        setShowMyTransactions(true)
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">My Transactions</p>
                        <p className="text-xs text-slate-500">View and edit your records</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <Link
                to='/dashboard/overview'
                className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl
                  hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all font-semibold text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </Link>

              <div className="w-px h-6 bg-slate-200" />

              {/* Cart summary badge */}
              {!cart.isEmpty && (
                <button
                  onClick={handleCheckout}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl
                    hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 font-bold text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Checkout ({cart.totalItems})
                </button>
              )}
            </div>
          </div>

          <ProductFiltersBar
            filters={filters}
            onChange={handleFiltersChange}
            totalCount={totalCount}
            loading={loading}
          />

          {/* Category quick-filter pills */}
          {categories.length > 0 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-thin">
              <button
                onClick={() => setFilters((f) => ({ ...f, category_id: undefined }))}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                  !filters.category_id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFilters((f) => ({
                    ...f,
                    category_id: f.category_id === cat.id ? undefined : cat.id,
                  }))}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                    filters.category_id === cat.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-700">Failed to load products</p>
              <p className="text-sm text-slate-400 mt-1">{error}</p>
            </div>
            <button
              onClick={() => fetchProducts(filters, 1, false)}
              className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
            <svg className="w-16 h-16 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-600">No products found</p>
              <p className="text-sm mt-1">Try adjusting your filters or search term</p>
            </div>
            <button
              onClick={() => setFilters({ search: '', sort_by: 'product_name', sort_order: 'asc' })}
              className="px-5 py-2 border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={handleProductClick}
                />
              ))}
            </div>

            {/* Load more */}
            {hasNext && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-8 py-3.5 bg-white border-2 border-slate-200
                    rounded-2xl text-sm font-bold text-slate-700 hover:border-blue-400 hover:bg-blue-50
                    disabled:opacity-60 transition-all shadow-sm"
                >
                  {loadingMore ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading more...
                    </>
                  ) : (
                    <>
                      Load More Products
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}

            <p className="text-center text-xs text-slate-400 mt-4">
              Showing {products.length} of {totalCount} products
            </p>
          </>
        )}
      </main>

      {/* Modals */}
      {selectedProduct && (
        <SkuModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onSelectSku={handleSkuSelect}
        />
      )}

      {selectedSku && (
        <StockPurchaseModal
          sku={selectedSku}
          cart={cart}
          onClose={handleStockModalClose}
          onAdded={() => {}}
        />
      )}

      {/* Transaction Modals */}
      {showAddTransaction && (
        <AddTransactionModal
          onClose={() => setShowAddTransaction(false)}
          onSuccess={() => {
            // Optionally refresh data
          }}
        />
      )}

      {showMyTransactions && (
        <MyTransactionsModal
          onClose={() => setShowMyTransactions(false)}
        />
      )}

      {showSalesHistory && (
        <SalesHistoryModal
          onClose={() => setShowSalesHistory(false)}
        />
      )}

      {/* Floating cart */}
      <CartPanel
        cart={cart}
        onCheckout={handleCheckout}
        onClear={cart.clearCart}
      />
    </div>
  )
}

const SkeletonCard: React.FC = () => (
  <div className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden animate-pulse" style={{ minHeight: 320 }}>
    <div className="h-48 bg-slate-100" />
    <div className="p-4 space-y-3">
      <div className="h-4 bg-slate-100 rounded-lg w-4/5" />
      <div className="h-3 bg-slate-100 rounded-lg w-2/5" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-12 bg-slate-100 rounded-xl" />
        <div className="h-12 bg-slate-100 rounded-xl" />
        <div className="h-12 bg-slate-100 rounded-xl" />
        <div className="h-12 bg-slate-100 rounded-xl" />
      </div>
    </div>
  </div>
)