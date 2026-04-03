import React, { useState } from 'react'
import EditTransactionModal from './edit-transaction-modal'
import type { TransactionWithEmployee } from './types'

interface Props {
  transaction: TransactionWithEmployee
  expanded: boolean
  onToggle: () => void
  onDelete: (id: number) => void
  onRestore: (id: number) => void
  onEdit: (id: number) => void
  onSync: (id: number) => void
  onUpdated?: () => void  // Add this prop
}

const formatDate = (ts: number) => {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 2,
  }).format(val)
}

const typeStyles = {
  cashin: {
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    icon: (
      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
      </svg>
    ),
    text: 'text-emerald-600'
  },
  cashout: {
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
    icon: (
      <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
      </svg>
    ),
    text: 'text-red-600'
  },
  transfer: {
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    icon: (
      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    text: 'text-blue-600'
  },
}

const TransactionCard = ({ 
  transaction, 
  expanded, 
  onToggle, 
  onDelete, 
  onRestore, 
  onEdit, 
  onSync,
  onUpdated 
}: Props) => {
  const style = typeStyles[transaction.transaction_type]
  const isDeleted = transaction.is_deleted
  const [showEditModal, setShowEditModal] = useState(false)

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowEditModal(true)
  }

  const handleEditSuccess = () => {
    setShowEditModal(false)
    if (onUpdated) onUpdated()
    if (onEdit) onEdit(transaction.id)
  }

  return (
    <>
      <div className={`group border-b border-gray-100 last:border-0 transition-colors duration-150 ${expanded ? 'bg-gray-50/80' : 'hover:bg-gray-50/50'}`}>
        {/* Collapsed Row */}
        <div
          className="grid grid-cols-12 items-center gap-4 px-5 py-3 cursor-pointer select-none"
          onClick={onToggle}
        >
          {/* Type Icon */}
          <div className="col-span-1">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
              expanded ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
            }`}>
              {style.icon}
            </div>
          </div>

          {/* Description */}
          <div className="col-span-3 min-w-0">
            <p className={`text-sm font-semibold truncate leading-tight ${isDeleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
              {transaction.description || '—'}
            </p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              ID: #{String(transaction.id).padStart(4, '0')}
            </p>
          </div>

          {/* Amount */}
          <div className="col-span-2">
            <span className={`text-sm font-bold ${style.text}`}>
              {transaction.transaction_type === 'cashin' ? '+' : 
               transaction.transaction_type === 'cashout' ? '-' : ''}
              {formatCurrency(transaction.amount)}
            </span>
          </div>

          {/* Recorded By */}
          <div className="col-span-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {transaction.employee_name || `Employee #${transaction.recorded_by}`}
            </span>
          </div>

          {/* Date */}
          <div className="col-span-2">
            <span className="text-xs text-gray-500">{formatDate(transaction.created_on)}</span>
          </div>

          {/* Status Dot */}
          <div className="col-span-1">
            <div className="flex items-center">
              <div className={`w-1.5 h-1.5 rounded-full ${style.dot} ${isDeleted ? 'opacity-30' : ''}`} />
              <span className="ml-1.5 text-xs text-gray-400 hidden lg:inline">
                {transaction.is_deleted ? 'Deleted' : 'Active'}
              </span>
            </div>
          </div>

          {/* Chevron */}
          <div className="col-span-1 flex justify-end">
            <svg className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180 text-blue-500' : 'text-gray-300 group-hover:text-gray-500'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Expanded Panel */}
        {expanded && (
          <div className="flex border-t border-gray-100" onClick={e => e.stopPropagation()}>
            {/* LEFT: Details */}
            <div className="flex-1 min-w-0 px-5 py-4 space-y-4 overflow-hidden">
              {/* Type badge */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${style.badge}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  {transaction.transaction_type === 'cashin' ? 'Cash In' :
                   transaction.transaction_type === 'cashout' ? 'Cash Out' : 'Transfer'}
                </span>
                {transaction.is_sync_required && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync Required
                  </span>
                )}
              </div>

              {/* Description */}
              {transaction.description && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Description</p>
                  <p className="text-sm text-gray-700">{transaction.description}</p>
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Amount</p>
                  <p className={`text-base font-bold ${style.text}`}>
                    {transaction.transaction_type === 'cashin' ? '+' : 
                     transaction.transaction_type === 'cashout' ? '-' : ''}
                    {formatCurrency(transaction.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Recorded By</p>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white text-xs font-bold">
                      {transaction.employee_name?.charAt(0) || 'E'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{transaction.employee_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{transaction.employee_username || ''}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Created On</p>
                  <p className="text-sm text-gray-700">{formatDate(transaction.created_on)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Last Synced</p>
                  <p className="text-sm text-gray-700">
                    {transaction.last_synced_on ? formatDate(transaction.last_synced_on) : 'Never'}
                  </p>
                </div>
              </div>

              {/* Sync ID */}
              {transaction.sync_id && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Sync ID</p>
                  <p className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block">
                    {transaction.sync_id}
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT: Action sidebar */}
            <div className="w-36 flex-shrink-0 border-l border-gray-100 flex flex-col py-4 px-3">
              {!isDeleted ? (
                <>
                  <button
                    onClick={handleEditClick}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); onSync(transaction.id); }}
                    className="flex items-center gap-2 w-full px-3 py-2 mt-1.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600 hover:text-blue-700 text-xs font-semibold transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync
                  </button>

                  <div className="flex-1" />

                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(transaction.id); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 text-xs font-semibold transition-all"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRestore(transaction.id); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-semibold transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Restore
                  </button>
                  <div className="flex-1" />
                  <p className="text-xs text-gray-300 text-center leading-relaxed">Transaction deleted</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditTransactionModal
          transaction={transaction}
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  )
}

export default TransactionCard