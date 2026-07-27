import { useId } from "react";
import { Target, Flame, GraduationCap, CheckCircle2, LucideIcon } from "lucide-react";
import { useTelemetry, buildSparklinePath, alpha, TelemetryPalette } from "./tokens";
import type { SubjectStack } from "./SubjectStackedBars";

interface Props {
  accuracy: number;                    // 0..100
  accuracySessions: number[];          // (unused now — kept for API compat)
  subjectStacks: SubjectStack[];       // for the Accuracy mini-viz
  gradeValue: string;                  // e.g. "1 / 1"
  gradeDelta?: string;
  gradeTone?: "up" | "down" | "neutral";
  gradeProgress: number | null;        // 0..100 or null when no targets set
  gradeAccent: string;                 // subject-tinted fill colour
  gradeTrajectory: number[];           // kept for API compat
  masteredCount: number;
  developingCount: number;
  reviewCount: number;
  totalAttempted: number;
  masteredHistory: number[];           // mastery trend sparkline data
  streak: number;
  longestStreak: number;
  streakDays: boolean[];
  streakLoads?: number[];
  onOpenAccuracy?: () => void;
  onOpenGrade?: () => void;
  onOpenMastered?: () => void;
  onOpenStreak?: () => void;
}

/* ───────────────────────── shared card shell ───────────────────────── */

interface ShellProps {
  icon: LucideIcon;
  label: string;
  value: string;
  valueColor?: string;
  topRight?: React.ReactNode;
  onClick?: () => void;
  children: React.ReactNode;
  p: TelemetryPalette;
}

const CardShell = ({ icon: Icon, label, value, valueColor, topRight, onClick, children, p }: ShellProps) => {
  const Element: any = onClick ? "button" : "div";
  return (
    <Element
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`text-left w-full h-full rounded-2xl p-3.5 flex flex-col transition-transform ${
        onClick ? "active:scale-[0.98] cursor-pointer" : ""
      }`}
      style={{ background: p.card, border: `1px solid ${p.border}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon size={16} strokeWidth={1.75} style={{ color: p.muted }} />
        {topRight}
      </div>
      <div className="text-[11px]" style={{ color: p.muted }}>{label}</div>
      <div
        className="text-[26px] leading-none font-semibold tabular-nums mt-1"
        style={{ color: valueColor ?? p.text }}
      >
        {value}
      </div>
      <div className="mt-auto pt-3">{children}</div>
    </Element>
  );
};

/* ───── 1. Accuracy — mini stacked mastery capsules per subject ───── */

const AccuracyMiniStacks = ({
  stacks, p,
}: { stacks: SubjectStack[]; p: TelemetryPalette }) => {
  if (stacks.length === 0) {
    return (
      <div
        className="w-full rounded-full"
        style={{ height: 4, background: alpha(p.muted, 0.18) }}
      />
    );
  }
  const shown = stacks.slice(0, 6);
  const max = Math.max(...shown.map((s) => s.total), 1);
  const H = 34;
  return (
    <div className="flex items-end justify-start gap-2 pb-0.5" style={{ height: H }}>
      {shown.map((s) => {
        const h = Math.max(14, (s.total / max) * H);
        const segs = [
          { n: s.review, c: p.review },
          { n: s.developing, c: p.developing },
          { n: s.mastered, c: p.mastered },
        ].filter((seg) => seg.n > 0);
        return (
          <div
            key={s.name}
            className="rounded-full overflow-hidden flex flex-col"
            style={{
              width: 6,
              height: h,
              background: alpha(p.muted, 0.16),
            }}
          >
            {segs.map((seg, i) => (
              <div
                key={i}
                style={{ height: `${(seg.n / s.total) * 100}%`, background: seg.c }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

/* ───── 2. Target grades — pill progress with striped remainder ───── */

const GradePillProgress = ({
  pct, accent, p,
}: { pct: number | null; accent: string; p: TelemetryPalette }) => {
  const value = pct ?? 0;
  const H = 12;
  return (
    <div className="w-full">
      {/* Plain gradient track. The diagonal hatch read as a loading state, and
          the glow on the fill was the same halo treatment removed elsewhere. */}
      <div
        className="relative w-full overflow-hidden rounded-full"
        style={{
          height: H,
          background: `linear-gradient(90deg, ${alpha(p.muted, 0.1)}, ${alpha(p.muted, 0.18)})`,
        }}
      >
        {value > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(4, Math.min(100, value))}%`,
              background: `linear-gradient(90deg, ${alpha(accent, 0.7)}, ${accent})`,
            }}
          />
        )}
      </div>
      <div className="flex justify-center mt-2">
        <span
          className="text-[10px] font-semibold tabular-nums rounded-full px-2 py-0.5"
          style={{
            color: pct == null ? p.muted : p.text,
            background: pct == null ? alpha(p.muted, 0.14) : alpha(accent, 0.18),
            border: `1px solid ${pct == null ? p.border : alpha(accent, 0.35)}`,
          }}
        >
          {pct == null ? "—" : `${value}%`}
        </span>
      </div>
    </div>
  );
};

/* ───── 3. Mastered — smooth area sparkline of progression ───── */

const MasteryTrend = ({
  history, mastered, developing, review, p,
}: {
  history: number[];
  mastered: number;
  developing: number;
  review: number;
  p: TelemetryPalette;
}) => {
  const gid = `mtrend-${useId().replace(/:/g, "")}`;
  const W = 140;
  const H = 40;
  const has = history.length > 1;
  const d = has ? buildSparklinePath(history, W, H) : "";
  // With fewer than two data points there's no trend to draw. A flat muted
  // line read as a broken component, so fall back to the band split — which is
  // information the card already has, and is what the number above summarises.
  if (!d) {
    const total = mastered + developing + review;
    if (total === 0) {
      return (
        <div className="w-full rounded-full" style={{ height: 6, background: alpha(p.muted, 0.16) }} />
      );
    }
    const segs = [
      { n: review, c: p.review },
      { n: developing, c: p.developing },
      { n: mastered, c: p.mastered },
    ].filter((s) => s.n > 0);
    return (
      <div>
        <div
          className="w-full rounded-full overflow-hidden flex"
          style={{ height: 6, background: alpha(p.muted, 0.16) }}
        >
          {segs.map((s, i) => (
            <div key={i} style={{ width: `${(s.n / total) * 100}%`, background: s.c }} />
          ))}
        </div>
        <div className="flex items-center gap-2.5 mt-2">
          {segs.map((s, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.c }} />
              <span className="text-[10px] tabular-nums" style={{ color: p.muted }}>{s.n}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }
  const last = history[history.length - 1];
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const lastX = W - 2;
  const lastY = 2 + (1 - (last - min) / range) * (H - 4);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.mastered} stopOpacity="0.32" />
          <stop offset="100%" stopColor={p.mastered} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gid})`} />
      <path d={d} stroke={p.mastered} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2.4} fill={p.mastered} />
    </svg>
  );
};

/* ───── 4. Streak — untouched 7-day activity bars ───── */

const StreakBars = ({
  days, loads, p,
}: { days: boolean[]; loads?: number[]; p: TelemetryPalette }) => {
  const H = 34;
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const maxLoad = Math.max(1, ...(loads ?? []));
  return (
    <div>
      <div className="flex items-end gap-[5px]" style={{ height: H }}>
        {Array.from({ length: 7 }, (_, i) => {
          const active = days[i];
          const norm = loads?.[i] ? loads[i] / maxLoad : 0;
          const h = active ? Math.max(10, norm * H || H * 0.55) : 4;
          return (
            <div
              key={i}
              className="flex-1 rounded-[3px]"
              style={{
                height: h,
                background: active ? p.info : alpha(p.muted, 0.2),
              }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-[5px] mt-1">
        {labels.map((l, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[9px] tabular-nums"
            style={{ color: p.muted }}
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ───────────────────────── grid ───────────────────────── */

export const QuickStatsGrid = ({
  accuracy,
  subjectStacks,
  gradeValue,
  gradeDelta,
  gradeTone = "neutral",
  gradeProgress,
  gradeAccent,
  masteredCount,
  developingCount,
  reviewCount,
  totalAttempted,
  masteredHistory,
  streak,
  longestStreak,
  streakDays,
  streakLoads,
  onOpenAccuracy,
  onOpenGrade,
  onOpenMastered,
  onOpenStreak,
}: Props) => {
  const p = useTelemetry();

  const gradeToneColor =
    gradeTone === "up" ? p.mastered : gradeTone === "down" ? p.review : p.muted;

  const masteredValue = totalAttempted > 0 ? `${masteredCount} / ${totalAttempted}` : "0";
  const streakDelta = longestStreak > 0 ? `best ${longestStreak}d` : undefined;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* 1. Accuracy */}
      <CardShell
        p={p}
        icon={Target}
        label="Accuracy"
        value={`${Math.round(accuracy)}%`}
        onClick={onOpenAccuracy}
      >
        <AccuracyMiniStacks stacks={subjectStacks} p={p} />
      </CardShell>

      {/* 2. Target grades */}
      <CardShell
        p={p}
        icon={GraduationCap}
        label="Target grades"
        value={gradeValue}
        topRight={
          gradeDelta ? (
            <span className="text-[10px] font-medium" style={{ color: gradeToneColor }}>
              {gradeDelta}
            </span>
          ) : null
        }
        onClick={onOpenGrade}
      >
        <GradePillProgress pct={gradeProgress} accent={gradeAccent} p={p} />
      </CardShell>

      {/* 3. Mastered */}
      <CardShell
        p={p}
        icon={CheckCircle2}
        label="Mastered"
        value={masteredValue}
        onClick={onOpenMastered}
      >
        <MasteryTrend
          history={masteredHistory}
          mastered={masteredCount}
          developing={developingCount}
          review={reviewCount}
          p={p}
        />
      </CardShell>

      {/* 4. Revision streak */}
      <CardShell
        p={p}
        icon={Flame}
        label="Revision streak"
        value={`${streak}d`}
        topRight={
          streakDelta ? (
            <span className="text-[10px] font-medium" style={{ color: p.muted }}>
              {streakDelta}
            </span>
          ) : null
        }
        onClick={onOpenStreak}
      >
        <StreakBars days={streakDays} loads={streakLoads} p={p} />
      </CardShell>
    </div>
  );
};
