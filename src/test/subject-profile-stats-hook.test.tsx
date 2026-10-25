import { createElement, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkspaceContext, WorkspaceStore } from '@/hooks/use-workspace-session';
import { useSubjectProfileStats } from '@/hooks/useSubjectProfileStats';
import { EMPTY_SUBJECT_PROFILE_STATS, selectSubjectProfileStats } from '@/lib/subject-profile-stats';
const state = vi.hoisted(() => ({ user: 'first', fail: false, calls: [] as string[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: state.user } }, error: null }) } } }));
vi.mock('@/lib/subject-profile-stats-query', () => ({ subjectProfileStatsQuery: (store: WorkspaceStore) => ({
  queryKey: ['workspace-subject-profile-stats:v1', store.ownerId],
  queryFn: async () => {
    const { workspaceUser } = await import('@/lib/workspace-query-client');
    const user = await workspaceUser(store);
    if (!user) throw new Error('Sign in to view your statistics.');
    state.calls.push(user.id); if (state.fail) throw new Error('Fixture unavailable');
    return { ...EMPTY_SUBJECT_PROFILE_STATS, subjects: [{ id: user.id, name: user.id, color: '#123456' }] };
  },
}) }));
afterEach(cleanup); beforeEach(() => { state.user = 'first'; state.fail = false; state.calls = []; });
const wrapper = (store: WorkspaceStore) => ({ children }: { children: ReactNode }) => createElement(WorkspaceContext.Provider, { value: { ownerId: store.ownerId, ready: true, store } }, children);
it('always provides empty metadata while loading and retries a failed owner-scoped read', async () => {
  state.fail = true;
  const { result } = renderHook(() => useSubjectProfileStats(), { wrapper: wrapper(new WorkspaceStore('first')) });
  expect(result.current.data).toBe(EMPTY_SUBJECT_PROFILE_STATS);
  await waitFor(() => expect(result.current.error).not.toBeNull());
  expect(result.current.hasData).toBe(false); expect(result.current.data.subjects).toEqual([]);
  state.fail = false;
  await act(async () => { await result.current.refetch(); });
  await waitFor(() => expect(result.current.data.subjects[0]?.id).toBe('first'));
  expect(result.current.error).toBeNull();
});
it('uses independent verified-account caches and never reuses another account’s metadata', async () => {
  const first = renderHook(() => useSubjectProfileStats(), { wrapper: wrapper(new WorkspaceStore('first')) });
  await waitFor(() => expect(first.result.current.data.subjects[0]?.name).toBe('first'));
  first.unmount(); state.user = 'second';
  const second = renderHook(() => useSubjectProfileStats(), { wrapper: wrapper(new WorkspaceStore('second')) });
  expect(second.result.current.data.subjects).toEqual([]);
  await waitFor(() => expect(second.result.current.data.subjects[0]?.name).toBe('second'));
  expect(state.calls).toEqual(['first', 'second']);
  const calls = state.calls.length;
  selectSubjectProfileStats(second.result.current.data, { subjectId: 'second', profileId: 'all', timeRange: 'monthly' });
  selectSubjectProfileStats(second.result.current.data, { subjectId: 'second', profileId: 'unprofiled', timeRange: 'weekly' });
  expect(state.calls).toHaveLength(calls);
});
it('rejects a changed verified account before issuing a metadata read', async () => {
  state.user = 'second';
  const { result } = renderHook(() => useSubjectProfileStats(), { wrapper: wrapper(new WorkspaceStore('first')) });
  await waitFor(() => expect(result.current.error).not.toBeNull());
  expect(state.calls).toEqual([]); expect(result.current.data).toBe(EMPTY_SUBJECT_PROFILE_STATS);
});
