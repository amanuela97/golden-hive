// Loading component for products page
export default function ProductsLoading() {
  return (
    <div className="bg-background">
      <div className="container mx-auto px-12 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Main content - left side on desktop */}
          <div className="flex-1 order-2 lg:order-1">
            <div className="flex items-center justify-between mb-8">
              <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
              <div className="h-10 bg-gray-200 rounded w-[200px] animate-pulse"></div>
            </div>

            {/* Product grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 rounded-lg h-64 mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters - right side on desktop */}
          <aside className="w-full lg:w-80 order-1 lg:order-2">
            <div className="space-y-6">
              <div className="h-6 bg-gray-200 rounded w-24 animate-pulse"></div>
              <div className="space-y-4">
                <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
