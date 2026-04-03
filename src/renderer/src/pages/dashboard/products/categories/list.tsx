import CategoryCard from '@renderer/components/products/categories/category-card'
import CategoryOffcanvas from '@renderer/components/products/categories/category-offcanvas'
import CategorySkeleton from '@renderer/components/products/categories/category-skeleton'
import CreateCategoryModal from '@renderer/components/products/categories/create-category-modal'
import ToastContainer, { ToastMessage } from '@renderer/components/toast/toast-container'
import { useEffect, useRef, useState } from 'react'

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

type SortKey = 'name_asc' | 'name_desc' | 'date_asc' | 'date_desc' | 'products_asc' | 'products_desc' | 'subs_asc' | 'subs_desc'

const sortFn = (a: Category, b: Category, key: SortKey) => {
  switch (key) {
    case 'name_asc':      return a.category_name.localeCompare(b.category_name)
    case 'name_desc':     return b.category_name.localeCompare(a.category_name)
    case 'date_asc':      return new Date(a.created_on).getTime() - new Date(b.created_on).getTime()
    case 'date_desc':     return new Date(b.created_on).getTime() - new Date(a.created_on).getTime()
    case 'products_asc':  return a.product_count - b.product_count
    case 'products_desc': return b.product_count - a.product_count
    case 'subs_asc':      return a.sub_category_count - b.sub_category_count
    case 'subs_desc':     return b.sub_category_count - a.sub_category_count
    default: return 0
  }
}

const sortLabels: Record<SortKey, { label: string; icon: string }> = {
  name_asc:      { label: 'A → Z',           icon: 'az' },
  name_desc:     { label: 'Z → A',           icon: 'za' },
  date_asc:      { label: 'Oldest first',    icon: 'cal' },
  date_desc:     { label: 'Newest first',    icon: 'cal' },
  products_asc:  { label: 'Fewest products', icon: 'box' },
  products_desc: { label: 'Most products',   icon: 'box' },
  subs_asc:      { label: 'Fewest subs',     icon: 'list' },
  subs_desc:     { label: 'Most subs',       icon: 'list' },
}

const ProductCategories = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name_asc')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [offcanvasCategory, setOffcanvasCategory] = useState<Category | null>(null)
  const [offcanvasOpen, setOffcanvasOpen] = useState(false)
  const sortMenuRef = useRef<HTMLDivElement>(null)

  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
  }
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  const loadCategories = async () => {
    setLoading(true)
    try {
      const res = await window.api.products.getCategories({ nested: true })
      if (res.success && res.data) setCategories(res.data.categories as Category[])
      else addToast(res.message || 'Failed to load categories', 'error')
    } catch { addToast('An error occurred while loading categories', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadCategories() }, [])

  // close sort menu on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setShowSortMenu(false) }
    if (showSortMenu) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showSortMenu]) 

  const handleDelete = async (categoryId: number) => {
    const name = categories.find(c => c.id === categoryId)?.category_name ?? 'Category'
    try {
      const res = await window.api.products.softDeleteCategory({ id: categoryId })
      if (!res.success) throw new Error(res.message)
      setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, is_deleted: true, is_active: false } : c))
      if (expandedId === categoryId) setExpandedId(null)
      addToast(`"${name}" has been deleted`, 'success')
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed to delete category', 'error') }
  }

  const handleRestore = async (categoryId: number) => {
    const name = categories.find(c => c.id === categoryId)?.category_name ?? 'Category'
    try {
      const res = await window.api.products.restoreCategory({ id: categoryId, cascade: true } as any)
      if (!res.success) throw new Error(res.message)
      setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, is_deleted: false, is_active: true } : c))
      addToast(`"${name}" has been restored`, 'success')
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed to restore category', 'error') }
  }

  const handleEdit = (id: number) => {
    const cat = categories.find(c => c.id === id)
    if (cat) { setOffcanvasCategory(cat); setOffcanvasOpen(true) }
  }

  const handleSync = (id: number) => {
    console.log('Sync category:', id) // wired to empty fn for now
  }

  const handleCategoryUpdated = async () => {
    addToast('Category updated successfully!', 'success')
    await loadCategories()
  }

  const handleCategoryCreated = async () => {
    addToast('Category created successfully!', 'success')
    await loadCategories()
  }

  // filter + sort
  const filtered = categories
    .filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      return c.category_name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
    })
    .sort((a, b) => sortFn(a, b, sortKey))

  const totalProducts = categories.reduce((s, c) => s + c.product_count, 0)
  const activeCount = categories.filter(c => !c.is_deleted).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50">
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      <CreateCategoryModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onSuccess={handleCategoryCreated} />

      <CategoryOffcanvas
        category={offcanvasCategory}
        open={offcanvasOpen}
        onClose={() => setOffcanvasOpen(false)}
        onUpdated={handleCategoryUpdated}
        onSync={handleSync}
      />

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                Product Categories
              </h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {filtered.length} {filtered.length === 1 ? 'category' : 'categories'}
                </span>
                {!loading && (
                  <>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{totalProducts} total products</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{activeCount} active</span>
                  </>
                )}
                {search && <span className="text-gray-500 text-xs hidden sm:inline">· Filtered from {categories.length} total</span>}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search categories…"
                  className="w-full sm:w-64 lg:w-72 pl-10 pr-10 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              {/* Sort dropdown */}
              <div className="relative" ref={sortMenuRef}>
                <button
                  onClick={() => setShowSortMenu(s => !s)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-all shadow-sm whitespace-nowrap"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                  <span className="hidden sm:inline">{sortLabels[sortKey].label}</span>
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showSortMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-30">
                    {/* Alphabetical group */}
                    <div className="px-3 py-1.5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Alphabetical</p>
                    </div>
                    {(['name_asc', 'name_desc'] as SortKey[]).map(k => (
                      <button key={k} onClick={() => { setSortKey(k); setShowSortMenu(false) }}
                        className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors ${sortKey === k ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                        {sortLabels[k].label}
                        {sortKey === k && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                      </button>
                    ))}
                    <div className="border-t border-gray-100 my-1" />
                    <div className="px-3 py-1.5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Date Created</p>
                    </div>
                    {(['date_desc', 'date_asc'] as SortKey[]).map(k => (
                      <button key={k} onClick={() => { setSortKey(k); setShowSortMenu(false) }}
                        className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors ${sortKey === k ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                        {sortLabels[k].label}
                        {sortKey === k && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                      </button>
                    ))}
                    <div className="border-t border-gray-100 my-1" />
                    <div className="px-3 py-1.5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">By Count</p>
                    </div>
                    {(['products_desc', 'products_asc', 'subs_desc', 'subs_asc'] as SortKey[]).map(k => (
                      <button key={k} onClick={() => { setSortKey(k); setShowSortMenu(false) }}
                        className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors ${sortKey === k ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                        {sortLabels[k].label}
                        {sortKey === k && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Add button */}
              <button onClick={() => setShowCreateModal(true)} className="px-3 sm:px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span className="hidden sm:inline">Add Category</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
            {[{ label: 'Image', span: 1 }, { label: 'Category Name', span: 3 }, { label: 'Products', span: 2 }, { label: 'Subcategories', span: 2 }, { label: 'Status', span: 2 }, { label: '', span: 2 }].map(({ label, span }) => (
              <div key={label} className={`col-span-${span}`}>
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <CategorySkeleton />
          ) : filtered.length === 0 ? (
            <div className="py-16 sm:py-24 px-4 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
                <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">{search ? 'No categories found' : 'No categories yet'}</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">{search ? `No results for "${search}".` : 'Organise your products by creating your first category.'}</p>
              {search
                ? <button onClick={() => setSearch('')} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">Clear search</button>
                : <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg">Add your first category</button>
              }
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(category => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  expanded={expandedId === category.id}
                  onToggle={() => setExpandedId(expandedId === category.id ? null : category.id)}
                  onDelete={handleDelete}
                  onRestore={handleRestore}
                  onEdit={handleEdit}
                  onSync={handleSync}
                />
              ))}
            </div>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="mt-4 sm:mt-6 text-center text-sm text-gray-500">
            Showing {filtered.length} of {categories.length} categories
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductCategories