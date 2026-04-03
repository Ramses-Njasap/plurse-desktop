const CategorySkeleton = () => (
  <div className="divide-y divide-gray-100">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-4 md:px-6 py-4 animate-pulse">
        {/* Image */}
        <div className="md:col-span-1 flex items-center gap-3 md:gap-0">
          <div className="w-12 h-12 bg-gray-200 rounded-xl flex-shrink-0" />
          <div className="md:hidden flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
        {/* Name */}
        <div className="hidden md:block md:col-span-3 space-y-1.5">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
        {/* Products */}
        <div className="hidden md:block md:col-span-2">
          <div className="h-7 bg-blue-100 rounded-lg w-28" />
        </div>
        {/* Subcategories */}
        <div className="hidden md:block md:col-span-2">
          <div className="h-7 bg-violet-100 rounded-lg w-32" />
        </div>
        {/* Status */}
        <div className="hidden lg:block lg:col-span-2">
          <div className="h-6 bg-gray-100 rounded-full w-20" />
        </div>
        {/* Toggle */}
        <div className="md:col-span-2 lg:col-span-1 flex justify-end">
          <div className="h-8 w-8 bg-gray-200 rounded-full" />
        </div>
      </div>
    ))}
  </div>
)

export default CategorySkeleton