export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header skeleton */}
      <div className="h-16 bg-white border-b border-gray-200 animate-pulse" />

      {/* Hero skeleton */}
      <div className="py-20 lg:py-28 bg-gradient-to-br from-gray-50 via-white to-gray-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="h-8 w-32 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-16 w-3/4 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-6 w-1/2 bg-gray-200 rounded animate-pulse" />
              <div className="h-24 w-full bg-gray-200 rounded-lg animate-pulse" />
              <div className="flex gap-4">
                <div className="h-14 w-48 bg-gray-300 rounded-full animate-pulse" />
                <div className="h-14 w-40 bg-gray-200 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <div className="w-48 h-48 bg-gray-200 rounded-3xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Content sections skeleton */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="h-8 w-32 bg-gray-200 rounded-full mx-auto mb-4 animate-pulse" />
            <div className="h-12 w-64 bg-gray-200 rounded-lg mx-auto mb-4 animate-pulse" />
            <div className="h-6 w-96 bg-gray-200 rounded mx-auto animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-100 rounded-2xl p-8 animate-pulse">
                <div className="w-16 h-16 bg-gray-200 rounded-xl mb-6" />
                <div className="h-6 w-3/4 bg-gray-200 rounded mb-3" />
                <div className="h-20 w-full bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
