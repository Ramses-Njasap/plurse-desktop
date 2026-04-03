import React from 'react'

type ImageMeta = {
  path: string
  filename: string
  original_filename: string
  mime_type: string
  file_size: number
  uploaded_at: string
} | null | undefined

type Props = {
  image: ImageMeta
  categoryName: string
  size?: 'sm' | 'md' | 'lg'
  isDeleted?: boolean
}

const sizeMap = {
  sm: 'w-10 h-10 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
}

const getAvatarColor = (name: string) => {
  const colors = [
    'from-blue-400 to-blue-600',
    'from-violet-400 to-violet-600',
    'from-pink-400 to-pink-600',
    'from-amber-400 to-amber-600',
    'from-teal-400 to-teal-600',
    'from-rose-400 to-rose-600',
    'from-cyan-400 to-cyan-600',
    'from-indigo-400 to-indigo-600',
  ]
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
}

const CategoryImage = ({ image, categoryName, size = 'md', isDeleted }: Props) => {
  const [imgSrc, setImgSrc] = React.useState<string | null>(null)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    if (!image?.path) {
      setLoaded(true)
      return
    }
    try {
      const dataUrl = window.api.files.readFileAsDataURL(image.path)
      setImgSrc(dataUrl)
    } catch {
      // fallback to initials
    } finally {
      setLoaded(true)
    }
  }, [image?.path])

  const sizeClass = sizeMap[size]
  const initial = (categoryName || '?').charAt(0).toUpperCase()
  const gradientColor = isDeleted ? 'from-gray-300 to-gray-400' : getAvatarColor(categoryName)

  if (!loaded) {
    return (
      <div className={`${sizeClass} rounded-xl bg-gray-200 animate-pulse flex-shrink-0`} />
    )
  }

  return (
    <div className={`${sizeClass} rounded-xl overflow-hidden flex-shrink-0 border border-gray-200 shadow-sm relative`}>
      {imgSrc ? (
        <img src={imgSrc} alt={categoryName} className="w-full h-full object-cover" />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${gradientColor} flex items-center justify-center`}
        >
          <span className="text-white font-bold">{initial}</span>
        </div>
      )}
      {isDeleted && (
        <div className="absolute inset-0 bg-gray-900/30 flex items-center justify-center">
          <svg className="w-1/2 h-1/2 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
    </div>
  )
}

export default CategoryImage