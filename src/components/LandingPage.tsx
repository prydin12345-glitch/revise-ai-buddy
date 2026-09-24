// FILE: src/components/LandingPage.tsx
// Examly landing v2 — the exam theatre takes the stage.
// Audit-driven rework: theatre is the hero centrepiece with product chrome,
// serif display headings (the exam-paper metaphor in the type itself),
// distinct textures per section, honest trust signals, legal footer.

import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView, useReducedMotion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  PenLine, Sparkles, CheckCircle2, Upload, Users, LineChart, Timer,
  GraduationCap, ArrowRight, Menu, X, FunctionSquare, FileText, BadgeCheck,
  ChevronLeft, ChevronRight,
} from "lucide-react";

/* ───────────────────────── Exam theatre v2 ─────────────────────────
   Five acts on a loop: TYPE → GENERATE → the question WRITES itself →
   the curve SKETCHES → marks TICK in (held long enough to land).
   Chrome is the product's own: subject pill, timer, marks total.      */

type Act = "typing" | "generating" | "writing" | "sketching" | "marked";

/* ── Theatre content: three subjects on rotation ──
   Pure display data — no state, no side effects. The Act state machine below
   is unchanged; this only decides *what* it renders on a given loop. Adding a
   subject means adding an entry here, nothing else. */

interface TheatreTimers {
  writing: string;
  sketching: string;
  marked: string;
}

interface TheatreBase {
  subject: string;
  topic: string;
  qLabel: string;
  question: string;
  marksTotal: number;
  marksAwarded: number;
  timers: TheatreTimers;
  feedback: string;
}

interface TheatreGraphExample extends TheatreBase {
  kind: "graph";
  /** SVG path `d` for the self-drawing curve, in the shared 300×200 grid. */
  graphPath: string;
  /** Extra annotations (points, shading, labels) revealed once marked. */
  markedOverlay: JSX.Element;
}

interface TheatreMcqExample extends TheatreBase {
  kind: "mcq";
  options: { key: string; text: string }[];
  correctKey: string;
}

type TheatreExample = TheatreGraphExample | TheatreMcqExample;

const THEATRE_EXAMPLES: TheatreExample[] = [
  {
    kind: "graph",
    subject: "A-Level Maths",
    topic: "A-Level Maths · Sketching quadratics",
    qLabel: "Q2",
    question:
      "The curve C has equation y = x\u00b2 \u2212 6x + 5.  Sketch C, showing the coordinates of the turning point and any points where C crosses the axes.",
    marksTotal: 3,
    marksAwarded: 3,
    timers: { writing: "0:21", sketching: "0:39", marked: "0:47" },
    feedback: "Turning point (3, \u22124) correct; both intercepts labelled. Full marks.",
    // y = x²−6x+5 · origin (60,130) · 20px/x · 10px/y
    graphPath: "M 60 80 C 73 114, 88 142, 105 160 C 113 168, 127 168, 135 160 C 152 142, 167 114, 180 80",
    markedOverlay: (
      <g>
        <circle cx={80} cy={130} r={3} fill="hsl(var(--primary))" />
        <circle cx={160} cy={130} r={3} fill="hsl(var(--primary))" />
        <circle cx={120} cy={170} r={3} fill="hsl(var(--primary))" />
        <text x={128} y={178} fontSize="9" fill="hsl(var(--muted-foreground))">(3, \u22124)</text>
        <text x={76} y={124} fontSize="9" fill="hsl(var(--muted-foreground))">1</text>
        <text x={156} y={124} fontSize="9" fill="hsl(var(--muted-foreground))">5</text>
      </g>
    ),
  },
  {
    kind: "graph",
    subject: "GCSE Physics",
    topic: "GCSE Physics · Motion graphs",
    qLabel: "Q4",
    question:
      "The velocity\u2013time graph shows a cyclist's journey. Calculate the total distance travelled in the first 8 seconds.",
    marksTotal: 4,
    marksAwarded: 4,
    timers: { writing: "0:24", sketching: "0:42", marked: "0:53" },
    feedback: "Area under the graph = 48 m. All three sections identified and calculated correctly. Full marks.",
    // v/t trapezium · origin (60,130) · accelerate 0\u21923s, constant 3\u21925s, decelerate 5\u21928s
    graphPath: "M 60 130 L 135 40 L 185 40 L 260 130",
    markedOverlay: (
      <g>
        <polygon points="60,130 135,40 185,40 260,130" fill="hsl(var(--primary))" fillOpacity={0.12} />
        <circle cx={135} cy={40} r={3} fill="hsl(var(--primary))" />
        <circle cx={185} cy={40} r={3} fill="hsl(var(--primary))" />
        <text x={128} y={30} fontSize="9" fill="hsl(var(--muted-foreground))">d = 48 m</text>
      </g>
    ),
  },
  {
    kind: "mcq",
    subject: "GCSE Chemistry",
    topic: "GCSE Chemistry · Rates of reaction",
    qLabel: "Q1",
    question:
      "Which change would increase the rate of reaction between magnesium and dilute hydrochloric acid?",
    marksTotal: 1,
    marksAwarded: 1,
    timers: { writing: "0:14", sketching: "0:16", marked: "0:19" },
    feedback: "Higher temperature increases particle energy and collision frequency, so the reaction rate increases. Correct.",
    options: [
      { key: "A", text: "Using a lower concentration of acid" },
      { key: "B", text: "Using larger pieces of magnesium" },
      { key: "C", text: "Increasing the temperature of the acid" },
      { key: "D", text: "Removing the catalyst" },
    ],
    correctKey: "C",
  },
];

const useTypewriter = (text: string, active: boolean, speed = 28) => {
  const [shown, setShown] = useState(active ? "" : text);
  useEffect(() => {
    if (!active) { setShown(text); return; }
    setShown("");
    let i = 0;
    const t = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(t);
    }, speed);
    return () => clearInterval(t);
  }, [text, active, speed]);
  return shown;
};

/** Faded side card — a glanceable title card, not a full replica of the live
 *  paper (too little room at this width for that to read well). Click jumps
 *  straight to it. Height matches the stage's min-height so the row stays
 *  visually aligned regardless of which example is centred. */
const TheatrePeek = ({
  example, onClick, ariaLabel,
}: { example: TheatreExample; onClick: () => void; ariaLabel: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    className="hidden xl:flex flex-col shrink-0 w-[130px] h-[560px] sm:h-[400px] rounded-2xl border border-border bg-card p-4 opacity-40 hover:opacity-70 focus-visible:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-opacity text-left"
  >
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 w-fit">
      <GraduationCap className="h-2.5 w-2.5" />
      {example.subject}
    </span>
    <p className="font-serif text-xs leading-relaxed text-foreground mt-3 line-clamp-[10]">
      {example.question}
    </p>
  </button>
);

const NavArrow = ({
  side, onClick,
}: { side: "left" | "right"; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={side === "left" ? "Previous example" : "Next example"}
    className="hidden md:flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
    {side === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
  </button>
);

const ExamTheatre = () => {
  const reduced = useReducedMotion();
  const [act, setAct] = useState<Act>(reduced ? "marked" : "typing");
  const [cycle, setCycle] = useState(0);
  // Which way the slide transition animates from — purely decorative, no
  // bearing on which example is shown (that's `cycle` alone, as before).
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (reduced) return;
    // Durations sum to 20s — the carousel settles into an auto-advance
    // every ~20 seconds, using the same clock that already drove the
    // single-card loop rather than a second, competing timer.
    const durations: Record<Act, number> = {
      typing: 2300, generating: 1400, writing: 4300, sketching: 2600, marked: 9400,
    };
    const order: Act[] = ["typing", "generating", "writing", "sketching", "marked"];
    const idx = order.indexOf(act);
    const t = setTimeout(() => {
      if (idx === order.length - 1) { setDirection(1); setCycle((c) => c + 1); setAct("typing"); }
      else setAct(order[idx + 1]);
    }, durations[act]);
    return () => clearTimeout(t);
  }, [act, reduced]);

  const len = THEATRE_EXAMPLES.length;
  const activeIndex = ((cycle % len) + len) % len;
  const example = THEATRE_EXAMPLES[activeIndex];
  const prevExample = THEATRE_EXAMPLES[(activeIndex - 1 + len) % len];
  const nextExample = THEATRE_EXAMPLES[(activeIndex + 1) % len];

  // Manual navigation (arrow, peek, dot, swipe) resets the act machine for
  // the newly-centred example — the exact same reset the natural end of a
  // loop already performs, just triggered early instead of by the timeout.
  const goBy = (delta: number) => {
    setDirection(delta > 0 ? 1 : -1);
    setCycle((c) => c + delta);
    setAct("typing");
  };
  const goToIndex = (target: number) => {
    const forward = (target - activeIndex + len) % len;
    const backward = (activeIndex - target + len) % len;
    goBy(forward <= backward ? forward : -backward);
  };

  const typedTopic = useTypewriter(example.topic, !reduced && act === "typing", 45);
  const typedQuestion = useTypewriter(example.question, !reduced && act === "writing", 22);
  const questionVisible = act !== "typing" && act !== "generating";
  const questionText = act === "writing" ? typedQuestion : questionVisible ? example.question : "";
  const sketchOn = act === "sketching" || act === "marked";
  const marked = act === "marked";

  const slideVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 36 : -36 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -36 : 36 }),
  };

  return (
    <div className="relative w-full select-none">
      <div className="flex items-center justify-center gap-3 md:gap-4">
        <NavArrow side="left" onClick={() => goBy(-1)} />
        <TheatrePeek example={prevExample} onClick={() => goBy(-1)} ariaLabel={`Show the ${prevExample.subject} example`} />

        {/* Fixed-height stage: the card never visibly resizes switching
            between the two-column graph layout and the single-column MCQ
            layout — min-height is a floor, so it only ever grows, never jumps
            smaller. (Sized generously from the tallest variant; nudge if the
            live preview shows extra headroom either way.) */}
        <div className="relative w-full max-w-[680px] min-h-[560px] sm:min-h-[400px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={cycle}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
              drag={reduced ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.65}
              onDragEnd={(_, info) => {
                if (info.offset.x < -70) goBy(1);
                else if (info.offset.x > 70) goBy(-1);
              }}
              className="absolute inset-0 rounded-2xl border border-border bg-card shadow-[0_32px_80px_-28px_hsl(var(--primary)/0.4)] overflow-hidden cursor-grab active:cursor-grabbing md:cursor-default"
            >
              {/* Product chrome: subject pill · timer · running marks total */}
              <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-secondary/60">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1">
                  <GraduationCap className="h-3 w-3" />
                  {example.subject}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  {marked ? example.timers.marked : act === "sketching" ? example.timers.sketching : questionVisible ? example.timers.writing : "0:00"}
                </span>
                <span className="ml-auto text-xs font-medium text-muted-foreground">
                  Marks: <span className={marked ? "text-green-600 font-semibold" : ""}>{marked ? example.marksAwarded : 0}</span> / {example.marksTotal}
                </span>
              </div>

              <div className="p-4 sm:p-6 space-y-4" aria-hidden="true">
                {/* Topic input */}
                <div className="rounded-xl border border-border bg-background px-3.5 py-2.5 flex items-center gap-2.5">
                  <PenLine className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm text-foreground min-h-[1.25rem]">
                    {act === "typing" ? typedTopic : example.topic}
                    {act === "typing" && <span className="inline-block w-[2px] h-4 ml-px bg-primary align-middle animate-pulse" />}
                  </span>
                </div>

                <AnimatePresence>
                  {act === "generating" && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-sm text-muted-foreground px-1"
                    >
                      <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                      Writing your paper…
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* The exam paper */}
                <AnimatePresence>
                  {questionVisible && (
                    <motion.div
                      initial={reduced ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={
                        example.kind === "graph"
                          ? "rounded-xl border border-border bg-background overflow-hidden grid sm:grid-cols-[1fr_300px]"
                          : "rounded-xl border border-border bg-background overflow-hidden"
                      }
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
                          <span className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold px-2 py-1">
                            {example.qLabel}
                          </span>
                          <span className="text-xs text-muted-foreground pt-1 shrink-0">
                            ({example.marksTotal} mark{example.marksTotal === 1 ? "" : "s"})
                          </span>
                        </div>
                        <p className="font-serif text-sm leading-relaxed text-foreground px-4 pt-2 pb-3 min-h-[5rem]">
                          {questionText}
                          {act === "writing" && <span className="inline-block w-[2px] h-4 ml-px bg-foreground/60 align-middle animate-pulse" />}
                        </p>

                        {/* Multiple-choice options — this subject has no graph to sketch */}
                        {example.kind === "mcq" && questionVisible && (
                          <div className="px-4 pb-2 space-y-1.5">
                            {example.options.map((opt) => {
                              const isCorrect = opt.key === example.correctKey;
                              return (
                                <div
                                  key={opt.key}
                                  className={
                                    "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors " +
                                    (marked && isCorrect
                                      ? "border-green-600/40 bg-green-500/10"
                                      : marked
                                      ? "border-border opacity-50"
                                      : "border-border")
                                  }
                                >
                                  <span
                                    className={
                                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold " +
                                      (marked && isCorrect
                                        ? "border-green-600 text-green-700 dark:text-green-400"
                                        : "border-muted-foreground/40 text-muted-foreground")
                                    }
                                  >
                                    {opt.key}
                                  </span>
                                  <span className="text-foreground">{opt.text}</span>
                                  {marked && isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto shrink-0" />}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="px-4 pb-4 min-h-[3.4rem]">
                          <AnimatePresence>
                            {marked && (
                              <motion.div
                                initial={reduced ? false : { opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-start gap-2 rounded-lg border border-green-600/30 bg-green-500/10 px-3 py-2"
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-foreground">
                                  <span className="font-semibold text-green-700 dark:text-green-400">{example.marksAwarded}/{example.marksTotal}.</span>{" "}
                                  {example.feedback}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Graph paper + self-sketching curve — only for graph-kind subjects */}
                      {example.kind === "graph" && (
                        <div className="border-t sm:border-t-0 sm:border-l border-border relative">
                          <svg viewBox="0 0 300 200" className="w-full block bg-background">
                            {Array.from({ length: 14 }).map((_, i) => (
                              <line key={`v${i}`} x1={20 + i * 20} y1={10} x2={20 + i * 20} y2={190} stroke="hsl(var(--border))" strokeWidth="0.6" />
                            ))}
                            {Array.from({ length: 9 }).map((_, i) => (
                              <line key={`h${i}`} x1={20} y1={20 + i * 20} x2={280} y2={20 + i * 20} stroke="hsl(var(--border))" strokeWidth="0.6" />
                            ))}
                            <line x1={20} y1={130} x2={280} y2={130} stroke="hsl(var(--muted-foreground))" strokeWidth="1.1" />
                            <line x1={60} y1={10} x2={60} y2={190} stroke="hsl(var(--muted-foreground))" strokeWidth="1.1" />
                            <motion.path
                              d={example.graphPath}
                              fill="none"
                              stroke="hsl(var(--primary))"
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              initial={{ pathLength: reduced ? 1 : 0 }}
                              animate={{ pathLength: sketchOn ? 1 : 0 }}
                              transition={{ duration: reduced ? 0 : 2.1, ease: "easeInOut" }}
                            />
                            {marked && example.markedOverlay}
                          </svg>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <TheatrePeek example={nextExample} onClick={() => goBy(1)} ariaLabel={`Show the ${nextExample.subject} example`} />
        <NavArrow side="right" onClick={() => goBy(1)} />
      </div>

      {/* Pagination — also answers "how many examples are there" at a glance */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        {THEATRE_EXAMPLES.map((ex, i) => (
          <button
            key={ex.subject}
            type="button"
            onClick={() => goToIndex(i)}
            aria-label={`Show the ${ex.subject} example`}
            aria-current={i === activeIndex}
            className={
              "h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
              (i === activeIndex ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40")
            }
          />
        ))}
      </div>
    </div>
  );
};

/* ───────────────────────── Feature vignettes ─────────────────────────
   Product evidence, not adjectives: each feature card carries a small
   faithful mock of the real UI element it describes.                  */

const SketchVignette = () => (
  <svg viewBox="0 0 220 90" className="w-full rounded-lg border border-border bg-background">
    {Array.from({ length: 11 }).map((_, i) => (
      <line key={i} x1={i * 22} y1={0} x2={i * 22} y2={90} stroke="hsl(var(--border))" strokeWidth="0.5" />
    ))}
    {Array.from({ length: 5 }).map((_, i) => (
      <line key={i} x1={0} y1={i * 22} x2={220} y2={i * 22} stroke="hsl(var(--border))" strokeWidth="0.5" />
    ))}
    <path d="M 20 70 Q 110 -25 200 70" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
    <circle cx={110} cy={23} r={4} fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="1.8" />
    <circle cx={20} cy={70} r={3.5} fill="hsl(var(--primary))" />
    <circle cx={200} cy={70} r={3.5} fill="hsl(var(--primary))" />
  </svg>
);

const MarkingVignette = () => (
  <div className="rounded-lg border border-border bg-background p-3 space-y-1.5 text-xs">
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">Method — completing the square</span>
      <span className="font-semibold text-green-600">M1 ✓</span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">Accuracy — turning point stated</span>
      <span className="font-semibold text-green-600">A1 ✓</span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">Accuracy — intercepts labelled</span>
      <span className="font-semibold text-danger">A0 ✗</span>
    </div>
    <div className="pt-1 border-t border-border text-muted-foreground">
      "State (0, 5) on the y-axis — the sketch is right, the label is missing."
    </div>
  </div>
);

const UploadVignette = () => (
  <div className="rounded-lg border border-border bg-background p-3 space-y-2">
    <div className="flex items-center gap-2 text-xs">
      <FileText className="h-3.5 w-3.5 text-primary" />
      <span className="font-medium">June-2023-Paper-2.pdf</span>
      <span className="ml-auto text-muted-foreground">14 questions found</span>
    </div>
    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
      <div className="h-full w-[86%] rounded-full bg-primary" />
    </div>
    <div className="flex gap-1.5 flex-wrap">
      {["MCQ × 4", "Graphs × 3", "Multi-part × 5", "Tables × 2"].map((t) => (
        <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{t}</span>
      ))}
    </div>
  </div>
);

const HeatmapVignette = () => (
  <div className="rounded-lg border border-border bg-background p-3">
    <div className="grid grid-cols-12 gap-1">
      {[0.1, 0.4, 0.2, 0.7, 0.9, 0.3, 0, 0.6, 0.8, 1, 0.5, 0.2,
        0.3, 0, 0.6, 0.9, 0.4, 0.7, 0.2, 0.8, 1, 0.3, 0.6, 0.9].map((v, i) => (
        <span key={i} className="aspect-square rounded-[3px]"
          style={{ background: v === 0 ? "hsl(var(--secondary))" : `hsl(var(--primary) / ${0.25 + v * 0.65})` }} />
      ))}
    </div>
    <p className="mt-2 text-xs text-muted-foreground">23 sessions · strongest: algebra · revise next: vectors</p>
  </div>
);

const FEATURES = [
  {
    icon: FunctionSquare,
    title: "Draw your answer",
    body: "Sketch curves, plot points and measure angles on an interactive canvas — your drawing gets marked, not just your typing.",
    vignette: SketchVignette,
  },
  {
    icon: BadgeCheck,
    title: "Method marks, not just right or wrong",
    body: "Method marks and accuracy marks broken down against the mark scheme, with feedback on exactly what was missing.",
    vignette: MarkingVignette,
  },
  {
    icon: Upload,
    title: "Any past paper becomes practice",
    body: "Upload a PDF and Examly extracts the questions — graphs, sub-parts and all — into an exam you sit on screen.",
    vignette: UploadVignette,
  },
  {
    icon: LineChart,
    title: "See yourself improve",
    body: "Every session feeds a heatmap and per-topic scores, so the night before the exam isn't a guess.",
    vignette: HeatmapVignette,
  },
];

const STEPS = [
  { icon: PenLine, title: "Tell it your topic", body: "Pick your subject, level and topics — or upload a past paper and Examly reads it." },
  { icon: Sparkles, title: "Your paper writes itself", body: "Exam-style questions in seconds: MCQs, calculations, data tables, sketch graphs." },
  { icon: BadgeCheck, title: "Marked in seconds", body: "Answer on screen — draw the curve, show your working — and get method marks with feedback." },
];

const PLANS = [
  {
    name: "Free",
    price: "£0",
    period: "",
    blurb: "Real generated papers, properly marked",
    features: ["Generated practice sets with AI marking", "Interactive graph questions", "Progress tracking", "Fair-use daily limits"],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Student Pro",
    price: "£7.99",
    period: "/month",
    blurb: "For serious exam season",
    features: ["Everything in Free", "Unlimited paper generation", "Past-paper PDF upload", "Full examiner feedback breakdowns"],
    cta: "Go Pro",
    highlighted: true,
  },
];

/* ───────────────────────── Shared bits ───────────────────────── */

const Reveal = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const reduced = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduced ? false : { opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.55, delay }}
    >
      {children}
    </motion.div>
  );
};

const NAV_LINKS: Array<[string, string]> = [
  ["How it works", "how"],
  ["Features", "features"],
  ["For tutors", "tutors"],
  ["Pricing", "pricing"],
];

/* ───────────────────────── Page ───────────────────────── */

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Nav: transparent at rest, blur + border after 10px (house convention)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const paperGrid = useMemo(
    () => ({
      backgroundImage:
        "linear-gradient(hsl(var(--border)/0.55) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)/0.55) 1px, transparent 1px)",
      backgroundSize: "32px 32px",
    }),
    []
  );
  const dotGrid = useMemo(
    () => ({
      backgroundImage: "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
      backgroundSize: "22px 22px",
    }),
    []
  );
  const ruledLines = useMemo(
    () => ({
      backgroundImage: "linear-gradient(hsl(var(--border)/0.5) 1px, transparent 1px)",
      backgroundSize: "100% 36px",
    }),
    []
  );

  const goSignup = () => navigate("/auth?mode=signup");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-border/60 bg-background/80 backdrop-blur-md shadow-sm" : "border-b border-transparent bg-transparent"}`}>
        <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-[18px] w-[18px]" />
            </span>
            <span className="font-bold text-lg tracking-tight">Examly</span>
          </button>

          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(([label, id]) => (
              <Button key={id} variant="ghost" size="sm"
                onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })}>
                {label}
              </Button>
            ))}
            <div className="w-px h-5 bg-border mx-2" />
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth?mode=login")}>Log in</Button>
            <Button size="sm" onClick={goSignup}>Start free</Button>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileOpen((v) => !v)} aria-label="Menu">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="md:hidden fixed inset-0 top-16 bg-foreground/20 backdrop-blur-[2px]"
                onClick={() => setMobileOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="md:hidden relative border-t border-border bg-background px-4 py-3 space-y-1 shadow-lg"
              >
                {NAV_LINKS.map(([label, id]) => (
                  <button key={id} className="block w-full text-left py-2.5 text-sm font-medium"
                    onClick={() => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); setMobileOpen(false); }}>
                    {label}
                  </button>
                ))}
                <div className="flex gap-2 pt-3 pb-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate("/auth?mode=login")}>Log in</Button>
                  <Button size="sm" className="flex-[2]" onClick={goSignup}>Start free</Button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero: the theatre IS the hero ── */}
      <section className="relative pt-28 pb-20 sm:pt-32 sm:pb-24 px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={paperGrid} />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-background/30 to-background" />

        <div className="relative max-w-2xl">
          <Reveal>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.06]">
              A full exam-style paper
              <br />
              in under a minute.
              <span className="block text-primary mt-1">Marked like an examiner.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-lg">
              Pick a topic. Examly writes the paper, you sit it on screen, and every answer —
              even the graphs you draw — comes back with method marks and feedback.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              <Button size="lg" className="text-base px-8 w-fit" onClick={goSignup}>
                Generate your first paper
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-xs text-muted-foreground">Free to start · No card needed</p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.26} className="relative mt-12">
          <ExamTheatre />
          <p className="text-center text-xs text-muted-foreground mt-3">
            Live preview — this is the product, not a video.
          </p>
        </Reveal>

        {/* Trust line — honest until real numbers exist */}
        <Reveal delay={0.32}>
          <p className="relative mt-10 text-center text-xs sm:text-sm text-muted-foreground tracking-wide">
            Aligned to <span className="font-semibold text-foreground">AQA</span>,{" "}
            <span className="font-semibold text-foreground">Edexcel</span> and{" "}
            <span className="font-semibold text-foreground">OCR</span> specifications · GCSE · A-Level · BTEC
          </p>
        </Reveal>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">From topic to marked paper</h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              The whole loop takes under a minute — it's the sequence playing above.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.1}>
                <div className="relative h-full rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <step.icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Step {i + 1}</span>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features with product vignettes ── */}
      <section id="features" className="relative py-24 px-4 border-y border-border bg-secondary/30">
        <div className="absolute inset-0 pointer-events-none opacity-60" style={dotGrid} />
        <div className="relative max-w-6xl mx-auto">
          <Reveal className="text-center mb-14">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">Not flashcards. Real exam questions.</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              The question types that actually appear on your paper, answered the way you would in the hall.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-border bg-card p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <f.icon className="h-[18px] w-[18px]" />
                    </span>
                    <h3 className="font-semibold text-lg">{f.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{f.body}</p>
                  <div className="mt-auto">
                    <f.vignette />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tutors ── */}
      <section id="tutors" className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-50" style={ruledLines} />
        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card text-xs text-muted-foreground mb-5">
              <Users className="h-3.5 w-3.5" />
              For tutors
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">
              Set a paper for your class in the time it takes to take the register.
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Upload last year's paper or generate a fresh one, assign it to your class, and watch
              results come in — marked, with method marks broken down per student. Your Sunday
              evenings are yours again.
            </p>
            <Button className="mt-6" size="lg" onClick={goSignup}>
              Create your first class
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                The tutor dashboard
              </p>
              <div className="space-y-3">
                {[
                  { icon: FileText, label: "Mock Paper 2 — Algebra & Graphs", meta: "Assigned · due Friday" },
                  { icon: BadgeCheck, label: "Class results, per question", meta: "Method and accuracy marks for every student" },
                  { icon: LineChart, label: "Topic gaps at a glance", meta: "See which topics the whole class is missing" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                    <row.icon className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{row.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{row.meta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 px-4 bg-secondary/30 border-y border-border">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">Less than one hour of tutoring</h2>
            <p className="mt-3 text-muted-foreground">Start free. Upgrade when exam season gets serious.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 0.1}>
                <div className={`relative h-full rounded-2xl border p-6 flex flex-col ${plan.highlighted ? "border-primary bg-card shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.4)]" : "border-border bg-card"}`}>
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.blurb}</p>
                  <p className="mt-4 mb-5">
                    <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </p>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <Button variant={plan.highlighted ? "default" : "outline"} className="w-full" onClick={goSignup}>
                    {plan.cta}
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA — contrasting band to land the close ── */}
      <section className="py-24 px-4 bg-primary text-primary-foreground">
        <Reveal className="max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            For students who'd rather practise than panic.
          </h2>
          <p className="mt-5 text-primary-foreground">
            Generate it, sit it, get it marked — before your kettle boils.
          </p>
          <Button
            size="lg"
            className="mt-8 text-base px-8 bg-background text-foreground hover:bg-background/90"
            onClick={goSignup}
          >
            Generate your first paper
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-4 w-4" />
              </span>
              <span className="font-semibold">Examly</span>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <button onClick={() => navigate("/privacy")} className="hover:text-foreground transition-colors">Privacy</button>
              <button onClick={() => navigate("/terms")} className="hover:text-foreground transition-colors">Terms</button>
              <a href="mailto:hello@examly.app" className="hover:text-foreground transition-colors">Contact</a>
            </nav>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Examly. Examly is independent practice software and is not
            affiliated with or endorsed by AQA, Pearson Edexcel or OCR.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
