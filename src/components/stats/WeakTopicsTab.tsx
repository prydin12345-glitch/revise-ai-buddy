import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, Zap, ChevronDown, ChevronUp } from "lucide-react";
import {
  UnifiedTopicScore,
  UnifiedMastery,
} from "@/hooks/useUnifiedTopicPerformance";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { normaliseTopicTags } from "@/lib/normalise-topic";
import { cn } from "@/lib/utils";
import { MathRenderer } from "@/components/MathRenderer";
import { EmptyChartState } from "./EmptyChartState";

interface WeakTopicsTabProps {
  topics: UnifiedTopicScore[];
  loading: boolean;
}

const MASTERY_COLOURS: Record<
  UnifiedMastery,
  { bar: string; badge: string; badgeBg: string; border: string; filterBg: string }
> = {
  weak: {
    bar: "#ef4444",
    badge: "#fca5a5",
    badgeBg: "#450a0a",
    border: "#ef4444",
    filterBg: "#450a0a",
  },
  developing: {
    bar: "#f97316",
    badge: "#fdba74",
    badgeBg: "#431407",
    border: "#f97316",
    filterBg: "#431407",
  },
  strong: {
    bar: "#22c55e",
    badge: "#86efac",
    badgeBg: "#14532d",
    border: "#22c55e",
    filterBg: "#14532d",
  },
  untested: {
    bar: "hsl(var(--muted-foreground))",
    badge: "hsl(var(--muted-foreground))",
    badgeBg: "hsl(var(--muted))",
    border: "hsl(var(--border))",
    filterBg: "hsl(var(--muted))",
  },
};

/* ------------------------------------------------------------------ */
/*  Wrong Answers Panel                                                */
/* ------------------------------------------------------------------ */

const formatCorrectAnswer = (raw: string): string => {
  return raw
    .replace(/\b[BMAC]\d+\s*(for\s*)?/gi, "")
    .replace(/\(\d+\s*marks?\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const splitAnswerSteps = (answer: string): string[] => {
  const cleaned = formatCorrectAnswer(answer);
  return cleaned
    .split(/\.\s+(?=[A-Z$])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

interface WrongAnswer {
  score: number | null;
  submitted_at: string;
  question_id: string;
  questionText: string;
  questionNumber: string;
  correctAnswer: string | null;
  marks: number;
}

const WrongAnswersPanel = ({
  topic,
  studentId,
}: {
  topic: UnifiedTopicScore;
  studentId: string;
}) => {
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchWrong = async () => {
      setLoading(true);

      const { data: answers } = await supabase
        .from("student_answers")
        .select("score, submitted_at, question_id")
        .eq("student_id", studentId)
        .order("submitted_at", { ascending: false });

      if (!answers || answers.length === 0 || cancelled) {
        setWrongAnswers([]);
        setLoading(false);
        return;
      }

      const qIds = [...new Set(answers.map((a) => a.question_id))];
      const { data: questions } = await supabase
        .from("exam_questions")
        .select(
          "id, topic_tag, correct_answer, marks, question_text, question_number"
        )
        .in("id", qIds);

      if (!questions || cancelled) {
        setWrongAnswers([]);
        setLoading(false);
        return;
      }

      const rawTags = [
        ...new Set(
          questions.map((q) => q.topic_tag).filter(Boolean) as string[]
        ),
      ];
      const normMap = await normaliseTopicTags(rawTags);
      const qMap = new Map(questions.map((q) => [q.id, q]));

      const wrong: WrongAnswer[] = [];
      for (const ans of answers) {
        const q = qMap.get(ans.question_id);
        if (!q || !q.topic_tag) continue;
        const canonical = normMap[q.topic_tag] ?? q.topic_tag;
        if (canonical !== topic.topic) continue;
        const score = Number(ans.score) || 0;
        if (score >= q.marks) continue;
        wrong.push({
          score,
          submitted_at: ans.submitted_at,
          question_id: ans.question_id,
          questionText: q.question_text,
          questionNumber: q.question_number,
          correctAnswer: q.correct_answer,
          marks: q.marks,
        });
        if (wrong.length >= 5) break;
      }

      if (!cancelled) {
        setWrongAnswers(wrong);
        setLoading(false);
      }
    };
    fetchWrong();
    return () => {
      cancelled = true;
    };
  }, [topic.topic, studentId]);

  if (loading)
    return (
      <div className="py-3 text-xs text-muted-foreground animate-pulse">
        Loading wrong answers…
      </div>
    );

  if (wrongAnswers.length === 0)
    return (
      <div className="py-3 text-xs text-muted-foreground">
        No recent wrong answers found for this topic.
      </div>
    );

  return (
    <div className="mt-3 space-y-2">
      {wrongAnswers.map((answer, i) => (
        <div
          key={i}
          className="rounded-lg border border-border/40 bg-background/50 p-3"
        >
          <div className="text-[13px] leading-relaxed text-foreground/80 mb-2 line-clamp-3">
            <span className="text-muted-foreground mr-1">
              Q{answer.questionNumber}:
            </span>
            <MathRenderer
              content={answer.questionText}
              hasMath={/\$[^$]+\$/.test(answer.questionText)}
              inline
            />
          </div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-xs text-muted-foreground">Score:</span>
            <span
              className={cn(
                "text-[13px] font-bold",
                (answer.score ?? 0) >= answer.marks
                  ? "text-emerald-400"
                  : "text-destructive"
              )}
            >
              {answer.score}/{answer.marks}
            </span>
          </div>
          {answer.correctAnswer && (
            <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/30 p-2.5">
              <div className="text-[11px] text-emerald-400 tracking-widest uppercase mb-1.5">
                Model Answer
              </div>
              <div className="text-[13px] text-emerald-300 leading-relaxed space-y-1">
                {splitAnswerSteps(answer.correctAnswer).map((step, si, arr) => (
                  <div key={si} className="flex gap-2">
                    {arr.length > 1 && (
                      <span className="text-emerald-500 flex-shrink-0 mt-0.5">
                        ›
                      </span>
                    )}
                    <MathRenderer
                      content={step}
                      hasMath={/\$[^$]+\$/.test(step)}
                      inline
                      className="text-emerald-300"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground/50 mt-1.5">
            {new Date(answer.submitted_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export const WeakTopicsTab = ({ topics, loading }: WeakTopicsTabProps) => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<UnifiedMastery | null>(null);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const handlePracticeWeakTopic = (topic: UnifiedTopicScore) => {
    const params = new URLSearchParams({
      subtopic: topic.topic,
      source: "weak_topics",
    });
    if (topic.subjectId) params.set("subject", topic.subjectId);
    navigate(`/create-practice-questions?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8">
        <EmptyChartState
          message="Complete exams or practice quizzes to see your topic-level performance breakdown."
          icon={BookOpen}
          action={{
            label: "Start Practicing",
            onClick: () => navigate("/create-practice-questions"),
          }}
          height={200}
        />
      </div>
    );
  }

  const weakCount = topics.filter((t) => t.mastery === "weak").length;
  const developingCount = topics.filter(
    (t) => t.mastery === "developing"
  ).length;
  const strongCount = topics.filter((t) => t.mastery === "strong").length;

  const testedTopics = topics.filter((t) => t.mastery !== "untested");
  const filteredTopics = activeFilter
    ? testedTopics.filter((t) => t.mastery === activeFilter)
    : testedTopics;

  const summaryCards: {
    mastery: UnifiedMastery;
    count: number;
    label: string;
  }[] = [
    { mastery: "weak", count: weakCount, label: "WEAK" },
    { mastery: "developing", count: developingCount, label: "DEVELOPING" },
    { mastery: "strong", count: strongCount, label: "STRONG" },
  ];

  return (
    <div className="space-y-5">
      {/* Summary filter cards */}
      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map(({ mastery, count, label }) => {
          const colours = MASTERY_COLOURS[mastery];
          const isActive = activeFilter === mastery;
          const isDimmed = activeFilter !== null && !isActive;

          return (
            <button
              key={mastery}
              onClick={() => setActiveFilter(isActive ? null : mastery)}
              className={cn(
                "rounded-[10px] p-4 text-left transition-all border font-inherit",
                isDimmed && "opacity-40"
              )}
              style={{
                background: isActive ? colours.filterBg : "hsl(var(--card))",
                borderColor: isActive
                  ? colours.border
                  : "hsl(var(--border))",
              }}
            >
              <div
                className="text-[28px] font-extrabold leading-none tracking-tighter"
                style={{ color: colours.bar }}
              >
                {count}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 uppercase tracking-widest">
                {label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active filter clear */}
      {activeFilter && (
        <button
          onClick={() => setActiveFilter(null)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕ Clear filter
        </button>
      )}

      {/* Topic cards */}
      <div className="space-y-2.5">
        {filteredTopics.map((topic) => {
          const colours = MASTERY_COLOURS[topic.mastery];
          const isExpanded = expandedTopic === topic.topic;

          return (
            <div
              key={topic.topic}
              className="bg-card border border-border rounded-[10px] transition-colors"
              style={{ borderLeftWidth: 3, borderLeftColor: colours.border }}
            >
              <div className="p-4 space-y-3">
                {/* Header row */}
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-foreground truncate">
                      {topic.topic}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1.5">
                      {topic.examScore !== null && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Exam:{" "}
                          <strong className="text-foreground">
                            {topic.examScore}%
                          </strong>
                        </span>
                      )}
                      {topic.practiceScore !== null && (
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          Practice:{" "}
                          <strong className="text-foreground">
                            {topic.practiceScore}%
                          </strong>
                        </span>
                      )}
                      <span>
                        Combined:{" "}
                        <strong className="text-foreground">
                          {topic.unifiedScore}%
                        </strong>
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-[11px] font-semibold rounded-full px-2.5 py-0.5 shrink-0 whitespace-nowrap"
                    style={{
                      background: colours.badgeBg,
                      color: colours.badge,
                    }}
                  >
                    {topic.mastery.charAt(0).toUpperCase() +
                      topic.mastery.slice(1)}
                  </span>
                </div>

                {/* Progress bar — 6px height */}
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${topic.unifiedScore}%`,
                      background: colours.bar,
                      transition: "width 0.8s ease",
                    }}
                  />
                </div>

                {/* Practice nudge for weak topics */}
                {topic.mastery === "weak" && (
                  <div className="flex items-center justify-between pt-1">
                    <span
                      className="text-[11px] flex items-center gap-1"
                      style={{
                        color: topic.practicedSinceLastExam
                          ? "#22c55e"
                          : "#f97316",
                      }}
                    >
                      {topic.practicedSinceLastExam
                        ? "✓ Practised since last exam"
                        : "⚠ Not practised since last exam"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => handlePracticeWeakTopic(topic)}
                    >
                      Practice now →
                    </Button>
                  </div>
                )}

                {/* Wrong answers expander */}
                <button
                  onClick={() =>
                    setExpandedTopic(isExpanded ? null : topic.topic)
                  }
                  className="w-full pt-2 mt-1 border-t border-border/30 text-muted-foreground text-[11px] text-center hover:text-foreground transition-colors flex items-center justify-center gap-1"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3" /> Hide wrong answers
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" /> See wrong answers
                    </>
                  )}
                </button>

                {isExpanded && userId && (
                  <WrongAnswersPanel topic={topic} studentId={userId} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
