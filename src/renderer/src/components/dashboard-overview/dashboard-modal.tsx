// components/dashboard-overview/dashboard-modal.tsx

import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import CustomersModalContent from './customers-modal-content'
import DebtModalContent from './debt-modal-content'
import InventoryModalContent from './inventory-modal-content'
import SalesModalContent from './sales-modal-content'
import type {
  ComparisonPeriod,
  CustomerDashboardData,
  InventoryDashboardData,
  ModalType,
  OverviewDashboardData,
  ProductsDashboardData,
  SalesDashboardData
} from './types/types'

interface DashboardModalProps {
  type: ModalType
  onClose: () => void
  data?: {
    overview?: OverviewDashboardData
    sales?: SalesDashboardData
    products?: ProductsDashboardData
    customers?: CustomerDashboardData
    inventory?: InventoryDashboardData
  }
  loading?: boolean
  selectedPeriod?: ComparisonPeriod
  onPeriodChange?: (period: ComparisonPeriod) => void
}

interface ModalConfig {
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string
}

const modalConfig: Record<NonNullable<ModalType>, ModalConfig> = {
  sales: {
    title: 'Sales Analytics',
    subtitle: 'Revenue, transactions & profit trends',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    color: 'text-blue-600 bg-blue-50',
  },
  revenue: {
    title: 'Revenue Breakdown',
    subtitle: 'Month-to-date revenue analysis',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>
    ),
    color: 'text-purple-600 bg-purple-50',
  },
  profit: {
    title: 'Profit Analysis',
    subtitle: 'Gross, operating & net profit',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: 'text-emerald-600 bg-emerald-50',
  },
  debt: {
    title: 'Debt & Receivables',
    subtitle: 'Outstanding balances & collection status',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    color: 'text-red-600 bg-red-50',
  },
  inventory: {
    title: 'Inventory Intelligence',
    subtitle: 'Stock health, aging & reorder alerts',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    color: 'text-amber-600 bg-amber-50',
  },
  customers: {
    title: 'Customer Analytics',
    subtitle: 'Segments, retention & lifetime value',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: 'text-indigo-600 bg-indigo-50',
  },
}

const DashboardModal: React.FC<DashboardModalProps> = ({
  type,
  onClose,
  data,
  loading = false,
  selectedPeriod,
  onPeriodChange,
}) => {
  useEffect(() => {
    if (!type) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handler)
    }
  }, [type, onClose])

  if (!type) return null

  const config = modalConfig[type]

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col z-10 animate-[slideUp_0.2s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${config.color}`}>
              {config.icon}
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{config.title}</h2>
              <p className="text-xs text-gray-400">{config.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-8 bg-gray-100 rounded w-40" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-24 bg-gray-100 rounded-xl" />
                <div className="h-24 bg-gray-100 rounded-xl" />
              </div>
              <div className="h-48 bg-gray-100 rounded-xl" />
            </div>
          ) : (
            <>
              {(type === 'sales' || type === 'revenue' || type === 'profit') && (
                <SalesModalContent
                  data={data?.sales}
                  selectedPeriod={selectedPeriod}
                  onPeriodChange={onPeriodChange}
                />
              )}
              {type === 'debt' && (
                <DebtModalContent data={data?.sales} />
              )}
              {type === 'inventory' && (
                <InventoryModalContent data={data?.inventory} />
              )}
              {type === 'customers' && (
                <CustomersModalContent
                  data={data?.customers}
                  selectedPeriod={selectedPeriod}
                  onPeriodChange={onPeriodChange}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default DashboardModal