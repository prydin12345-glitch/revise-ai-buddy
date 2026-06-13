// FILE: src/components/wizard/StepWizard.tsx
// A purely presentational multi-step wrapper. It owns NO domain logic — it
// only animates between steps, renders a progress rail, and runs a caller-
// supplied validator before advancing. All form state, validation rules and
// the generate pipeline stay in the page that uses this. This keeps the
// "don't lose any logic" guarantee: the wizard never touches the data.

import { ReactNode, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  id: string;
  title: string;
  subtitle?: string;
  /** Returns null if OK, or an error message to show and block advancing. */
  validate?: () => string | null;
  content: ReactNode;
}

interface StepWizardProps {
  steps: WizardStep[];
  /** Index of the final "review" step the Save-changes flow returns to. */
  reviewIndex?: number;
  /** Label + handler for the terminal action on the last step. */
  finalLabel: ReactNode;
  onFinish: () => void;
  finishDisabled?: boolean;
  accentColor?: string;
  /** Column width — the PAGE owns this, not the wizard. Default keeps prior behaviour. */
  maxWidth?: string;
  /** Optional callback when the active step changes (for analytics etc). */
  onStepChange?: (index: number) => void;
}

export function StepWizard({
  steps,
  reviewIndex,
  finalLabel,
  onFinish,
  finishDisabled,
  accentColor = "hsl(var(--primary))",
  maxWidth = "max-w-3xl",
  onStepChange,
}: StepWizardProps) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [error, setError] = useState<string | null>(null);
  // When the user entered a step via "edit from review", Save returns there.
  const [returnToReview, setReturnToReview] = useState(false);

  const go = useCallback(
    (next: number, dir: 1 | -1) => {
      setDirection(dir);
      setError(null);
      setActive(next);
      onStepChange?.(next);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [onStepChange]
  );

  const handleNext = () => {
    const err = steps[active].validate?.() ?? null;
    if (err) { setError(err); return; }
    if (returnToReview && reviewIndex != null) {
      setReturnToReview(false);
      go(reviewIndex, 1);
      return;
    }
    if (active < steps.length - 1) go(active + 1, 1);
    else onFinish();
  };

  const handleBack = () => {
    if (returnToReview && reviewIndex != null) {
      setReturnToReview(false);
      go(reviewIndex, -1);
      return;
    }
    if (active > 0) go(active - 1, -1);
  };

  /** Jump to a step to edit it, remembering to return to review on save. */
  const editStep = (index: number) => {
    setReturnToReview(true);
    go(index, -1);
  };

  const isReview = reviewIndex != null && active === reviewIndex;
  const isLast = active === steps.length - 1;
  const variants = {
    enter: (dir: number) => ({ opacity: 0, x: reduced ? 0 : dir * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: reduced ? 0 : dir * -40 }),
  };

  return (
    <div className={cn(maxWidth, "mx-auto")}>
      {/* Progress rail */}
      <div className="flex items-center justify-start sm:justify-center gap-2 sm:gap-3 mb-8 px-1 overflow-x-auto no-scrollbar" role="list">
        {steps.map((s, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <div key={s.id} className="flex items-center gap-2 sm:gap-3" role="listitem">
              <button
                type="button"
                onClick={() => i <= active && go(i, i < active ? -1 : 1)}
                disabled={i > active}
                className={cn(
                  "flex items-center gap-2 rounded-full transition-all",
                  i <= active ? "cursor-pointer" : "cursor-default"
                )}
                aria-current={current ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.title}`}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all",
                    done && "text-white",
                    current && "ring-4 ring-offset-2 ring-offset-background text-white",
                    !done && !current && "bg-secondary text-muted-foreground"
                  )}
                  style={done || current ? { backgroundColor: accentColor, ...(current ? { boxShadow: `0 0 0 4px ${accentColor}33` } : {}) } : undefined}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={cn(
                  "hidden sm:block text-sm font-medium whitespace-nowrap",
                  current ? "text-foreground" : "text-muted-foreground"
                )}>
                  {s.title}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span className={cn("h-px w-4 sm:w-8 transition-colors", i < active ? "" : "bg-border")}
                  style={i < active ? { backgroundColor: accentColor } : undefined} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step header */}
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight">{steps[active].title}</h2>
        {steps[active].subtitle && (
          <p className="text-muted-foreground mt-1 text-sm">{steps[active].subtitle}</p>
        )}
      </div>

      {/* Animated step body. overflow-x-clip contains the horizontal slide
          without trimming focus rings, tooltips or popovers vertically. */}
      <div className="relative overflow-x-clip px-1 py-1">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={steps[active].id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduced ? 0 : 0.3, ease: "easeInOut" }}
          >
            {/* Expose editStep to the review step via context-free prop drilling:
                the page renders its review content with edit buttons that call
                window-level callback set here. Simplicity: we pass through a
                data attribute the review reads. */}
            {isReview ? (
              <ReviewEditContext.Provider value={{ editStep, isReview: true }}>
                {steps[active].content}
              </ReviewEditContext.Provider>
            ) : (
              steps[active].content
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Inline validation error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            role="alert"
            className="mt-4 text-center text-sm text-destructive font-medium"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Nav buttons */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={handleBack}
          disabled={active === 0 && !returnToReview}
          className={cn((active === 0 && !returnToReview) && "invisible")}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {returnToReview ? "Cancel" : "Back"}
        </Button>

        {returnToReview ? (
          <Button onClick={handleNext} style={{ backgroundColor: accentColor }} className="hover:opacity-90 text-white">
            Save changes
            <Check className="h-4 w-4 ml-1.5" />
          </Button>
        ) : isLast ? (
          <Button onClick={handleNext} disabled={finishDisabled} size="lg"
            style={{ backgroundColor: accentColor }} className="hover:opacity-90 text-white">
            {finalLabel}
          </Button>
        ) : (
          <Button onClick={handleNext} style={{ backgroundColor: accentColor }} className="hover:opacity-90 text-white">
            Next
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* Lightweight context so the review step can render "Edit" buttons that jump
   back to a specific step and return on save — without the page wiring it. */
import { createContext, useContext } from "react";

interface ReviewEditValue {
  editStep: (index: number) => void;
  isReview: boolean;
}
const ReviewEditContext = createContext<ReviewEditValue | null>(null);

export const useReviewEdit = () => {
  const ctx = useContext(ReviewEditContext);
  return ctx ?? { editStep: () => {}, isReview: false };
};
