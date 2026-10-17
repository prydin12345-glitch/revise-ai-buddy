import { Skeleton } from "@/components/ui/skeleton";

export const DashboardSkeleton = () => (
  <div className="font-sans">
    <main className="student-home-dashboard">
      <div className="student-home-grid">
        <div className="student-home-welcome"><Skeleton className="h-[220px] w-full md:h-[240px]" /></div>
        <div className="student-home-primary flex min-w-0 flex-col gap-5">
          <Skeleton className="h-[104px] w-full rounded-lg" />
          <Skeleton className="laptop-home-skeleton-create h-[120px] w-full rounded-lg" />
          <Skeleton className="laptop-home-skeleton-create h-[180px] w-full rounded-lg" />
          <Skeleton className="laptop-home-skeleton-activity h-[280px] w-full rounded-lg" />
        </div>
        <aside className="student-home-secondary flex min-w-0 flex-col gap-5">
          <Skeleton className="laptop-home-skeleton-context h-[260px] w-full rounded-lg" />
          <Skeleton className="laptop-home-skeleton-announcements hidden w-full rounded-lg" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </aside>
      </div>
    </main>
  </div>
);
