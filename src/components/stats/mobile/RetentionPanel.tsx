import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Zap, Clock, FlaskConical, PencilRuler, CheckCheck } from "lucide-react";
import { useTelemetry, alpha, clampPct } from "./tokens";
import type { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

interface Props {
  topics: UnifiedTopicScore[];
  subjects: { name: string; color: string }[];
}

type Freshness = "fresh" | "fading" | "stale" | "unknown";

const daysSince = (iso: string | null): number | null => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
};

const freshnessOf = (days: number | null): Freshness => {
  if (days === null) return "unknown";
  if (days <= 7) return "fresh";
  if (days <= 21) return "fading";
  return "stale";
};

const timeAgo = (days: number | null) => {
  if (days === null) return "never reviewed";
  if (days <= 0) return "reviewed today";
  if (days === 1) return "reviewed yesterday";
  if (days < 7) return `reviewed ${days}d ago`;
  if (days < 30) return `reviewed ${Math.floor(days / 7)}w ago`;
  return `reviewed ${Math.floor(days / 30)}mo ago`;
};

export const RetentionPanel = ({ topics, subjects }: Props) => {
  const TELEMETRY = useTelemetry();
  const [showAll, setShowAll] = useState(false);

  const FRESHNESS_META: Record<Freshness, { label: string; colour: string; retained: number }> = {
    fresh: { label: "Fresh", colour: TELEMETRY.mastered, retained: 100 },
    fading: { label: "Fading", colour: TELEMETRY.developing, retained: 62 },
    stale: { label: "Stale", colour: TELEMETRY.review, retained: 28 },
    unknown: { label: "—", colour: TELEMETRY.idle, retained: 0 },
  };

  const { rows, bands } = useMemo(() => {
    const scored = topics.filter((t) => t.examQuestionCount + t.practiceQuestionCount > 0);

    const rows = scored
      .map((t) => {
        const pct = clampPct(t.unifiedScore);
        const days = daysSince(t.lastAttempted);
        return {
          topic: t,
          pct,
          days,
          freshness: freshnessOf(days),
          marked: t.examQuestionCount + t.practiceQuestionCount,
          // Genuine corroboration: the topic has cleared 70% in *both* streams,
          // which is stronger evidence than one high exam score alone.
          corroborated:
            t.examScore !== null &&
            t.practiceScore !== null &&
            t.examScore >= 70 &&
            t.practiceScore >= 70,
          colour: subjects.find((s) => s.name === t.subjectId)?.color ?? TELEMETRY.idle,
        };
      })
      .sort((a, b) => {
        const order = { stale: 0, fading: 1, fresh: 2, unknown: 3 };
        if (order[a.freshness] !== order[b.freshness]) return order[a.freshness] - order[b.freshness];
        return b.pct - a.pct;
      });

    return {
      rows,
      bands: {
        fresh: rows.filter((r) => r.freshness === "fresh").length,
        fading: rows.filter((r) => r.freshness === "fading").length,
        stale: rows.filter((r) => r.freshness === "stale").length,
      },
    };
  }, [topics, subjects, TELEMETRY.idle]);

  if (rows.length === 0) {
    return (
      <div className="text-[13px] text-center py-8" style={{ color: TELEMETRY.muted }}>
        Nothing marked yet — retention appears once you've sat something.
      </div>
    );
  }

  const visible = showAll ? rows : rows.slice(0, 6);

  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl p-4"
        style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
      >
        <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
          Recall freshness
        </div>
        <div className="text-[11px] mt-0.5 mb-3" style={{ color: TELEMETRY.muted }}>
          How long since you last touched each topic — stale first
        </div>

        <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: TELEMETRY.cardAlt }}>
          {([
            [bands.stale, TELEMETRY.review],
            [bands.fading, TELEMETRY.developing],
            [bands.fresh, TELEMETRY.mastered],
          ] as const).map(([n, colour], i) =>
            n > 0 ? <div key={i} style={{ width: `${(n / rows.length) * 100}%`, background: colour }} /> : null
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          {([
            ["Stale", bands.stale, TELEMETRY.review, "21d+"],
            ["Fading", bands.fading, TELEMETRY.developing, "7–21d"],
            ["Fresh", bands.fresh, TELEMETRY.mastered, "under 7d"],
          ] as const).map(([label, n, colour, hint]) => (
            <div
              key={label}
              className="rounded-xl px-2 py-2.5 text-center"
              style={{ background: TELEMETRY.cardAlt, border: `1px solid ${TELEMETRY.border}` }}
            >
              <div className="text-lg font-semibold tabular-nums" style={{ color: colour }}>{n}</div>
              <div className="text-[10px]" style={{ color: TELEMETRY.text }}>{label}</div>
              <div className="text-[9px] mt-0.5" style={{ color: TELEMETRY.muted }}>{hint}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {visible.map((r, i) => {
          const meta = FRESHNESS_META[r.freshness];
          return (
            <motion.div
              key={r.topic.topic}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.22 }}
              className="rounded-2xl p-3.5"
              style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: alpha(meta.colour, 0.1) }}
                >
                  <Zap size={15} style={{ color: meta.colour }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold capitalize leading-tight" style={{ color: TELEMETRY.text }}>
                    {r.topic.topic}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {r.topic.subjectId && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                        style={{ color: r.colour, background: alpha(r.colour, 0.12) }}
                      >
                        {r.topic.subjectId}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: TELEMETRY.muted }}>
                      <Clock size={10} />
                      {timeAgo(r.days)}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[17px] font-bold tabular-nums leading-none" style={{ color: TELEMETRY.text }}>
                    {r.pct}%
                  </div>
                  <div className="text-[10px] font-semibold mt-1" style={{ color: meta.colour }}>
                    {meta.label}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: TELEMETRY.cardAlt }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${meta.retained}%`, background: meta.colour }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                {r.topic.examQuestionCount > 0 && (
                  <span
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
                    style={{ color: TELEMETRY.mutedStrong, background: TELEMETRY.cardAlt }}
                  >
                    <PencilRuler size={10} />
                    {r.topic.examQuestionCount} exam
                  </span>
                )}
                {r.topic.practiceQuestionCount > 0 && (
                  <span
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
                    style={{ color: TELEMETRY.mutedStrong, background: TELEMETRY.cardAlt }}
                  >
                    <FlaskConical size={10} />
                    {r.topic.practiceQuestionCount} practice
                  </span>
                )}
                {r.corroborated && (
                  <span
                    className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ color: TELEMETRY.mastered, background: alpha(TELEMETRY.mastered, 0.12) }}
                  >
                    <CheckCheck size={10} />
                    Strong in both
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {rows.length > 6 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full min-h-[44px] rounded-xl text-[13px] font-medium"
          style={{ color: TELEMETRY.mutedStrong, background: TELEMETRY.cardAlt, border: `1px solid ${TELEMETRY.border}` }}
        >
          {showAll ? "Show less" : `Show all ${rows.length} topics`}
        </button>
      )}
    </div>
  );
};
