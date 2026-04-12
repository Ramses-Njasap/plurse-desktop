import React from 'react'
import ReactDOM from 'react-dom'
import CategoryFormSlide, { CategoryFormData, defaultFormData } from './category-form-slide'
import CategoryModalPanel from './category-modal-panel'

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
  category: Category | null
  open: boolean
  onClose: () => void
  onUpdated?: () => void
  onSync?: (id: number) => void
}

type EditForm = {
  category_name: string; description: string; is_active: boolean
  profile_pic: string; profile_pic_filename: string; profile_pic_mime_type: string
}

type SubEditForm = EditForm
type SortKey = 'name_asc' | 'name_desc' | 'products_asc' | 'products_desc' | 'date_asc' | 'date_desc'

const formatDate = (d: string) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatLastSync = (s: string | null) => {
  if (!s) return 'Never synced'
  const diff = Date.now() - new Date(s).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return 'Just now'
}

const sortSubs = (subs: Category[], key: SortKey) => {
  const s = [...subs]
  switch (key) {
    case 'name_asc':      return s.sort((a, b) => a.category_name.localeCompare(b.category_name))
    case 'name_desc':     return s.sort((a, b) => b.category_name.localeCompare(a.category_name))
    case 'products_asc':  return s.sort((a, b) => a.product_count - b.product_count)
    case 'products_desc': return s.sort((a, b) => b.product_count - a.product_count)
    case 'date_asc':      return s.sort((a, b) => new Date(a.created_on).getTime() - new Date(b.created_on).getTime())
    case 'date_desc':     return s.sort((a, b) => new Date(b.created_on).getTime() - new Date(a.created_on).getTime())
    default: return s
  }
}

// ── SubCategory Detail Modal ──────────────────────────────────────────────────

type SubModalProps = {
  sub: Category
  onClose: () => void
  onUpdated?: () => void
}

const SubCategoryModal = ({ sub, onClose, onUpdated }: SubModalProps) => {
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<SubEditForm>({
    category_name: sub.category_name,
    description: sub.description || '',
    is_active: sub.is_active,
    profile_pic: '', profile_pic_filename: '', profile_pic_mime_type: '',
  })
  const [dirty, setDirty] = React.useState(false)
  const [imgSrc, setImgSrc] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (sub.image?.path) {
      try { setImgSrc(window.api.files.readFileAsDataURL(sub.image.path)) } catch { /* */ }
    }
  }, [sub.image?.path])

  const set = (patch: Partial<SubEditForm>) => { setForm(f => ({ ...f, ...patch })); setDirty(true) }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/') || file.size > 5_242_880) return
    const r = new FileReader()
    r.onloadend = () => set({ profile_pic: r.result as string, profile_pic_filename: file.name, profile_pic_mime_type: file.type })
    r.readAsDataURL(file)
  }

  const handleDiscard = () => {
    setForm({ category_name: sub.category_name, description: sub.description || '', is_active: sub.is_active, profile_pic: '', profile_pic_filename: '', profile_pic_mime_type: '' })
    setDirty(false); setEditing(false)
  }

  const handleSave = async () => {
    if (!form.category_name.trim()) return
    setSaving(true)
    try {
      const payload: any = { id: sub.id, category_name: form.category_name.trim(), description: form.description.trim() || undefined, is_active: form.is_active }
      if (form.profile_pic) { payload.update_image = true; payload.image_data = form.profile_pic }
      const res = await window.api.products.updateCategory(payload)
      if (!res.success) throw new Error(res.message)
      setDirty(false); setEditing(false); onUpdated?.()
    } catch (err) { console.error(err) } finally { setSaving(false) }
  }

  const displayImg = form.profile_pic || imgSrc

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      onClick={onClose}
      style={{ animation: 'fadeIn 0.15s ease-out' }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden z-10"
        style={{ animation: 'scaleIn 0.18s ease-out', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className={`px-5 py-4 border-b border-gray-100 flex items-center justify-between ${editing ? 'bg-blue-50/60' : 'bg-gray-50/60'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900">Sub-category Detail</span>
          </div>
          <div className="flex items-center gap-1.5">
            {!editing && (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* image */}
          <div className="flex justify-center">
            <div className="relative group">
              <div
                className={`w-20 h-20 rounded-2xl overflow-hidden border-2 ${editing ? 'border-dashed border-blue-300 cursor-pointer' : 'border-gray-200'} shadow-sm`}
                onClick={() => editing && fileInputRef.current?.click()}
              >
                {displayImg
                  ? <img src={displayImg} alt={sub.category_name} className="w-full h-full object-cover" />
                  : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">{sub.category_name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                {editing && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          {editing ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
                <input value={form.category_name} onChange={e => set({ category_name: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea value={form.description} onChange={e => set({ description: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
              </div>
              <div className="flex items-center justify-between py-2.5 px-3.5 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Active</p>
                  <p className="text-xs text-gray-500">Visible in storefront</p>
                </div>
                <button type="button" onClick={() => set({ is_active: !form.is_active })} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2.5">
              <div className="text-center">
                <h3 className="text-base font-bold text-gray-900">{sub.category_name}</h3>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sub.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${sub.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {sub.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-blue-700">{sub.product_count}</div>
                  <div className="text-xs text-blue-600">Products</div>
                </div>
                <div className="bg-violet-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-violet-700">{sub.sub_category_count}</div>
                  <div className="text-xs text-violet-600">Sub-cats</div>
                </div>
              </div>
              {sub.description && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 leading-relaxed">{sub.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <div className="text-gray-500 mb-0.5">ID</div>
                  <div className="font-mono font-semibold text-gray-900">#{String(sub.id).padStart(4, '0')}</div>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <div className="text-gray-500 mb-0.5">Created</div>
                  <div className="font-medium text-gray-900">{formatDate(sub.created_on)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {editing && dirty && (
          <div className="px-5 pb-5 flex gap-2.5">
            <button onClick={handleDiscard} className="flex-1 px-3 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold border border-gray-300 rounded-lg transition-all">
              Discard
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-3 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2">
              {saving
                ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              }
              Save Changes
            </button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }
      `}</style>
    </div>,
    document.body
  )
}

// ── Main Offcanvas ────────────────────────────────────────────────────────────

const CategoryOffcanvas = ({ category, open, onClose, onUpdated, onSync }: Props) => {
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)
  const [form, setForm] = React.useState<EditForm>({ category_name: '', description: '', is_active: true, profile_pic: '', profile_pic_filename: '', profile_pic_mime_type: '' })
  const [imgSrc, setImgSrc] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [subSearch, setSubSearch] = React.useState('')
  const [subSort, setSubSort] = React.useState<SortKey>('name_asc')
  const [selectedSub, setSelectedSub] = React.useState<Category | null>(null)
  const [subImgCache, setSubImgCache] = React.useState<Record<number, string>>({})
  const [showSortMenu, setShowSortMenu] = React.useState(false)
  const sortMenuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!category) return
    setEditing(false); setDirty(false)
    setForm({ category_name: category.category_name, description: category.description || '', is_active: category.is_active, profile_pic: '', profile_pic_filename: '', profile_pic_mime_type: '' })
    setSubSearch(''); setSubSort('name_asc'); setSelectedSub(null)
    if (category.image?.path) {
      try { setImgSrc(window.api.files.readFileAsDataURL(category.image.path)) } catch { setImgSrc(null) }
    } else { setImgSrc(null) }
    const cache: Record<number, string> = {}
    category.sub_categories?.forEach(sub => {
      if (sub.image?.path) {
        try { const d = window.api.files.readFileAsDataURL(sub.image.path); if (d) cache[sub.id] = d } catch { /* */ }
      }
    })
    setSubImgCache(cache)
  }, [category])

  // Lock body scroll when open
  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setShowSortMenu(false) }
    if (showSortMenu) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showSortMenu])

  if (!category) return null

  const setF = (patch: Partial<EditForm>) => { setForm(f => ({ ...f, ...patch })); setDirty(true) }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/') || file.size > 5_242_880) return
    const r = new FileReader()
    r.onloadend = () => setF({ profile_pic: r.result as string, profile_pic_filename: file.name, profile_pic_mime_type: file.type })
    r.readAsDataURL(file)
  }

  const handleDiscard = () => {
    setForm({ category_name: category.category_name, description: category.description || '', is_active: category.is_active, profile_pic: '', profile_pic_filename: '', profile_pic_mime_type: '' })
    setDirty(false); setEditing(false)
  }

  const handleSave = async () => {
    if (!form.category_name.trim()) return
    setSaving(true)
    try {
      const payload: any = { id: category.id, category_name: form.category_name.trim(), description: form.description.trim() || undefined, is_active: form.is_active }
      if (form.profile_pic) { payload.update_image = true; payload.image_data = form.profile_pic }
      const res = await window.api.products.updateCategory(payload)
      if (!res.success) throw new Error(res.message)
      setDirty(false); setEditing(false); onUpdated?.()
    } catch (err) { console.error(err) } finally { setSaving(false) }
  }

  const filteredSubs = sortSubs(
    (category.sub_categories || []).filter(s => !subSearch || s.category_name.toLowerCase().includes(subSearch.toLowerCase()) || s.description?.toLowerCase().includes(subSearch.toLowerCase())),
    subSort
  )

  const sortLabels: Record<SortKey, string> = {
    name_asc: 'A → Z', name_desc: 'Z → A',
    products_asc: 'Fewest products', products_desc: 'Most products',
    date_asc: 'Oldest first', date_desc: 'Newest first',
  }

  const displayImg = form.profile_pic || imgSrc

  return ReactDOM.createPortal(
    <>
      {/* Backdrop — full viewport */}
      <div
        className={`fixed inset-0 z-[9998] bg-black/25 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-[9999] h-full bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out overflow-x-hidden ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: 'min(480px, 100vw)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Category Details</h2>
              <p className="text-xs text-gray-500">#{String(category.id).padStart(4, '0')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-all shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
            {editing && (
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Editing
              </span>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Hero */}
          <div className={`px-5 pt-5 pb-4 ${editing ? 'bg-blue-50/40' : 'bg-gradient-to-b from-gray-50/80 to-white'} transition-colors`}>
            <div className="flex items-start gap-4">
              <div className="relative group flex-shrink-0">
                <div
                  className={`w-20 h-20 rounded-2xl overflow-hidden border-2 shadow-sm ${editing ? 'border-dashed border-blue-300 cursor-pointer hover:border-blue-500' : 'border-gray-200'} transition-all`}
                  onClick={() => editing && fileInputRef.current?.click()}
                >
                  {displayImg
                    ? <img src={displayImg} alt={category.category_name} className="w-full h-full object-cover" />
                    : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                        <span className="text-white text-3xl font-bold">{category.category_name.charAt(0).toUpperCase()}</span>
                      </div>
                    )
                  }
                  {editing && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )}
                </div>
                {category.is_deleted && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              <div className="flex-1 min-w-0">
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Category Name <span className="text-red-500">*</span></label>
                      <input value={form.category_name} onChange={e => setF({ category_name: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                      <textarea value={form.description} onChange={e => setF({ description: e.target.value })} rows={3} placeholder="Describe this category…" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white" />
                    </div>
                    <div className="flex items-center justify-between py-2.5 px-3.5 bg-white rounded-lg border border-gray-200">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Active</p>
                        <p className="text-xs text-gray-500">Visible in the storefront</p>
                      </div>
                      <button type="button" onClick={() => setF({ is_active: !form.is_active })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}>
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 break-words">{category.category_name}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${category.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${category.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {category.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {category.is_deleted && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">Deleted</span>}
                      {category.is_sync_required && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200"><div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />Sync pending</span>}
                    </div>
                    {category.description && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{category.description}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Save / Discard bar */}
          {editing && dirty && (
            <div className="px-5 py-3 bg-blue-50 border-y border-blue-100 flex items-center gap-3">
              <p className="text-xs text-blue-700 font-medium flex-1">You have unsaved changes</p>
              <button onClick={handleDiscard} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold border border-gray-300 rounded-lg transition-all shadow-sm">Discard</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all shadow flex items-center gap-1.5">
                {saving
                  ? <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                }
                Save Changes
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="px-5 py-4 grid grid-cols-3 gap-3 border-b border-gray-100">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-blue-700">{category.product_count}</div>
              <div className="text-xs text-blue-600 mt-0.5">Products</div>
            </div>
            <div className="bg-violet-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-violet-700">{category.sub_category_count}</div>
              <div className="text-xs text-violet-600 mt-0.5">Subcategories</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-gray-700">#{String(category.id).padStart(4, '0')}</div>
              <div className="text-xs text-gray-500 mt-0.5">ID</div>
            </div>
          </div>

          {/* Meta */}
          <div className="px-5 py-4 border-b border-gray-100 space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Created</div>
                <div className="font-medium text-gray-900">{formatDate(category.created_on)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Updated</div>
                <div className="font-medium text-gray-900">{formatDate(category.updated_on)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Parent</div>
                <div className="font-medium text-gray-900">
                  {category.parent_category_id ? `#${String(category.parent_category_id).padStart(4, '0')}` : <span className="text-gray-400">Root</span>}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Last Sync</div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${category.is_sync_required ? 'bg-amber-400' : category.last_sync ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="font-medium text-gray-900 text-xs">{formatLastSync(category.last_sync)}</span>
                </div>
              </div>
            </div>
            {category.is_sync_required && (
              <button onClick={() => onSync?.(category.id)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-sm font-semibold rounded-lg transition-all">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </button>
            )}
          </div>

          {/* Subcategories */}
          {(category.sub_categories?.length > 0) && (
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Subcategories ({category.sub_categories.length})
                </h4>
              </div>

              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input value={subSearch} onChange={e => setSubSearch(e.target.value)} placeholder="Search subcategories…" className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all" />
                </div>
                <div className="relative" ref={sortMenuRef}>
                  <button onClick={() => setShowSortMenu(s => !s)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-all whitespace-nowrap">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                    </svg>
                    Sort
                  </button>
                  {showSortMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20">
                      {(Object.keys(sortLabels) as SortKey[]).map(key => (
                        <button key={key} onClick={() => { setSubSort(key); setShowSortMenu(false) }}
                          className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between transition-colors ${subSort === key ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                          {sortLabels[key]}
                          {subSort === key && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {filteredSubs.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">No subcategories match your search</div>
              ) : (
                <div className="space-y-2">
                  {filteredSubs.map(sub => {
                    const subImg = subImgCache[sub.id]
                    return (
                      <button key={sub.id} onClick={() => setSelectedSub(sub)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl transition-all group text-left"
                      >
                        <div className="w-9 h-9 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 shadow-sm">
                          {subImg
                            ? <img src={subImg} alt={sub.category_name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center"><span className="text-white text-xs font-bold">{sub.category_name.charAt(0).toUpperCase()}</span></div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">{sub.category_name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">{sub.product_count} products</span>
                            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${sub.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${sub.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                              {sub.is_active ? 'Active' : 'Inactive'}
                            </span>
                            {sub.is_sync_required && <span className="text-xs text-amber-600 font-medium">· Sync</span>}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="h-6" />
        </div>
      </div>

      {selectedSub && (
        <SubCategoryModal
          sub={selectedSub}
          onClose={() => setSelectedSub(null)}
          onUpdated={() => { setSelectedSub(null); onUpdated?.() }}
        />
      )}
    </>,
    document.body
  )
}

export default CategoryOffcanvas