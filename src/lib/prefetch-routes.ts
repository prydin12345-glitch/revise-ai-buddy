/**
 * Route prefetch map — maps route paths to their dynamic import functions.
 * Used for onMouseEnter prefetching on sidebar nav items.
 */
export const routePrefetchMap: Record<string, () => Promise<any>> = {
  '/dashboard': () => import('@/pages/Dashboard'),
  '/my-exams': () => import('@/pages/MyExams'),
  '/quizzes': () => import('@/pages/MyQuizzes'),
  '/my-classes': () => import('@/pages/MyClasses'),
  '/stats': () => import('@/pages/Stats'),
  '/settings': () => import('@/pages/Settings'),
  '/tutor/exams': () => import('@/pages/tutor/ManageExams'),
  '/tutor/practice': () => import('@/pages/tutor/ManagePracticeSets'),
  '/tutor/students': () => import('@/pages/tutor/ManageStudents'),
  '/tutor/feedback': () => import('@/pages/tutor/ManageFeedback'),
  '/tutor/progress': () => import('@/pages/tutor/StudentProgress'),
};

/** Prefetch a route's chunk by path. Safe to call multiple times — browser caches the module. */
export const prefetchRoute = (path: string) => {
  const loader = routePrefetchMap[path];
  if (loader) {
    loader().catch(() => {
      // Silently ignore prefetch failures
    });
  }
};

/** Prefetch common student pages during idle time after dashboard mounts. */
export const prefetchCommonRoutes = () => {
  const commonPaths = ['/my-exams', '/stats', '/quizzes', '/settings', '/my-classes'];

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      commonPaths.forEach(path => prefetchRoute(path));
    });
  } else {
    // Fallback for Safari — use setTimeout with a delay
    setTimeout(() => {
      commonPaths.forEach(path => prefetchRoute(path));
    }, 2000);
  }
};
