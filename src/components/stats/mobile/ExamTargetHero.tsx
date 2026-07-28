import { useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarPlus, MoreHorizontal } from "lucide-react";
import { CountdownRings } from "./CountdownRings";
import { ExamSetupSheet } from "./ExamSetupSheet";
import { TargetGradeModal } from "./TargetGradeModal";
import { useTelemetry, alpha, clampPct } from "./tokens";
import { useExamSchedule, type ScheduledExam } from "@/hooks/useExamSchedule";
import { useGradeSettings } from "@/hooks/useGradeSettings";
import { getScale, projectGrade, boundariesFor, type GradeScaleId } from "@/lib/grade-scales";

interface Props {
  subjects: { name: string; color: string; avgScore: number; count: number }[];
  defaultScaleId: GradeScaleId;
}

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

const timeOfDay = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export const ExamTargetHero = ({ subjects, defaultScaleId }: Props) => {
  const TELEMETRY = useTelemetry();
  const navigate = useNavigate();
  const { exams } = useExamSchedule();
  const { get } = useGradeSettings();

  const [index, setIndex] = useState(0);
  const [setupFor, setSetupFor] = useState<ScheduledExam | null | undefined>(undefined);
  const [targetFor, setTargetFor] = useState<ScheduledExam | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Track the snapped card so the dots stay honest during a flick.
  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const width = el.clientWidth || 1;
    setIndex(Math.round(el.scrollLeft / width));
  }, []);

  const colourOf = useCallback(
    (subject: string) => subjects.find((s) => s.name === subject)?.color ?? TELEMETRY.info,
    [subjects, TELEMETRY.info]
  );

  const cards = useMemo(
    () =>
      exams.map((exam) => {
        const perf = subjects.find((s) => s.name === exam.subject);
        const settings = get(exam.subject);
        const scale = getScale(settings.scaleId ?? defaultScaleId);
        const current = clampPct(perf?.avgScore ?? 0);
        const projected = projectGrade(current, scale, {
          overrides: settings.boundaries,
          tierId: settings.tierId,
        }).grade;
        const target = settings.targetGrade ?? null;
        const bounds = boundariesFor(scale, settings.boundaries);
        const needed = target ? bounds[target] : undefined;

        return {
          exam,
          accent: colourOf(exam.subject),
          current,
          projected,
          target,
          needed,
          // How far through the journey to the target boundary you are.
          progress: needed && needed > 0 ? Math.min(100, (current / needed) * 100) : null,
          hasData: (perf?.count ?? 0) > 0,
        };
      }),
    [exams, subjects, get, defaultScaleId, colourOf]
  );

  const practise = (exam: ScheduledExam) => {
    const params = new URLSearchParams({ subject: exam.subject, source: "exam_countdown" });
    navigate(`/create-practice-questions?${params.toString()}`);
  };

  if (cards.length === 0) {
    return (
      <>
        <div
          className="rounded-3xl p-6 text-center"
          style={{ background: TELEMETRY.card, border: `1px dashed ${TELEMETRY.border}` }}
        >
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: alpha(TELEMETRY.info, 0.1) }}
          >
            <CalendarPlus size={20} style={{ color: TELEMETRY.info }} />
          </div>
          <div className="text-[15px] font-semibold mt-3" style={{ color: TELEMETRY.text }}>
            No upcoming exams set
          </div>
          <p className="text-[12px] mt-1 mb-4" style={{ color: TELEMETRY.muted }}>
            Add a sitting to start the countdown and track your target grade.
          </p>
          <button
            type="button"
            onClick={() => setSetupFor(null)}
            className="min-h-[46px] px-5 rounded-xl font-semibold text-[14px] active:scale-[0.98] transition-transform"
            style={{ background: TELEMETRY.info, color: TELEMETRY.onAccent }}
          >
            + Add first exam
          </button>
        </div>

        <ExamSetupSheet
          open={setupFor !== undefined}
          onClose={() => setSetupFor(undefined)}
          exam={setupFor}
          subjects={subjects}
          defaultScaleId={defaultScaleId}
        />
      </>
    );
  }

  return (
    <>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-1"
        style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
      >
        {cards.map((c) => (
          <div key={c.exam.id} className="w-full shrink-0 snap-center px-1">
            <div
              className="rounded-3xl p-4"
              style={{
                background: TELEMETRY.card,
                border: `1px solid ${TELEMETRY.border}`,
                boxShadow: `inset 0 1px 0 0 ${alpha(c.accent, 0.12)}`,
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg capitalize"
                  style={{ color: c.accent, background: alpha(c.accent, 0.14) }}
                >
                  {c.exam.subject}
                </span>
                <span className="text-[12px] truncate flex-1" style={{ color: TELEMETRY.muted }}>
                  {c.exam.paper}
                </span>
                <button
                  type="button"
                  onClick={() => setSetupFor(c.exam)}
                  aria-label={`Edit ${c.exam.subject} ${c.exam.paper}`}
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                  style={{ color: TELEMETRY.muted, background: TELEMETRY.cardAlt }}
                >
                  <MoreHorizontal size={15} />
                </button>
              </div>

              <CountdownRings target={c.exam.startsAt} accent={c.accent} />

              <div className="text-center mt-3">
                <div className="text-[13px] font-medium" style={{ color: TELEMETRY.text }}>
                  {longDate(c.exam.startsAt)}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: TELEMETRY.muted }}>
                  {timeOfDay(c.exam.startsAt)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTargetFor(c.exam)}
                className="w-full text-left rounded-2xl p-3 mt-4 active:opacity-80 transition-opacity"
                style={{ background: TELEMETRY.cardAlt, border: `1px solid ${TELEMETRY.border}` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5">
                    <Target size={12} style={{ color: TELEMETRY.muted }} />
                    <span className="text-[11px]" style={{ color: TELEMETRY.muted }}>
                      {c.target ? `Target ${c.target}` : "Set a target"}
                    </span>
                  </span>
                  <span className="text-[11px]" style={{ color: TELEMETRY.muted }}>
                    {c.hasData && c.projected ? `Projected ${c.projected}` : "No data yet"}
                  </span>
                </div>

                <div className="h-2 rounded-full overflow-hidden" style={{ background: alpha(TELEMETRY.muted, 0.18) }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${c.progress ?? 0}%`,
                      background: `linear-gradient(90deg, ${alpha(c.accent, 0.7)}, ${c.accent})`,
                    }}
                  />
                </div>

                <div className="text-[11px] mt-1.5" style={{ color: TELEMETRY.muted }}>
                  {!c.target
                    ? "Tap to choose the grade you're aiming for."
                    : !c.hasData
                    ? "Sit a paper to see how close you are."
                    : c.progress !== null && c.progress >= 100
                    ? `You're at ${Math.round(c.current)}% — on track for ${c.target}.`
                    : `${Math.round(c.current)}% now · ${c.needed}% needed for ${c.target}.`}
                </div>
              </button>

              <button
                type="button"
                onClick={() => practise(c.exam)}
                className="w-full min-h-[48px] rounded-xl font-semibold text-[14px] mt-3 flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
                style={{ background: c.accent, color: TELEMETRY.onAccent }}
              >
                <Zap size={15} />
                Start {c.exam.paper} practice
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 mt-3">
        <div className="flex items-center gap-1.5">
          {cards.map((c, i) => (
            <span
              key={c.exam.id}
              className="rounded-full transition-all"
              style={{
                width: i === index ? 16 : 6,
                height: 6,
                background: i === index ? cards[index]?.accent ?? TELEMETRY.info : alpha(TELEMETRY.muted, 0.35),
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSetupFor(null)}
          className="text-[11px] font-semibold flex items-center gap-1 min-h-[32px] px-2"
          style={{ color: TELEMETRY.muted }}
        >
          <CalendarPlus size={12} />
          Add exam
        </button>
      </div>

      <ExamSetupSheet
        open={setupFor !== undefined}
        onClose={() => setSetupFor(undefined)}
        exam={setupFor}
        subjects={subjects}
        defaultScaleId={defaultScaleId}
      />

      {targetFor && (
        <TargetGradeModal
          open
          onClose={() => setTargetFor(null)}
          subject={targetFor.subject}
          paper={targetFor.paper}
          defaultScaleId={defaultScaleId}
          accent={colourOf(targetFor.subject)}
        />
      )}
    </>
  );
};
