import { Skeleton } from "@/components/ui/skeleton";

export const DashboardSkeleton = () => (
  <div className="font-sans">
    <main className="mx-auto max-w-[1480px] px-4 py-6 lg:px-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_332px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="mb-1 space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-[104px] w-full rounded-[20px]" />
          <Skeleton className="h-[120px] w-full rounded-[20px]" />
          <Skeleton className="h-[180px] w-full rounded-[20px]" />
          <Skeleton className="h-[280px] w-full rounded-[20px]" />
        </div>
        <aside className="flex flex-col gap-5">
          <Skeleton className="h-[260px] w-full rounded-[20px]" />
          <Skeleton className="h-[300px] w-full rounded-[20px]" />
        </aside>
      </div>
    </main>
  </div>
);
