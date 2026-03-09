import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, BookOpen, FileText, Zap, CheckCircle2, ChevronDown, ChevronUp, X, Crosshair } from "lucide-react";
import { UnifiedTopicScore, UnifiedMastery } from "@/hooks/useUnifiedTopicPerformance";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { normaliseTopicTags } from "@/lib/normalise-topic";
import { cn } from "@/lib/utils";

interface WeakTopicsTabProps {
  topics: UnifiedTopicScore[];
  loading: boolean;
}

const MASTERY_CONFIG = {
  weak: {
    border: "border-l-destructive",
    badge: "bg-[hsl(0_50%_15%)] text-[hsl(0_90%_72%)] border-[hsl(0_60%_25%)]",
    bar: "bg-destructive",
    label: "Weak",
    accent: "hsl(0, 90%, 72%)",
    cardBorder: "border-destructive",
  },
  developing: {
    border: "border-l-amber-500",
    badge: "bg-[hsl(30_70%_15%)] text-[hsl(48_96%_56%)] border-[hsl(28_73%_18%)]",
    bar: "bg-amber-500",
    label: "Developing",
    accent: "hsl(48, 96%, 56%)",
    cardBorder: "border-amber-500",
  },
  strong: {
    border: "border-l-emerald-500",
    badge: "bg-[hsl(145_50%_12%)] text-[hsl(142_69%_58%)] border-[hsl(145_63%_16%)]",
    bar: "bg-emerald-500",
    label: "Strong",
    accent: "hsl(142, 69%, 58%)",
    cardBorder: "border-emerald-500",
  },
  untested: {
    border: "border-l-muted-foreground/30",
    badge: "bg-muted text-muted-foreground border-border",
    bar: "bg-muted-foreground/30",
    label: "Untested",
    accent: "hsl(215, 16%, 47%)",
    cardBorder: "border-border",
  },
};

/* ------------------------------------------------------------------ */
/*  Wrong Answers Panel                                                */
/* ------------------------------------------------------------------ */

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
  onPractice,
}: {
  topic: UnifiedTopicScore;
  studentId: string;
  onPractice: () => void;
}) => {
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchWrong = async () => {
      setLoading(true);

      // We need to find exam_questions with this topic_tag (could be an alias)
      // First get all student answers
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
        .select("id, topic_tag, correct_answer, marks, question_text, question_number")
        .in("id", qIds);

      if (!questions || cancelled) {
        setWrongAnswers([]);
        setLoading(false);
        return;
      }

      // Normalise topic tags
      const rawTags = [...new Set(questions.map((q) => q.topic_tag).filter(Boolean) as string[])];
      const normMap = await normaliseTopicTags(rawTags);

      const qMap = new Map(questions.map((q) => [q.id, q]));

      const wrong: WrongAnswer[] = [];
      for (const ans of answers) {
        const q = qMap.get(ans.question_id);
        if (!q || !q.topic_tag) continue;
        const canonical = normMap[q.topic_tag] ?? q.topic_tag;
        if (canonical !== topic.topic) continue;
        const score = Number(ans.score) || 0;
        if (score >= q.marks) continue; // not wrong
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
      <div className="py-3 text-xs text-muted-foreground animate-pulse">Loading wrong answers…</div>
    );

  if (wrongAnswers.length === 0)
    return (
      <div className="py-3 text-xs text-muted-foreground">
        No recent wrong answers found for this topic.
      </div>
    );

  return (
    <div className="mt-2 space-y-2">
      {wrongAnswers.map((answer, i) => (
        <div
          key={i}
          className="rounded-md border border-border/30 bg-background/50 p-3"
        >
          <p className="text-[13px] leading-relaxed text-foreground/80 mb-2 line-clamp-3">
            Q{answer.questionNumber}: {answer.questionText}
          </p>
          <div className="flex items-start justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">
              Scored:{" "}
              <strong className="text-destructive">
                {answer.score}/{answer.marks}
              </strong>
            </span>
            {answer.correctAnswer && (
              <span className="text-[11px] text-muted-foreground text-right max-w-[60%]">
                Correct:{" "}
                <strong className="text-emerald-400">{answer.correctAnswer}</strong>
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-1.5">
            {new Date(answer.submitted_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="w-full h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
        onClick={onPractice}
      >
        <Target className="h-3 w-3 mr-1.5" />
        Practice {topic.topic} now to improve
      </Button>
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
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const handlePracticeWeakTopic = (topicName: string) => {
    navigate(`/create-practice-questions?subtopic=${encodeURIComponent(topicName)}&source=weak_topics`);
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
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-12">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No Topic Data Yet</p>
            <p className="text-sm mb-4">
              Complete exams or practice quizzes to see your topic-level performance breakdown.
            </p>
            <Button variant="outline" onClick={() => navigate("/create-practice-questions")}>
              <FileText className="w-4 h-4 mr-2" />
              Start Practicing
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const weakCount = topics.filter((t) => t.mastery === "weak").length;
  const developingCount = topics.filter((t) => t.mastery === "developing").length;
  const strongCount = topics.filter((t) => t.mastery === "strong").length;

  const testedTopics = topics.filter((t) => t.mastery !== "untested");
  const filteredTopics = activeFilter
    ? testedTopics.filter((t) => t.mastery === activeFilter)
    : testedTopics;

  const summaryCards: { mastery: UnifiedMastery; count: number; label: string }[] = [
    { mastery: "weak", count: weakCount, label: "WEAK" },
    { mastery: "developing", count: developingCount, label: "DEVELOPING" },
    { mastery: "strong", count: strongCount, label: "STRONG" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary strip — clickable filters */}
      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map(({ mastery, count, label }) => {
          const config = MASTERY_CONFIG[mastery];
          const isActive = activeFilter === mastery;
          const isDimmed = activeFilter !== null && !isActive;

          return (
            <Card
              key={mastery}
              onClick={() => setActiveFilter(isActive ? null : mastery)}
              className={cn(
                "cursor-pointer transition-all duration-200 border-l-4",
                config.border,
                isActive && `ring-2 ring-offset-1 ring-offset-background ${config.cardBorder}`,
                isDimmed && "opacity-40",
                "hover:border-opacity-80"
              )}
            >
              <CardContent className="py-4 px-5 flex flex-col gap-1">
                <p
                  className="text-[28px] font-bold"
                  style={{ color: config.accent }}
                >
                  {count}
                </p>
                <p className="text-xs tracking-widest uppercase text-muted-foreground">
                  {label}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Active filter indicator */}
      {activeFilter && (
        <button
          onClick={() => setActiveFilter(null)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
          Clear filter
        </button>
      )}

      {/* Topic cards */}
      <div className="space-y-3">
        {filteredTopics.map((topic) => {
          const config = MASTERY_CONFIG[topic.mastery];
          const isExpanded = expandedTopic === topic.topic;

          return (
            <Card
              key={topic.topic}
              className={cn("border-l-4 transition-colors", config.border)}
            >
              <CardContent className="py-5 px-5 space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold truncate text-foreground">
                    {topic.topic}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("text-[11px] shrink-0 border", config.badge)}
                  >
                    {config.label}
                  </Badge>
                </div>

                {/* Score breakdown */}
                <div className="flex items-center gap-5 text-[13px] text-muted-foreground">
                  {topic.examScore !== null && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Exam: <strong className="text-foreground">{topic.examScore}%</strong>
                    </span>
                  )}
                  {topic.practiceScore !== null && (
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Practice: <strong className="text-foreground">{topic.practiceScore}%</strong>
                    </span>
                  )}
                  <span>
                    Combined: <strong className="text-foreground">{topic.unifiedScore}%</strong>
                  </span>
                </div>

                {/* Separator */}
                <div className="border-t border-border/30" />

                {/* Progress bar */}
                <div className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-full rounded-full transition-all duration-500",
                      config.bar
                    )}
                    style={{ width: `${topic.unifiedScore}%` }}
                  />
                </div>

                {/* Practice nudge for weak topics */}
                {topic.mastery === "weak" && (
                  <div className="flex items-center justify-between pt-1.5">
                    <span className="text-xs flex items-center gap-1">
                      {topic.practicedSinceLastExam ? (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Practised since last exam
                        </span>
                      ) : (
                        <span className="text-amber-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Not practised since last exam
                        </span>
                      )}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 transition-all"
                      onClick={() => handlePracticeWeakTopic(topic.topic)}
                    >
                      Practice now →
                    </Button>
                  </div>
                )}

                {/* Expand toggle for wrong answers */}
                <button
                  onClick={() =>
                    setExpandedTopic(isExpanded ? null : topic.topic)
                  }
                  className="w-full pt-2 mt-1 border-t border-border/20 text-muted-foreground/70 text-xs text-center hover:text-muted-foreground transition-colors flex items-center justify-center gap-1"
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

                {/* Wrong answers panel */}
                {isExpanded && userId && (
                  <WrongAnswersPanel
                    topic={topic}
                    studentId={userId}
                    onPractice={() => handlePracticeWeakTopic(topic.topic)}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
