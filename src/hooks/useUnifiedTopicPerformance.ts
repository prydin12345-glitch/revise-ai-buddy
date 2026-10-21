import { useQuery } from "@tanstack/react-query";
import { useWorkspaceQueryScope } from "./use-workspace-query-client";
import { unifiedTopicQuery } from "@/lib/unified-topic-query";

export type UnifiedMastery = "strong" | "developing" | "weak" | "untested";

export interface UnifiedTopicScore {
  topic: string;
  subjectId: string | null;
  unifiedScore: number;
  examScore: number | null;
  practiceScore: number | null;
  examQuestionCount: number;
  practiceQuestionCount: number;
  /** Answered but not yet marked — counted separately so they never score 0%.
   *  Optional: other call sites (e.g. SubjectDonut) build this shape by hand. */
  pendingQuestionCount?: number;
  mastery: UnifiedMastery;
  lastAttempted: string | null;
  practicedSinceLastExam: boolean;
}

/**
 * Combines exam (student_answers + exam_questions.topic_tag) and
 * practice (practice_question_answers + practice_questions.subtopic)
 * into a single per-topic score for a given student.
 *
 * The `studentId` parameter makes it usable from both the student's own
 * stats page (pass current user id) AND from the tutor tooltip/dashboard.
 */
export const useUnifiedTopicPerformance = (
  studentId: string | null | undefined,
  subject?: string | readonly string[]
) => {
  const { client } = useWorkspaceQueryScope();
  const scopeKey = JSON.stringify([...new Set((typeof subject === "string" ? [subject] : subject || [])
    .map(value => value.trim().toLowerCase()).filter(Boolean))].sort());
  const query = useQuery({ ...unifiedTopicQuery(studentId || "", scopeKey), enabled: !!studentId, refetchOnMount: "always" }, client);
  const topics = query.data || [];
  return {
    topics,
    loading: !!studentId && query.isPending,
    error: query.error ? "Couldn’t load topic performance. Try again." : null,
    refetch: () => query.refetch({ cancelRefetch: false }),
    weakTopics: topics.filter(topic => topic.mastery === "weak" && (topic.examScore !== null || topic.practiceScore !== null)),
  };
};
