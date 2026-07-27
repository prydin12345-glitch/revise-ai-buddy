import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useTelemetry, alpha } from "./tokens";
import { useGradeSettings } from "@/hooks/useGradeSettings";
import { getScale, type GradeScaleId } from "@/lib/grade-scales";

interface Props {
  open: boolean;
  onClose: () => void;
  subject: string;
  paper: string;
  defaultScaleId: GradeScaleId;
  accent: string;
}

/**
 * Quick target-grade picker. Writes straight to useGradeSettings, which is the
 * same store the Grade Projection panel reads — so a target set here shows up
 * there immediately, and there's only one place a target can live.
 *
 * Targets are per subject, not per paper: your target for Biology is your
 * target for Biology whichever paper you're looking at.
 */
export const TargetGradeModal = ({
  open, onClose, subject, paper, defaultScaleId, accent,
}: Props) => {
  const TELEMETRY = useTelemetry();
  const { get, update } = useGradeSettings();

  const settings = get(subject);
  const scale = getScale(settings.scaleId ?? defaultScaleId);
  const current = settings.targetGrade ?? null;

  const choose = (grade: string) => {
    update(subject, { targetGrade: grade === current ? undefined : grade });
    window.setTimeout(onClose, 180);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            role="dialog"
            aria-label={`Target grade for ${subject}`}
            className="fixed z-50 left-4 right-4 top-1/2 -translate-y-1/2 rounded-3xl p-5 max-w-[420px] mx-auto"
            style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
          >
            <div className="text-[11px]" style={{ color: TELEMETRY.muted }}>
              {paper}
            </div>
            <div className="text-lg font-semibold capitalize mb-1" style={{ color: TELEMETRY.text }}>
              {subject}
            </div>
            <div className="text-[12px] mb-4" style={{ color: TELEMETRY.muted }}>
              {scale.grades.length > 0
                ? `Target grade · ${scale.label}`
                : "This subject uses percentages, so there's no grade to target."}
            </div>

            {scale.grades.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {scale.grades.map((g) => {
                  const active = g === current;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => choose(g)}
                      className="min-w-[46px] min-h-[46px] px-3 rounded-2xl text-[15px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1"
                      style={{
                        color: active ? TELEMETRY.onAccent : TELEMETRY.text,
                        background: active ? accent : TELEMETRY.cardAlt,
                        border: `1px solid ${active ? accent : TELEMETRY.border}`,
                      }}
                    >
                      {g}
                      {active && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[44px] rounded-xl text-[13px] font-medium mt-4"
              style={{ color: TELEMETRY.mutedStrong, background: TELEMETRY.cardAlt, border: `1px solid ${TELEMETRY.border}` }}
            >
              Done
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
