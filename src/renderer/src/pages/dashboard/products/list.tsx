// src/pages/public/products/list.tsx

import CreateProductModal from '@renderer/components/products/create-product-modal'
import ProductCard from '@renderer/components/products/product-card'
import ProductOffcanvas from '@renderer/components/products/product-offcanvas'
import ProductSkeleton from '@renderer/components/products/product-skeleton'
import ToastContainer, { ToastMessage } from '@renderer/components/toast/toast-container'
import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Types (aligned with getAllProducts response in preload/index.d.ts) ────────

type ProductMetrics = {
  total_items_bought: number
  total_items_sold: number
  total_items_remaining: number
  inventory_value: number
  total_revenue: number
  total_cost: number
  total_profit: number
  profit_margin: number
  sku_count: number
  avg_sku_profit_margin: number
  sell_through_rate: number
  days_of_inventory: number
  is_low_stock: boolean
  is_high_margin: boolean
  is_loss_making: boolean
  is_best_seller: boolean
  stock_status: 'Out of Stock' | 'Low Stock' | 'In Stock' | 'Overstocked'
}

type Product = {
  id: number
  product_name: string
  category_id: number
  category_name: string
  description: string | null
  created_on: number
  updated_on: number
  is_active: boolean
  is_deleted: boolean
  sku_count: number
  images?: Array<any>
  skus?: Array<any>
  metrics: ProductMetrics
}

type Pagination = {
  page: number
  limit: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
  returned: number
}

type SortKey = 'name_asc' | 'name_desc' | 'date_asc' | 'date_desc' | 'skus_asc' | 'skus_desc'
type TabKey = 'active' | 'deleted'

const LIMIT = 150

const sortLabels: Record<SortKey, string> = {
  name_asc: 'A → Z',
  name_desc: 'Z → A',
  date_asc: 'Oldest first',
  date_desc: 'Newest first',
  skus_asc: 'Fewest SKUs',
  skus_desc: 'Most SKUs',
}

const sortToApiParams = (key: SortKey): { sort_by: string; sort_order: 'asc' | 'desc' } => {
  switch (key) {
    case 'name_asc':  return { sort_by: 'product_name', sort_order: 'asc' }
    case 'name_desc': return { sort_by: 'product_name', sort_order: 'desc' }
    case 'date_asc':  return { sort_by: 'created_on', sort_order: 'asc' }
    case 'date_desc': return { sort_by: 'created_on', sort_order: 'desc' }
    case 'skus_asc':  return { sort_by: 'created_on', sort_order: 'asc' }
    case 'skus_desc': return { sort_by: 'created_on', sort_order: 'desc' }
  }
}

const Products = () => {
  const [products, setProducts]       = useState<Product[]>([])
  const [pagination, setPagination]   = useState<Pagination | null>(null)
  const [expandedId, setExpandedId]   = useState<number | null>(null)
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortKey, setSortKey]         = useState<SortKey>('name_asc')
  const [activeTab, setActiveTab]     = useState<TabKey>('active')
  const [currentPage, setCurrentPage] = useState(1)
  const [showSortMenu, setShowSortMenu]       = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [offcanvasProductId, setOffcanvasProductId] = useState<number | null>(null)
  const [offcanvasOpen, setOffcanvasOpen]     = useState(false)
  const [toasts, setToasts]           = useState<ToastMessage[]>([])
  const [activeCount, setActiveCount]   = useState(0)
  const [deletedCount, setDeletedCount] = useState(0)

  const sortMenuRef = useRef<HTMLDivElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
  }
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 350)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [search])

  const loadProducts = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const { sort_by, sort_order } = sortToApiParams(sortKey)

      const res = await window.api.products.getAllProducts({
        page,
        limit: LIMIT,
        include_deleted: activeTab === 'deleted',
        include_inactive: activeTab === 'deleted',
        include_images: true,
        include_skus: true,
        max_skus_return: 5,
        search: debouncedSearch || undefined,
        sort_by: sort_by as any,
        sort_order,
      })

      if (res.success && res.data) {
        const items = (res.data.products as unknown as Product[]).filter(p =>
          activeTab === 'deleted' ? p.is_deleted : !p.is_deleted
        )
        setProducts(items)

        const pag = res.data.pagination
        if (pag) {
          setPagination({
            page:        pag.page        ?? page,
            limit:       pag.limit       ?? LIMIT,
            total:       pag.total       ?? 0,
            total_pages: pag.total_pages ?? Math.ceil((pag.total ?? 0) / LIMIT),
            has_next:    pag.has_next    ?? false,
            has_prev:    pag.has_prev    ?? false,
            returned:    pag.returned    ?? items.length,
          })
        }
      } else {
        addToast(res.message || 'Failed to load products', 'error')
      }
    } catch {
      addToast('An error occurred while loading products', 'error')
    } finally {
      setLoading(false)
    }
  }, [activeTab, debouncedSearch, sortKey])

  useEffect(() => {
    loadProducts(currentPage)
  }, [loadProducts, currentPage])

  useEffect(() => {
    if (!pagination) return
    if (activeTab === 'active')  setActiveCount(pagination.total)
    if (activeTab === 'deleted') setDeletedCount(pagination.total)
  }, [pagination, activeTab])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setShowSortMenu(false)
    }
    if (showSortMenu) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showSortMenu])

  const handleTabChange = (tab: TabKey) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    setCurrentPage(1)
    setExpandedId(null)
    setSearch('')
    setDebouncedSearch('')
  }

  const handleSortChange = (key: SortKey) => {
    setSortKey(key)
    setCurrentPage(1)
    setShowSortMenu(false)
  }

  const handleDelete = async (productId: number) => {
    const name = products.find(p => p.id === productId)?.product_name ?? 'Product'
    try {
      const res = await window.api.products.softDeleteProduct({ id: productId })
      if (!res.success) throw new Error(res.message)
      addToast(`"${name}" has been deleted`, 'success')
      const newPage = products.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
      setCurrentPage(newPage)
      await loadProducts(newPage)
      setDeletedCount(c => c + 1)
      setActiveCount(c => Math.max(0, c - 1))
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed to delete product', 'error') }
  }

  const handleRestore = async (productId: number) => {
    const name = products.find(p => p.id === productId)?.product_name ?? 'Product'
    try {
      const res = await window.api.products.softDeleteProduct({ id: productId, restore: true })
      if (!res.success) throw new Error(res.message)
      addToast(`"${name}" has been restored`, 'success')
      const newPage = products.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
      setCurrentPage(newPage)
      await loadProducts(newPage)
      setDeletedCount(c => Math.max(0, c - 1))
      setActiveCount(c => c + 1)
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed to restore product', 'error') }
  }

  const handleEdit = (id: number) => {
    setOffcanvasProductId(id)
    setOffcanvasOpen(true)
  }

  const handleSync = (id: number) => { console.log('Sync product:', id) }

  const handleProductCreated = async () => {
    addToast('Product created successfully!', 'success')
    setCurrentPage(1)
    await loadProducts(1)
    setActiveCount(c => c + 1)
  }

  const handleProductUpdated = async () => {
    addToast('Product updated successfully!', 'success')
    await loadProducts(currentPage)
  }

  const totalSkus = products.reduce((s, p) => s + p.sku_count, 0)

  const goToPage = (page: number) => {
    setCurrentPage(page)
    setExpandedId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getPaginationRange = (): (number | '…')[] => {
    if (!pagination) return []
    const { page, total_pages } = pagination
    if (total_pages <= 7) return Array.from({ length: total_pages }, (_, i) => i + 1)
    const range: (number | '…')[] = [1]
    if (page > 3) range.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(total_pages - 1, page + 1); i++) range.push(i)
    if (page < total_pages - 2) range.push('…')
    range.push(total_pages)
    return range
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50">
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      <CreateProductModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleProductCreated}
      />

      <ProductOffcanvas
        productId={offcanvasProductId}
        open={offcanvasOpen}
        onClose={() => setOffcanvasOpen(false)}
        onUpdated={handleProductUpdated}
        onSync={handleSync}
      />

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Products</h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {activeCount} active
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    {totalSkus} SKUs on this page
                  </span>
                  {deletedCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      {deletedCount} deleted
                    </span>
                  )}
                  {debouncedSearch && (
                    <span className="text-gray-500 text-xs hidden sm:inline">
                      · Filtered by "{debouncedSearch}"
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="w-full sm:w-64 lg:w-72 pl-10 pr-10 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Sort */}
              <div className="relative" ref={sortMenuRef}>
                <button
                  onClick={() => setShowSortMenu(s => !s)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-all shadow-sm whitespace-nowrap"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                  <span className="hidden sm:inline">{sortLabels[sortKey]}</span>
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-30">
                    {[
                      { group: 'Alphabetical', keys: ['name_asc', 'name_desc'] as SortKey[] },
                      { group: 'Date Created', keys: ['date_desc', 'date_asc'] as SortKey[] },
                      { group: 'By SKUs', keys: ['skus_desc', 'skus_asc'] as SortKey[] },
                    ].map(({ group, keys }, gi) => (
                      <div key={group}>
                        {gi > 0 && <div className="border-t border-gray-100 my-1" />}
                        <div className="px-3 py-1.5">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{group}</p>
                        </div>
                        {keys.map(k => (
                          <button key={k} onClick={() => handleSortChange(k)}
                            className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors ${sortKey === k ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                            {sortLabels[k]}
                            {sortKey === k && (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {activeTab === 'active' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-3 sm:px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Add Product</span>
                  <span className="sm:hidden">Add</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

          {/* ── Tabs ── */}
          <div className="flex border-b border-gray-200 px-4 sm:px-6 pt-3">
            {([
              { key: 'active' as TabKey, label: 'Active Products', count: activeCount, color: 'blue' },
              { key: 'deleted' as TabKey, label: 'Deleted', count: deletedCount, color: 'red' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`
                  relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all border-b-2 mr-1
                  ${activeTab === tab.key
                    ? tab.color === 'blue' ? 'text-blue-600 border-blue-600' : 'text-red-600 border-red-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.label}
                <span className={`
                  inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold
                  ${activeTab === tab.key
                    ? tab.color === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-500'
                  }
                `}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
            {[
              { label: 'Image', span: 1 },
              { label: 'Product Name', span: 3 },
              { label: 'SKUs', span: 2 },
              { label: 'Metrics', span: 3 },
              { label: 'Status', span: 2 },
              { label: '', span: 1 },
            ].map(({ label, span }) => (
              <div key={label} className={`col-span-${span}`}>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <ProductSkeleton />
          ) : products.length === 0 ? (
            <div className="py-16 sm:py-24 px-4 text-center">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${activeTab === 'deleted' ? 'bg-red-50' : 'bg-blue-50'}`}>
                {activeTab === 'deleted' ? (
                  <svg className="w-8 h-8 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                {debouncedSearch ? 'No products found' : activeTab === 'deleted' ? 'No deleted products' : 'No products yet'}
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                {debouncedSearch
                  ? `No results for "${debouncedSearch}".`
                  : activeTab === 'deleted'
                  ? 'Deleted products will appear here.'
                  : 'Start building your inventory by adding your first product.'}
              </p>
              {debouncedSearch
                ? <button onClick={() => setSearch('')} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">Clear search</button>
                : activeTab === 'active' && (
                  <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add your first product
                  </button>
                )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {products.map(product => (
                <ProductCard
                  key={product.id}
                  product={product as any}
                  expanded={expandedId === product.id}
                  onToggle={() => setExpandedId(expandedId === product.id ? null : product.id)}
                  onDelete={handleDelete}
                  onRestore={handleRestore}
                  onEdit={handleEdit}
                  onSync={handleSync}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {!loading && pagination && pagination.total_pages > 1 && (
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-500 order-2 sm:order-1">
              Showing{' '}
              <span className="font-semibold text-gray-700">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>
              {' '}–{' '}
              <span className="font-semibold text-gray-700">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>
              {' '}of{' '}
              <span className="font-semibold text-gray-700">{pagination.total}</span>
              {' '}{activeTab === 'deleted' ? 'deleted' : 'active'} products
            </p>

            <div className="flex items-center gap-1 order-1 sm:order-2">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={!pagination.has_prev}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {getPaginationRange().map((item, idx) =>
                  item === '…' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 py-2 text-sm text-gray-400 select-none">…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => goToPage(item as number)}
                      className={`min-w-[36px] h-9 px-2 text-sm font-semibold rounded-lg transition-all ${
                        item === pagination.page
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={!pagination.has_next}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <span className="hidden sm:inline">Next</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {!loading && products.length > 0 && pagination && pagination.total_pages <= 1 && (
          <div className="mt-4 sm:mt-6 text-center text-sm text-gray-500">
            Showing all {pagination.total} {activeTab === 'deleted' ? 'deleted' : 'active'} products
          </div>
        )}
      </div>
    </div>
  )
}

export default Products