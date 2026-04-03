// src/components/public/sales-point/image-gallery.tsx

import type { SKUImage } from '@renderer/components/public/types/sales'
import React, { useEffect, useState } from 'react'

interface ImageGalleryProps {
  images: SKUImage[]
  altText?: string
  className?: string
  thumbSize?: 'sm' | 'md' | 'lg'
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  altText = 'Image',
  className = '',
  thumbSize = 'md',
}) => {
  const [activeIdx, setActiveIdx] = useState(0)
  const [loadedSrcs, setLoadedSrcs] = useState<Record<number, string | null>>({})

  useEffect(() => {
    // Reset when images change
    setActiveIdx(0)
    setLoadedSrcs({})
  }, [images])

  useEffect(() => {
    // Load all image srcs
    images.forEach((img, i) => {
      if (img.path && loadedSrcs[i] === undefined) {
        try {
          const src = window.api.files.readFileAsDataURL(img.path)
          setLoadedSrcs((prev) => ({ ...prev, [i]: src }))
        } catch {
          setLoadedSrcs((prev) => ({ ...prev, [i]: null }))
        }
      }
    })
  }, [images])

  const activeSrc = loadedSrcs[activeIdx]
  const thumbSizes = { sm: 'w-10 h-10', md: 'w-14 h-14', lg: 'w-16 h-16' }

  if (!images || images.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 rounded-xl ${className}`}>
        <div className="flex flex-col items-center gap-2 text-slate-300">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs">No image</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Main image */}
      <div className="relative bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center aspect-square w-full">
        {activeSrc ? (
          <img
            src={activeSrc}
            alt={`${altText} ${activeIdx + 1}`}
            className="w-full h-full object-cover"
          />
        ) : activeSrc === null ? (
          <div className="flex flex-col items-center gap-1 text-slate-300">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span className="text-xs">Load error</span>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <svg className="w-6 h-6 text-slate-300 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
        {images.length > 1 && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {activeIdx + 1}/{images.length}
          </span>
        )}
      </div>

      {/* Thumbnails (only if >1 image) */}
      {images.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {images.map((img, i) => {
            const src = loadedSrcs[i]
            const isPrimary = img.is_primary || i === 0
            return (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`shrink-0 ${thumbSizes[thumbSize]} rounded-lg overflow-hidden border-2 transition-all ${
                  activeIdx === i ? 'border-blue-500 shadow-sm' : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                {src ? (
                  <img src={src} alt={`${altText} thumb ${i + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}