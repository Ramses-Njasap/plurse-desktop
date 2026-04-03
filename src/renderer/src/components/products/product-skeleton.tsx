// src/components/products/product-skeleton.tsx

const ProductSkeleton = () => (
  <div className="divide-y divide-gray-100">
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-4 md:px-6 py-4 animate-pulse"
      >
        {/* Image */}
        <div className="md:col-span-1 flex items-center gap-3 md:gap-0">
          <div className="w-12 h-12 bg-gray-200 rounded-xl flex-shrink-0" />
          {/* Mobile: name + category next to image */}
          <div className="md:hidden flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </div>

        {/* Name + category */}
        <div className="hidden md:flex md:col-span-3 flex-col justify-center space-y-1.5">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>

        {/* Stock status badge */}
        <div className="hidden md:flex md:col-span-2 items-center">
          <div className="h-6 bg-blue-100 rounded-full w-24" />
        </div>

        {/* Revenue + profit */}
        <div className="hidden md:flex md:col-span-2 flex-col justify-center space-y-1.5">
          <div className="h-4 bg-violet-100 rounded w-20" />
          <div className="h-3 bg-emerald-100 rounded w-16" />
        </div>

        {/* Items remaining / sold */}
        <div className="hidden lg:flex lg:col-span-2 flex-col justify-center space-y-1.5">
          <div className="h-3 bg-gray-100 rounded w-24" />
          <div className="h-3 bg-gray-100 rounded w-20" />
        </div>

        {/* Flags row: best seller, low stock, high margin */}
        <div className="hidden lg:flex lg:col-span-1 items-center gap-1">
          <div className="h-5 w-5 bg-amber-100 rounded-full" />
          <div className="h-5 w-5 bg-red-100 rounded-full" />
          <div className="h-5 w-5 bg-emerald-100 rounded-full" />
        </div>

        {/* Action button */}
        <div className="md:col-span-2 lg:col-span-1 flex items-center justify-end">
          <div className="h-8 w-8 bg-gray-200 rounded-full" />
        </div>
      </div>
    ))}
  </div>
)

export default ProductSkeleton