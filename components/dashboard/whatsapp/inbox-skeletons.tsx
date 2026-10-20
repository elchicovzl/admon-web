import { Skeleton } from '@/components/ui/skeleton'

export function ConversationListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="space-y-1 p-2" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex gap-3 rounded-md p-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-48 max-w-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ThreadSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-4" aria-hidden>
      <Skeleton className="h-10 w-2/3 max-w-sm" />
      <Skeleton className="ml-auto h-14 w-1/2 max-w-xs" />
      <Skeleton className="h-10 w-1/2 max-w-xs" />
      <Skeleton className="ml-auto h-10 w-2/5 max-w-xs" />
      <Skeleton className="h-16 w-3/5 max-w-sm" />
    </div>
  )
}

/** Whole inbox while the server component loads the first page. */
export function InboxSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[28rem] overflow-hidden rounded-lg border bg-card">
      <div className="w-full shrink-0 border-r md:w-80 lg:w-96">
        <div className="border-b p-3">
          <Skeleton className="h-8 w-full" />
        </div>
        <ConversationListSkeleton />
      </div>
      <div className="hidden flex-1 md:flex">
        <ThreadSkeleton />
      </div>
    </div>
  )
}
