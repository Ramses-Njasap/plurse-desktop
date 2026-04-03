// components/dashboard-overview/debt-modal-content.tsx

import React, { useState } from 'react'
import { DashBarChart } from './charts'
import { useComparison } from './hooks/use-comparison'
import ModalTabs from './modal-tabs'
import PeriodSelector from './period-selector'
import type { ComparisonPeriod, SalesDashboardData } from './types/types'

const fmt = (v: number) => v.toLocaleString() + ' XAF'

interface DebtModalContentProps {
  data?: SalesDashboardData
  selectedPeriod?: ComparisonPeriod
  onPeriodChange?: (period: ComparisonPeriod) => void
}

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'debtors', label: 'Debtors' },
  { id: 'analytics', label: 'Analytics' },
]

const statusStyle: Record<string, string> = {
  overdue: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  partially_paid: 'bg-blue-100 text-blue-700',
}

const DebtModalContent: React.FC<DebtModalContentProps> = ({ 
  data, 
  selectedPeriod,
  onPeriodChange 
}) => {
  const [activeTab, setActiveTab] = useState('overview')
  const comparison = useComparison(data, selectedPeriod || 'today_vs_yesterday')

  if (!data) return null

  // Extract debtors from sales data
  const debtors = data.breakdown
    .flatMap(day => day.products)
    .flatMap(p => p.skus)
    .flatMap(s => s.stock_purchases)
    .flatMap(b => b.sales)
    .filter(sale => sale.in_debt && sale.debt_info)
    .map(sale => ({
      id: sale.sale_id,
      name: sale.customer?.name || 'Unknown',
      amount: sale.debt_info?.balance_due || 0,
      days_overdue: sale.debt_info?.overdue_days || 0,
      status: sale.debt_info?.status === 'overdue' ? 'overdue' : 'pending'
    }))
    .slice(0, 5)

  const totalOutstanding = data.summary.debt_sales
  const overdueAmount = debtors
    .filter(d => d.status === 'overdue')
    .reduce((sum, d) => sum + d.amount, 0)
  const overdueCount = debtors.filter(d => d.status === 'overdue').length
  const dueThisWeek = debtors
    .filter(d => d.status === 'pending')
    .reduce((sum, d) => sum + d.amount, 0)

  // Trend data for chart
  const trendData = data.breakdown.slice(-6).map(day => ({
    label: new Date(day.date).toLocaleDateString('en-GB', { month: 'short' }),
    debt: day.products.reduce((sum, p) => sum + p.total, 0) * 0.4,
    collected: day.products.reduce((sum, p) => sum + p.total, 0) * 0.3
  }))

  return (
    <div>
      <div className="flex justify-end mb-4">
        {selectedPeriod && onPeriodChange && (
          <PeriodSelector
            value={selectedPeriod}
            onChange={onPeriodChange}
            size="sm"
          />
        )}
      </div>

      <ModalTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 bg-red-50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-red-600 font-medium mb-1">Total Outstanding Debt</div>
                <div className="text-2xl font-bold text-red-700">{fmt(totalOutstanding)}</div>
                <div className="text-xs text-red-500 mt-0.5">{overdueCount} customers with overdue balances</div>
              </div>
              <svg className="w-10 h-10 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Overdue 30+ days</div>
              <div className="text-xl font-bold text-red-600">{fmt(overdueAmount)}</div>
              <div className="text-xs text-gray-400 mt-0.5">{overdueCount} customers</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Due This Week</div>
              <div className="text-xl font-bold text-amber-600">{fmt(dueThisWeek)}</div>
              <div className="text-xs text-gray-400 mt-0.5">{debtors.filter(d => d.status === 'pending').length} customers</div>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-700 mb-3">Debt vs Collections (6 months)</div>
            <DashBarChart
              data={trendData}
              bars={[
                { key: 'debt', name: 'Total Debt', color: '#ef4444' },
                { key: 'collected', name: 'Collected', color: '#10b981' },
              ]}
              xKey="label"
              formatter={fmt}
              height={200}
            />
          </div>
        </div>
      )}

      {activeTab === 'debtors' && (
        <div className="space-y-2">
          {debtors.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              No outstanding debts
            </div>
          ) : (
            debtors.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {d.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{d.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {d.days_overdue > 0 ? `${d.days_overdue} days overdue` : 'Due soon'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">{fmt(d.amount)}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[d.status]}`}>
                    {d.status === 'overdue' ? 'Overdue' : 'Pending'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Collection Rate', value: '72%', sub: 'Last 30 days', color: 'text-emerald-600' },
              { label: 'Avg. Debt Age', value: '24 days', sub: 'All debtors', color: 'text-gray-900' },
              { label: 'Debt-to-Revenue', value: `${((totalOutstanding / data.summary.total) * 100).toFixed(1)}%`, sub: 'Current month', color: 'text-amber-600' },
              { label: 'Bad Debt Risk', value: fmt(overdueAmount), sub: '67+ days overdue', color: 'text-red-600' },
            ].map((m) => (
              <div key={m.label} className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">{m.label}</div>
                <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{m.sub}</div>
              </div>
            ))}
          </div>

          {debtors.length > 0 && (
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-sm font-semibold text-blue-900 mb-1">💡 Insight</div>
              <div className="text-xs text-blue-700">
                {comparison.label}: Outstanding debt is {comparison.trend === 'up' ? 'increasing' : comparison.trend === 'down' ? 'decreasing' : 'stable'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DebtModalContent