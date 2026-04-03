// src/components/public/sales-point/transaction-modals.tsx

import { formatCurrency, formatDateTime } from '@renderer/components/public/types/utils'
import React, { useEffect, useState } from 'react'

// ============================================================================
// Add Transaction Modal
// ============================================================================

interface AddTransactionModalProps {
  onClose: () => void
  onSuccess?: () => void
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ onClose, onSuccess }) => {
  const [type, setType] = useState<'cashin' | 'cashout' | 'transfer'>('cashin')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const sessionRes = await window.api.employees.getCurrentSession()
      if (!sessionRes.success || !sessionRes.data) {
        setError('No active session. Please log in again.')
        setSubmitting(false)
        return
      }

      const result = await window.api.transactions.createTransaction({
        transaction_type: type,
        amount: parseFloat(amount),
        description: description || undefined
      })

      if (result.success) {
        if (onSuccess) onSuccess()
        onClose()
      } else {
        setError(result.message || 'Failed to create transaction')
      }
    } catch (e: any) {
      setError(e?.message || 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Add Transaction</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Transaction Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Transaction Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setType('cashin')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                  type === 'cashin'
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'border-slate-200 text-slate-600 hover:border-green-300 hover:bg-green-50'
                }`}
              >
                <span className="text-xl">💰</span>
                <span className="text-xs font-bold">Cash In</span>
              </button>
              <button
                onClick={() => setType('cashout')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                  type === 'cashout'
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50'
                }`}
              >
                <span className="text-xl">💸</span>
                <span className="text-xs font-bold">Cash Out</span>
              </button>
              <button
                onClick={() => setType('transfer')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                  type === 'transfer'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <span className="text-xl">💱</span>
                <span className="text-xs font-bold">Transfer</span>
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">XAF</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-16 pr-4 py-3 text-lg font-bold border-2 border-slate-200 rounded-xl
                  focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Daily sales deposit, Supplier payment, etc."
              rows={3}
              className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl resize-none
                focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100
                placeholder:text-slate-400"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-semibold text-slate-600 border-2 border-slate-200 rounded-xl
                hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !amount}
              className="flex-1 py-3 text-sm font-bold bg-blue-600 text-white rounded-xl
                hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </>
              ) : (
                'Add Transaction'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// My Transactions Modal with Full Filters and Live Stats
// ============================================================================

interface MyTransactionsModalProps {
  onClose: () => void
}

interface Transaction {
  id: number
  transaction_type: 'cashin' | 'cashout' | 'transfer'
  amount: number
  description: string | null
  created_on: number
  employee_name?: string
  employee_username?: string
}

interface TransactionFilters {
  search: string
  type: 'all' | 'cashin' | 'cashout' | 'transfer'
  datePreset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year' | 'custom' | 'all'
  dateFrom: string
  dateTo: string
  minAmount: string
  maxAmount: string
  sortBy: 'created_on' | 'amount' | 'transaction_type'
  sortOrder: 'asc' | 'desc'
}

interface FilteredStats {
  total_cashin: number
  total_cashout: number
  total_transfer: number
  net_cashflow: number
  count: number
  average: number
}

interface EditTransactionModalProps {
  transaction: Transaction
  onClose: () => void
  onUpdated: () => void
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({ transaction, onClose, onUpdated }) => {
  const [type, setType] = useState(transaction.transaction_type)
  const [amount, setAmount] = useState(transaction.amount.toString())
  const [description, setDescription] = useState(transaction.description || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const result = await window.api.transactions.updateTransaction({
        id: transaction.id,
        transaction_type: type,
        amount: parseFloat(amount),
        description: description || undefined
      })

      if (result.success) {
        onUpdated()
        onClose()
      } else {
        setError(result.message || 'Failed to update transaction')
      }
    } catch (e: any) {
      setError(e?.message || 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this transaction?')) return

    setSubmitting(true)
    setError('')

    try {
      const result = await window.api.transactions.softDeleteTransaction({
        id: transaction.id
      })

      if (result.success) {
        onUpdated()
        onClose()
      } else {
        setError(result.message || 'Failed to delete transaction')
      }
    } catch (e: any) {
      setError(e?.message || 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Edit Transaction</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Transaction Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Transaction Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setType('cashin')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                  type === 'cashin'
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'border-slate-200 text-slate-600 hover:border-green-300 hover:bg-green-50'
                }`}
              >
                <span className="text-xl">💰</span>
                <span className="text-xs font-bold">Cash In</span>
              </button>
              <button
                onClick={() => setType('cashout')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                  type === 'cashout'
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50'
                }`}
              >
                <span className="text-xl">💸</span>
                <span className="text-xs font-bold">Cash Out</span>
              </button>
              <button
                onClick={() => setType('transfer')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                  type === 'transfer'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <span className="text-xl">💱</span>
                <span className="text-xs font-bold">Transfer</span>
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">XAF</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-16 pr-4 py-3 text-lg font-bold border-2 border-slate-200 rounded-xl
                  focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl resize-none
                focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleDelete}
              disabled={submitting}
              className="px-4 py-3 text-sm font-semibold text-red-600 border-2 border-red-200 rounded-xl
                hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-semibold text-slate-600 border-2 border-slate-200 rounded-xl
                hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 text-sm font-bold bg-blue-600 text-white rounded-xl
                hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const MyTransactionsModal: React.FC<MyTransactionsModalProps> = ({ onClose }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [filteredStats, setFilteredStats] = useState<FilteredStats>({
    total_cashin: 0,
    total_cashout: 0,
    total_transfer: 0,
    net_cashflow: 0,
    count: 0,
    average: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalStats, setTotalStats] = useState({
    total_cashin: 0,
    total_cashout: 0,
    total_transfer: 0,
    net_cashflow: 0
  })

  // Filter state
  const [filters, setFilters] = useState<TransactionFilters>({
    search: '',
    type: 'all',
    datePreset: 'all',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    sortBy: 'created_on',
    sortOrder: 'desc'
  })

  const [tempFilters, setTempFilters] = useState<TransactionFilters>(filters)

  const loadTransactions = async (pageNum: number, append = false) => {
    try {
      const sessionRes = await window.api.employees.getCurrentSession()
      if (!sessionRes.success || !sessionRes.data) {
        setError('No active session')
        setLoading(false)
        return
      }

      const result = await window.api.transactions.getAllTransactions({
        page: pageNum,
        limit: 50,
        recorded_by: sessionRes.data.employee.id,
        include_employee_details: true,
        sort_by: 'created_on',
        sort_order: 'desc'
      })

      if (result.success && result.data) {
        const newTransactions = result.data.items as Transaction[]
        if (append) {
          setTransactions(prev => [...prev, ...newTransactions])
        } else {
          setTransactions(newTransactions)
        }
        setHasMore(result.data.pagination?.has_next ?? false)
        
        if (result.data.summary) {
          setTotalStats({
            total_cashin: result.data.summary?.total_cashin || 0,
            total_cashout: result.data.summary?.total_cashout || 0,
            total_transfer: result.data.summary?.total_transfer || 0,
            net_cashflow: result.data.summary?.net_cashflow || 0
          })
        }
      } else {
        setError(result.message || 'Failed to load transactions')
      }
    } catch (e: any) {
      setError(e?.message || 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  // Calculate stats for filtered transactions
  const calculateFilteredStats = (filtered: Transaction[]) => {
    const cashinTotal = filtered
      .filter(t => t.transaction_type === 'cashin')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const cashoutTotal = filtered
      .filter(t => t.transaction_type === 'cashout')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const transferTotal = filtered
      .filter(t => t.transaction_type === 'transfer')
      .reduce((sum, t) => sum + t.amount, 0)

    const netCashflow = cashinTotal - cashoutTotal
    const count = filtered.length
    const average = count > 0 ? (cashinTotal + cashoutTotal + transferTotal) / count : 0

    setFilteredStats({
      total_cashin: cashinTotal,
      total_cashout: cashoutTotal,
      total_transfer: transferTotal,
      net_cashflow: netCashflow,
      count,
      average
    })
  }

  // Apply filters to transactions
  useEffect(() => {
    if (transactions.length === 0) {
      setFilteredTransactions([])
      calculateFilteredStats([])
      return
    }

    let filtered = [...transactions]

    // Search filter (description)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(t => 
        t.description?.toLowerCase().includes(searchLower) ||
        t.id.toString().includes(searchLower)
      )
    }

    // Type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(t => t.transaction_type === filters.type)
    }

    // Date range filter
    if (filters.datePreset !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
      
      let fromTimestamp: number | null = null
      let toTimestamp: number | null = null

      switch (filters.datePreset) {
        case 'today':
          fromTimestamp = today
          toTimestamp = Math.floor(Date.now() / 1000)
          break
        case 'yesterday':
          fromTimestamp = today - 86400
          toTimestamp = today
          break
        case 'this_week':
          const startOfWeek = new Date(now)
          startOfWeek.setDate(now.getDate() - now.getDay())
          startOfWeek.setHours(0, 0, 0, 0)
          fromTimestamp = Math.floor(startOfWeek.getTime() / 1000)
          toTimestamp = Math.floor(Date.now() / 1000)
          break
        case 'this_month':
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
          fromTimestamp = Math.floor(startOfMonth.getTime() / 1000)
          toTimestamp = Math.floor(Date.now() / 1000)
          break
        case 'this_year':
          const startOfYear = new Date(now.getFullYear(), 0, 1)
          fromTimestamp = Math.floor(startOfYear.getTime() / 1000)
          toTimestamp = Math.floor(Date.now() / 1000)
          break
        case 'custom':
          if (filters.dateFrom) {
            fromTimestamp = Math.floor(new Date(filters.dateFrom).getTime() / 1000)
          }
          if (filters.dateTo) {
            toTimestamp = Math.floor(new Date(filters.dateTo).getTime() / 1000) + 86399
          }
          break
      }

      if (fromTimestamp !== null) {
        filtered = filtered.filter(t => t.created_on >= fromTimestamp!)
      }
      if (toTimestamp !== null) {
        filtered = filtered.filter(t => t.created_on <= toTimestamp!)
      }
    }

    // Amount range filter
    if (filters.minAmount) {
      const min = parseFloat(filters.minAmount)
      filtered = filtered.filter(t => t.amount >= min)
    }
    if (filters.maxAmount) {
      const max = parseFloat(filters.maxAmount)
      filtered = filtered.filter(t => t.amount <= max)
    }

    // Calculate stats BEFORE sorting (stats should be based on filtered data regardless of sort order)
    calculateFilteredStats(filtered)

    // Sorting (for display only)
    filtered.sort((a, b) => {
      let comparison = 0
      switch (filters.sortBy) {
        case 'created_on':
          comparison = a.created_on - b.created_on
          break
        case 'amount':
          comparison = a.amount - b.amount
          break
        case 'transaction_type':
          comparison = a.transaction_type.localeCompare(b.transaction_type)
          break
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison
    })

    setFilteredTransactions(filtered)
  }, [transactions, filters])

  useEffect(() => {
    loadTransactions(1)
  }, [])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    loadTransactions(nextPage, true)
  }

  const applyFilters = () => {
    setFilters(tempFilters)
    setShowFilters(false)
  }

  const resetFilters = () => {
    const defaultFilters: TransactionFilters = {
      search: '',
      type: 'all',
      datePreset: 'all',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
      sortBy: 'created_on',
      sortOrder: 'desc'
    }
    setTempFilters(defaultFilters)
    setFilters(defaultFilters)
    setShowFilters(false)
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (filters.search) count++
    if (filters.type !== 'all') count++
    if (filters.datePreset !== 'all') count++
    if (filters.minAmount) count++
    if (filters.maxAmount) count++
    return count
  }

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'cashin':
        return { bg: 'bg-green-100', text: 'text-green-700', icon: '💰', label: 'Cash In' }
      case 'cashout':
        return { bg: 'bg-red-100', text: 'text-red-700', icon: '💸', label: 'Cash Out' }
      case 'transfer':
        return { bg: 'bg-blue-100', text: 'text-blue-700', icon: '💱', label: 'Transfer' }
      default:
        return { bg: 'bg-slate-100', text: 'text-slate-700', icon: '❓', label: type }
    }
  }

  const getDatePresetLabel = (preset: string) => {
    switch (preset) {
      case 'today': return 'Today'
      case 'yesterday': return 'Yesterday'
      case 'this_week': return 'This Week'
      case 'this_month': return 'This Month'
      case 'this_year': return 'This Year'
      case 'custom': return 'Custom Range'
      default: return 'All Time'
    }
  }

  const isFiltered = getActiveFilterCount() > 0

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        
        <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">My Transactions</h2>
                <p className="text-blue-200 text-sm mt-1">View and manage your transaction history</p>
              </div>
              <button onClick={onClose} className="text-white/70 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Stats Summary - Shows Filtered Stats when filters are active */}
            {!loading && !error && (
              <div className="mt-4">
                {/* Filter indicator */}
                {isFiltered && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                      Filtered Results
                    </span>
                    <span className="text-blue-200 text-sm">
                      Showing {filteredStats.count} of {transactions.length} transactions
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-5 gap-3">
                  {/* Cash In */}
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-blue-200 text-xs">Cash In</p>
                    <p className="text-white font-bold text-lg">
                      {formatCurrency(isFiltered ? filteredStats.total_cashin : totalStats.total_cashin)}
                    </p>
                    {isFiltered && filteredStats.total_cashin !== totalStats.total_cashin && (
                      <p className="text-blue-300 text-[10px] mt-1">
                        of {formatCurrency(totalStats.total_cashin)} total
                      </p>
                    )}
                  </div>

                  {/* Cash Out */}
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-blue-200 text-xs">Cash Out</p>
                    <p className="text-white font-bold text-lg">
                      {formatCurrency(isFiltered ? filteredStats.total_cashout : totalStats.total_cashout)}
                    </p>
                    {isFiltered && filteredStats.total_cashout !== totalStats.total_cashout && (
                      <p className="text-blue-300 text-[10px] mt-1">
                        of {formatCurrency(totalStats.total_cashout)} total
                      </p>
                    )}
                  </div>

                  {/* Transfers */}
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-blue-200 text-xs">Transfers</p>
                    <p className="text-white font-bold text-lg">
                      {formatCurrency(isFiltered ? filteredStats.total_transfer : totalStats.total_transfer)}
                    </p>
                    {isFiltered && filteredStats.total_transfer !== totalStats.total_transfer && (
                      <p className="text-blue-300 text-[10px] mt-1">
                        of {formatCurrency(totalStats.total_transfer)} total
                      </p>
                    )}
                  </div>

                  {/* Net Cashflow */}
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-blue-200 text-xs">Net Cashflow</p>
                    <p className={`font-bold text-lg ${
                      (isFiltered ? filteredStats.net_cashflow : totalStats.net_cashflow) >= 0 
                        ? 'text-green-300' 
                        : 'text-red-300'
                    }`}>
                      {formatCurrency(Math.abs(isFiltered ? filteredStats.net_cashflow : totalStats.net_cashflow))}
                      <span className="text-xs ml-1">
                        {(isFiltered ? filteredStats.net_cashflow : totalStats.net_cashflow) >= 0 ? '↑' : '↓'}
                      </span>
                    </p>
                  </div>

                  {/* Transaction Count */}
                  {/* <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-blue-200 text-xs">Count</p>
                    <p className="text-white font-bold text-lg">
                      {isFiltered ? filteredStats.count : transactions.length}
                    </p>
                    <p className="text-blue-300 text-[10px] mt-1">transactions</p>
                  </div> */}

                  {/* Average */}
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-blue-200 text-xs">Average</p>
                    <p className="text-white font-bold text-lg">
                      {formatCurrency(isFiltered ? filteredStats.average : 
                        (transactions.length > 0 
                          ? (totalStats.total_cashin + totalStats.total_cashout + totalStats.total_transfer) / transactions.length 
                          : 0
                        )
                      )}
                    </p>
                    <p className="text-blue-300 text-[10px] mt-1">per transaction</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Filter Bar */}
          <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-48">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" 
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={tempFilters.search}
                  onChange={(e) => setTempFilters({ ...tempFilters, search: e.target.value })}
                  placeholder="Search by description..."
                  className="w-full pl-9 pr-4 py-2 text-sm border-2 border-slate-200 rounded-xl
                    focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Filter Toggle Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                  showFilters || getActiveFilterCount() > 0
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Filters
                {getActiveFilterCount() > 0 && (
                  <span className="bg-white text-blue-600 px-1.5 py-0.5 rounded-full text-xs font-bold">
                    {getActiveFilterCount()}
                  </span>
                )}
              </button>

              {/* Active Filter Indicators */}
              {filters.type !== 'all' && (
                <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold flex items-center gap-1">
                  Type: {filters.type}
                  <button onClick={() => {
                    const newFilters = { ...filters, type: 'all' as const }
                    setFilters(newFilters)
                    setTempFilters(newFilters)
                  }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}

              {filters.datePreset !== 'all' && (
                <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold flex items-center gap-1">
                  {getDatePresetLabel(filters.datePreset)}
                  <button onClick={() => {
                    const newFilters = { ...filters, datePreset: 'all' as const, dateFrom: '', dateTo: '' }
                    setFilters(newFilters)
                    setTempFilters(newFilters)
                  }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}

              {(filters.minAmount || filters.maxAmount) && (
                <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold flex items-center gap-1">
                  Amount: {filters.minAmount && `≥${filters.minAmount}`} {filters.maxAmount && `≤${filters.maxAmount}`}
                  <button onClick={() => {
                    const newFilters = { ...filters, minAmount: '', maxAmount: '' }
                    setFilters(newFilters)
                    setTempFilters(newFilters)
                  }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}

              {/* Results Count */}
              <span className="ml-auto text-sm text-slate-500">
                Showing <span className="font-bold text-slate-700">{filteredTransactions.length}</span> of {transactions.length} transactions
              </span>
            </div>

            {/* Expanded Filters Panel */}
            {showFilters && (
              <div className="mt-4 p-4 bg-white rounded-xl border-2 border-slate-200 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Type Filter */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Transaction Type
                    </label>
                    <select
                      value={tempFilters.type}
                      onChange={(e) => setTempFilters({ ...tempFilters, type: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                        focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All Types</option>
                      <option value="cashin">Cash In</option>
                      <option value="cashout">Cash Out</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </div>

                  {/* Date Preset */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Date Range
                    </label>
                    <select
                      value={tempFilters.datePreset}
                      onChange={(e) => setTempFilters({ ...tempFilters, datePreset: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                        focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="this_week">This Week</option>
                      <option value="this_month">This Month</option>
                      <option value="this_year">This Year</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>

                  {/* Custom Date Range */}
                  {tempFilters.datePreset === 'custom' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                          From Date
                        </label>
                        <input
                          type="date"
                          value={tempFilters.dateFrom}
                          onChange={(e) => setTempFilters({ ...tempFilters, dateFrom: e.target.value })}
                          className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                            focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                          To Date
                        </label>
                        <input
                          type="date"
                          value={tempFilters.dateTo}
                          onChange={(e) => setTempFilters({ ...tempFilters, dateTo: e.target.value })}
                          className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                            focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Amount Range */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Min Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">XAF</span>
                      <input
                        type="number"
                        min="0"
                        value={tempFilters.minAmount}
                        onChange={(e) => setTempFilters({ ...tempFilters, minAmount: e.target.value })}
                        placeholder="Min"
                        className="w-full pl-12 pr-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                          focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Max Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">XAF</span>
                      <input
                        type="number"
                        min="0"
                        value={tempFilters.maxAmount}
                        onChange={(e) => setTempFilters({ ...tempFilters, maxAmount: e.target.value })}
                        placeholder="Max"
                        className="w-full pl-12 pr-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                          focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Sort Options */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Sort By
                    </label>
                    <select
                      value={tempFilters.sortBy}
                      onChange={(e) => setTempFilters({ ...tempFilters, sortBy: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                        focus:outline-none focus:border-blue-500"
                    >
                      <option value="created_on">Date</option>
                      <option value="amount">Amount</option>
                      <option value="transaction_type">Type</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Sort Order
                    </label>
                    <select
                      value={tempFilters.sortOrder}
                      onChange={(e) => setTempFilters({ ...tempFilters, sortOrder: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl
                        focus:outline-none focus:border-blue-500"
                    >
                      <option value="desc">Newest First</option>
                      <option value="asc">Oldest First</option>
                    </select>
                  </div>
                </div>

                {/* Filter Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 border-2 border-slate-200 rounded-xl
                      hover:bg-slate-50 transition-colors"
                  >
                    Reset All
                  </button>
                  <button
                    onClick={applyFilters}
                    className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl
                      hover:bg-blue-700 transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <svg className="w-10 h-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-slate-500 mt-4">Loading transactions...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-red-600 font-semibold mt-4">Failed to load transactions</p>
                <p className="text-xs text-slate-400 mt-1">{error}</p>
                <button
                  onClick={() => loadTransactions(1)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <svg className="w-16 h-16 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold mt-4">No transactions found</p>
                <p className="text-xs mt-1">Try adjusting your filters or add a new transaction</p>
                <button
                  onClick={resetFilters}
                  className="mt-4 px-4 py-2 text-sm font-semibold text-blue-600 border-2 border-blue-200 rounded-xl
                    hover:bg-blue-50 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((transaction) => {
                  const styles = getTypeStyles(transaction.transaction_type)
                  return (
                    <button
                      key={transaction.id}
                      onClick={() => setSelectedTransaction(transaction)}
                      className="w-full flex items-center gap-4 p-4 bg-white border-2 border-slate-200 rounded-xl
                        hover:border-blue-400 hover:bg-blue-50/30 transition-all text-left"
                    >
                      <div className={`w-12 h-12 rounded-xl ${styles.bg} flex items-center justify-center shrink-0`}>
                        <span className="text-xl">{styles.icon}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles.bg} ${styles.text}`}>
                            {styles.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDateTime(transaction.created_on)}
                          </span>
                          {transaction.employee_name && (
                            <span className="text-xs text-slate-400">
                              • {transaction.employee_name}
                            </span>
                          )}
                        </div>
                        
                        <p className="font-bold text-slate-800 text-lg mt-1">
                          {formatCurrency(transaction.amount)}
                        </p>
                        
                        {transaction.description && (
                          <p className="text-sm text-slate-500 mt-0.5 truncate">
                            {transaction.description}
                          </p>
                        )}
                      </div>
                      
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )
                })}

                {hasMore && (
                  <button
                    onClick={handleLoadMore}
                    className="w-full py-3 text-sm font-semibold text-blue-600 border-2 border-blue-200 rounded-xl
                      hover:bg-blue-50 transition-colors"
                  >
                    Load More
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {selectedTransaction && (
        <EditTransactionModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onUpdated={() => {
            setSelectedTransaction(null)
            loadTransactions(1)
          }}
        />
      )}
    </>
  )
}