export function PageSkeleton() {
  return (
    <div className="animate-pulse w-full p-6">
      <div className="flex items-center justify-between mb-8">
        {/* Title Skeleton */}
        <div className="h-8 w-48 rounded-md bg-gray-200 dark:bg-gray-700" />
        {/* Button Skeleton */}
        <div className="h-10 w-24 rounded-md bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Tabs or Filters Skeleton */}
      <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="h-10 w-20 rounded-t-md bg-gray-200 dark:bg-gray-700" />
        <div className="h-10 w-20 bg-gray-100 dark:bg-gray-800 rounded-t-md" />
        <div className="h-10 w-20 bg-gray-100 dark:bg-gray-800 rounded-t-md" />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700">
        {/* Table Header */}
        <div className="grid grid-cols-5 gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
          {[...Array(5)].map((_, i) => <div key={i} className="h-4 rounded bg-gray-200 dark:bg-gray-700" />)}
        </div>
        {/* Table Body */}
        <div className="p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-4">
              {[...Array(5)].map((_, j) => <div key={j} className="h-4 rounded bg-gray-200 dark:bg-gray-700" />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}