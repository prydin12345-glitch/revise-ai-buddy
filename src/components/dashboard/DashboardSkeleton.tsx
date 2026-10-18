import { Skeleton } from "@/components/ui/skeleton";
import { useIsLaptop, useIsMobile } from "@/hooks/use-mobile";
import "@/styles/home-dashboard-components.css";
import "@/styles/tablet-dashboard.css";

export const DashboardSkeleton = () => {
  const isLaptop = useIsLaptop();
  const isMobile = useIsMobile();
  const isTablet = !isLaptop && !isMobile;
  return (
    <div className="font-sans">
      <main className="student-home-dashboard">
        <div className={`student-home-grid${isTablet ? " student-home-tablet" : ""}`} role="status" aria-label="Loading your dashboard">
          <div className="student-home-welcome student-home-skeleton-welcome"><Skeleton className="h-[220px] w-full md:h-[240px]" /></div>
          {isTablet ? <>
            <Skeleton className="tablet-home-skeleton-summary h-[156px] w-full rounded-2xl" />
            <Skeleton className="tablet-home-skeleton-statistics h-[324px] w-full rounded-2xl" />
            <div className="laptop-home-context">
              <Skeleton className="tablet-home-skeleton-card h-[294px] w-full" />
              <Skeleton className="tablet-home-skeleton-card h-[294px] w-full" />
            </div>
            <Skeleton className="tablet-home-skeleton-activity h-[480px] w-full rounded-2xl" />
          </> : <>
            <div className="student-home-primary flex min-w-0 flex-col gap-5">
              <Skeleton className="h-[104px] w-full rounded-lg" />
              <Skeleton className="laptop-home-skeleton-create h-[120px] w-full rounded-lg" />
              <Skeleton className="laptop-home-skeleton-create h-[180px] w-full rounded-lg" />
              <Skeleton className="laptop-home-skeleton-activity h-[280px] w-full rounded-lg" />
            </div>
            <aside className="student-home-secondary flex min-w-0 flex-col gap-5">
              <Skeleton className="laptop-home-skeleton-context h-[260px] w-full rounded-lg" />
              <Skeleton className="laptop-home-skeleton-announcements hidden w-full rounded-lg" />
              <Skeleton className="laptop-home-skeleton-recent h-[300px] w-full rounded-lg" />
            </aside>
          </>}
        </div>
      </main>
    </div>
  );
};
