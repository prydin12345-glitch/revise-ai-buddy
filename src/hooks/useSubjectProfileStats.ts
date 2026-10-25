import { useQuery } from '@tanstack/react-query';
import { useWorkspaceQueryScope } from './use-workspace-query-client';
import { subjectProfileStatsQuery } from '@/lib/subject-profile-stats-query';
import { EMPTY_SUBJECT_PROFILE_STATS } from '@/lib/subject-profile-stats';

/** Read-only metadata cache tied to the verified sign-in generation; no assessment keys. */
export function useSubjectProfileStats() {
  const { store, client, ready } = useWorkspaceQueryScope();
  const query = useQuery({ ...subjectProfileStatsQuery(store), enabled: ready,
    refetchOnMount: 'always', retryOnMount: false }, client);
  return { data: query.data ?? EMPTY_SUBJECT_PROFILE_STATS, hasData: !!query.data, loading: query.isPending, refreshing: query.isFetching && !!query.data, error: query.error, refetch: () => query.refetch({ cancelRefetch: false }) };
}
