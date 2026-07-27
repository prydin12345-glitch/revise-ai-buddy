import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { MobileStatSheet } from "./MobileStatSheet";
import { useTelemetry, alpha } from "./tokens";
import { useExamSchedule, type ScheduledExam } from "@/hooks/useExamSchedule";
import { useGradeSettings } from "@/hooks/useGradeSettings";
import { getScale, type GradeScaleId } from "@/lib/grade-scales";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Existing sitting to edit; omit to add a new one. */
  exam?: ScheduledExam | null;
  subjects: { name: string; color: string }[];
  defaultScaleId: GradeScaleId;
}

const PAPER_PRESETS = ["Paper 1", "Paper 2", "Paper 3", "Mock Exam"];

/** datetime-local wants "YYYY-MM-DDTHH:mm" in *local* time, not ISO/UTC. */
const toLocalInput = (iso?: string): string => {
  const d = iso ? new Date(iso) : new Date(Date.now() + 7 * 86400000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const ExamSetupSheet = ({ open, onClose, exam, subjects, defaultScaleId }: Props) => {
  const TELEMETRY = useTelemetry();
  const { upsert, remove } = useExamSchedule();
  const { get, update } = useGradeSettings();

  const [subject, setSubject] = useState("");
  const [paper, setPaper] = useState("Paper 1");
  const [when, setWhen] = useState(toLocalInput());

  useEffect(() => {
    if (!open) return;
    setSubject(exam?.subject ?? subjects[0]?.name ?? "");
    setPaper(exam?.paper ?? "Paper 1");
    setWhen(toLocalInput(exam?.startsAt));
  }, [open, exam, subjects]);

  const settings = subject ? get(subject) : {};
  const scale = getScale(settings.scaleId ?? defaultScaleId);
  const target = settings.targetGrade ?? null;
  const accent = subjects.find((s) => s.name === subject)?.color ?? TELEMETRY.info;

  const canSave = subject !== "" && paper.trim() !== "" && when !== "";

  const save = () => {
    if (!canSave) return;
    upsert({ id: exam?.id, subject, paper: paper.trim(), startsAt: new Date(when).toISOString() });
    onClose();
  };

  const field = "block text-[11px] mb-1.5";
  const pill = (active: boolean) => ({
    color: active ? TELEMETRY.onAccent : TELEMETRY.mutedStrong,
    background: active ? accent : TELEMETRY.cardAlt,
    border: `1px solid ${active ? accent : TELEMETRY.border}`,
  });

  return (
    <MobileStatSheet
      open={open}
      onClose={onClose}
      title={exam ? "Edit exam" : "Add exam"}
      subtitle={exam ? "Change the sitting or remove it." : "When are you actually sitting this?"}
    >
      <div className="space-y-5">
        <div>
          <span className={field} style={{ color: TELEMETRY.muted }}>Subject</span>
          {subjects.length === 0 ? (
            <p className="text-[12px]" style={{ color: TELEMETRY.muted }}>
              Add a subject first and it'll appear here.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => {
                const active = s.name === subject;
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setSubject(s.name)}
                    className="min-h-[40px] px-3 rounded-full text-[13px] font-medium capitalize transition-all active:scale-95 flex items-center gap-1.5"
                    style={{
                      color: active ? TELEMETRY.onAccent : TELEMETRY.mutedStrong,
                      background: active ? s.color : TELEMETRY.cardAlt,
                      border: `1px solid ${active ? s.color : TELEMETRY.border}`,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: active ? TELEMETRY.onAccent : s.color }}
                    />
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <span className={field} style={{ color: TELEMETRY.muted }}>Paper</span>
          <div className="flex flex-wrap gap-2 mb-2">
            {PAPER_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setPaper(preset)}
                className="min-h-[38px] px-3 rounded-full text-[13px] font-medium transition-all active:scale-95"
                style={pill(paper === preset)}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={paper}
            onChange={(e) => setPaper(e.target.value)}
            placeholder="Or type your own"
            aria-label="Paper or component name"
            className="w-full h-11 rounded-xl px-3 text-[14px] outline-none"
            style={{ background: TELEMETRY.cardAlt, border: `1px solid ${TELEMETRY.border}`, color: TELEMETRY.text }}
          />
        </div>

        <div>
          <span className={field} style={{ color: TELEMETRY.muted }}>Date &amp; time</span>
          {/* datetime-local opens the OS picker, which handles 12/24h by locale
              — a custom AM/PM toggle would fight the device setting. */}
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            aria-label="Exam date and time"
            className="w-full h-11 rounded-xl px-3 text-[14px] outline-none"
            style={{ background: TELEMETRY.cardAlt, border: `1px solid ${TELEMETRY.border}`, color: TELEMETRY.text }}
          />
        </div>

        {subject && scale.grades.length > 0 && (
          <div>
            <span className={field} style={{ color: TELEMETRY.muted }}>
              Target grade · {scale.label}
            </span>
            <div className="flex flex-wrap gap-2">
              {scale.grades.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => update(subject, { targetGrade: g === target ? undefined : g })}
                  className="min-w-[44px] min-h-[44px] px-2.5 rounded-2xl text-[15px] font-bold transition-all active:scale-95"
                  style={pill(g === target)}
                >
                  {g}
                </button>
              ))}
            </div>
            <p className="text-[11px] mt-2" style={{ color: TELEMETRY.muted }}>
              Applies to {subject} everywhere, not just this paper.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          {exam && (
            <button
              type="button"
              onClick={() => { remove(exam.id); onClose(); }}
              aria-label="Remove exam"
              className="min-h-[48px] w-12 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform"
              style={{ color: TELEMETRY.review, background: alpha(TELEMETRY.review, 0.1), border: `1px solid ${alpha(TELEMETRY.review, 0.25)}` }}
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="flex-1 min-h-[48px] rounded-xl font-semibold text-[14px] transition-transform active:scale-[0.99] disabled:opacity-50"
            style={{ background: accent, color: TELEMETRY.onAccent }}
          >
            {exam ? "Save changes" : "Add exam"}
          </button>
        </div>
      </div>
    </MobileStatSheet>
  );
};
