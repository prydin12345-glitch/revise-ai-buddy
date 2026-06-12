// FILE: src/components/LandingPage.tsx
// Examly landing page — "the exam writes itself."
// Signature element: a self-playing exam theatre in the hero where a real
// question generates, a graph sketches itself, and examiner marks tick in.
// Visual language borrowed from actual UK exam papers: serif question text,
// marks in the right gutter, graph-paper texture, examiner-green ticks.

import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView, useReducedMotion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  PenLine, Sparkles, CheckCircle2, Upload, Users, LineChart,
  GraduationCap, ArrowRight, Menu, X, FunctionSquare, FileText, BadgeCheck,
} from "lucide-react";

/* ───────────────────────── Exam theatre ─────────────────────────
   A four-act loop: TYPE the topic → GENERATE shimmer → the QUESTION
   writes itself → the curve SKETCHES on the grid → marks TICK in.   */

const TOPIC_TEXT = "A-Level Maths · Sketching quadratics";
const QUESTION_TEXT =
  "The curve C has equation y = x\u00b2 \u2212 6x + 5.  Sketch C, showing the coordinates of the turning point and any points where C crosses the axes.";

type Act = "typing" | "generating" | "writing" | "sketching" | "marked";

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

const ExamTheatre = () => {
  const reduced = useReducedMotion();
  const [act, setAct] = useState<Act>(reduced ? "marked" : "typing");
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const durations: Record<Act, number> = {
      typing: 2300, generating: 1400, writing: 4300, sketching: 2600, marked: 3600,
    };
    const order: Act[] = ["typing", "generating", "writing", "sketching", "marked"];
    const idx = order.indexOf(act);
    const t = setTimeout(() => {
      if (idx === order.length - 1) { setCycle((c) => c + 1); setAct("typing"); }
      else setAct(order[idx + 1]);
    }, durations[act]);
    return () => clearTimeout(t);
  }, [act, reduced]);

  const typedTopic = useTypewriter(TOPIC_TEXT, !reduced && act === "typing", 45);
  const typedQuestion = useTypewriter(QUESTION_TEXT, !reduced && act === "writing", 22);
  const questionVisible = act !== "typing" && act !== "generating";
  const questionText = act === "writing" ? typedQuestion : questionVisible ? QUESTION_TEXT : "";
  const sketchOn = act === "sketching" || act === "marked";
  const marked = act === "marked";

  return (
    <div className="relative w-full max-w-[520px] mx-auto select-none" aria-hidden="true">
      <div className="rounded-2xl border border-border bg-card shadow-[0_24px_60px_-24px_hsl(var(--primary)/0.35)] overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/60">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          <div className="ml-3 flex-1 rounded-md bg-background/80 border border-border px-3 py-1 text-[11px] text-muted-foreground truncate">
            examly · new practice set
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Topic input */}
          <div className="rounded-xl border border-border bg-background px-3.5 py-2.5 flex items-center gap-2.5">
            <PenLine className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm text-foreground min-h-[1.25rem]">
              {act === "typing" ? typedTopic : TOPIC_TEXT}
              {act === "typing" && <span className="inline-block w-[2px] h-4 ml-px bg-primary align-middle animate-pulse" />}
            </span>
          </div>

          {/* Generating shimmer */}
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
                key={`paper-${cycle}`}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-background overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
                  <span className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold px-2 py-1">
                    Q2
                  </span>
                  <span className="text-xs text-muted-foreground pt-1 shrink-0">(3 marks)</span>
                </div>
                <p className="font-serif text-[13.5px] leading-relaxed text-foreground px-4 pt-2 pb-3 min-h-[4.2rem]">
                  {questionText}
                  {act === "writing" && <span className="inline-block w-[2px] h-4 ml-px bg-foreground/60 align-middle animate-pulse" />}
                </p>

                {/* Graph paper + self-sketching curve */}
                <div className="mx-4 mb-3 rounded-lg border border-border overflow-hidden">
                  <svg viewBox="0 0 300 170" className="w-full block bg-background">
                    {Array.from({ length: 14 }).map((_, i) => (
                      <line key={`v${i}`} x1={20 + i * 20} y1={8} x2={20 + i * 20} y2={162} stroke="hsl(var(--border))" strokeWidth="0.6" />
                    ))}
                    {Array.from({ length: 8 }).map((_, i) => (
                      <line key={`h${i}`} x1={20} y1={10 + i * 20} x2={280} y2={10 + i * 20} stroke="hsl(var(--border))" strokeWidth="0.6" />
                    ))}
                    {/* axes: origin (60,110) · x: 20px/unit · y: 10px/unit */}
                    <line x1={20} y1={110} x2={280} y2={110} stroke="hsl(var(--muted-foreground))" strokeWidth="1.1" />
                    <line x1={60} y1={8} x2={60} y2={162} stroke="hsl(var(--muted-foreground))" strokeWidth="1.1" />
                    {/* y = x²−6x+5: (0,5)(1,0)(3,−4)(5,0)(6,5) → px (60,60)(80,110)(120,150)(160,110)(180,60) */}
                    <motion.path
                      key={`curve-${cycle}`}
                      d="M 60 60 C 73 94, 88 122, 105 140 C 113 148, 127 148, 135 140 C 152 122, 167 94, 180 60"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      initial={{ pathLength: reduced ? 1 : 0 }}
                      animate={{ pathLength: sketchOn ? 1 : 0 }}
                      transition={{ duration: reduced ? 0 : 2.1, ease: "easeInOut" }}
                    />
                    {marked && (
                      <g>
                        <circle cx={80} cy={110} r={3} fill="hsl(var(--primary))" />
                        <circle cx={160} cy={110} r={3} fill="hsl(var(--primary))" />
                        <circle cx={120} cy={150} r={3} fill="hsl(var(--primary))" />
                        <text x={128} y={158} fontSize="9" fill="hsl(var(--muted-foreground))">(3, −4)</text>
                        <text x={76} y={104} fontSize="9" fill="hsl(var(--muted-foreground))">1</text>
                        <text x={156} y={104} fontSize="9" fill="hsl(var(--muted-foreground))">5</text>
                      </g>
                    )}
                  </svg>
                </div>

                {/* Examiner marking */}
                <div className="px-4 pb-4 min-h-[2.6rem]">
                  <AnimatePresence>
                    {marked && (
                      <motion.div
                        initial={reduced ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-2 rounded-lg border border-green-600/30 bg-green-500/10 px-3 py-2"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-foreground">
                          <span className="font-semibold text-green-700 dark:text-green-400">3/3.</span>{" "}
                          Turning point (3, −4) correct; both intercepts labelled. Full marks.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-3">
        Live preview — this is what generating a set looks like.
      </p>
    </div>
  );
};

/* ───────────────────────── Page data ───────────────────────── */

const STEPS = [
  {
    icon: PenLine,
    title: "Tell it your topic",
    body: "Pick your subject, level and topics — or upload a past paper and Examly reads it.",
  },
  {
    icon: Sparkles,
    title: "Your paper writes itself",
    body: "Exam-style questions appear in seconds: MCQs, calculations, data tables, sketch graphs.",
  },
  {
    icon: BadgeCheck,
    title: "Marked like an examiner",
    body: "Answer on screen — draw the curve, build the working — and get method marks with feedback.",
  },
];

const FEATURES = [
  {
    icon: FunctionSquare,
    title: "Draw your answer",
    body: "Sketch curves, plot points, build circuits and measure angles on an interactive canvas — then have your drawing marked, not just your typing.",
  },
  {
    icon: BadgeCheck,
    title: "Examiner-style marking",
    body: "Method marks and accuracy marks, with feedback that tells you what the mark scheme wanted — not just right or wrong.",
  },
  {
    icon: Upload,
    title: "Turn any past paper into practice",
    body: "Upload a PDF and Examly extracts the questions — graphs, sub-parts and all — into an exam you can sit on screen.",
  },
  {
    icon: LineChart,
    title: "See yourself improve",
    body: "A heatmap of your practice, scores by topic, and the gaps to revise next — so the night before the exam isn't a guess.",
  },
];

const SUBJECTS = ["Maths", "Physics", "Chemistry", "Biology", "Economics", "Computer Science", "Business", "Psychology"];

const PLANS = [
  {
    name: "Free",
    price: "£0",
    period: "",
    blurb: "Try real generated papers",
    features: ["Practice sets with AI marking", "Interactive graph questions", "Progress tracking"],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Student Pro",
    price: "£7.99",
    period: "/month",
    blurb: "Unlimited exam practice",
    features: ["Unlimited generated papers", "Past-paper upload", "Full examiner feedback", "Priority generation"],
    cta: "Go Pro",
    highlighted: true,
  },
];

/* ───────────────────────── Page ───────────────────────── */

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

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const grid = useMemo(
    () => ({
      backgroundImage:
        "linear-gradient(hsl(var(--border)/0.55) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)/0.55) 1px, transparent 1px)",
      backgroundSize: "32px 32px",
    }),
    []
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
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
            <Button size="sm" onClick={() => navigate("/auth?mode=signup")}>Start free</Button>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileOpen((v) => !v)} aria-label="Menu">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 py-3 space-y-2">
            {NAV_LINKS.map(([label, id]) => (
              <button key={id} className="block w-full text-left py-2 text-sm"
                onClick={() => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); setMobileOpen(false); }}>
                {label}
              </button>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate("/auth?mode=login")}>Log in</Button>
              <Button size="sm" className="flex-1" onClick={() => navigate("/auth?mode=signup")}>Start free</Button>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-28 pb-16 sm:pt-32 sm:pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={grid} />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-background/40 to-background" />

        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-8 items-center">
          <div className="text-center lg:text-left">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card text-xs text-muted-foreground mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                GCSE · A-Level · BTEC
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight leading-[1.05]">
                Past-paper practice
                <br />
                that <span className="text-primary">writes itself.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
                Tell Examly your topic. It writes an exam-style paper in seconds — graphs you
                sketch by hand, working it marks like an examiner, feedback that tells you why.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Button size="lg" className="text-base px-7" onClick={() => navigate("/auth?mode=signup")}>
                  Generate your first paper
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="text-base"
                  onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>
                  See how it works
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Free to start · No card needed</p>
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <ExamTheatre />
          </Reveal>
        </div>
      </section>

      {/* ── Subject strip ── */}
      <section className="border-y border-border bg-card/60 py-4">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {SUBJECTS.map((s) => (
            <span key={s} className="text-sm text-muted-foreground whitespace-nowrap">{s}</span>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">From topic to marked paper</h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              The whole loop takes under a minute. It's the sequence playing above.
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

      {/* ── Features ── */}
      <section id="features" className="py-20 px-4 bg-secondary/40 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Not flashcards. Real exam questions.</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Examly generates the question types that actually appear on your paper — and lets you answer them the way you would in the hall.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-border bg-card p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tutors ── */}
      <section id="tutors" className="py-20 px-4">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card text-xs text-muted-foreground mb-5">
              <Users className="h-3.5 w-3.5" />
              For tutors
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Set a paper for your class in the time it takes to take the register.
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Upload last year's paper or generate a fresh one, assign it to your class, and watch
              results come in — marked, with the method marks broken down per student. Your Sunday
              evenings are yours again.
            </p>
            <Button className="mt-6" size="lg" onClick={() => navigate("/auth?mode=signup")}>
              Create your first class
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              {[
                { icon: FileText, label: "Mock Paper 2 — Algebra & Graphs", meta: "Assigned · due Friday" },
                { icon: BadgeCheck, label: "Amara K.", meta: "24/30 · strong on transformations" },
                { icon: BadgeCheck, label: "Josh P.", meta: "19/30 · revisit completing the square" },
                { icon: LineChart, label: "Class average", meta: "71% · up 9% since September" },
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
          </Reveal>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 px-4 bg-secondary/40 border-y border-border">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Less than one hour of tutoring</h2>
            <p className="mt-3 text-muted-foreground">Start free. Upgrade when you're hooked.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 0.1}>
                <div className={`relative h-full rounded-2xl border p-6 flex flex-col ${plan.highlighted ? "border-primary bg-card shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.4)]" : "border-border bg-card"}`}>
                  {plan.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                      Most popular
                    </span>
                  )}
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
                  <Button variant={plan.highlighted ? "default" : "outline"} className="w-full"
                    onClick={() => navigate("/auth?mode=signup")}>
                    {plan.cta}
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={grid} />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-transparent via-background/40 to-background" />
        <Reveal className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Your next paper is 60 seconds away.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Generate it, sit it, get it marked — before your kettle boils.
          </p>
          <Button size="lg" className="mt-8 text-base px-8" onClick={() => navigate("/auth?mode=signup")}>
            Generate your first paper
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="font-semibold">Examly</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Examly. Built for students who'd rather practise than panic.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
