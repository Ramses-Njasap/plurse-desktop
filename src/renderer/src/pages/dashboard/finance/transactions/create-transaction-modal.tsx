import TransactionImage from '@renderer/components/transactions/transaction-image'
import { useState } from 'react'
import type { TransactionFormData, TransactionType } from './types'
import { defaultTransactionForm } from './types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const CreateTransactionModal = ({ open, onClose, onSuccess }: Props) => {
  const [form, setForm] = useState<TransactionFormData>(defaultTransactionForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const set = (patch: Partial<TransactionFormData>) => {
    setForm(f => ({ ...f, ...patch }))
    // Clear error for changed field
    Object.keys(patch).forEach(key => {
        if (errors[key]) {
        const newErrors = { ...errors }
        delete newErrors[key]
        setErrors(newErrors)
        }
    })
    }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.transaction_type) errs.transaction_type = 'Transaction type is required'
    if (!form.amount || parseFloat(form.amount) <= 0) errs.amount = 'Amount must be greater than 0'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await window.api.transactions.createTransaction({
        transaction_type: form.transaction_type,
        amount: parseFloat(form.amount),
        description: form.description || undefined,
      })
      if (!res.success) throw new Error(res.message)
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const typeOptions: { value: TransactionType; label: string; description: string }[] = [
    { value: 'cashin', label: 'Cash In', description: 'Money received (sales, payments, etc.)' },
    { value: 'cashout', label: 'Cash Out', description: 'Money paid out (expenses, suppliers, etc.)' },
    { value: 'transfer', label: 'Transfer', description: 'Money moved between accounts' },
  ]

  return (
    <div
      className="fixed top-0 left-64 right-0 bottom-0 z-50 flex items-center justify-center p-4"
      style={{ animation: 'fadeIn 0.15s ease-out' }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ animation: 'scaleIn 0.15s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2.5">
            <TransactionImage transactionType={form.transaction_type} size="sm" />
            <div>
              <h2 className="text-sm font-bold text-gray-900">New Transaction</h2>
              <p className="text-xs text-gray-500">Record a cash movement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 max-h-[70vh] overflow-y-auto">
          <div className="space-y-5">
            {/* Transaction Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Transaction Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 gap-2">
                {typeOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set({ transaction_type: opt.value })}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      form.transaction_type === opt.value
                        ? opt.value === 'cashin' ? 'border-emerald-400 bg-emerald-50' :
                          opt.value === 'cashout' ? 'border-red-400 bg-red-50' :
                          'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      opt.value === 'cashin' ? 'bg-emerald-500' :
                      opt.value === 'cashout' ? 'bg-red-500' :
                      'bg-blue-500'
                    }`}>
                      {opt.value === 'cashin' ? (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                        </svg>
                      ) : opt.value === 'cashout' ? (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                    </div>
                    {form.transaction_type === opt.value && (
                      <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
              {errors.transaction_type && (
                <p className="text-xs text-red-600 mt-1">{errors.transaction_type}</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={e => set({ amount: e.target.value })}
                  placeholder="0.00"
                  className={`w-full pl-8 pr-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${
                    errors.amount ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-emerald-500 bg-white'
                  }`}
                />
              </div>
              {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Description <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                value={form.description}
                onChange={e => set({ description: e.target.value })}
                placeholder="e.g. Supplier payment, Daily sales, Bank transfer..."
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none bg-white transition-all"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow flex items-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Create Transaction
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}

export default CreateTransactionModal