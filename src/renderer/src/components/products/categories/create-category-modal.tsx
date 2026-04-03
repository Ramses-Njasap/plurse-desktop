import React from 'react'
import CategoryFormSlide, { CategoryFormData, defaultFormData } from './category-form-slide'
import CategoryModalPanel from './category-modal-panel'

const MAX_SUB_CATEGORIES = 5

type Props = {
  open: boolean
  onClose: () => void
  onSuccess?: (categoryId: number) => void
}

/**
 * Navigation rules (all fixed):
 *
 *  stack[0]  = root, stack[1..N] = sub-categories
 *  activeDepth = currently visible top panel index
 *
 *  ► Back arrow   → setActiveDepth(depth - 1)  [never destroys panels]
 *  ► Delete (🗑)  → stack.slice(0, depth), setActiveDepth(depth - 1)
 *
 *  Sub-action button on a panel at `depth`:
 *  - If stack[depth+1] EXISTS (panel already created, user went back) → "Next sub category (N)" → setActiveDepth(depth+1)
 *  - If stack[depth+1] DOES NOT EXIST and below max and this IS the active top → "Create sub category (N)" → push new panel
 *  - Otherwise → nothing
 *
 *  This means EVERY previously-created panel always has "Next →" available when revisited.
 */

type StackEntry = {
  data: CategoryFormData
  errors: Record<string, string>
}

const CreateCategoryModal = ({ open, onClose, onSuccess }: Props) => {
  const [stack, setStack] = React.useState<StackEntry[]>([
    { data: defaultFormData(), errors: {} },
  ])
  const [activeDepth, setActiveDepth] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setStack([{ data: defaultFormData(), errors: {} }])
      setActiveDepth(0)
      setSubmitting(false)
    }
  }, [open])

  if (!open) return null

  // ── Helpers ──────────────────────────────────────────────────────────────

  const updateEntry = (depth: number, patch: Partial<StackEntry>) =>
    setStack(prev => prev.map((e, i) => (i === depth ? { ...e, ...patch } : e)))

  const clearError = (depth: number, key: string) =>
    setStack(prev => prev.map((e, i) => {
      if (i !== depth) return e
      const errs = { ...e.errors }
      delete errs[key]
      return { ...e, errors: errs }
    }))

  const validate = (depth: number): boolean => {
    const entry = stack[depth]
    const errors: Record<string, string> = {}
    if (!entry.data.category_name.trim()) errors.category_name = 'Name is required'
    updateEntry(depth, { errors })
    return Object.keys(errors).length === 0
  }

  // Navigate forward to an already-existing panel
  const handleGoToNext = (fromDepth: number) => {
    if (!validate(fromDepth)) return
    setActiveDepth(fromDepth + 1)
  }

  // Create a brand-new sub panel (only when none exists at depth+1)
  const handleCreateSub = (fromDepth: number) => {
    if (!validate(fromDepth)) return
    if (stack.length - 1 >= MAX_SUB_CATEGORIES) return
    const newStack = [...stack, { data: defaultFormData(), errors: {} }]
    setStack(newStack)
    setActiveDepth(newStack.length - 1)
  }

  // Back: just change active depth, never destroys
  const handleBack = (depth: number) => {
    if (depth === 0) onClose()
    else setActiveDepth(depth - 1)
  }

  // Delete: remove this panel and everything deeper
  const handleDeleteSub = (depth: number) => {
    const newStack = stack.slice(0, depth)
    setStack(newStack)
    setActiveDepth(depth - 1)
  }

  // Submit: single nested request
  const handleSubmit = async (fromDepth: number) => {
    let allValid = true
    for (let i = 0; i <= fromDepth; i++) {
      if (!validate(i)) allValid = false
    }
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
      throw err
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const totalDepth = stack.length

  return (
    <div className="fixed top-0 left-64 right-0 bottom-0 z-50 flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.15s ease-out' }}>
      {/* Lighter backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md" style={{ height: 'min(90vh, 700px)' }}>
        {stack.map((entry, depth) => {
          const isSubCat = depth > 0
          const subNumber = depth
          const isTop = depth === activeDepth
          const isVisible = depth <= activeDepth

          if (!isVisible) return null

          const positionLabel = isSubCat ? `${subNumber}/${MAX_SUB_CATEGORIES}` : undefined
          const title = isSubCat ? `Sub-category #${subNumber}` : 'New Category'

          // KEY FIX: correctly compute which sub-action button to show
          const nextPanelExists = stack.length > depth + 1  // a panel at depth+1 already in stack?
          const belowMax = stack.length - 1 < MAX_SUB_CATEGORIES

          // "Create" only shows on the current active top with no next panel yet
          const showCreate = isTop && !nextPanelExists && belowMax
          // "Next" shows whenever there IS a next panel — regardless of isTop
          const showNext = nextPanelExists

          const submitLabel = isSubCat
            ? `Create (${subNumber} sub-categor${subNumber === 1 ? 'y' : 'ies'})`
            : 'Create'

          return (
            <CategoryModalPanel
              key={depth}
              depth={depth}
              positionLabel={positionLabel}
              title={title}
              onClose={() => handleBack(depth)}
              onDelete={isSubCat ? () => handleDeleteSub(depth) : undefined}
              isTop={isTop}
              totalDepth={totalDepth}
            >
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
            </CategoryModalPanel>
          )
        })}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  )
}

export default CreateCategoryModal