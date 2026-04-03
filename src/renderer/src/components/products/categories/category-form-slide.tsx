import React from 'react'

export type CategoryFormData = {
  category_name: string
  description: string
  is_active: boolean
  profile_pic: string
  profile_pic_filename: string
  profile_pic_mime_type: string
}

export const defaultFormData = (): CategoryFormData => ({
  category_name: '',
  description: '',
  is_active: true,
  profile_pic: '',
  profile_pic_filename: '',
  profile_pic_mime_type: '',
})

type Props = {
  data: CategoryFormData
  onChange: (updated: CategoryFormData) => void
  errors: Record<string, string>
  onClearError: (key: string) => void
  isSubCategory?: boolean
  subIndex?: number
  maxSubs?: number
  /**
   * If provided → this panel is the TOP panel with NO next panel yet.
   * Clicking creates a brand-new sub-category panel.
   */
  onCreateSub?: () => void
  /**
   * If provided → a next panel ALREADY EXISTS.
   * Clicking navigates forward without creating anything new.
   */
  onGoToNext?: () => void
  /** 1-based number of the NEXT sub (used for button labels) */
  nextSubNumber?: number
  onSubmit: () => void
  submitLabel?: string
  submitting?: boolean
}

const CategoryFormSlide = ({
  data,
  onChange,
  errors,
  onClearError,
  isSubCategory = false,
  maxSubs = 5,
  onCreateSub,
  onGoToNext,
  nextSubNumber = 1,
  onSubmit,
  submitLabel = 'Create',
  submitting = false,
}: Props) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const set = (patch: Partial<CategoryFormData>) => onChange({ ...data, ...patch })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onloadend = () => {
      set({
        profile_pic: reader.result as string,
        profile_pic_filename: file.name,
        profile_pic_mime_type: file.type,
      })
      onClearError('profile_pic')
    }
    reader.readAsDataURL(file)
  }

  const removeImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    set({ profile_pic: '', profile_pic_filename: '', profile_pic_mime_type: '' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const showSubButton = (onCreateSub || onGoToNext) && nextSubNumber <= maxSubs

  return (
    <div className="space-y-5">
      {/* ── Image Upload ── */}
      <div className="flex flex-col items-center">
        <div className="relative group">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="
              w-24 h-24 rounded-full border-2 border-dashed border-gray-300
              hover:border-blue-400 bg-gray-50 hover:bg-blue-50
              flex items-center justify-center overflow-hidden
              transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500
            "
          >
            {data.profile_pic ? (
              <img
                src={data.profile_pic}
                alt="Category"
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <svg className="w-8 h-8 text-gray-400 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs text-gray-400 group-hover:text-blue-400 transition-colors font-medium">
                  Image
                </span>
              </div>
            )}
          </button>

          {data.profile_pic && (
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-md transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">Optional · JPG, PNG, GIF · max 5MB</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* ── Category Name ── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          {isSubCategory ? 'Sub-category Name' : 'Category Name'}
          <span className="text-red-500 ml-1">*</span>
        </label>
        <input
          type="text"
          value={data.category_name}
          onChange={(e) => {
            set({ category_name: e.target.value })
            onClearError('category_name')
          }}
          placeholder={isSubCategory ? 'e.g. Running Shoes' : 'e.g. Footwear'}
          className={`
            w-full px-4 py-3 rounded-lg border text-sm
            focus:outline-none focus:ring-2 transition-all
            ${errors.category_name
              ? 'border-red-300 focus:ring-red-400 bg-red-50'
              : 'border-gray-300 focus:ring-blue-500 focus:border-transparent bg-white'
            }
          `}
        />
        {errors.category_name && (
          <p className="text-xs text-red-600 mt-1">{errors.category_name}</p>
        )}
      </div>

      {/* ── Description ── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Description
          <span className="ml-2 text-xs font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          value={data.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Describe this category…"
          rows={3}
          className="
            w-full px-4 py-3 rounded-lg border border-gray-300 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            resize-none bg-white transition-all
          "
        />
      </div>

      {/* ── Active Toggle ── */}
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <p className="text-sm font-semibold text-gray-700">Active</p>
          <p className="text-xs text-gray-500">Visible in the storefront</p>
        </div>
        <button
          type="button"
          onClick={() => set({ is_active: !data.is_active })}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full
            transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${data.is_active ? 'bg-blue-600' : 'bg-gray-300'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 rounded-full bg-white shadow-sm
              transform transition-transform duration-200
              ${data.is_active ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {/* ── Sub-category Action Button ── */}
      {showSubButton && (
        <>
          {onGoToNext ? (
            // Panel is NOT the top but a next panel exists → navigate forward
            <button
              type="button"
              onClick={onGoToNext}
              className="
                w-full px-4 py-3 rounded-lg border-2 border-blue-200
                bg-blue-50 hover:bg-blue-100 hover:border-blue-400
                text-sm font-semibold text-blue-600 hover:text-blue-700
                transition-all duration-200
                flex items-center justify-center gap-2
              "
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Next sub category ({nextSubNumber})
            </button>
          ) : (
            // Panel is the TOP and no next panel yet → create a new one
            <button
              type="button"
              onClick={onCreateSub}
              className="
                w-full px-4 py-3 rounded-lg border-2 border-dashed border-gray-300
                hover:border-blue-400 hover:bg-blue-50
                text-sm font-semibold text-gray-600 hover:text-blue-600
                transition-all duration-200
                flex items-center justify-center gap-2
              "
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create sub category ({nextSubNumber})
            </button>
          )}
        </>
      )}

      {/* ── OR divider ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* ── Submit / Create button ── */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="
          w-full px-4 py-3 rounded-lg
          bg-gray-900 hover:bg-gray-800
          disabled:bg-gray-400 disabled:cursor-not-allowed
          text-white text-sm font-semibold
          transition-all duration-200 shadow-sm hover:shadow
          flex items-center justify-center gap-2
        "
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
            {submitLabel}
          </>
        )}
      </button>
    </div>
  )
}

export default CategoryFormSlide