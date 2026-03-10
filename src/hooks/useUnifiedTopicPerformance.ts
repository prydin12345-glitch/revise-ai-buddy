import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normaliseTopicTags } from "@/lib/normalise-topic";

export type UnifiedMastery = "strong" | "developing" | "weak" | "untested";

export interface UnifiedTopicScore {
  topic: string;
  subjectId: string | null;
  unifiedScore: number;
  examScore: number | null;
  practiceScore: number | null;
  examQuestionCount: number;
  practiceQuestionCount: number;
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
  subject?: string
) => {
  const [topics, setTopics] = useState<UnifiedTopicScore[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUnified = useCallback(async () => {
    if (!studentId) {
      setTopics([]);
      setLoading(false);
      return;
    }

    try {
      // ---- Exam performance ----
      const { data: examAnswers } = await supabase
        .from("student_answers")
        .select("score, is_correct, submitted_at, question_id")
        .eq("student_id", studentId);

      // Fetch the related exam_questions for topic_tag + marks
      const examQIds = [
        ...new Set(examAnswers?.map((a) => a.question_id).filter(Boolean) || []),
      ];

      let examQuestions: any[] = [];
      let examSubjectMap: Record<string, string> = {};
      if (examQIds.length > 0) {
        const { data } = await supabase
          .from("exam_questions")
          .select("id, topic_tag, marks, exam_id")
          .in("id", examQIds);
        examQuestions = data || [];

        // Fetch subject_id for each exam
        const examIds = [...new Set(examQuestions.map(q => q.exam_id).filter(Boolean))];
        if (examIds.length > 0) {
          const { data: exams } = await supabase
            .from("exams")
            .select("id, subject_id")
            .in("id", examIds);
          exams?.forEach(e => { examSubjectMap[e.id] = e.subject_id; });
        }
      }

      // ---- Practice performance ----
      const { data: practiceAnswers } = await supabase
        .from("practice_question_answers")
        .select("score, is_correct, submitted_at, question_id")
        .eq("user_id", studentId);

      const practiceQIds = [
        ...new Set(
          practiceAnswers?.map((a) => a.question_id).filter(Boolean) || []
        ),
      ];

      let practiceQuestions: any[] = [];
      let practiceSubjectMap: Record<string, string> = {};
      if (practiceQIds.length > 0) {
        const { data } = await supabase
          .from("practice_questions")
          .select("id, subtopic, marks, set_id")
          .in("id", practiceQIds);
        practiceQuestions = data || [];

        // Fetch subject_id for each practice set
        const setIds = [...new Set(practiceQuestions.map(q => q.set_id).filter(Boolean))];
        if (setIds.length > 0) {
          const { data: sets } = await supabase
            .from("practice_question_sets")
            .select("id, subject_id")
            .in("id", setIds);
          sets?.forEach(s => { practiceSubjectMap[s.id] = s.subject_id; });
        }
      }

      // ---- Normalise exam topic_tags ----
      const rawTags = [
        ...new Set(
          examQuestions
            .map((q) => q.topic_tag)
            .filter(Boolean) as string[]
        ),
      ];
      const normMap = await normaliseTopicTags(rawTags);

      // ---- Group exam scores by canonical topic ----
      const examByTopic: Record<
        string,
        { scores: number[]; lastDate: string; subjectId: string | null }
      > = {};

      const examQMap = new Map(examQuestions.map((q) => [q.id, q]));

      examAnswers?.forEach((answer) => {
        const q = examQMap.get(answer.question_id);
        if (!q || !q.topic_tag) return;
        const canonical = normMap[q.topic_tag] ?? q.topic_tag;
        const pct = q.marks > 0 ? ((Number(answer.score) || 0) / q.marks) * 100 : 0;

        if (!examByTopic[canonical]) {
          examByTopic[canonical] = { scores: [], lastDate: "", subjectId: examSubjectMap[q.exam_id] ?? null };
        }
        examByTopic[canonical].scores.push(pct);
        if (answer.submitted_at && answer.submitted_at > examByTopic[canonical].lastDate) {
          examByTopic[canonical].lastDate = answer.submitted_at;
        }
      });

      // ---- Group practice scores by topic (subtopic is already canonical) ----
      const practiceByTopic: Record<
        string,
        { correct: number; total: number; totalMarks: number; scoredMarks: number; lastDate: string; subjectId: string | null }
      > = {};

      const practiceQMap = new Map(practiceQuestions.map((q) => [q.id, q]));

      practiceAnswers?.forEach((answer) => {
        const q = practiceQMap.get(answer.question_id);
        if (!q || !q.subtopic) return;
        const topic = q.subtopic;

        if (!practiceByTopic[topic]) {
          practiceByTopic[topic] = { correct: 0, total: 0, totalMarks: 0, scoredMarks: 0, lastDate: "", subjectId: practiceSubjectMap[q.set_id] ?? null };
        }
        practiceByTopic[topic].total++;
        practiceByTopic[topic].totalMarks += q.marks || 1;
        practiceByTopic[topic].scoredMarks += Number(answer.score) || 0;
        if (answer.is_correct) practiceByTopic[topic].correct++;
        if (answer.submitted_at && answer.submitted_at > practiceByTopic[topic].lastDate) {
          practiceByTopic[topic].lastDate = answer.submitted_at;
        }
      });

      // ---- Combine all topics ----
      const allTopicNames = new Set([
        ...Object.keys(examByTopic),
        ...Object.keys(practiceByTopic),
      ]);

      const unified: UnifiedTopicScore[] = [];

      allTopicNames.forEach((topic) => {
        const exam = examByTopic[topic];
        const practice = practiceByTopic[topic];

        const examScore =
          exam && exam.scores.length > 0
            ? exam.scores.reduce((a, b) => a + b, 0) / exam.scores.length
            : null;

        const practiceScore =
          practice && practice.totalMarks > 0
            ? (practice.scoredMarks / practice.totalMarks) * 100
            : null;

        // Weighted combination — exams weighted higher (more formal signal)
        let unifiedScore: number;
        if (examScore !== null && practiceScore !== null) {
          unifiedScore = examScore * 0.6 + practiceScore * 0.4;
        } else if (examScore !== null) {
          unifiedScore = examScore;
        } else if (practiceScore !== null) {
          unifiedScore = practiceScore;
        } else {
          unifiedScore = 0;
        }

        const mastery: UnifiedMastery =
          examScore === null && practiceScore === null
            ? "untested"
            : unifiedScore >= 75
            ? "strong"
            : unifiedScore >= 50
            ? "developing"
            : "weak";

        const lastExamDate = exam?.lastDate || null;
        const lastPracticeDate = practice?.lastDate || null;
        const practicedSinceLastExam =
          lastExamDate !== null &&
          lastPracticeDate !== null &&
          lastPracticeDate > lastExamDate;

        const lastAttempted =
          [lastExamDate, lastPracticeDate]
            .filter(Boolean)
            .sort()
            .reverse()[0] ?? null;

        // Determine subject from exam or practice data
        const subjectId = exam?.subjectId ?? practice?.subjectId ?? null;

        unified.push({
          topic,
          subjectId,
          unifiedScore: Math.round(unifiedScore),
          examScore: examScore !== null ? Math.round(examScore) : null,
          practiceScore: practiceScore !== null ? Math.round(practiceScore) : null,
          examQuestionCount: exam?.scores.length ?? 0,
          practiceQuestionCount: practice?.total ?? 0,
          mastery,
          lastAttempted,
          practicedSinceLastExam,
        });
      });

      // Sort: weak first, then developing, then strong, then untested
      const masteryOrder: Record<UnifiedMastery, number> = {
        weak: 0,
        developing: 1,
        strong: 2,
        untested: 3,
      };
      unified.sort((a, b) => masteryOrder[a.mastery] - masteryOrder[b.mastery]);

      setTopics(unified);
    } catch (err) {
      console.error("Error fetching unified topic performance:", err);
    } finally {
      setLoading(false);
    }
  }, [studentId, subject]);

  useEffect(() => {
    fetchUnified();
  }, [fetchUnified]);

  return {
    topics,
    loading,
    weakTopics: topics.filter((t) => t.mastery === "weak"),
  };
};
