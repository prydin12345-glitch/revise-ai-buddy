export type WorkspaceTab = 'home' | 'exams' | 'create' | 'practice' | 'profile';

export function workspaceDestinations(tutor = false) {
  return [
    { key: 'home', label: 'Home', path: '/dashboard' },
    { key: 'exams', label: 'Exams', path: tutor ? '/tutor/exams' : '/my-exams' },
    { key: 'create', label: 'Create', path: null },
    { key: 'practice', label: tutor ? 'Students' : 'Quizzes', path: tutor ? '/tutor/students' : '/quizzes' },
    { key: 'profile', label: 'Profile', path: '/settings' },
  ] as const;
}

export function activeWorkspaceTab(path: string, tutor = false): WorkspaceTab | undefined {
  if (path === '/dashboard') return 'home';
  if (path.startsWith('/settings')) return 'profile';
  if (tutor && path.startsWith('/tutor/students')) return 'practice';
  if (!tutor && /^\/(quizzes|practice-questions)(\/|$)/.test(path)) return 'practice';
  if (/^\/(my-exams|exam)(\/|$)/.test(path) || (tutor && /^\/tutor\/exams(\/|$)/.test(path))) return 'exams';
  return undefined;
}

export function hasAppHistory(): boolean {
  return typeof window.history.state?.idx === 'number' && window.history.state.idx > 0;
}

export function scrollWorkspaceToTop() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.dispatchEvent(new Event('examly:scroll-top'));
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
}
