import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Sparkles, Clock, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normaliseTopicTags } from "@/lib/normalise-topic";
import { MathRenderer } from "@/components/MathRenderer";
import { MobileStatSheet } from "./MobileStatSheet";
import { TopicTelemetryRow } from "./TopicTelemetryRow";
import { useTelemetry, alpha, clampPct, scoreStatusColor, scoreStatusLabel } from "./tokens";
import { ScoreDistribution } from "./ScoreDistribution";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

interface Props {
  topics: UnifiedTopicScore[];
  loading: boolean;
  /** For subject badge colours on the topic cards. */
  subjects?: { name: string; color: string }[];
}

type FilterKey = "all" | "review" | "developing" | "mastered" | "pending" | "untouched";
type SortKey = "weakest" | "attempts" | "recent";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "review", label: "Needs review" },
  { key: "developing", label: "Developing" },
  { key: "mastered", label: "Mastered" },
  { key: "pending", label: "Awaiting marking" },
  { key: "untouched", label: "Untouched" },
  { key: "all", label: "All" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "weakest", label: "Weakest first" },
  { key: "attempts", label: "Most attempted" },
  { key: "recent", label: "Recently sat" },
];

const attemptsOf = (t: UnifiedTopicScore) => t.examQuestionCount + t.practiceQuestionCount;

/**
 * Buckets match scoreStatusLabel() in tokens.ts exactly, so a topic reads the
 * same here as it does on the overview. The old tab kept its own red/orange/
 * green scale with different thresholds, which is why the same topic could look
 * "weak" on one screen and "developing" on another.
 */
const bucketOf = (t: UnifiedTopicScore): Exclude<FilterKey, "all"> => {
  if (attemptsOf(t) === 0) {
    // Answered but unmarked is not the same as never attempted — it used to
    // land in "untouched" scoring 0%, which read as a failed topic.
    return (t.pendingQuestionCount ?? 0) > 0 ? "pending" : "untouched";
  }
  const pct = clampPct(t.unifiedScore);
  if (pct >= 70) return "mastered";
  if (pct >= 40) return "developing";
  return "review";
};

const timeAgo = (iso: string | null): string => {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

/* ------------------------------------------------------------------ */

interface WrongAnswer {
  questionText: string;
  correctAnswer: string;
  score: number;
  marks: number;
  submittedAt: string;
}

const WrongAnswers = ({ topic }: { topic: string }) => {
  const TELEMETRY = useTelemetry();
  const [rows, setRows] = useState<WrongAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data: answers } = await supabase
          .from("student_answers")
          .select("score, submitted_at, question_id")
          .eq("student_id", user.id)
          .order("submitted_at", { ascending: false });

        if (!answers?.length || cancelled) {
          if (!cancelled) setRows([]);
          return;
        }

        const qIds = [...new Set(answers.map((a) => a.question_id))];
        const { data: questions } = await supabase
          .from("exam_questions")
          .select("id, topic_tag, correct_answer, marks, question_text")
          .in("id", qIds);

        if (!questions || cancelled) {
          if (!cancelled) setRows([]);
          return;
        }

        const tags = [...new Set(questions.map((q) => q.topic_tag).filter(Boolean) as string[])];
        const normMap = await normaliseTopicTags(tags);
        const qMap = new Map(questions.map((q) => [q.id, q]));

        const out: WrongAnswer[] = [];
        for (const ans of answers) {
          const q = qMap.get(ans.question_id);
          if (!q?.topic_tag) continue;
          if ((normMap[q.topic_tag] ?? q.topic_tag) !== topic) continue;
          const score = Number(ans.score) || 0;
          if (score >= q.marks) continue;
          out.push({
            questionText: q.question_text,
            correctAnswer: q.correct_answer,
            score,
            marks: q.marks,
            submittedAt: ans.submitted_at,
          });
          if (out.length >= 3) break;
        }
        if (!cancelled) setRows(out);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [topic]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: TELEMETRY.cardAlt }} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-[12px]" style={{ color: TELEMETRY.muted }}>
        No dropped marks recorded for this topic yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div
          key={i}
          className="rounded-xl p-3"
          style={{ background: TELEMETRY.cardAlt, border: `1px solid ${TELEMETRY.border}` }}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px]" style={{ color: TELEMETRY.muted }}>
              {timeAgo(r.submittedAt)}
            </span>
            <span
              className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
              style={{
                color: TELEMETRY.magenta,
                background: alpha(TELEMETRY.magenta, 0.1),
              }}
            >
              {r.score}/{r.marks}
            </span>
          </div>
          <div className="text-[12px] leading-snug line-clamp-3" style={{ color: TELEMETRY.text }}>
            <MathRenderer content={r.questionText} />
          </div>
          {r.correctAnswer && (
            <div className="mt-2 pt-2 text-[11px] leading-snug" style={{ borderTop: `1px solid ${TELEMETRY.border}`, color: TELEMETRY.mutedStrong }}>
              <span className="font-semibold" style={{ color: TELEMETRY.lime }}>Expected: </span>
              <MathRenderer content={r.correctAnswer} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */

export const MobileWeakTopics = ({ topics, loading, subjects = [] }: Props) => {
  const TELEMETRY = useTelemetry();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>("review");
  const [sort, setSort] = useState<SortKey>("weakest");
  const [selected, setSelected] = useState<UnifiedTopicScore | null>(null);

  const bandColour = (key: FilterKey) =>
    key === "review"
      ? TELEMETRY.magenta
      : key === "developing"
      ? TELEMETRY.cyan
      : key === "mastered"
      ? TELEMETRY.lime
      : key === "pending"
      ? TELEMETRY.amber
      : TELEMETRY.mutedStrong;

  const subjectColours = useMemo(
    () => new Map(subjects.map((s) => [s.name, s.color])),
    [subjects]
  );

  const counts = useMemo(() => {
    const c = { review: 0, developing: 0, mastered: 0, pending: 0, untouched: 0, all: topics.length };
    topics.forEach((t) => { c[bucketOf(t)] += 1; });
    return c;
  }, [topics]);

  const visible = useMemo(() => {
    const list = filter === "all" ? [...topics] : topics.filter((t) => bucketOf(t) === filter);
    return list.sort((a, b) => {
      if (sort === "attempts") return attemptsOf(b) - attemptsOf(a);
      if (sort === "recent") {
        return new Date(b.lastAttempted ?? 0).getTime() - new Date(a.lastAttempted ?? 0).getTime();
      }
      const aTried = attemptsOf(a) > 0;
      const bTried = attemptsOf(b) > 0;
      if (aTried !== bTried) return aTried ? -1 : 1; // untouched sinks
      return clampPct(a.unifiedScore) - clampPct(b.unifiedScore);
    });
  }, [topics, filter, sort]);

  const attempted = counts.all - counts.untouched;
  const coverage = counts.all > 0 ? Math.round((attempted / counts.all) * 100) : 0;

  const practise = (t: UnifiedTopicScore) => {
    const params = new URLSearchParams({ subtopic: t.topic, source: "weak_topics" });
    if (t.subjectId) params.set("subject", t.subjectId);
    navigate(`/create-practice-questions?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-32 rounded-2xl animate-pulse" style={{ background: TELEMETRY.cardAlt }} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: TELEMETRY.cardAlt }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4" style={{ background: TELEMETRY.bg }}>
      {/* Priority band — compact: headline count, coverage ring, inline stats. */}
      <div
        className="rounded-2xl p-4"
        style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
      >
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span
                className="text-[36px] font-bold tabular-nums leading-none"
                style={{ color: counts.review > 0 ? TELEMETRY.magenta : TELEMETRY.lime }}
              >
                {counts.review}
              </span>
              <span className="text-[13px] font-medium" style={{ color: TELEMETRY.text }}>
                {counts.review === 1 ? "topic needs" : "topics need"} review
              </span>
            </div>
            <div className="text-[11px] mt-1.5" style={{ color: TELEMETRY.muted }}>
              {attempted} of {counts.all} topics attempted
            </div>
          </div>

          {/* Coverage ring */}
          <div className="relative shrink-0" style={{ width: 60, height: 60 }}>
            <svg width={60} height={60} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={30} cy={30} r={25} fill="none" stroke={TELEMETRY.cardAlt} strokeWidth={6} />
              <circle
                cx={30}
                cy={30}
                r={25}
                fill="none"
                stroke={TELEMETRY.lime}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={`${(coverage / 100) * 2 * Math.PI * 25} ${2 * Math.PI * 25}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[13px] font-bold tabular-nums" style={{ color: TELEMETRY.text }}>
                {coverage}%
              </span>
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-between mt-3.5 pt-3"
          style={{ borderTop: `1px solid ${TELEMETRY.border}` }}
        >
          {([
            ["Mastered", counts.mastered, TELEMETRY.lime],
            ["Developing", counts.developing, TELEMETRY.cyan],
            ["Untouched", counts.untouched, TELEMETRY.gray],
          ] as const).map(([label, value, colour]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: colour }} />
              <span className="text-[11px]" style={{ color: TELEMETRY.muted }}>
                {label}
              </span>
              <span className="text-[13px] font-semibold tabular-nums" style={{ color: TELEMETRY.text }}>
                {value}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Distribution */}
      <div
        className="rounded-2xl p-4"
        style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
      >
        <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
          Score spread
        </div>
        <div className="text-[11px] mt-0.5 mb-4" style={{ color: TELEMETRY.muted }}>
          Every marked topic, plotted by score
        </div>
        <ScoreDistribution
          values={topics.filter((t) => attemptsOf(t) > 0).map((t) => clampPct(t.unifiedScore))}
        />
      </div>

      {/* Filters — each pill takes its own band colour when active, so the
          worst bucket never lights up in the "good" colour. */}
      <div className="-mx-1 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 px-1 pb-1">
          {FILTERS.filter((f) => f.key !== "pending" || counts.pending > 0).map((f) => {
            const active = filter === f.key;
            const tone = bandColour(f.key);
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className="shrink-0 min-h-[38px] px-3.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all active:scale-[0.96] flex items-center gap-2"
                style={{
                  color: active ? TELEMETRY.onAccent : TELEMETRY.mutedStrong,
                  background: active ? tone : TELEMETRY.card,
                  border: `1px solid ${active ? tone : TELEMETRY.border}`,
                }}
              >
                {f.label}
                <span
                  className="tabular-nums text-[11px] font-bold rounded-full px-1.5 leading-[17px] min-w-[18px] text-center"
                  style={{
                    color: active ? tone : TELEMETRY.text,
                    background: active ? TELEMETRY.onAccent : TELEMETRY.cardAlt,
                  }}
                >
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] shrink-0" style={{ color: TELEMETRY.muted }}>Sort</span>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {SORTS.map((s) => {
            const active = sort === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className="shrink-0 min-h-[34px] px-2.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors"
                style={{
                  color: active ? TELEMETRY.text : TELEMETRY.muted,
                  background: active ? TELEMETRY.cardAlt : "transparent",
                  border: `1px solid ${active ? TELEMETRY.border : "transparent"}`,
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List — individual elevated cards with subject badges and tap feedback. */}
      {visible.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: TELEMETRY.card, border: `1px dashed ${TELEMETRY.border}` }}
        >
          <Sparkles size={22} className="mx-auto mb-2" style={{ color: TELEMETRY.lime }} />
          <p className="text-[13px] font-medium" style={{ color: TELEMETRY.text }}>Nothing here</p>
          <p className="text-[12px] mt-1" style={{ color: TELEMETRY.muted }}>
            No topics in this band right now.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((t, i) => {
            const attempts = attemptsOf(t);
            const pending = t.pendingQuestionCount ?? 0;
            const awaiting = attempts === 0 && pending > 0;
            const pct = clampPct(t.unifiedScore);
            const colour = awaiting ? TELEMETRY.amber : scoreStatusColor(pct, attempts, TELEMETRY);
            const label = awaiting ? "Awaiting marking" : scoreStatusLabel(pct, attempts);
            const subjectColour =
              subjectColours.get(t.subjectId ?? "") ?? TELEMETRY.gray;

            return (
              <motion.button
                key={`${t.subjectId ?? "x"}-${t.topic}`}
                type="button"
                onClick={() => setSelected(t)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.24), duration: 0.2 }}
                whileTap={{ scale: 0.985 }}
                className="w-full text-left rounded-2xl p-3.5"
                style={{
                  background: TELEMETRY.card,
                  border: `1px solid ${TELEMETRY.border}`,
                  borderLeft: `3px solid ${colour}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[14px] font-semibold capitalize leading-tight break-words line-clamp-2"
                      style={{ color: TELEMETRY.text }}
                    >
                      {t.topic}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ color: colour, background: alpha(colour, 0.12) }}
                      >
                        {label}
                      </span>
                      {t.subjectId && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                          style={{ color: subjectColour, background: alpha(subjectColour, 0.12) }}
                        >
                          {t.subjectId}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className="text-[20px] font-bold tabular-nums leading-none"
                      style={{ color: awaiting ? TELEMETRY.amber : TELEMETRY.text }}
                    >
                      {attempts > 0 ? `${pct}%` : awaiting ? "··" : "—"}
                    </div>
                    <div className="text-[10px] tabular-nums mt-1" style={{ color: TELEMETRY.muted }}>
                      {attempts > 0 ? `${attempts} marked` : awaiting ? `${pending} pending` : "no data"}
                    </div>
                  </div>
                </div>

                {attempts > 0 && (
                  <div
                    className="h-1 rounded-full overflow-hidden mt-3"
                    style={{ background: TELEMETRY.cardAlt }}
                  >
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colour }} />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Detail */}
      <MobileStatSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.topic ?? ""}
        subtitle={selected?.subjectId ?? undefined}
      >
        {selected && (() => {
          const attempts = attemptsOf(selected);
          const pct = clampPct(selected.unifiedScore);
          const colour = scoreStatusColor(pct, attempts, TELEMETRY);

          return (
            <div className="space-y-4">
              <div
                className="rounded-2xl p-4 flex items-center gap-4"
                style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
              >
                <div>
                  <div className="text-[34px] font-bold tabular-nums leading-none" style={{ color: colour }}>
                    {attempts > 0 ? `${pct}%` : "—"}
                  </div>
                  <div className="text-[11px] font-semibold mt-1.5" style={{ color: colour }}>
                    {scoreStatusLabel(pct, attempts)}
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  {([
                    ["Exam", selected.examScore, selected.examQuestionCount],
                    ["Practice", selected.practiceScore, selected.practiceQuestionCount],
                  ] as const).map(([label, score, count]) => (
                    <div key={label}>
                      <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: TELEMETRY.muted }}>
                        <span>{label}</span>
                        <span className="tabular-nums">
                          {count > 0 && score !== null ? `${Math.round(score)}% · ${count}q` : "none"}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: TELEMETRY.cardAlt }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${count > 0 && score !== null ? clampPct(score) : 0}%`,
                            background: label === "Exam" ? TELEMETRY.cyan : TELEMETRY.lime,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-3" style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}>
                  <Clock size={13} style={{ color: TELEMETRY.muted }} />
                  <div className="text-[13px] font-semibold mt-1.5" style={{ color: TELEMETRY.text }}>
                    {timeAgo(selected.lastAttempted)}
                  </div>
                  <div className="text-[11px]" style={{ color: TELEMETRY.muted }}>Last attempted</div>
                </div>
                <div className="rounded-xl p-3" style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}>
                  <Layers size={13} style={{ color: TELEMETRY.muted }} />
                  <div className="text-[13px] font-semibold mt-1.5" style={{ color: TELEMETRY.text }}>
                    {attempts} {attempts === 1 ? "question" : "questions"}
                  </div>
                  <div className="text-[11px]" style={{ color: TELEMETRY.muted }}>Total attempted</div>
                </div>
              </div>

              {selected.practicedSinceLastExam && (
                <p
                  className="text-[12px] rounded-xl p-3"
                  style={{
                    color: TELEMETRY.mutedStrong,
                    background: alpha(TELEMETRY.cyan, 0.08),
                    border: `1px solid ${alpha(TELEMETRY.cyan, 0.2)}`,
                  }}
                >
                  You've practised this since your last exam — the exam figure above may be out of date.
                </p>
              )}

              <div>
                <h4 className="text-[11px] mb-2" style={{ color: TELEMETRY.muted }}>
                  Recent dropped marks
                </h4>
                <WrongAnswers topic={selected.topic} />
              </div>

              <button
                type="button"
                onClick={() => practise(selected)}
                className="w-full min-h-[48px] rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
                style={{ background: TELEMETRY.lime, color: TELEMETRY.onAccent }}
              >
                Practise this topic
                <ArrowUpRight size={16} />
              </button>
            </div>
          );
        })()}
      </MobileStatSheet>
    </div>
  );
};
