import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

/** Selects a profile's topics from already subject-scoped performance data. */
export function profileTopicRows(topics: readonly string[], performance: readonly UnifiedTopicScore[]): UnifiedTopicScore[] {
  const scores = new Map(performance.map(row => [row.topic.trim().toLowerCase(), row]));
  const unique = new Map(topics.map(topic => [topic.trim().toLowerCase(), topic.trim()]));
  return [...unique].filter(([key]) => key).map(([key, topic]) => scores.get(key) || {
    topic, subjectId: null, unifiedScore: 0, examScore: null, practiceScore: null,
    examQuestionCount: 0, practiceQuestionCount: 0, mastery: "untested",
    lastAttempted: null, practicedSinceLastExam: false,
  });
}
