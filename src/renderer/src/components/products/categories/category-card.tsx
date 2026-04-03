import React from 'react'
import CategoryActionModal from './category-action-modal'
import CategoryDescription from './category-description'
import CategoryImage from './category-image'
import SubcategoriesModal from './subcategories-modal'

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

type Props = {
  category: Category
  expanded: boolean
  onToggle: () => void
  onDelete?: (id: number) => void
  onRestore?: (id: number) => void
  onEdit?: (id: number) => void
  onSync?: (id: number) => void
}

const MAX_VISIBLE_SUBS = 4

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatLastSync = (lastSync: string | null) => {
  if (!lastSync) return 'Never synced'
  const diff = Date.now() - new Date(lastSync).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return 'Just now'
}

const CategoryCard = ({ category, expanded, onToggle, onDelete, onRestore, onEdit, onSync }: Props) => {
  const [showDropdown, setShowDropdown] = React.useState(false)
  const [showDeleteModal, setShowDeleteModal] = React.useState(false)
  const [showRestoreModal, setShowRestoreModal] = React.useState(false)
  const [showSubsModal, setShowSubsModal] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    if (showDropdown) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  const handleDeleteClick = (e: React.MouseEvent) => { e.stopPropagation(); setShowDropdown(false); setShowDeleteModal(true) }
  const handleRestoreClick = (e: React.MouseEvent) => { e.stopPropagation(); setShowDropdown(false); setShowRestoreModal(true) }
  const handleSyncClick = (e: React.MouseEvent) => { e.stopPropagation(); setShowDropdown(false); onSync?.(category.id) }

  const confirmDelete = () => { onDelete?.(category.id); setShowDeleteModal(false) }
  const confirmRestore = () => { onRestore?.(category.id); setShowRestoreModal(false) }

  const visibleSubs = (category.sub_categories || []).slice(0, MAX_VISIBLE_SUBS)
  const hiddenSubsCount = Math.max(0, (category.sub_categories || []).length - MAX_VISIBLE_SUBS)

  return (
    <>
      <div className={`group ${category.is_deleted ? 'opacity-60' : ''}`}>
        {/* ── Main Row ── */}
        <div
          onClick={onToggle}
          className={`
            relative grid grid-cols-1 md:grid-cols-12 items-center gap-3 md:gap-4
            px-4 md:px-6 py-4 border-b border-gray-100
            hover:bg-gray-50/80 transition-all duration-200 cursor-pointer
            ${expanded ? 'bg-blue-50/40' : ''} ${category.is_deleted ? 'bg-red-50/30' : ''}
          `}
        >
          {/* Col 1: Image */}
          <div className="md:col-span-1 flex items-center gap-3 md:gap-0">
            <div className="relative">
              <CategoryImage image={category.image} categoryName={category.category_name} size="md" isDeleted={category.is_deleted} />
              {category.is_deleted && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
              )}
              {category.is_sync_required && !category.is_deleted && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
              )}
            </div>
            {/* Mobile name */}
            <div className="md:hidden flex-1 min-w-0">
              <div className="font-semibold text-gray-900 flex items-center gap-2 truncate">
                {category.category_name}
                {category.is_deleted && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 flex-shrink-0">Deleted</span>}
                {category.is_sync_required && !category.is_deleted && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex-shrink-0">Sync</span>}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{category.product_count} products · {category.sub_category_count} subcategories</div>
            </div>
          </div>

          {/* Col 2: Name (desktop) */}
          <div className="hidden md:flex md:col-span-3 flex-col justify-center min-w-0">
            <div className="font-semibold text-gray-900 truncate flex items-center gap-2">
              {category.category_name}
              {category.is_deleted && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 flex-shrink-0">Deleted</span>}
              {category.is_sync_required && !category.is_deleted && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex-shrink-0">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Sync
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">ID: {category.id}</div>
          </div>

          {/* Col 3: Products */}
          <div className="hidden md:flex md:col-span-2 items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
              <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              <span className="text-xs font-semibold text-blue-700">{category.product_count} {category.product_count === 1 ? 'product' : 'products'}</span>
            </div>
          </div>

          {/* Col 4: Subcategories */}
          <div className="hidden md:flex md:col-span-2 items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 rounded-lg border border-violet-100">
              <svg className="w-3.5 h-3.5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              <span className="text-xs font-semibold text-violet-700">{category.sub_category_count} {category.sub_category_count === 1 ? 'subcategory' : 'subcategories'}</span>
            </div>
          </div>

          {/* Col 5: Status */}
          <div className="hidden lg:flex md:col-span-2 items-center">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${category.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${category.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
              {category.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Col 6: Toggle */}
          <div className="md:col-span-2 lg:col-span-1 flex justify-end">
            <div className={`w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 ${expanded ? 'rotate-180 bg-blue-100 !text-blue-600' : ''}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        {/* ── Expanded Details ── */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
          {expanded && (
            <div className={`border-b border-gray-100 ${category.is_deleted ? 'bg-red-50/20' : 'bg-gradient-to-b from-blue-50/30 to-gray-50/30'}`}>
              <div className="px-4 md:px-6 py-6">

                {/* Deleted banner */}
                {category.is_deleted && (
                  <div className="mb-5 bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-red-800">Category Deleted</h4>
                        <p className="text-xs text-red-600 mt-1">This category is marked as deleted and is no longer visible in the storefront.</p>
                        <button onClick={handleRestoreClick} className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          Restore Category
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Description */}
                  <div className="md:col-span-1 space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Description
                    </h3>
                    <CategoryDescription description={category.description} />
                  </div>

                  {/* Category Info */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Category Info
                    </h3>
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg hover:bg-white/60 transition-colors">
                        <div className="text-xs text-gray-500 mb-0.5">Category ID</div>
                        <div className="text-sm font-mono font-semibold text-gray-900">#{String(category.id).padStart(4, '0')}</div>
                      </div>
                      <div className="p-3 rounded-lg hover:bg-white/60 transition-colors">
                        <div className="text-xs text-gray-500 mb-0.5">Parent Category</div>
                        <div className="text-sm font-medium text-gray-900">
                          {category.parent_category_id ? `#${String(category.parent_category_id).padStart(4, '0')}` : <span className="text-gray-400">Root category</span>}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg hover:bg-white/60 transition-colors">
                        <div className="text-xs text-gray-500 mb-0.5">Created On</div>
                        <div className="text-sm font-medium text-gray-900">{formatDate(category.created_on)}</div>
                      </div>
                      <div className="p-3 rounded-lg hover:bg-white/60 transition-colors">
                        <div className="text-xs text-gray-500 mb-0.5">Last Sync</div>
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${category.is_sync_required ? 'bg-amber-400' : category.last_sync ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="text-sm font-medium text-gray-900">{formatLastSync(category.last_sync)}</span>
                          {category.is_sync_required && <span className="text-xs text-amber-600 font-medium">(pending)</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Quick Actions
                    </h3>
                    <div className="space-y-2">
                      {/* View / Edit — opens offcanvas */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit?.(category.id) }}
                        className="w-full px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        View / Edit Category
                      </button>

                      {/* More Options */}
                      <div className="relative" ref={dropdownRef}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown) }}
                          className="w-full px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium border border-gray-300 rounded-lg transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                          More Options
                        </button>
                        {showDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                            <button
                              onClick={handleSyncClick}
                              disabled={!category.is_sync_required}
                              className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between gap-3 transition-colors ${category.is_sync_required ? 'hover:bg-gray-50 text-gray-900' : 'text-gray-400 cursor-not-allowed'}`}
                            >
                              <div className="flex items-center gap-3">
                                <svg className={`w-4 h-4 ${category.is_sync_required ? 'text-blue-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                <span className="font-medium">Sync</span>
                              </div>
                              <span className="text-xs text-gray-500">{formatLastSync(category.last_sync)}</span>
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            {category.is_deleted ? (
                              <button onClick={handleRestoreClick} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-green-50 text-green-600 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                <span className="font-medium">Restore</span>
                              </button>
                            ) : (
                              <button onClick={handleDeleteClick} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-red-50 text-red-600 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                <span className="font-medium">Delete</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Subcategories preview with overflow ── */}
                {category.sub_categories && category.sub_categories.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-gray-200/70">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                        Subcategories ({category.sub_categories.length})
                      </h3>
                    </div>

                    {/* Single-row flex with overflow limit */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {visibleSubs.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={(e) => { e.stopPropagation(); onEdit?.(sub.id) }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 hover:bg-blue-50 transition-all group"
                        >
                          <CategoryImage image={sub.image} categoryName={sub.category_name} size="sm" isDeleted={sub.is_deleted} />
                          <div className="text-left">
                            <div className="text-xs font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">{sub.category_name}</div>
                            <div className="text-xs text-gray-400">{sub.product_count} products</div>
                          </div>
                        </button>
                      ))}

                      {/* "View all" overflow button */}
                      {hiddenSubsCount > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowSubsModal(true) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold text-blue-700 transition-all shadow-sm"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                          +{hiddenSubsCount} more
                        </button>
                      )}

                      {/* "View all" button even when under limit (convenient) */}
                      {category.sub_categories.length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowSubsModal(true) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 transition-all"
                        >
                          View all
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showDeleteModal && (
        <CategoryActionModal mode="delete" category={category} onConfirm={confirmDelete} onCancel={() => setShowDeleteModal(false)} />
      )}
      {showRestoreModal && (
        <CategoryActionModal mode="restore" category={category} onConfirm={confirmRestore} onCancel={() => setShowRestoreModal(false)} />
      )}
      {showSubsModal && (
        <SubcategoriesModal
          parentCategory={category}
          onClose={() => setShowSubsModal(false)}
          onEdit={onEdit}
          onSync={onSync}
        />
      )}
    </>
  )
}

export default CategoryCard