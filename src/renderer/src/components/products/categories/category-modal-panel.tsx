import React from 'react'

type Props = {
  /** 0 = root category, 1+ = sub category depth */
  depth: number
  /** 1-based position label, e.g. "1/5" */
  positionLabel?: string
  title: string
  onClose: () => void
  /** Called when user wants to delete this sub-category modal entirely */
  onDelete?: () => void
  children: React.ReactNode
  /** Whether this is the topmost modal in the stack (receives pointer events) */
  isTop: boolean
  /** Total number of modals open, used for stacking offset */
  totalDepth: number
}

const STACK_OFFSET = 20   // px shift per level
const SCALE_STEP   = 0.03 // scale down per level below top

const CategoryModalPanel = ({
  depth,
  positionLabel,
  title,
  onClose,
  onDelete,
  children,
  isTop,
  totalDepth,
}: Props) => {
  const levelsFromTop = totalDepth - 1 - depth   // 0 = topmost
  const translateY    = -levelsFromTop * STACK_OFFSET
  const scale         = 1 - levelsFromTop * SCALE_STEP
  const opacity       = levelsFromTop === 0 ? 1 : Math.max(0.6, 1 - levelsFromTop * 0.15)

  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-4"
      style={{ pointerEvents: isTop ? 'auto' : 'none' }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{
          transform: `translateY(${translateY}px) scale(${scale})`,
          opacity,
          transition: 'transform 0.25s ease, opacity 0.25s ease',
          transformOrigin: 'top center',
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2.5">
            {/* Depth indicator dot(s) */}
            {depth > 0 && (
              <div className="flex items-center gap-1">
                {Array.from({ length: depth }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-blue-400"
                    style={{ opacity: 0.4 + (i + 1) * 0.2 }}
                  />
                ))}
              </div>
            )}
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Position badge e.g. "2/5" */}
            {positionLabel && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                {positionLabel}
              </span>
            )}
            {/* Delete this sub-category */}
            {onDelete && (
              <button
                onClick={onDelete}
                title="Remove this sub-category"
                className="w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:text-white hover:bg-red-500 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            {/* Close / back */}
            <button
              onClick={onClose}
              title={depth === 0 ? 'Close' : 'Go back'}
              className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
            >
              {depth === 0 ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-5 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

export default CategoryModalPanel