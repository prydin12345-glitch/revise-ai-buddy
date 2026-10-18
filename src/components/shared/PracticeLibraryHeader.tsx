import type { ReactNode } from "react";
import { MyWorkTabBar } from "./MyWorkTabBar";
import { Skeleton } from "@/components/ui/skeleton";

export function PracticeLibraryHeader({ action }: { action: ReactNode }) {
  return (
    <header className="practice-library-header">
      <div className="practice-library-heading">
        <div>
          <h1>Practice library</h1>
          <p>Your mock exams and practice quizzes, organised by subject.</p>
        </div>
        <div className="practice-library-create">{action}</div>
      </div>
      <MyWorkTabBar />
    </header>
  );
}

export function LibrarySkeleton() {
  return (
    <div role="status" aria-label="Loading your work" className="library-paper-grid library-loading">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="library-paper p-5 space-y-5" aria-hidden="true">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
      <span className="sr-only">Loading your library…</span>
    </div>
  );
}
