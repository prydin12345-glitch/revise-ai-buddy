import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clock } from "lucide-react";

interface GenerationLoadingScreenProps {
  /** Kept for API back-compat; no longer shown. Callers cycle it on a timer,
   *  so it never reflected real progress (and looped back to "Analyzing…"
   *  after "Almost there"). */
  message?: string;
  subjectColor?: string;
  /** Kept for API back-compat; no longer used. */
  estimatedTime?: number;
  /** Kept for API back-compat; no longer used. */
  apiComplete?: boolean;

  /** "exam" shows the working steps; "practice" is a shorter wait, so it
   *  shows the summary, timer and tip only. */
  variant?: "exam" | "practice";
  /** What's being built — exam name, or the subject for practice. */
  title?: string;
  board?: string;
  tier?: string | null;
  questionCount?: number;
  topicCount?: number;
  /** A file was uploaded, so the first step is reading it. */
  hasDocument?: boolean;
  /** Student-facing exam tips. Off for tutors setting a paper. */
  showTips?: boolean;
}

const TIPS = [
  "Read the command word first. “State” wants one fact; “Explain” wants a reason.",
  "Check the marks. A 3-mark question usually needs three separate points.",
  "Show your working in calculations. You can pick up method marks even if the final answer is wrong.",
  "Use the data in the question. Quote a figure from the table or graph when asked to describe it.",
  "Link your points with “because”, “so” or “which means”. That turns a statement into an explanation.",
  "For “Evaluate” questions, weigh up both sides, then reach a conclusion.",
  "Don’t leave a multiple-choice question blank. A blank can’t score; a guess might.",
];

const TIP_INTERVAL_MS = 9000;

const EXAM_STEPS = [
  "Writing fresh questions",
  "Handling diagrams and formatting",
  "Matching your specification",
];

const formatElapsed = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Shimmering placeholder bar. The shimmer overlay stops under reduced motion,
 * leaving a plain static bar.
 */
function Shim({ className = "", delayMs = 0 }: { className?: string; delayMs?: number }) {
  return (
    <div className={"relative overflow-hidden bg-muted/60 " + className}>
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer motion-reduce:animate-none"
        style={{
          animationDelay: `${delayMs}ms`,
          backgroundImage:
            "linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.08), transparent)",
        }}
      />
    </div>
  );
}

/**
 * Loading state for exam / practice generation.
 *
 * Shows what is being built (from values the page already holds), the working
 * steps, an elapsed timer and an exam tip. It deliberately has no percentage
 * or ticked-off steps: the page only learns "done" or "failed", so any
 * progress figure would be invented.
 *
 * Sits above app chrome (z-[100]) so FABs / tab bars don't leak through.
 * Colours are semantic tokens; subjectColor tints the header band and accents.
 */
export function GenerationLoadingScreen({
  subjectColor,
  variant = "exam",
  title,
  board,
  tier,
  questionCount,
  topicCount,
  hasDocument = false,
  showTips = true,
}: GenerationLoadingScreenProps) {
  const reduced = useReducedMotion();
  const accent = subjectColor || "hsl(var(--primary))";

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  useEffect(() => {
    if (!showTips) return;
    const id = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), TIP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [showTips]);

  const kicker = variant === "practice" ? "Creating practice questions" : "Building your paper";
  const headline = title?.trim() || "";

  const tags = [
    board?.trim() || "",
    tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "",
    typeof questionCount === "number" && questionCount > 0 ? plural(questionCount, "question", "questions") : "",
    typeof topicCount === "number" && topicCount > 0 ? plural(topicCount, "topic", "topics") : "",
  ].filter((t) => t && t !== headline);

  const steps =
    variant === "practice"
      ? []
      : hasDocument
      ? ["Reading your document", ...EXAM_STEPS]
      : EXAM_STEPS;

  return (
    <div
      className="fixed inset-0 z-[100] bg-background text-foreground overflow-y-auto"
      aria-busy="true"
    >
      {/* Only this line is announced. The timer and tips change constantly
          and would flood a screen reader if the whole overlay were live. */}
      <span role="status" className="sr-only">
        {kicker}. Please wait.
      </span>

      {/* Honest indeterminate bar. Under reduced motion it holds still. */}
      <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-border/40" aria-hidden="true">
        <div
          className="h-full w-1/3 animate-indeterminate-bar rounded-full motion-reduce:animate-none motion-reduce:w-full motion-reduce:opacity-50"
          style={{ backgroundColor: accent }}
        />
      </div>

      <div className="min-h-full flex items-center justify-center px-4 py-10" aria-hidden="true">
        <div className="w-full max-w-md sm:max-w-lg space-y-3">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div
              className="px-5 pt-4 pb-4"
              style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 65%, black))` }}
            >
              {headline ? (
                <>
                  <div className="text-11 text-white/80 mb-1">{kicker}</div>
                  <div className="text-17 font-semibold text-white leading-snug break-words">{headline}</div>
                </>
              ) : (
                <div className="text-17 font-semibold text-white leading-snug">{kicker}</div>
              )}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {tags.map((tag) => (
                    <span key={tag} className="text-11 px-2.5 py-1 rounded-md bg-white/20 text-white">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {steps.length > 0 && (
              <ul className="px-5 divide-y divide-border">
                {steps.map((step, i) => (
                  <li key={step} className="flex items-center gap-3 py-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full border-[1.5px] shrink-0"
                      style={{ borderColor: accent }}
                    />
                    <span className="flex-1 text-sm text-foreground">{step}</span>
                    <Shim className="w-11 h-1.5 rounded-full" delayMs={i * 350} />
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between px-5 py-2.5 border-t border-border bg-muted/40">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                <Clock className="w-3.5 h-3.5" />
                {formatElapsed(elapsed)}
              </span>
              <span className="text-xs text-muted-foreground">Ready when it&rsquo;s ready</span>
            </div>
          </div>

          {showTips && (
            <div className="rounded-2xl border border-border bg-card px-5 py-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-11 text-muted-foreground">While you wait</span>
                <span className="flex items-center gap-1">
                  {TIPS.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1 rounded-full transition-all ${
                        i === tipIndex ? "w-3.5 bg-foreground/60" : "w-1 bg-border"
                      }`}
                    />
                  ))}
                </span>
              </div>
              <motion.p
                key={tipIndex}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="text-sm leading-relaxed text-foreground min-h-[3.25rem]"
              >
                {TIPS[tipIndex]}
              </motion.p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

