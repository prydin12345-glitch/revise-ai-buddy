import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, FileText, Zap, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UnifiedTopicScore,
  UnifiedMastery,
} from "@/hooks/useUnifiedTopicPerformance";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { normaliseTopicTags } from "@/lib/normalise-topic";
import { MathRenderer } from "@/components/MathRenderer";

interface WeakTopicsTabProps {
  topics: UnifiedTopicScore[];
  loading: boolean;
}

const MASTERY_CONFIG: Record<
  string,
  {
    label: string;
    colour: string;
    bg: string;
    border: string;
    activeBg: string;
    activeBorder: string;
    description: string;
  }
> = {
  weak: {
    label: "Weak",
    colour: "hsl(0 84% 60%)",
    bg: "hsl(0 84% 60% / 0.08)",
    border: "hsl(0 84% 60% / 0.3)",
    activeBg: "hsl(0 84% 60% / 0.12)",
    activeBorder: "hsl(0 84% 60%)",
    description: "Need attention",
  },
  developing: {
    label: "Developing",
    colour: "hsl(25 95% 53%)",
    bg: "hsl(25 95% 53% / 0.08)",
    border: "hsl(25 95% 53% / 0.3)",
    activeBg: "hsl(25 95% 53% / 0.12)",
    activeBorder: "hsl(25 95% 53%)",
    description: "Making progress",
  },
  strong: {
    label: "Strong",
    colour: "hsl(142 71% 45%)",
    bg: "hsl(142 71% 45% / 0.08)",
    border: "hsl(142 71% 45% / 0.3)",
    activeBg: "hsl(142 71% 45% / 0.12)",
    activeBorder: "hsl(142 71% 45%)",
    description: "Well covered",
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
  topic: string;
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
        if (canonical !== topic) continue;
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
  }, [topic, studentId]);

  if (loading)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2].map((i) => (
          <div
            key={i}
            style={{
              background: "hsl(var(--muted))",
              borderRadius: 8,
              height: 80,
              opacity: 0.6,
            }}
            className="animate-pulse"
          />
        ))}
      </div>
    );

  if (wrongAnswers.length === 0)
    return (
      <div
        style={{
          textAlign: "center",
          padding: 20,
          color: "hsl(var(--muted-foreground))",
          fontSize: 13,
        }}
      >
        No wrong answers recorded for this topic yet
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {wrongAnswers.map((answer, i) => {
        const isFullMarks = (answer.score ?? 0) >= answer.marks;
        return (
          <div
            key={i}
            style={{
              background: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "hsl(var(--foreground))",
                lineHeight: 1.6,
                marginBottom: 8,
              }}
              className="line-clamp-3"
            >
              <span
                style={{
                  color: "hsl(var(--muted-foreground))",
                  marginRight: 4,
                }}
              >
                Q{answer.questionNumber}:
              </span>
              <MathRenderer
                content={answer.questionText}
                hasMath={/\$[^$]+\$/.test(answer.questionText)}
                inline
              />
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: isFullMarks
                  ? "hsl(142 71% 45%)"
                  : "hsl(0 84% 60%)",
                marginBottom: 6,
              }}
            >
              Score: {answer.score}/{answer.marks}
            </div>
            {answer.correctAnswer && (
              <div
                style={{
                  background: "hsl(142 71% 45% / 0.06)",
                  border: "1px solid hsl(142 71% 45% / 0.2)",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "hsl(142 71% 45%)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                  }}
                >
                  Model Answer
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "hsl(var(--foreground))",
                    lineHeight: 1.6,
                  }}
                >
                  {splitAnswerSteps(answer.correctAnswer).map(
                    (step, si, arr) => (
                      <div
                        key={si}
                        style={{
                          display: "flex",
                          gap: 8,
                          marginBottom: si < arr.length - 1 ? 4 : 0,
                        }}
                      >
                        {arr.length > 1 && (
                          <span
                            style={{
                              color: "hsl(142 71% 45%)",
                              flexShrink: 0,
                              marginTop: 1,
                            }}
                          >
                            ›
                          </span>
                        )}
                        <MathRenderer
                          content={step}
                          hasMath={/\$[^$]+\$/.test(step)}
                          inline
                        />
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
            <div
              style={{
                fontSize: 11,
                color: "hsl(var(--muted-foreground))",
                marginTop: 4,
              }}
            >
              {new Date(answer.submitted_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
        );
      })}
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
  const [showAll, setShowAll] = useState(false);

  const INITIAL_SHOW = 10;

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const testedTopics = topics.filter((t) => t.mastery !== "untested");
  const weakCount = topics.filter((t) => t.mastery === "weak").length;
  const developingCount = topics.filter((t) => t.mastery === "developing").length;
  const strongCount = topics.filter((t) => t.mastery === "strong").length;

  const filteredTopics = activeFilter
    ? testedTopics.filter((t) => t.mastery === activeFilter)
    : testedTopics;

  const visibleTopics = showAll
    ? filteredTopics
    : filteredTopics.slice(0, INITIAL_SHOW);

  // Show empty state when no topics at all
  if (topics.length === 0 || testedTopics.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "48px 24px",
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "hsl(var(--muted))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          <BookOpen
            size={22}
            color="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
          />
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "hsl(var(--foreground))",
            marginBottom: 6,
          }}
        >
          No topic data yet
        </div>
        <div
          style={{
            fontSize: 13,
            color: "hsl(var(--muted-foreground))",
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          Complete some exams or practice quizzes to see your topic performance
          here
        </div>
        <button
          onClick={() => navigate("/create-practice-questions")}
          style={{
            padding: "8px 20px",
            background: "hsl(var(--primary))",
            border: "none",
            borderRadius: 8,
            color: "hsl(var(--primary-foreground))",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Start Practising
        </button>
      </div>
    );
  }

  const summaryCards: {
    mastery: "weak" | "developing" | "strong";
    count: number;
  }[] = [
    { mastery: "weak", count: weakCount },
    { mastery: "developing", count: developingCount },
    { mastery: "strong", count: strongCount },
  ];

  return (
    <div>
      {/* Summary filter cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {summaryCards.map(({ mastery, count }) => {
          const config = MASTERY_CONFIG[mastery];
          const isActive = activeFilter === mastery;
          const isDisabled = activeFilter !== null && activeFilter !== mastery;

          return (
            <button
              key={mastery}
              onClick={() => setActiveFilter(isActive ? null : mastery)}
              style={{
                padding: 16,
                background: isActive ? config.activeBg : "hsl(var(--card))",
                border: `1px solid ${isActive ? config.activeBorder : "hsl(var(--border))"}`,
                borderTop: `3px solid ${isActive ? config.colour : "hsl(var(--border))"}`,
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
                opacity: isDisabled ? 0.4 : 1,
                transition: "all 0.2s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.borderColor = config.colour;
                  e.currentTarget.style.borderTopColor = config.colour;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = "hsl(var(--border))";
                  e.currentTarget.style.borderTopColor = "hsl(var(--border))";
                }
              }}
            >
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: config.colour,
                  letterSpacing: "-1.5px",
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                {count}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "hsl(var(--foreground))",
                  marginBottom: 2,
                }}
              >
                {config.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {config.description}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active filter clear */}
      {activeFilter && (
        <button
          onClick={() => setActiveFilter(null)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 12px",
            background: "hsl(var(--muted))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 99,
            fontSize: 12,
            color: "hsl(var(--foreground))",
            cursor: "pointer",
            fontFamily: "inherit",
            marginBottom: 16,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "hsl(var(--muted)/0.7)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "hsl(var(--muted))")
          }
        >
          <X size={12} />
          Clear filter
        </button>
      )}

      {/* Filtered empty state */}
      {filteredTopics.length === 0 && activeFilter && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "hsl(var(--muted))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
            }}
          >
            <BookOpen
              size={22}
              color="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
            />
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "hsl(var(--foreground))",
              marginBottom: 6,
            }}
          >
            No {activeFilter} topics
          </div>
          <div
            style={{
              fontSize: 13,
              color: "hsl(var(--muted-foreground))",
              lineHeight: 1.5,
            }}
          >
            You have no topics at {activeFilter} mastery level
          </div>
        </div>
      )}

      {/* Topic cards */}
      <div>
        {visibleTopics.map((topic, index) => {
          const config =
            MASTERY_CONFIG[topic.mastery] ?? MASTERY_CONFIG.developing;
          const isExpanded = expandedTopic === topic.topic;

          return (
            <motion.div
              key={topic.topic}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.3 }}
              style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderLeft: `3px solid ${config.colour}`,
                borderRadius: 10,
                marginBottom: 10,
                overflow: "hidden",
                transition: "box-shadow 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 0 0 1px ${config.colour}30`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Card body */}
              <div style={{ padding: "14px 16px" }}>
                {/* Top row — topic name + mastery badge */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 10,
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "hsl(var(--foreground))",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginBottom: 3,
                      }}
                    >
                      {topic.topic}
                    </div>
                    {/* Score breakdown — Combined most prominent */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          color: config.colour,
                          letterSpacing: "-0.5px",
                          lineHeight: 1,
                        }}
                      >
                        {topic.unifiedScore}%
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        {topic.examScore !== null && (
                          <span
                            style={{
                              fontSize: 11,
                              color: "hsl(var(--muted-foreground))",
                            }}
                          >
                            Exam{" "}
                            <span
                              style={{
                                fontWeight: 600,
                                color: "hsl(var(--foreground))",
                              }}
                            >
                              {topic.examScore}%
                            </span>
                          </span>
                        )}
                        {topic.practiceScore !== null && (
                          <span
                            style={{
                              fontSize: 11,
                              color: "hsl(var(--muted-foreground))",
                            }}
                          >
                            Practice{" "}
                            <span
                              style={{
                                fontWeight: 600,
                                color: "hsl(var(--foreground))",
                              }}
                            >
                              {topic.practiceScore}%
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side — badge + practice button */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: 99,
                        background: config.bg,
                        color: config.colour,
                        border: `1px solid ${config.border}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {config.label}
                    </span>

                    {topic.mastery === "weak" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const params = new URLSearchParams({
                            subtopic: topic.topic,
                            source: "weak_topics",
                          });
                          if (topic.subjectId)
                            params.set("subject", topic.subjectId);
                          navigate(
                            `/create-practice-questions?${params.toString()}`
                          );
                        }}
                        style={{
                          padding: "4px 12px",
                          background: "hsl(0 84% 60%)",
                          border: "none",
                          borderRadius: 6,
                          color: "white",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          whiteSpace: "nowrap",
                          transition: "opacity 0.15s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.opacity = "0.85")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.opacity = "1")
                        }
                      >
                        Practice →
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: 6,
                    background: "hsl(var(--muted))",
                    borderRadius: 3,
                    overflow: "hidden",
                    marginBottom: topic.mastery === "weak" ? 10 : 0,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${topic.unifiedScore}%`,
                      background: config.colour,
                      borderRadius: 3,
                      transition: "width 0.9s ease",
                    }}
                  />
                </div>

                {/* Practised since last exam indicator — weak only */}
                {topic.mastery === "weak" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      color: topic.practicedSinceLastExam
                        ? "hsl(142 71% 45%)"
                        : "hsl(25 95% 53%)",
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: topic.practicedSinceLastExam
                          ? "hsl(142 71% 45%)"
                          : "hsl(25 95% 53%)",
                        flexShrink: 0,
                      }}
                    />
                    {topic.practicedSinceLastExam
                      ? "Practised since last exam"
                      : "Not practised since last exam"}
                  </div>
                )}
              </div>

              {/* Wrong answers expander */}
              <button
                onClick={() =>
                  setExpandedTopic(isExpanded ? null : topic.topic)
                }
                style={{
                  width: "100%",
                  padding: "8px 16px",
                  background: isExpanded
                    ? "hsl(var(--muted)/0.5)"
                    : "transparent",
                  border: "none",
                  borderTop: "1px solid hsl(var(--border)/0.5)",
                  color: "hsl(var(--muted-foreground))",
                  fontSize: 11,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  fontFamily: "inherit",
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "hsl(var(--muted)/0.5)";
                  e.currentTarget.style.color = "hsl(var(--foreground))";
                }}
                onMouseLeave={(e) => {
                  if (!isExpanded) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color =
                      "hsl(var(--muted-foreground))";
                  }
                }}
              >
                <ChevronDown
                  size={12}
                  style={{
                    transform: isExpanded
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                />
                {isExpanded ? "Hide wrong answers" : "See wrong answers"}
              </button>

              {/* Wrong answers panel — animated */}
              <AnimatePresence>
                {isExpanded && userId && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      style={{
                        padding: "12px 16px 16px",
                        background: "hsl(var(--muted)/0.3)",
                        borderTop: "1px solid hsl(var(--border)/0.5)",
                      }}
                    >
                      <WrongAnswersPanel
                        topic={topic.topic}
                        studentId={userId}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Show more / less */}
      {filteredTopics.length > INITIAL_SHOW && (
        <button
          onClick={() => setShowAll((prev) => !prev)}
          style={{
            width: "100%",
            padding: 10,
            background: "transparent",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            color: "hsl(var(--muted-foreground))",
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
            marginTop: 4,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "hsl(var(--primary))";
            e.currentTarget.style.color = "hsl(var(--primary))";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "hsl(var(--border))";
            e.currentTarget.style.color = "hsl(var(--muted-foreground))";
          }}
        >
          {showAll
            ? "Show less"
            : `Show ${filteredTopics.length - INITIAL_SHOW} more topics`}
        </button>
      )}
    </div>
  );
};
