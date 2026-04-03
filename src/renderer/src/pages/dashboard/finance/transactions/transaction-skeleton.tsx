
const TransactionSkeleton = () => (
  <div className="divide-y divide-gray-100">
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-4 md:px-6 py-4 animate-pulse"
      >
        {/* Type Icon */}
        <div className="md:col-span-1 flex items-center gap-3 md:gap-0">
          <div className="w-8 h-8 bg-gray-200 rounded-lg flex-shrink-0" />
          <div className="md:hidden flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </div>

        {/* Description */}
        <div className="hidden md:flex md:col-span-3 flex-col justify-center space-y-1.5">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>

        {/* Amount */}
        <div className="hidden md:flex md:col-span-2 items-center">
          <div className="h-5 bg-emerald-200 rounded w-20" />
        </div>

        {/* Recorded By */}
        <div className="hidden md:flex md:col-span-2 items-center">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 rounded-full" />
            <div className="h-3 bg-gray-200 rounded w-16" />
          </div>
        </div>

        {/* Date */}
        <div className="hidden md:flex md:col-span-2 items-center">
          <div className="h-3 bg-gray-200 rounded w-24" />
        </div>

        {/* Status */}
        <div className="hidden md:flex md:col-span-1 items-center">
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Chevron */}
        <div className="md:col-span-1 flex justify-end">
          <div className="w-4 h-4 bg-gray-200 rounded" />
        </div>
      </div>
    ))}
  </div>
)

export default TransactionSkeleton