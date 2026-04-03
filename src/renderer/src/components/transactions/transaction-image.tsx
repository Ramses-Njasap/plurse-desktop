
type Props = {
  transactionType: 'cashin' | 'cashout' | 'transfer'
  size?: 'sm' | 'md' | 'lg'
  isDeleted?: boolean
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
}

const typeConfig = {
  cashin: {
    gradient: 'from-emerald-400 to-emerald-600',
    icon: (
      <svg className="w-1/2 h-1/2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
      </svg>
    ),
  },
  cashout: {
    gradient: 'from-red-400 to-red-600',
    icon: (
      <svg className="w-1/2 h-1/2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
      </svg>
    ),
  },
  transfer: {
    gradient: 'from-blue-400 to-blue-600',
    icon: (
      <svg className="w-1/2 h-1/2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
}

const TransactionImage = ({ transactionType, size = 'md', isDeleted }: Props) => {
  const config = typeConfig[transactionType]
  const sizeClass = sizeMap[size]

  return (
    <div className={`${sizeClass} rounded-xl overflow-hidden flex-shrink-0 relative`}>
      <div className={`w-full h-full bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
        {config.icon}
      </div>
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

export default TransactionImage