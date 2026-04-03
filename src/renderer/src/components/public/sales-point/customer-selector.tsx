// src/components/public/sales-point/customer-selector.tsx

import type { Customer } from '@renderer/components/public/types/sales'
import React, { useEffect, useRef, useState } from 'react'

interface CustomerSelectorProps {
  value: Customer | null
  onChange: (customer: Customer | null) => void
}

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({ value, onChange }) => {
  const [mode, setMode] = useState<'select' | 'create'>('select')
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // New customer
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!open) return
    const doFetch = async () => {
      setLoading(true)
      try {
        const result = await window.api.customers.getAllCustomers({
          search: search || undefined,
          limit: 20,
          include_inactive: false,
        })
        if (result.success && result.data) {
          setCustomers(result.data.customers as Customer[])
        }
      } catch (e) {
        console.error('Customer fetch error', e)
      }
      setLoading(false)
    }
    const t = setTimeout(doFetch, 300)
    return () => clearTimeout(t)
  }, [search, open])

  const handleCreate = async () => {
    if (!newName.trim()) { setCreateError('Customer name is required'); return }
    setCreating(true)
    setCreateError('')
    try {
      const result = await window.api.customers.createCustomer({
        name: newName.trim(),
        phone: newPhone || undefined,
        email: newEmail || undefined,
        address: newAddress || undefined,
      })
      if (result.success && result.data) {
        onChange(result.data as unknown as Customer)
        setOpen(false)
        setMode('select')
        setNewName(''); setNewPhone(''); setNewEmail(''); setNewAddress('')
      } else {
        setCreateError(result.message ?? 'Failed to create customer')
      }
    } catch (e: any) {
      setCreateError(e?.message ?? 'Unexpected error')
    }
    setCreating(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      {value ? (
        <div className="flex items-center gap-3 p-3.5 bg-blue-50 border-2 border-blue-200 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white text-base font-bold">{value.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{value.name}</p>
            {(value.phone || value.email) && (
              <p className="text-xs text-slate-500 truncate">{value.phone ?? value.email}</p>
            )}
          </div>
          <button type="button" onClick={() => onChange(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Remove customer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 p-3.5 bg-white border-2 border-slate-200 rounded-xl
            hover:border-blue-400 hover:bg-blue-50/30 transition-all text-left">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <span className="text-sm text-slate-400 flex-1">Search or add customer (optional)</span>
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate-200 rounded-2xl shadow-2xl z-[100] overflow-hidden">
          <div className="flex border-b border-slate-100">
            {(['select', 'create'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  mode === m ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {m === 'select' ? 'Find Customer' : '+ New Customer'}
              </button>
            ))}
          </div>

          {mode === 'select' ? (
            <>
              <div className="p-3 border-b border-slate-100">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input autoFocus type="text" value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, phone..."
                    className="w-full pl-9 pr-4 py-2 text-sm border-2 border-slate-200 rounded-xl
                      focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                ) : customers.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-400">
                    {search ? 'No customers found' : 'Start typing to search'}
                  </div>
                ) : (
                  customers.map((c) => (
                    <button key={c.id} type="button"
                      onClick={() => { onChange(c); setOpen(false); setSearch('') }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-slate-50 last:border-0">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-blue-700 text-sm font-bold">{c.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                        {(c.phone || c.email) && (
                          <p className="text-xs text-slate-400 truncate">{c.phone ?? c.email}</p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input autoFocus type="text" value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl
                    focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Phone', type: 'tel', val: newPhone, set: setNewPhone, placeholder: '+1 234 567 890' },
                  { label: 'Email', type: 'email', val: newEmail, set: setNewEmail, placeholder: 'email@example.com' },
                ].map(({ label, type, val, set, placeholder }) => (
                  <div key={label}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                    <input type={type} value={val} onChange={(e) => set(e.target.value)}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl bg-white
                        focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
                <input type="text" value={newAddress} onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Street address"
                  className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl bg-white
                    focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              {createError && <p className="text-xs text-red-500 font-medium">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 text-sm text-slate-600 border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-medium bg-white">
                  Cancel
                </button>
                <button type="button" onClick={handleCreate} disabled={creating || !newName.trim()}
                  className="flex-1 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl
                    hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {creating && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {creating ? 'Creating...' : 'Create & Select'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}