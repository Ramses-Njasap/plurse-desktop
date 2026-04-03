// src/components/products/category-select.tsx

import React from 'react'

type Category = {
  id: number
  category_name: string
  is_active: boolean
  is_deleted: boolean
  sub_categories?: Category[]
}

type Props = {
  value: number | null
  onChange: (id: number | null) => void
  error?: string
}

const CategorySelect = ({ value, onChange, error }: Props) => {
  const [categories, setCategories] = React.useState<Category[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await window.api.products.getCategories({ nested: true })
        if (res.success && res.data) {
          setCategories((res.data.categories as Category[]).filter(c => !c.is_deleted))
        }
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Flatten categories with indentation info
  const flatten = (cats: Category[], depth = 0): { cat: Category; depth: number }[] => {
    return cats.flatMap(cat => [
      { cat, depth },
      ...(cat.sub_categories ? flatten(cat.sub_categories.filter(s => !s.is_deleted), depth + 1) : [])
    ])
  }

  const flat = flatten(categories)
  const filtered = flat.filter(({ cat }) =>
    !search || cat.category_name.toLowerCase().includes(search.toLowerCase())
  )

  const selected = flat.find(({ cat }) => cat.id === value)?.cat

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`
          w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm text-left
          focus:outline-none focus:ring-2 transition-all
          ${error
            ? 'border-red-300 focus:ring-red-400 bg-red-50'
            : 'border-gray-300 focus:ring-blue-500 focus:border-transparent bg-white'
          }
        `}
      >
        <span className={selected ? 'text-gray-900 font-medium' : 'text-gray-400'}>
          {loading ? 'Loading categories…' : selected ? selected.category_name : 'Select a category'}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !loading && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search categories…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-56 overflow-y-auto py-1">
            {/* Clear option */}
            {value !== null && (
              <button
                onClick={() => { onChange(null); setOpen(false); setSearch('') }}
                className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50 flex items-center gap-2 italic"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear selection
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-400">No categories found</div>
            ) : (
              filtered.map(({ cat, depth }) => (
                <button
                  key={cat.id}
                  onClick={() => { onChange(cat.id); setOpen(false); setSearch('') }}
                  className={`
                    w-full text-left flex items-center gap-2 px-3 py-2 text-sm transition-colors
                    ${value === cat.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50 text-gray-800'}
                  `}
                  style={{ paddingLeft: `${12 + depth * 16}px` }}
                >
                  {depth > 0 && (
                    <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                  <span className="flex-1 truncate">{cat.category_name}</span>
                  {!cat.is_active && (
                    <span className="text-xs text-gray-400 italic flex-shrink-0">Inactive</span>
                  )}
                  {value === cat.id && (
                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

export default CategorySelect