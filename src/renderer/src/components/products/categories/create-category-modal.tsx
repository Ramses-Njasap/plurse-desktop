import React from 'react'
import ReactDOM from 'react-dom'
import CategoryFormSlide, { CategoryFormData, defaultFormData } from './category-form-slide'

const MAX_SUB_CATEGORIES = 5

type Props = {
  open: boolean
  onClose: () => void
  onSuccess?: (categoryId: number) => void
}

type StackEntry = {
  data: CategoryFormData
  errors: Record<string, string>
}

const CreateCategoryModal = ({ open, onClose, onSuccess }: Props) => {
  const [stack, setStack] = React.useState<StackEntry[]>([{ data: defaultFormData(), errors: {} }])
  const [activeDepth, setActiveDepth] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setStack([{ data: defaultFormData(), errors: {} }])
      setActiveDepth(0)
      setSubmitting(false)
    }
  }, [open])

  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  const updateEntry = (depth: number, patch: Partial<StackEntry>) =>
    setStack(prev => prev.map((e, i) => (i === depth ? { ...e, ...patch } : e)))

  const clearError = (depth: number, key: string) =>
    setStack(prev => prev.map((e, i) => {
      if (i !== depth) return e
      const errs = { ...e.errors }; delete errs[key]
      return { ...e, errors: errs }
    }))

  const validate = (depth: number): boolean => {
    const entry = stack[depth]
    const errors: Record<string, string> = {}
    if (!entry.data.category_name.trim()) errors.category_name = 'Name is required'
    updateEntry(depth, { errors })
    return Object.keys(errors).length === 0
  }

  const handleGoToNext = (fromDepth: number) => {
    if (!validate(fromDepth)) return
    setActiveDepth(fromDepth + 1)
  }

  const handleCreateSub = (fromDepth: number) => {
    if (!validate(fromDepth)) return
    if (stack.length - 1 >= MAX_SUB_CATEGORIES) return
    const newStack = [...stack, { data: defaultFormData(), errors: {} }]
    setStack(newStack)
    setActiveDepth(newStack.length - 1)
  }

  const handleBack = (depth: number) => {
    if (depth === 0) onClose()
    else setActiveDepth(depth - 1)
  }

  const handleDeleteSub = (depth: number) => {
    const newStack = stack.slice(0, depth)
    setStack(newStack)
    setActiveDepth(depth - 1)
  }

  const handleSubmit = async (fromDepth: number) => {
    let allValid = true
    for (let i = 0; i <= fromDepth; i++) { if (!validate(i)) allValid = false }
    if (!allValid) return
    setSubmitting(true)
    try {
      const rootEntry = stack[0]
      const subcategories = stack.slice(1, fromDepth + 1).map(entry => ({
        category_name: entry.data.category_name.trim(),
        description: entry.data.description.trim() || undefined,
        is_active: entry.data.is_active,
        with_image: !!entry.data.profile_pic,
        image_data: entry.data.profile_pic || undefined,
      }))
      const payload = {
        category_name: rootEntry.data.category_name.trim(),
        description: rootEntry.data.description.trim() || undefined,
        is_active: rootEntry.data.is_active,
        with_image: !!rootEntry.data.profile_pic,
        image_data: rootEntry.data.profile_pic || undefined,
        ...(subcategories.length > 0 ? { subcategories } : {}),
      }
      const result = await window.api.products.createCategory(payload as any)
      if (!result.success || !result.data?.id) throw new Error(result.message || 'Failed to create category')
      onSuccess?.(result.data.id)
      onClose()
    } catch (err) {
      console.error('Failed to create category:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return ReactDOM.createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9998] bg-black/25 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Offcanvas panel */}
      <div
        className={`fixed top-0 right-0 z-[9999] h-full bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: 'min(480px, 100vw)' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Back button when inside a sub-category panel */}
            {activeDepth > 0 && (
              <button
                onClick={() => handleBack(activeDepth)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                {activeDepth === 0 ? 'New Category' : `Sub-category #${activeDepth}`}
              </h2>
              {activeDepth > 0 && (
                <p className="text-xs text-gray-500">{activeDepth} of {MAX_SUB_CATEGORIES} max</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Delete sub-category button */}
            {activeDepth > 0 && (
              <button
                onClick={() => handleDeleteSub(activeDepth)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg border border-red-200 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remove
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Depth indicator (breadcrumb) when there are subs ── */}
        {stack.length > 1 && (
          <div className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-50 border-b border-gray-100 overflow-x-auto flex-shrink-0">
            {stack.map((_, depth) => (
              <React.Fragment key={depth}>
                {depth > 0 && (
                  <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                <button
                  onClick={() => depth < activeDepth && setActiveDepth(depth)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                    depth === activeDepth
                      ? 'bg-blue-100 text-blue-700'
                      : depth < activeDepth
                      ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 cursor-pointer'
                      : 'text-gray-400 cursor-default'
                  }`}
                >
                  {depth === 0 ? 'Root' : `Sub #${depth}`}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ── Sliding panel content ── */}
        <div className="flex-1 overflow-hidden relative">
          {stack.map((entry, depth) => {
            const isSubCat = depth > 0
            const isTop = depth === activeDepth
            const nextPanelExists = stack.length > depth + 1
            const belowMax = stack.length - 1 < MAX_SUB_CATEGORIES
            const showCreate = isTop && !nextPanelExists && belowMax
            const showNext = nextPanelExists
            const submitLabel = isSubCat
              ? `Create (${depth} sub-categor${depth === 1 ? 'y' : 'ies'})`
              : 'Create'

            return (
              <div
                key={depth}
                className="absolute inset-0 overflow-y-auto bg-white transition-transform duration-300 ease-out"
                style={{
                  transform: depth === activeDepth
                    ? 'translateX(0)'
                    : depth < activeDepth
                    ? 'translateX(-100%)'
                    : 'translateX(100%)',
                }}
              >
                <div className="p-5">
                  <CategoryFormSlide
                    data={entry.data}
                    onChange={updated => updateEntry(depth, { data: updated })}
                    errors={entry.errors}
                    onClearError={key => clearError(depth, key)}
                    isSubCategory={isSubCat}
                    subIndex={depth - 1}
                    maxSubs={MAX_SUB_CATEGORIES}
                    onCreateSub={showCreate ? () => handleCreateSub(depth) : undefined}
                    onGoToNext={showNext ? () => handleGoToNext(depth) : undefined}
                    nextSubNumber={depth + 1}
                    onSubmit={() => handleSubmit(depth)}
                    submitLabel={submitLabel}
                    submitting={submitting}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>,
    document.body
  )
}

export default CreateCategoryModal