import React from 'react'

type Props = {
  description: string | null | undefined
}

const DESCRIPTION_CHAR_LIMIT = 120

const CategoryDescription = ({ description }: Props) => {
  const [showModal, setShowModal] = React.useState(false)

  if (!description || description.trim() === '') {
    return (
      <div className="flex flex-col items-center justify-center h-[72px] rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4">
        <svg className="w-4 h-4 text-gray-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-xs text-gray-400 font-medium">No description provided</span>
      </div>
    )
  }

  const isTruncated = description.length > DESCRIPTION_CHAR_LIMIT
  const displayText = isTruncated
    ? description.slice(0, DESCRIPTION_CHAR_LIMIT).trimEnd() + '…'
    : description

  return (
    <>
      <div className="h-[72px] flex flex-col justify-center">
        <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
          {displayText}
          {isTruncated && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowModal(true) }}
              className="ml-1 text-blue-500 hover:text-blue-700 font-medium text-xs underline underline-offset-2 transition-colors whitespace-nowrap"
            >
              Read more
            </button>
          )}
        </p>
      </div>

      {/* Full Description Modal — centered in content area (left-64) */}
      {showModal && (
        <div
          className="fixed top-0 left-64 right-0 bottom-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
          onClick={(e) => { e.stopPropagation(); setShowModal(false) }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            style={{ animation: 'scaleIn 0.15s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Full Description</h3>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowModal(false) }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 max-h-80 overflow-y-auto">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{description}</p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={(e) => { e.stopPropagation(); setShowModal(false) }}
                className="w-full px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </>
  )
}

export default CategoryDescription