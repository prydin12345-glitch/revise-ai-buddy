import { useQuery } from "@tanstack/react-query";
import { useWorkspaceQueryScope } from "./use-workspace-query-client";
import { subjectAverageQuery, type SubjectTrend } from "@/lib/subject-average-query";

export type { SubjectTrend } from "@/lib/subject-average-query";

interface SubjectAverage {
  percentage: number | null;
  average: number | null;
  questionsAttempted: number;
  trend: SubjectTrend;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

/** Cached practice-question accuracy for a single subject and its recent-answer trend. */
export const useSubjectAverage = (subjectName: string): SubjectAverage => {
  const { store, client } = useWorkspaceQueryScope();
  const query = useQuery({ ...subjectAverageQuery(store, subjectName), refetchOnMount: "always", retryOnMount: false }, client);
  return {
    percentage: query.data?.percentage ?? null,
    average: query.data?.average ?? null,
    questionsAttempted: query.data?.questionsAttempted ?? 0,
    trend: query.data?.trend ?? null,
    loading: query.isPending,
    error: query.error,
    refetch: () => query.refetch({ cancelRefetch: false }),
  };
};
