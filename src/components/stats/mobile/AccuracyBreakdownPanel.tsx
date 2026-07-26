import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTelemetry, alpha, clampPct, scoreStatusColor, scoreStatusLabel } from "./tokens";
import { SubjectStackedBars, buildSubjectStacks } from "./SubjectStackedBars";
import { SubjectTrendChart } from "./SubjectTrendChart";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

interface Props {
  topics: UnifiedTopicScore[];
  subjects: { name: string; color: string }[];
  /** examResultsData, for the per-subject trend in the drill-down. */
  trendData?: Array<Record<string, any>>;
}

const marked = (t: UnifiedTopicScore) => t.examQuestionCount + t.practiceQuestionCount > 0;

export const AccuracyBreakdownPanel = ({ topics, subjects, trendData = [] }: Props) => {
  const TELEMETRY = useTelemetry();
  const navigate = useNavigate();
  const [drill, setDrill] = useState<string | null>(null);

  const stacks = useMemo(
    () => buildSubjectStacks(topics, subjects, TELEMETRY.gray),
    [topics, subjects, TELEMETRY.gray]
  );

  const active = stacks.find((s) => s.name === drill) ?? null;

  const drillTopics = useMemo(() => {
    if (!drill) return [];
    return topics
      .filter((t) => marked(t) && (t.subjectId ?? "Unassigned") === drill)
      .sort((a, b) => clampPct(a.unifiedScore) - clampPct(b.unifiedScore));
  }, [topics, drill]);

  if (stacks.length === 0) {
    return (
      <div className="text-[13px] text-center py-8" style={{ color: TELEMETRY.muted }}>
        No marked questions yet.
      </div>
    );
  }

  const practise = (t: UnifiedTopicScore) => {
    const params = new URLSearchParams({ subtopic: t.topic, source: "accuracy_breakdown" });
    if (t.subjectId) params.set("subject", t.subjectId);
    navigate(`/create-practice-questions?${params.toString()}`);
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {active ? (
        <motion.div
          key="detail"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className="space-y-3"
        >
          <button
            type="button"
            onClick={() => setDrill(null)}
            className="flex items-center gap-1 text-[13px] font-medium min-h-[40px] -ml-1"
            style={{ color: TELEMETRY.muted }}
          >
            <ChevronLeft size={16} />
            All subjects
          </button>

          <div
            className="rounded-2xl p-4"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: active.colour }} />
                <span className="text-base font-semibold capitalize truncate" style={{ color: TELEMETRY.text }}>
                  {active.name}
                </span>
              </span>
              <span className="text-xl font-bold tabular-nums" style={{ color: active.colour }}>
                {Math.round(active.avg)}%
              </span>
            </div>
            <div className="text-[11px] mb-3" style={{ color: TELEMETRY.muted }}>
              {active.total} marked topic{active.total === 1 ? "" : "s"}
            </div>
            <SubjectTrendChart data={trendData} subject={active.name} colour={active.colour} />
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
          >
            <div className="px-4 pt-4 pb-1">
              <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
                Topics, weakest first
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: TELEMETRY.muted }}>
                Tap any topic to generate practice on it
              </div>
            </div>

            <div className="px-4 pb-2">
              {drillTopics.map((t, i) => {
                const pct = clampPct(t.unifiedScore);
                const attempts = t.examQuestionCount + t.practiceQuestionCount;
                const colour = scoreStatusColor(pct, attempts, TELEMETRY);
                return (
                  <motion.button
                    key={t.topic}
                    type="button"
                    onClick={() => practise(t)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.24), duration: 0.2 }}
                    className="w-full text-left flex items-center gap-3 py-3 active:opacity-70"
                    style={{ borderBottom: `1px solid ${TELEMETRY.borderSoft}` }}
                  >
                    <span className="w-1 rounded-full shrink-0" style={{ height: 30, background: colour }} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium capitalize truncate" style={{ color: TELEMETRY.text }}>
                        {t.topic}
                      </span>
                      <span
                        className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1"
                        style={{ color: colour, background: alpha(colour, 0.1) }}
                      >
                        {scoreStatusLabel(pct, attempts)}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-[15px] font-semibold tabular-nums" style={{ color: TELEMETRY.text }}>
                        {pct}%
                      </span>
                      <span className="block text-[10px]" style={{ color: TELEMETRY.muted }}>
                        {attempts} marked
                      </span>
                    </span>
                    <ArrowUpRight size={15} className="shrink-0" style={{ color: TELEMETRY.muted }} />
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className="space-y-3"
        >
          <div
            className="rounded-2xl p-4"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
          >
            <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
              Where your topics sit
            </div>
            <div className="text-[11px] mt-0.5 mb-4" style={{ color: TELEMETRY.muted }}>
              Topics per subject, stacked by mastery — tap a bar to drill in
            </div>

            <SubjectStackedBars topics={topics} subjects={subjects} onSelect={setDrill} />

            <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: `1px solid ${TELEMETRY.border}` }}>
              {([
                ["Needs review", TELEMETRY.magenta],
                ["Developing", TELEMETRY.cyan],
                ["Mastered", TELEMETRY.lime],
              ] as const).map(([label, colour]) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ background: colour }} />
                  <span className="text-[10px]" style={{ color: TELEMETRY.muted }}>{label}</span>
                </span>
              ))}
            </div>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
          >
            {stacks.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setDrill(s.name)}
                className="w-full text-left p-4 flex items-center gap-3 active:opacity-70"
                style={{ borderBottom: `1px solid ${TELEMETRY.borderSoft}` }}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.colour }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold capitalize truncate" style={{ color: TELEMETRY.text }}>
                    {s.name}
                  </span>
                  <span className="flex items-center gap-2 mt-1.5">
                    {([
                      [s.mastered, TELEMETRY.lime],
                      [s.developing, TELEMETRY.cyan],
                      [s.review, TELEMETRY.magenta],
                    ] as const)
                      .filter(([n]) => n > 0)
                      .map(([n, colour], i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: colour }} />
                          <span className="text-[11px] tabular-nums" style={{ color: TELEMETRY.muted }}>{n}</span>
                        </span>
                      ))}
                  </span>
                </span>
                <span className="text-[17px] font-bold tabular-nums shrink-0" style={{ color: s.colour }}>
                  {Math.round(s.avg)}%
                </span>
                <ChevronRight size={16} className="shrink-0" style={{ color: TELEMETRY.muted }} />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
