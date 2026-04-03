import TransactionFilters from '@renderer/components/transactions/transaction-filters'
import { useCallback, useEffect, useRef, useState } from 'react'
import CreateTransactionModal from './create-transaction-modal'
import TransactionCard from './transaction-card'
import TransactionSkeleton from './transaction-skeleton'
import type {
  TransactionFilters as Filters,
  Pagination,
  SortKey,
  TransactionMetrics,
  TransactionType,
  TransactionWithEmployee
} from './types'
import { formatCurrency, sortLabels, sortToApiParams } from './types'

const LIMIT = 50

const Transactions = () => {
  const [transactions, setTransactions] = useState<TransactionWithEmployee[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [metrics, setMetrics] = useState<TransactionMetrics | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>({})
  const [sortKey, setSortKey] = useState<SortKey>('date_desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' }[]>([])

  const sortMenuRef = useRef<HTMLDivElement>(null)

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  const convertTransaction = (apiTransaction: any): TransactionWithEmployee => {
  return {
    ...apiTransaction,
    transaction_type: apiTransaction.transaction_type as TransactionType
  }
}

  const loadTransactions = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const { sort_by, sort_order } = sortToApiParams(sortKey)
      const res = await window.api.transactions.getAllTransactions({
        page,
        limit: LIMIT,
        ...filters,
        sort_by,
        sort_order,
      })

      if (res.success && res.data) {
        const convertedItems = res.data.items.map(convertTransaction)
        setTransactions(convertedItems)
        setPagination(res.data.pagination)
        setMetrics(res.data.summary)
      } else {
        addToast(res.message || 'Failed to load transactions', 'error')
      }
    } catch {
      addToast('An error occurred while loading transactions', 'error')
    } finally {
      setLoading(false)
    }
  }, [filters, sortKey])

  useEffect(() => {
    loadTransactions(currentPage)
  }, [loadTransactions, currentPage])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setShowSortMenu(false)
    }
    if (showSortMenu) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showSortMenu])

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters)
    setCurrentPage(1)
    setExpandedId(null)
  }

  const handleSortChange = (key: SortKey) => {
    setSortKey(key)
    setCurrentPage(1)
    setShowSortMenu(false)
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await window.api.transactions.softDeleteTransaction({ id })
      if (!res.success) throw new Error(res.message)
      addToast('Transaction deleted', 'success')
      if (transactions.length === 1 && currentPage > 1) {
        setCurrentPage(p => p - 1)
      } else {
        await loadTransactions(currentPage)
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete transaction', 'error')
    }
  }

  const handleRestore = async (id: number) => {
    try {
      const res = await window.api.transactions.softDeleteTransaction({ id, restore: true })
      if (!res.success) throw new Error(res.message)
      addToast('Transaction restored', 'success')
      await loadTransactions(currentPage)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to restore transaction', 'error')
    }
  }

  const handleEdit = (id: number) => {
    // Will open edit modal
    console.log('Edit transaction:', id)
  }

  const handleSync = (id: number) => {
    console.log('Sync transaction:', id)
  }

  const handleTransactionCreated = () => {
    addToast('Transaction created successfully!', 'success')
    setCurrentPage(1)
    loadTransactions(1)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white pointer-events-auto ${
              t.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          >
            {t.type === 'success' ? (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {t.message}
          </div>
        ))}
      </div>

      <CreateTransactionModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleTransactionCreated}
      />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-md flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Transactions</h1>
                {metrics && (
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      In: {formatCurrency(metrics.total_cashin)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      Out: {formatCurrency(metrics.total_cashout)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      Transfer: {formatCurrency(metrics.total_transfer)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">
                      Net: {formatCurrency(metrics.net_cashflow)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <TransactionFilters
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
                      { group: 'Amount', keys: ['amount_desc', 'amount_asc'] as SortKey[] },
                      { group: 'Type', keys: ['type_asc', 'type_desc'] as SortKey[] },
                    ].map(({ group, keys }, gi) => (
                      <div key={group}>
                        {gi > 0 && <div className="border-t border-gray-100 my-1" />}
                        <div className="px-3 py-1.5">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{group}</p>
                        </div>
                        {keys.map(k => (
                          <button
                            key={k}
                            onClick={() => handleSortChange(k)}
                            className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                              sortKey === k ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
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

              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3 sm:px-5 py-2.5 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">New Transaction</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
            {[
              { label: 'Type', span: 1 },
              { label: 'Description', span: 3 },
              { label: 'Amount', span: 2 },
              { label: 'Recorded By', span: 2 },
              { label: 'Date', span: 2 },
              { label: 'Status', span: 1 },
              { label: '', span: 1 },
            ].map(({ label, span }) => (
              <div key={label} className={`col-span-${span}`}>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <TransactionSkeleton />
          ) : transactions.length === 0 ? (
            <div className="py-16 sm:py-24 px-4 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-gray-100">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                {filters.search || filters.transaction_type !== 'all' ? 'No transactions found' : 'No transactions yet'}
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                {filters.search || filters.transaction_type !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'Record your first transaction to start tracking cash flow.'}
              </p>
              {filters.search || filters.transaction_type !== 'all' ? (
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
                  Add your first transaction
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {transactions.map(transaction => (
                <TransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  expanded={expandedId === transaction.id}
                  onToggle={() => setExpandedId(expandedId === transaction.id ? null : transaction.id)}
                  onDelete={handleDelete}
                  onRestore={handleRestore}
                  onEdit={handleEdit}
                  onSync={handleSync}
                  onUpdated={() => loadTransactions(currentPage)} 
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
              <span className="font-semibold text-gray-700">{pagination.total}</span> transactions
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

export default Transactions