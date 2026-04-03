import CreateSaleModal from '@renderer/components/sales/create-sale-modal'
import SaleCard from '@renderer/components/sales/sale-card'
import SaleFilters from '@renderer/components/sales/sale-filters'
import SaleOffcanvas from '@renderer/components/sales/sale-offcanvas'
import SaleSkeleton from '@renderer/components/sales/sale-skeleton'
import ToastContainer, { ToastMessage } from '@renderer/components/toast/toast-container'
import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SaleStatus = 'pending' | 'completed' | 'cancelled' | 'refunded'
type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mobile_money' | 'credit' | 'other'

export type SaleFiltersType = {
  // Basic filters
  status?: SaleStatus[]
  is_debt_sale?: boolean
  is_deleted?: boolean
  
  // Date filters
  date_preset?: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year' | 'custom'
  date_from?: number
  date_to?: number
  
  // Price and quantity ranges
  min_price?: number
  max_price?: number
  min_quantity?: number
  max_quantity?: number
  
  // Profit margin
  min_margin?: number
  max_margin?: number
  margin_status?: 'above' | 'within' | 'below'
  
  // Payment filters
  payment_methods?: PaymentMethod[]
  is_fully_paid?: boolean
  
  // Debt-specific
  debt_status?: 'overdue' | 'upcoming' | 'paid' | 'all'
  
  // Search
  search?: string
  
  // Entity filters
  customer_id?: number
  employee_id?: number
  product_id?: number
  sku_id?: number
}

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

type Pagination = {
  page: number
  limit: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
  returned: number
}

type SortKey = 'date_desc' | 'date_asc' | 'price_desc' | 'price_asc' | 'margin_desc' | 'margin_asc'

const LIMIT = 50

const sortLabels: Record<SortKey, string> = {
  date_desc: 'Newest first',
  date_asc: 'Oldest first',
  price_desc: 'Highest price',
  price_asc: 'Lowest price',
  margin_desc: 'Highest margin',
  margin_asc: 'Lowest margin',
}

const sortToApiParams = (key: SortKey): { sort_by: string; sort_order: 'asc' | 'desc' } => {
  switch (key) {
    case 'date_desc': return { sort_by: 'sold_on', sort_order: 'desc' }
    case 'date_asc':  return { sort_by: 'sold_on', sort_order: 'asc' }
    case 'price_desc': return { sort_by: 'total_price', sort_order: 'desc' }
    case 'price_asc':  return { sort_by: 'total_price', sort_order: 'asc' }
    case 'margin_desc': return { sort_by: 'profit_margin', sort_order: 'desc' }
    case 'margin_asc':  return { sort_by: 'profit_margin', sort_order: 'asc' }
  }
}

const Sales = () => {
  const [sales, setSales] = useState<Sale[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<SaleFiltersType>({})
  const [sortKey, setSortKey] = useState<SortKey>('date_desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [offcanvasSaleId, setOffcanvasSaleId] = useState<number | null>(null)
  const [offcanvasOpen, setOffcanvasOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [metrics, setMetrics] = useState<{
    total_sales: number
    total_revenue: number
    total_profit: number
    debt_sales_count: number
    total_outstanding_debt: number
  } | null>(null)

  const sortMenuRef = useRef<HTMLDivElement>(null)

  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
  }
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  const loadSales = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const { sort_by, sort_order } = sortToApiParams(sortKey)

      const res = await window.api.sales.getAllSales({
        page,
        limit: LIMIT,
        ...filters,
        include_customer: true,
        include_employee: true,
        include_stock_purchase: true,
        include_payments: true,
        include_summary: true,
        sort_by: sort_by as any,
        sort_order,
      })

      if (res.success && res.data) {
        const items = res.data.sales.filter(s => 
          filters.is_deleted ? s.is_deleted : !s.is_deleted
        )
        setSales(items as Sale[])

        const pag = res.data.pagination
        if (pag) {
          setPagination({
            page: pag.page ?? page,
            limit: pag.limit ?? LIMIT,
            total: pag.total ?? 0,
            total_pages: pag.total_pages ?? Math.ceil((pag.total ?? 0) / LIMIT),
            has_next: pag.has_next ?? false,
            has_prev: pag.has_prev ?? false,
            returned: pag.returned ?? items.length,
          })
        }

        if (res.data.summary) {
          setMetrics({
            total_sales: res.data.summary.total_sales ?? 0,
            total_revenue: res.data.summary.total_revenue ?? 0,
            total_profit: res.data.summary.total_profit ?? 0,
            debt_sales_count: res.data.summary.debt_sales_count ?? 0,
            total_outstanding_debt: res.data.summary.total_outstanding_debt ?? 0,
          })
        }
      } else {
        addToast(res.message || 'Failed to load sales', 'error')
      }
    } catch {
      addToast('An error occurred while loading sales', 'error')
    } finally {
      setLoading(false)
    }
  }, [filters, sortKey])

  useEffect(() => {
    loadSales(currentPage)
  }, [loadSales, currentPage])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setShowSortMenu(false)
    }
    if (showSortMenu) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showSortMenu])

  const handleFilterChange = (newFilters: SaleFiltersType) => {
    setFilters(newFilters)
    setCurrentPage(1)
    setExpandedId(null)
  }

  const handleSortChange = (key: SortKey) => {
    setSortKey(key)
    setCurrentPage(1)
    setShowSortMenu(false)
  }

  const handleCancel = async (saleId: number, reason: string) => {
    try {
      const res = await window.api.sales.updateSale({
        id: saleId,
        action: 'cancel',
        reason,
      })
      if (!res.success) throw new Error(res.message)
      addToast(`Sale #${saleId} has been cancelled`, 'success')
      if (sales.length === 1 && currentPage > 1) {
        setCurrentPage(p => p - 1)
      } else {
        await loadSales(currentPage)
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to cancel sale', 'error')
    }
  }

  const handleRestore = async (saleId: number) => {
    try {
      const res = await window.api.sales.softDeleteSale({ id: saleId, restore: true })
      if (!res.success) throw new Error(res.message)
      addToast(`Sale #${saleId} has been restored`, 'success')
      await loadSales(currentPage)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to restore sale', 'error')
    }
  }

  const handleEdit = (id: number) => {
    setOffcanvasSaleId(id)
    setOffcanvasOpen(true)
  }

  const handlePayment = (id: number) => {
    setOffcanvasSaleId(id)
    setOffcanvasOpen(true)
  }

  const handleSaleCreated = async () => {
    addToast('Sale created successfully!', 'success')
    setCurrentPage(1)
    await loadSales(1)
  }

  const handleSaleUpdated = async () => {
    addToast('Sale updated successfully!', 'success')
    await loadSales(currentPage)
  }

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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'XAF' }).format(val)
  }

  const activeFilterCount = [
    filters.status && filters.status.length > 0,
    filters.is_debt_sale,
    filters.date_preset,
    filters.min_price,
    filters.max_price,
    filters.min_margin,
    filters.max_margin,
    filters.margin_status,
    filters.debt_status && filters.debt_status !== 'all',
    filters.search,
    filters.customer_id,
    filters.employee_id,
    filters.product_id,
    filters.sku_id,
  ].filter(Boolean).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50">
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      <CreateSaleModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleSaleCreated}
      />

      <SaleOffcanvas
        saleId={offcanvasSaleId}
        open={offcanvasOpen}
        onClose={() => setOffcanvasOpen(false)}
        onUpdated={handleSaleUpdated}
      />

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5 3.5l3 3L17 9M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Sales</h1>
                {metrics && (
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {metrics.total_sales} sales
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Revenue: {formatCurrency(metrics.total_revenue)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      Profit: {formatCurrency(metrics.total_profit)}
                    </span>
                    {metrics.debt_sales_count > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Debt: {formatCurrency(metrics.total_outstanding_debt)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {/* Filters */}
              <SaleFilters
                filters={filters}
                onChange={handleFilterChange}
              />

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
                      { group: 'Date', keys: ['date_desc', 'date_asc'] as SortKey[] },
                      { group: 'Price', keys: ['price_desc', 'price_asc'] as SortKey[] },
                      { group: 'Margin', keys: ['margin_desc', 'margin_asc'] as SortKey[] },
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

              {/* <button
                onClick={() => setShowCreateModal(true)}
                className="px-3 sm:px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">New Sale</span>
                <span className="sm:hidden">Sell</span>
              </button> */}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
            {[
              { label: 'Product', span: 3 },
              { label: 'Customer', span: 2 },
              { label: 'Qty', span: 1 },
              { label: 'Price', span: 1 },
              { label: 'Margin', span: 1 },
              { label: 'Status', span: 2 },
              { label: 'Payment', span: 1 },
              { label: '', span: 1 },
            ].map(({ label, span }) => (
              <div key={label} className={`col-span-${span}`}>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <SaleSkeleton />
          ) : sales.length === 0 ? (
            <div className="py-16 sm:py-24 px-4 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-gray-100">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5 3.5l3 3L17 9M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                {Object.keys(filters).length > 0 ? 'No sales found' : 'No sales yet'}
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                {Object.keys(filters).length > 0
                  ? 'Try adjusting your filters.'
                  : 'Start recording your sales by creating your first sale.'}
              </p>
              {Object.keys(filters).length > 0 ? (
                <button
                  onClick={() => handleFilterChange({})}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  Clear filters
                </button>
              ) : (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create your first sale
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sales.map(sale => (
                <SaleCard
                  key={sale.id}
                  sale={sale}
                  expanded={expandedId === sale.id}
                  onToggle={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                  onCancel={handleCancel}
                  onRestore={handleRestore}
                  onEdit={handleEdit}
                  onPayment={handlePayment}
                  onUpdated={handleSaleUpdated}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
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
              <span className="font-semibold text-gray-700">{pagination.total}</span> sales
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
      </div>
    </div>
  )
}

export default Sales