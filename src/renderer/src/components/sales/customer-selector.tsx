import React from 'react'

type Customer = {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
}

type Props = {
  onCreateNew: () => void
  onSelect: (customerId: number, name: string, phone: string | null) => void
}

const CustomerSelector = ({ onCreateNew, onSelect }: Props) => {
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [filtered, setFiltered] = React.useState<Customer[]>([])

  React.useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await window.api.customers.getAllCustomers({
          limit: 200,
          include_inactive: false,
        })
        if (res.success && res.data) {
          setCustomers(res.data.customers)
          setFiltered(res.data.customers)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  React.useEffect(() => {
    if (!search.trim()) {
      setFiltered(customers)
      return
    }
    const term = search.toLowerCase()
    setFiltered(customers.filter(c => 
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term))
    ))
  }, [search, customers])

  return (
    <div className="space-y-4">
      {/* Search and Create */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customers…"
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            autoFocus
          />
        </div>
        <button
          onClick={onCreateNew}
          className="px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-lg border border-emerald-200 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">No customers found</p>
          <button
            onClick={onCreateNew}
            className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Create a new customer
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id, c.name, c.phone)}
              className="w-full flex items-center gap-3 p-3 bg-white hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 rounded-xl transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">{c.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 truncate">
                  {c.name}
                </h4>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {c.phone && <span>{c.phone}</span>}
                  {c.email && <span className="truncate">{c.email}</span>}
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default CustomerSelector