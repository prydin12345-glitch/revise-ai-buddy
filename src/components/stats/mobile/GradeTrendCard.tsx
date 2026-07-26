import { useState, useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { useTelemetry, alpha } from "./tokens";
import { useGradeSettings } from "@/hooks/useGradeSettings";
import { getScale, projectGrade, gradeRank, type GradeScaleId } from "@/lib/grade-scales";

interface Props {
  /** examResultsData: [{ period: "Mon", Maths: 62, Physics: 71 }, ...] */
  data: Array<Record<string, any>>;
  subjects: { name: string; color: string }[];
  defaultScaleId: GradeScaleId;
}

const W = 320;
const H = 176;
const PAD_L = 30;
const PAD_R = 10;
const PAD_T = 14;
const PAD_B = 24;

export const GradeTrendCard = ({ data, subjects, defaultScaleId }: Props) => {
  const TELEMETRY = useTelemetry();
  const { get } = useGradeSettings();
  const [selected, setSelected] = useState<string | null>(null);

  const active = useMemo(
    () => subjects.find((s) => s.name === selected) ?? subjects[0] ?? null,
    [subjects, selected]
  );

  const model = useMemo(() => {
    if (!active) return null;
    const settings = get(active.name);
    const scale = getScale(settings.scaleId ?? defaultScaleId);
    const usesGrades = scale.grades.length > 0;

    // Rows are best → worst for grades, or 100 → 0 for a percentage scale.
    const rows = usesGrades ? scale.grades : ["100", "75", "50", "25", "0"];
    const yFor = (index: number) =>
      PAD_T + (index / Math.max(rows.length - 1, 1)) * (H - PAD_T - PAD_B);

    const points = data.map((row, i) => {
      const raw = row[active.name];
      const x =
        PAD_L + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (W - PAD_L - PAD_R));
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return { x, y: null as number | null, label: row.period as string, value: null };
      }
      if (!usesGrades) {
        const idx = ((100 - Math.max(0, Math.min(100, raw))) / 100) * (rows.length - 1);
        return { x, y: yFor(idx), label: row.period as string, value: `${Math.round(raw)}%` };
      }
      const grade = projectGrade(raw, scale, {
        overrides: settings.boundaries,
        tierId: settings.tierId,
      }).grade;
      const rank = grade ? gradeRank(scale, grade) : -1;
      return {
        x,
        y: rank >= 0 ? yFor(rank) : null,
        label: row.period as string,
        value: grade,
      };
    });

    const targetRank =
      usesGrades && settings.targetGrade ? gradeRank(scale, settings.targetGrade) : -1;

    // Split into runs so a gap in the data breaks the line instead of
    // drawing a straight segment across weeks with no exams.
    const runs: { x: number; y: number }[][] = [];
    let run: { x: number; y: number }[] = [];
    points.forEach((p) => {
      if (p.y === null) {
        if (run.length) runs.push(run);
        run = [];
      } else {
        run.push({ x: p.x, y: p.y });
      }
    });
    if (run.length) runs.push(run);

    return {
      scale,
      usesGrades,
      rows,
      yFor,
      points,
      runs,
      targetGrade: settings.targetGrade ?? null,
      targetY: targetRank >= 0 ? yFor(targetRank) : null,
      plotted: points.filter((p) => p.y !== null).length,
    };
  }, [active, data, get, defaultScaleId]);

  if (!active || !model) {
    return (
      <div
        className="rounded-2xl p-6 text-center text-[13px]"
        style={{ background: TELEMETRY.card, border: `1px dashed ${TELEMETRY.border}`, color: TELEMETRY.muted }}
      >
        No graded exams yet — your grade trend appears once you've sat one.
      </div>
    );
  }

  const latest = [...model.points].reverse().find((p) => p.value !== null);

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <TrendingUp size={13} style={{ color: TELEMETRY.magenta }} />
            <span className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
              Grade trend
            </span>
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: TELEMETRY.muted }}>
            {model.usesGrades ? model.scale.label : "Percentage"}
          </div>
        </div>
        {latest?.value && (
          <div className="text-right">
            <div className="text-xl font-bold tabular-nums leading-none" style={{ color: active.color }}>
              {latest.value}
            </div>
            <div className="text-[11px] mt-1" style={{ color: TELEMETRY.muted }}>
              latest
            </div>
          </div>
        )}
      </div>

      {subjects.length > 1 && (
        <div className="-mx-1 overflow-x-auto no-scrollbar mt-3">
          <div className="flex items-center gap-1.5 px-1 pb-1">
            {subjects.map((s) => {
              const on = s.name === active.name;
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setSelected(s.name)}
                  className="shrink-0 min-h-[32px] px-2.5 rounded-full text-[11px] font-medium whitespace-nowrap capitalize flex items-center gap-1.5"
                  style={{
                    color: on ? TELEMETRY.text : TELEMETRY.muted,
                    background: on ? TELEMETRY.cardAlt : "transparent",
                    border: `1px solid ${on ? s.color : "transparent"}`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {model.plotted === 0 ? (
        <p className="text-[12px] py-8 text-center" style={{ color: TELEMETRY.muted }}>
          No results for {active.name} in this range.
        </p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-2" style={{ overflow: "visible" }}>
          {model.rows.map((label, i) => {
            const y = model.yFor(i);
            return (
              <g key={label}>
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={W - PAD_R}
                  y2={y}
                  stroke={TELEMETRY.border}
                  strokeWidth={1}
                  opacity={0.5}
                />
                <text
                  x={PAD_L - 7}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill={TELEMETRY.muted}
                >
                  {label}
                </text>
              </g>
            );
          })}

          {model.targetY !== null && (
            <>
              <line
                x1={PAD_L}
                y1={model.targetY}
                x2={W - PAD_R}
                y2={model.targetY}
                stroke={TELEMETRY.cyan}
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
              <text
                x={W - PAD_R}
                y={model.targetY - 5}
                textAnchor="end"
                fontSize={9}
                fontWeight={600}
                fill={TELEMETRY.cyan}
              >
                target {model.targetGrade}
              </text>
            </>
          )}

          {model.runs.map((run, i) => (
            <polyline
              key={i}
              points={run.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={active.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {model.points.map((p, i) =>
            p.y === null ? null : (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={3.5}
                fill={TELEMETRY.card}
                stroke={active.color}
                strokeWidth={2}
              />
            )
          )}

          {model.points.map((p, i) => (
            <text
              key={`x-${i}`}
              x={p.x}
              y={H - 6}
              textAnchor="middle"
              fontSize={9}
              fill={TELEMETRY.muted}
            >
              {p.label}
            </text>
          ))}
        </svg>
      )}

      {model.usesGrades && !model.targetGrade && (
        <p
          className="text-[11px] mt-2 rounded-lg px-2.5 py-2"
          style={{
            color: TELEMETRY.mutedStrong,
            background: alpha(TELEMETRY.cyan, 0.08),
            border: `1px solid ${alpha(TELEMETRY.cyan, 0.2)}`,
          }}
        >
          Set a target grade for {active.name} in Grade Projection to see it plotted here.
        </p>
      )}
    </div>
  );
};
