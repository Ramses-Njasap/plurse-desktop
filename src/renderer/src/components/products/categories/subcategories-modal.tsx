import React from 'react';
import CategoryImage from './category-image';

type ImageMeta = {
  path: string; filename: string; original_filename: string
  mime_type: string; file_size: number; uploaded_at: string
} | null | undefined

type Category = {
  id: number; sync_id: string | null; category_name: string; description: string
  parent_category_id: number | null; created_on: string; updated_on: string
  is_deleted: boolean; last_sync: string | null; is_sync_required: boolean
  is_active: boolean; product_count: number; sub_category_count: number
  image?: ImageMeta; sub_categories: Category[]
}

type SortKey = 'name_asc' | 'name_desc' | 'products_asc' | 'products_desc' | 'date_asc' | 'date_desc' | 'subs_asc' | 'subs_desc'

type Props = {
  parentCategory: Category
  onClose: () => void
  onEdit?: (id: number) => void
  onSync?: (id: number) => void
}

const sortLabels: Record<SortKey, string> = {
  name_asc: 'A → Z', name_desc: 'Z → A',
  products_asc: 'Fewest products', products_desc: 'Most products',
  date_asc: 'Oldest first', date_desc: 'Newest first',
  subs_asc: 'Fewest sub-cats', subs_desc: 'Most sub-cats',
}

const sortFn = (a: Category, b: Category, key: SortKey): number => {
  switch (key) {
    case 'name_asc':      return a.category_name.localeCompare(b.category_name)
    case 'name_desc':     return b.category_name.localeCompare(a.category_name)
    case 'products_asc':  return a.product_count - b.product_count
    case 'products_desc': return b.product_count - a.product_count
    case 'date_asc':      return new Date(a.created_on).getTime() - new Date(b.created_on).getTime()
    case 'date_desc':     return new Date(b.created_on).getTime() - new Date(a.created_on).getTime()
    case 'subs_asc':      return a.sub_category_count - b.sub_category_count
    case 'subs_desc':     return b.sub_category_count - a.sub_category_count
    default: return 0
  }
}

const formatLastSync = (s: string | null) => {
  if (!s) return 'Never'
  const diff = Date.now() - new Date(s).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return 'Just now'
}

const SubcategoriesModal = ({ parentCategory, onClose, onEdit, onSync }: Props) => {
  const [search, setSearch] = React.useState('')
  const [sortKey, setSortKey] = React.useState<SortKey>('name_asc')
  const [showSortMenu, setShowSortMenu] = React.useState(false)
  const [expandedId, setExpandedId] = React.useState<number | null>(null)
  const sortMenuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setShowSortMenu(false) }
    if (showSortMenu) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showSortMenu])

  // prevent body scroll while modal open
  React.useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const filtered = (parentCategory.sub_categories || [])
    .filter(s => !search || s.category_name.toLowerCase().includes(search.toLowerCase()) || s.description?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortFn(a, b, sortKey))

  return (
    <div
      className="fixed top-0 left-64 right-0 bottom-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.15s ease-out' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
        style={{ animation: 'scaleIn 0.18s ease-out', maxHeight: 'min(85vh, 700px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Subcategories</h2>
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">{parentCategory.category_name}</span>
                {' '}· {parentCategory.sub_categories.length} total
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* ── Search + Sort toolbar ── */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search subcategories…"
              className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          <div className="relative" ref={sortMenuRef}>
            <button
              onClick={() => setShowSortMenu(s => !s)}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-all whitespace-nowrap ${showSortMenu ? 'bg-violet-50 border-violet-300 text-violet-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg>
              {sortLabels[sortKey]}
              <svg className={`w-3.5 h-3.5 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {showSortMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20">
                {(['name_asc','name_desc'] as SortKey[]).map(k => (
                  <button key={k} onClick={() => { setSortKey(k); setShowSortMenu(false) }}
                    className={`w-full px-3.5 py-2 text-left text-sm flex items-center justify-between transition-colors ${sortKey === k ? 'bg-violet-50 text-violet-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                    {sortLabels[k]}{sortKey === k && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                  </button>
                ))}
                <div className="border-t border-gray-100 my-1" />
                {(['products_desc','products_asc'] as SortKey[]).map(k => (
                  <button key={k} onClick={() => { setSortKey(k); setShowSortMenu(false) }}
                    className={`w-full px-3.5 py-2 text-left text-sm flex items-center justify-between transition-colors ${sortKey === k ? 'bg-violet-50 text-violet-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                    {sortLabels[k]}{sortKey === k && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                  </button>
                ))}
                <div className="border-t border-gray-100 my-1" />
                {(['date_desc','date_asc'] as SortKey[]).map(k => (
                  <button key={k} onClick={() => { setSortKey(k); setShowSortMenu(false) }}
                    className={`w-full px-3.5 py-2 text-left text-sm flex items-center justify-between transition-colors ${sortKey === k ? 'bg-violet-50 text-violet-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                    {sortLabels[k]}{sortKey === k && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                  </button>
                ))}
                <div className="border-t border-gray-100 my-1" />
                {(['subs_desc','subs_asc'] as SortKey[]).map(k => (
                  <button key={k} onClick={() => { setSortKey(k); setShowSortMenu(false) }}
                    className={`w-full px-3.5 py-2 text-left text-sm flex items-center justify-between transition-colors ${sortKey === k ? 'bg-violet-50 text-violet-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                    {sortLabels[k]}{sortKey === k && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Column header */}
        <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100/40 border-b border-gray-100 flex-shrink-0">
          <div className="col-span-1"><span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Img</span></div>
          <div className="col-span-4"><span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</span></div>
          <div className="col-span-2"><span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Products</span></div>
          <div className="col-span-2"><span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</span></div>
          <div className="col-span-2"><span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sync</span></div>
          <div className="col-span-1"></div>
        </div>

        {/* ── List ── */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-50 rounded-full mb-3">
                <svg className="w-6 h-6 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              </div>
              <p className="text-sm font-medium text-gray-500">{search ? 'No results found' : 'No subcategories'}</p>
              {search && <button onClick={() => setSearch('')} className="mt-2 text-xs text-violet-600 hover:text-violet-700 font-medium">Clear search</button>}
            </div>
          ) : filtered.map(sub => {
            const isExpanded = expandedId === sub.id
            return (
              <div key={sub.id} className={`transition-colors ${sub.is_deleted ? 'opacity-60 bg-red-50/20' : ''}`}>
                {/* Row */}
                <div
                  className={`grid grid-cols-12 gap-3 items-center px-5 py-3.5 cursor-pointer hover:bg-gray-50/80 transition-colors ${isExpanded ? 'bg-violet-50/40' : ''}`}
                  onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                >
                  {/* Image */}
                  <div className="col-span-1">
                    <div className="relative">
                      <CategoryImage image={sub.image} categoryName={sub.category_name} size="sm" isDeleted={sub.is_deleted} />
                      {sub.is_sync_required && !sub.is_deleted && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-white" />
                      )}
                    </div>
                  </div>

                  {/* Name */}
                  <div className="col-span-4 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1.5">
                      {sub.category_name}
                      {sub.is_deleted && <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600 flex-shrink-0">Del</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">ID: #{String(sub.id).padStart(4,'0')}</div>
                  </div>

                  {/* Products */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-lg border border-blue-100 w-fit">
                      <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                      <span className="text-xs font-semibold text-blue-700">{sub.product_count}</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${sub.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${sub.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {sub.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Sync */}
                  <div className="col-span-2">
                    {sub.is_sync_required ? (
                      <button
                        onClick={e => { e.stopPropagation(); onSync?.(sub.id) }}
                        className="flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-medium text-amber-700 transition-all"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Sync
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">{formatLastSync(sub.last_sync)}</span>
                    )}
                  </div>

                  {/* Expand chevron */}
                  <div className="col-span-1 flex justify-end">
                    <div className={`w-6 h-6 flex items-center justify-center rounded-full text-gray-400 transition-all ${isExpanded ? 'rotate-180 bg-violet-100 text-violet-600' : ''}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>

                {/* Expanded row */}
                {isExpanded && (
                  <div className="px-5 pb-4 pt-2 bg-violet-50/30 border-t border-violet-100/60">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Description */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description</p>
                        {sub.description ? (
                          <p className="text-sm text-gray-600 leading-relaxed">{sub.description}</p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">No description provided</p>
                        )}
                      </div>
                      {/* Meta */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Details</p>
                        <div className="text-xs text-gray-600 flex gap-2"><span className="text-gray-400 w-20">Sub-cats</span><span className="font-medium text-gray-900">{sub.sub_category_count}</span></div>
                        <div className="text-xs text-gray-600 flex gap-2"><span className="text-gray-400 w-20">Last sync</span><span className="font-medium text-gray-900">{formatLastSync(sub.last_sync)}</span></div>
                        <div className="text-xs text-gray-600 flex gap-2"><span className="text-gray-400 w-20">Created</span><span className="font-medium text-gray-900">{new Date(sub.created_on).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span></div>
                      </div>
                    </div>
                    {/* View/Edit button */}
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={e => { e.stopPropagation(); onClose(); onEdit?.(sub.id) }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-all shadow-sm"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        View / Edit Category
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex-shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {filtered.length} of {parentCategory.sub_categories.length} subcategories
            {search && <span className="text-violet-600 font-medium"> (filtered)</span>}
          </p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-all">
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}

export default SubcategoriesModal