import { useId } from "react";
import { Target, Flame, GraduationCap, CheckCircle2, LucideIcon } from "lucide-react";
import { useTelemetry, buildSparklinePath, alpha, TelemetryPalette } from "./tokens";

interface Props {
  accuracy: number;                    // 0..100
  accuracySessions: number[];          // recent 0..100 session scores (up to 7)
  gradeValue: string;                  // e.g. "1 / 1"
  gradeDelta?: string;                 // e.g. "all on target"
  gradeTone?: "up" | "down" | "neutral";
  gradeTrajectory: number[];           // recent avg % across subjects with targets
  masteredCount: number;
  developingCount: number;
  reviewCount: number;
  totalAttempted: number;
  streak: number;
  longestStreak: number;
  /** 7 booleans (Mon..Sun of current week) — true if the student studied. */
  streakDays: boolean[];
  /** Matching 7 numeric loads (0..1 normalised or raw hrs) for bar heights. */
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
  children: React.ReactNode;                   // the micro-viz
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
      <div className="mt-3">{children}</div>
    </Element>
  );
};

/* ───────────────────────── 1. Accuracy — stacked mini bars ───────────────────────── */

const AccuracyBars = ({ series, p }: { series: number[]; p: TelemetryPalette }) => {
  // Pad to 7 slots so the rhythm is stable even with a single recent session.
  const slots: (number | null)[] = Array.from({ length: 7 }, (_, i) => {
    const v = series[series.length - 7 + i];
    return typeof v === "number" ? Math.max(0, Math.min(100, v)) : null;
  });
  const H = 34;
  return (
    <div className="flex items-end gap-[5px] h-[34px]">
      {slots.map((v, i) => {
        if (v == null) {
          return (
            <div
              key={i}
              className="flex-1 rounded-[3px]"
              style={{ height: 4, background: alpha(p.muted, 0.18) }}
            />
          );
        }
        // Split into a "hit" band (correct) and a "miss" band above it.
        const hit = Math.max(3, (v / 100) * H);
        const miss = Math.max(0, H - hit);
        return (
          <div key={i} className="flex-1 flex flex-col justify-end" style={{ height: H }}>
            {miss > 2 && (
              <div
                className="rounded-t-[3px]"
                style={{ height: miss, background: alpha(p.cyan, 0.22) }}
              />
            )}
            <div
              className={miss > 2 ? "rounded-b-[3px]" : "rounded-[3px]"}
              style={{ height: hit, background: p.lime }}
            />
          </div>
        );
      })}
    </div>
  );
};

/* ───────────────────────── 2. Target grades — area line ───────────────────────── */

const GradeArea = ({ series, p }: { series: number[]; p: TelemetryPalette }) => {
  const gid = `garea-${useId().replace(/:/g, "")}`;
  const W = 120;
  const H = 34;
  const has = series.length > 1;
  const d = has ? buildSparklinePath(series, W, H) : "";
  if (!d) {
    return (
      <div
        className="w-full rounded-[3px]"
        style={{ height: 2, background: alpha(p.muted, 0.25) }}
      />
    );
  }
  const last = series[series.length - 1];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const lastX = W - 2;
  const lastY = 2 + (1 - (last - min) / range) * (H - 4);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.cyan} stopOpacity="0.28" />
          <stop offset="100%" stopColor={p.cyan} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gid})`} />
      <path d={d} stroke={p.cyan} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2.4} fill={p.cyan} />
    </svg>
  );
};

/* ───────────────────────── 3. Mastered — segmented bar ───────────────────────── */

const MasterySegments = ({
  mastered, developing, review, p,
}: { mastered: number; developing: number; review: number; p: TelemetryPalette }) => {
  const total = mastered + developing + review;
  if (total === 0) {
    return (
      <div
        className="w-full rounded-full"
        style={{ height: 6, background: alpha(p.muted, 0.2) }}
      />
    );
  }
  const segs = [
    { n: mastered, c: p.lime },
    { n: developing, c: p.amber },
    { n: review, c: p.magenta },
  ].filter((s) => s.n > 0);
  return (
    <div className="space-y-2">
      <div
        className="flex w-full overflow-hidden rounded-full gap-[2px]"
        style={{ height: 6, background: alpha(p.muted, 0.14) }}
      >
        {segs.map((s, i) => (
          <div
            key={i}
            style={{ width: `${(s.n / total) * 100}%`, background: s.c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] tabular-nums" style={{ color: p.muted }}>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: p.lime }} />{mastered}</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: p.amber }} />{developing}</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: p.magenta }} />{review}</span>
      </div>
    </div>
  );
};

/* ───────────────────────── 4. Streak — 7-day activity bars ───────────────────────── */

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
                background: active ? p.magenta : alpha(p.muted, 0.2),
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
  accuracySessions,
  gradeValue,
  gradeDelta,
  gradeTone = "neutral",
  gradeTrajectory,
  masteredCount,
  developingCount,
  reviewCount,
  totalAttempted,
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
    gradeTone === "up" ? p.lime : gradeTone === "down" ? p.magenta : p.muted;

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
        <AccuracyBars series={accuracySessions} p={p} />
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
        <GradeArea series={gradeTrajectory} p={p} />
      </CardShell>

      {/* 3. Mastered */}
      <CardShell
        p={p}
        icon={CheckCircle2}
        label="Mastered"
        value={masteredValue}
        onClick={onOpenMastered}
      >
        <MasterySegments
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
