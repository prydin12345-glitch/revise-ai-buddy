import { useCallback, useSyncExternalStore } from "react";
import { readSubjectGradeGoal, saveSubjectGradeGoal, subscribeSubjectGradeGoals, type SubjectGradeGoal } from "@/lib/subject-grade-goals";

export function useSubjectGradeGoals(ownerId: string | null, subjectId: string) {
  const snapshot = useCallback(() => readSubjectGradeGoal(ownerId, subjectId), [ownerId, subjectId]);
  const goal = useSyncExternalStore(subscribeSubjectGradeGoals, snapshot, snapshot);
  const save = useCallback((value: SubjectGradeGoal) => saveSubjectGradeGoal(ownerId, subjectId, value), [ownerId, subjectId]);
  return { goal, save };
}
