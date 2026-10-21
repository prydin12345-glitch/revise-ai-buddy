/**
 * Route prefetch map — maps route paths to their dynamic import functions.
 * Used for onMouseEnter prefetching on sidebar nav items.
 */
export const routePrefetchMap: Record<string, () => Promise<any>> = {
  '/dashboard': () => import('@/pages/Dashboard'),
  '/my-exams': () => import('@/pages/MyExams'),
  '/quizzes': () => import('@/pages/MyQuizzes'),
  '/my-classes': () => import('@/pages/MyClasses'),
  '/my-subjects': () => import('@/pages/MySubjects'),
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
  const pathname = path.split(/[?#]/)[0];
  const loader = routePrefetchMap[pathname] || (/^\/my-subjects\/[^/]+$/.test(pathname) ? () => import('@/pages/SubjectDetail') : /^\/my-subjects\/[^/]+\/[^/]+$/.test(pathname) ? () => import('@/pages/ProfileDetail') : undefined);
  if (loader) {
    loader().catch(() => {
      // Silently ignore prefetch failures
    });
  }
};

/** Prefetch common student pages during idle time after dashboard mounts. */
export const prefetchCommonRoutes = () => {
  const commonPaths = ['/my-exams', '/stats', '/quizzes', '/settings', '/my-classes', '/my-subjects'];

  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(() => {
      commonPaths.forEach(path => prefetchRoute(path));
    });
    return () => window.cancelIdleCallback(id);
  } else {
    // Fallback for Safari — use setTimeout with a delay
    const id = setTimeout(() => {
      commonPaths.forEach(path => prefetchRoute(path));
    }, 2000);
    return () => clearTimeout(id);
  }
};
