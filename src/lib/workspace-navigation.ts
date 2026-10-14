export type WorkspaceTab = 'home' | 'practice' | 'create' | 'subjects' | 'students' | 'profile';

export function workspaceDestinations(tutor = false): readonly { key: WorkspaceTab; label: string; path: string | null }[] {
  return [
    { key: 'home', label: 'Home', path: '/dashboard' },
    { key: 'practice', label: 'Practice', path: tutor ? '/tutor/exams' : '/my-exams' },
    { key: 'create', label: 'Create', path: null },
    tutor
      ? { key: 'students', label: 'Students', path: '/tutor/students' }
      : { key: 'subjects', label: 'Subjects', path: '/my-subjects' },
    { key: 'profile', label: 'Profile', path: '/settings' },
  ] as const;
}

export function activeWorkspaceTab(path: string, tutor = false): WorkspaceTab | undefined {
  if (path === '/dashboard') return 'home';
  if (path.startsWith('/settings')) return 'profile';
  if (/^\/my-subjects(\/|$)/.test(path)) return 'subjects';
  if (tutor && /^\/tutor\/students(\/|$)/.test(path)) return 'students';
  if (tutor && /^\/tutor\/(exams|practice)(\/|$)/.test(path)) return 'practice';
  if (!tutor && /^\/(quizzes|practice-questions)(\/|$)/.test(path)) return 'practice';
  if (/^\/(my-exams|exam)(\/|$)/.test(path)) return 'practice';
  return undefined;
}

/** Remember library pages, never an active exam or an unfinished setup flow. */
export function isWorkspaceListRoute(path: string, tutor = false): boolean {
  return workspaceDestinations(tutor).some(tab => tab.path === path)
    || path === (tutor ? '/tutor/practice' : '/quizzes');
}

export function hasAppHistory(): boolean {
  return typeof window.history.state?.idx === 'number' && window.history.state.idx > 0;
}

export function scrollWorkspaceToTop() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.dispatchEvent(new Event('examly:scroll-top'));
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
}
