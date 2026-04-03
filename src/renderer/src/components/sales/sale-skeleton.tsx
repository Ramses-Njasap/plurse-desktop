const SaleSkeleton = () => (
  <div className="divide-y divide-gray-100">
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-4 md:px-6 py-4 animate-pulse"
      >
        {/* Product */}
        <div className="md:col-span-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </div>

        {/* Customer */}
        <div className="hidden md:block md:col-span-2">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded w-1/2 mt-2" />
        </div>

        {/* Quantity */}
        <div className="hidden md:block md:col-span-1">
          <div className="h-5 bg-gray-200 rounded w-8" />
        </div>

        {/* Price */}
        <div className="hidden md:block md:col-span-1">
          <div className="h-5 bg-violet-200 rounded w-16" />
        </div>

        {/* Margin */}
        <div className="hidden md:block md:col-span-1">
          <div className="h-5 bg-emerald-200 rounded w-12" />
        </div>

        {/* Status */}
        <div className="hidden md:block md:col-span-2">
          <div className="h-6 bg-amber-100 rounded-full w-20" />
        </div>

        {/* Payment */}
        <div className="hidden md:block md:col-span-1">
          <div className="h-5 bg-gray-200 rounded w-12" />
        </div>

        {/* Chevron */}
        <div className="md:col-span-1 flex justify-end">
          <div className="h-5 w-5 bg-gray-200 rounded-full" />
        </div>
      </div>
    ))}
  </div>
)

export default SaleSkeleton