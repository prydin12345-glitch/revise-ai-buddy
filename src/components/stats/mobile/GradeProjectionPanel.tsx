import { useState } from "react";
import { ChevronDown, RotateCcw, Info } from "lucide-react";
import { useTelemetry, alpha } from "./tokens";
import { useGradeSettings } from "@/hooks/useGradeSettings";
import {
  ALL_SCALES,
  getScale,
  projectGrade,
  boundariesFor,
  targetStatus,
  type GradeScaleId,
} from "@/lib/grade-scales";

interface SubjectRow {
  name: string;
  color: string;
  avgScore: number;
  count: number;
}

interface Props {
  subjects: SubjectRow[];
  /** Starting scale when a subject has no override, from the user's region/level. */
  defaultScaleId: GradeScaleId;
}

export const GradeProjectionPanel = ({ subjects, defaultScaleId }: Props) => {
  const TELEMETRY = useTelemetry();
  const { get, update, setBoundary, reset } = useGradeSettings();
  const [editing, setEditing] = useState<string | null>(null);

  const statusStyle = (s: ReturnType<typeof targetStatus>) => {
    if (s === "met") return { label: "On target", color: TELEMETRY.lime };
    if (s === "close") return { label: "Close", color: TELEMETRY.amber };
    if (s === "behind") return { label: "Behind", color: TELEMETRY.magenta };
    return { label: "Set a target", color: TELEMETRY.muted };
  };

  const selectStyle = {
    background: TELEMETRY.cardAlt,
    border: `1px solid ${TELEMETRY.border}`,
    color: TELEMETRY.text,
  };

  if (subjects.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 text-center text-[13px]"
        style={{ background: TELEMETRY.card, border: `1px dashed ${TELEMETRY.border}`, color: TELEMETRY.muted }}
      >
        No graded exams yet. Once you've sat one, your projected grades appear here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="flex items-start gap-2 rounded-xl p-3"
        style={{ background: alpha(TELEMETRY.cyan, 0.08), border: `1px solid ${alpha(TELEMETRY.cyan, 0.2)}` }}
      >
        <Info size={14} className="mt-0.5 shrink-0" style={{ color: TELEMETRY.cyan }} />
        <p className="text-[12px] leading-snug" style={{ color: TELEMETRY.mutedStrong }}>
          These are estimates. Real grade boundaries change every year and differ by board and
          subject — set your own from a recent past paper for a projection you can trust.
        </p>
      </div>

      {subjects.map((subject) => {
        const settings = get(subject.name);
        const scale = getScale(settings.scaleId ?? defaultScaleId);
        const projection = projectGrade(subject.avgScore, scale, {
          overrides: settings.boundaries,
          tierId: settings.tierId,
        });
        const target = settings.targetGrade ?? null;
        const status = statusStyle(targetStatus(scale, projection.grade, target));
        const isOpen = editing === subject.name;
        const bounds = boundariesFor(scale, settings.boundaries);

        return (
          <div
            key={subject.name}
            className="rounded-2xl overflow-hidden"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
          >
            <button
              type="button"
              onClick={() => setEditing(isOpen ? null : subject.name)}
              className="w-full flex items-center gap-3 p-4 text-left min-h-[64px]"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: subject.color }} />

              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold truncate" style={{ color: TELEMETRY.text }}>
                  {subject.name}
                </span>
                <span className="block text-[11px] tabular-nums" style={{ color: TELEMETRY.muted }}>
                  {Math.round(subject.avgScore)}% over {subject.count}{" "}
                  {subject.count === 1 ? "exam" : "exams"}
                </span>
              </span>

              <span className="text-right shrink-0">
                <span className="block text-xl font-bold tabular-nums" style={{ color: TELEMETRY.text }}>
                  {projection.grade ?? `${Math.round(subject.avgScore)}%`}
                  {target && (
                    <span className="text-[13px] font-medium" style={{ color: TELEMETRY.muted }}>
                      {" → "}
                      {target}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: status.color }}>
                  {status.label}
                </span>
              </span>

              <ChevronDown
                size={16}
                className="shrink-0 transition-transform"
                style={{ color: TELEMETRY.muted, transform: isOpen ? "rotate(180deg)" : undefined }}
              />
            </button>

            {projection.cappedByTier && (
              <p className="px-4 pb-3 -mt-1 text-[11px]" style={{ color: TELEMETRY.amber }}>
                Capped at {projection.grade} by the tier you're entered for.
              </p>
            )}
            {!projection.cappedByTier && projection.nextGrade && projection.pointsToNext !== null && (
              <p className="px-4 pb-3 -mt-1 text-[11px]" style={{ color: TELEMETRY.muted }}>
                {projection.pointsToNext === 0
                  ? `On the boundary for ${projection.nextGrade}.`
                  : `${projection.pointsToNext}% more to reach ${projection.nextGrade}.`}
              </p>
            )}

            {isOpen && (
              <div className="px-4 pb-4 space-y-4" style={{ borderTop: `1px solid ${TELEMETRY.border}` }}>
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <label className="block">
                    <span className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: TELEMETRY.muted }}>
                      Grade scale
                    </span>
                    <select
                      value={settings.scaleId ?? defaultScaleId}
                      onChange={(e) =>
                        update(subject.name, {
                          scaleId: e.target.value as GradeScaleId,
                          tierId: undefined,
                          targetGrade: undefined,
                          boundaries: {},
                        })
                      }
                      className="w-full h-10 rounded-lg px-2 text-[13px]"
                      style={selectStyle}
                    >
                      {ALL_SCALES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: TELEMETRY.muted }}>
                      Target grade
                    </span>
                    <select
                      value={settings.targetGrade ?? ""}
                      onChange={(e) => update(subject.name, { targetGrade: e.target.value || undefined })}
                      disabled={scale.grades.length === 0}
                      className="w-full h-10 rounded-lg px-2 text-[13px] disabled:opacity-50"
                      style={selectStyle}
                    >
                      <option value="">None</option>
                      {scale.grades.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {scale.tiers && (
                  <label className="block">
                    <span className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: TELEMETRY.muted }}>
                      Entry tier
                    </span>
                    <select
                      value={settings.tierId ?? ""}
                      onChange={(e) => update(subject.name, { tierId: e.target.value || undefined })}
                      className="w-full h-10 rounded-lg px-2 text-[13px]"
                      style={selectStyle}
                    >
                      <option value="">Not set</option>
                      {scale.tiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label} (max {t.maxGrade})
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {scale.grades.length > 0 && (
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider mb-2" style={{ color: TELEMETRY.muted }}>
                      Grade boundaries (minimum %)
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {scale.grades
                        .filter((g) => bounds[g] !== undefined)
                        .map((g) => (
                          <label
                            key={g}
                            className="flex items-center gap-1.5 rounded-lg px-2 h-10"
                            style={{ background: TELEMETRY.cardAlt, border: `1px solid ${TELEMETRY.border}` }}
                          >
                            <span className="text-[12px] font-semibold w-6 shrink-0" style={{ color: TELEMETRY.text }}>
                              {g}
                            </span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={100}
                              value={bounds[g]}
                              onChange={(e) =>
                                setBoundary(
                                  subject.name,
                                  g,
                                  e.target.value === "" ? null : Number(e.target.value)
                                )
                              }
                              className="w-full bg-transparent text-[13px] tabular-nums outline-none min-w-0"
                              style={{ color: TELEMETRY.text }}
                            />
                            <span className="text-[11px] shrink-0" style={{ color: TELEMETRY.muted }}>
                              %
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => reset(subject.name)}
                  className="flex items-center gap-1.5 text-[12px] font-medium min-h-[40px]"
                  style={{ color: TELEMETRY.muted }}
                >
                  <RotateCcw size={13} />
                  Reset {subject.name} to defaults
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
