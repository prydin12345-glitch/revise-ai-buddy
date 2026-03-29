import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";

/* ──────────────────────────── helpers ──────────────────────────── */

const useCountUp = (target: number, duration = 2000, inView: boolean) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const inc = target / (duration / 16);
    const t = setInterval(() => {
      start += inc;
      if (start >= target) { setCount(target); clearInterval(t); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(t);
  }, [inView, target, duration]);
  return count;
};

const fmt = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
};

const StatCounter = ({ stat, inView, delay }: { stat: { value: number; suffix: string; label: string; color: string }; inView: boolean; delay: number }) => {
  const count = useCountUp(stat.value, 2000, inView);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className="text-center"
    >
      <div className="text-3xl md:text-4xl font-bold mb-1" style={{ color: stat.color }}>
        {fmt(count)}{stat.suffix}
      </div>
      <div className="text-xs text-muted-foreground tracking-wide uppercase">{stat.label}</div>
    </motion.div>
  );
};

/* ──────────────────────────── data ──────────────────────────── */

const stats = [
  { value: 10000, suffix: "+", label: "Questions Generated", color: "hsl(var(--primary))" },
  { value: 94, suffix: "%", label: "Success Rate", color: "hsl(145 65% 42%)" },
  { value: 1000000, suffix: "+", label: "Tests Created", color: "hsl(263 70% 58%)" },
  { value: 50000, suffix: "+", label: "Active Students", color: "hsl(38 92% 50%)" },
];

const features = [
  { icon: "🧠", title: "AI Question Generation", description: "Generate unlimited original questions for any subject, topic, and difficulty level. Never see the same question twice.", color: "hsl(var(--primary))" },
  { icon: "📊", title: "Smart Progress Tracking", description: "See exactly which topics need work. Your weak areas are identified and targeted automatically.", color: "hsl(145 65% 42%)" },
  { icon: "🎯", title: "Exam Board Accurate", description: "Questions match the style of AQA, Edexcel, OCR, IB, AP and more. Practise exactly what you'll face.", color: "hsl(263 70% 58%)" },
  { icon: "⚡", title: "Instant Feedback", description: "Every answer is marked instantly with detailed explanations. Learn from mistakes in real time.", color: "hsl(38 92% 50%)" },
];

const steps = [
  { number: "01", title: "Set Up Your Profile", description: "Choose your subjects, exam board, and level. Takes 60 seconds.", color: "hsl(var(--primary))" },
  { number: "02", title: "Generate Questions", description: "The AI creates original questions matched exactly to your syllabus.", color: "hsl(263 70% 58%)" },
  { number: "03", title: "Track Your Progress", description: "See weak topics, review mistakes, and improve with every session.", color: "hsl(145 65% 42%)" },
];

const testimonials = [
  { quote: "I went from predicted a C to getting an A* in Maths. The practice questions are exactly what comes up in the real exam.", name: "Sarah K.", role: "A-Level Student", avatar: "SK", color: "hsl(var(--primary))" },
  { quote: "As a tutor, I use Examly to generate tailored questions for each student. It saves me hours every week.", name: "Mr. Thompson", role: "Private Tutor", avatar: "MT", color: "hsl(263 70% 58%)" },
  { quote: "The weak topic tracking is brilliant. I could see exactly where I was losing marks and fix it before the exam.", name: "James R.", role: "GCSE Student", avatar: "JR", color: "hsl(145 65% 42%)" },
];

const plans = [
  { name: "Free", price: "£0", period: "forever", description: "Perfect for getting started", features: ["3 practice sets per month", "1 exam generation per month", "Basic progress tracking", "All subjects"], cta: "Get Started Free", highlighted: false },
  { name: "Pro", price: "£7.99", period: "per month", description: "For serious exam preparation", features: ["Unlimited practice sets", "10 exam generations per month", "PDF download", "Full AI grading and feedback", "Weak topic analysis", "Exam board specific questions"], cta: "Start Pro Free Trial", highlighted: true },
];

/* ──────────────────────────── component ──────────────────────────── */

const LandingPage = () => {
  const navigate = useNavigate();
  const statsRef = useRef(null);
  const statsInView = useInView(statsRef, { once: true, amount: 0.3 });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/60 border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between max-w-6xl">
          <span className="text-xl font-bold tracking-tight">Examly</span>
          <div className="hidden md:flex items-center gap-8">
            {["Features", "How It Works", "Pricing"].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {l}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth?mode=login")}>Log In</Button>
            <Button size="sm" onClick={() => navigate("/auth?mode=signup")}>Get Started Free</Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
        {/* Gradient blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full opacity-20 blur-[120px]"
            style={{ background: "hsl(var(--primary))" }}
          />
          <motion.div
            animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-15 blur-[120px]"
            style={{ background: "hsl(263 70% 58%)" }}
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 bg-muted/30 mb-8">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">AI-Powered Exam Practice</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }}
            className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.1] mb-6 tracking-tight">
            Ace Your Exams With{" "}
            <span className="text-primary">AI&#8209;Generated</span>{" "}
            Practice
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Generate unlimited exam questions tailored to your subject, exam board, and level. Never run out of practice material again.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth?mode=signup")} className="text-base px-8">
              Start For Free <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth?mode=login")} className="text-base px-8">
              Log In
            </Button>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }}
            className="mt-16 text-muted-foreground/40 text-2xl animate-bounce">
            ↓
          </motion.div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section ref={statsRef} className="py-20 px-4 border-y border-border/30">
        <div className="container mx-auto max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-10">
          {stats.map((s, i) => (
            <StatCounter key={i} stat={s} inView={statsInView} delay={i * 0.15} />
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary mb-2 block">Features</span>
            <h2 className="text-3xl md:text-4xl font-bold">Everything you need to excel</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative rounded-xl border border-border/50 bg-card/50 p-8 hover:border-primary/30 transition-colors group"
              >
                <div className="absolute top-0 left-8 right-8 h-px" style={{ background: `linear-gradient(90deg, transparent, ${f.color}40, transparent)` }} />
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-24 px-4 bg-muted/10">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary mb-2 block">How It Works</span>
            <h2 className="text-3xl md:text-4xl font-bold">Up and running in minutes</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {steps.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="text-center"
              >
                <div className="text-4xl font-bold mb-4" style={{ color: s.color }}>{s.number}</div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary mb-2 block">Testimonials</span>
            <h2 className="text-3xl md:text-4xl font-bold">Students who used Examly</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-xl border border-border/50 bg-card/50 p-8 flex flex-col"
              >
                <span className="text-4xl font-serif mb-2" style={{ color: t.color }}>"</span>
                <p className="text-muted-foreground text-sm leading-relaxed flex-1">{t.quote}</p>
                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border/30">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-primary-foreground" style={{ background: t.color }}>
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-4 bg-muted/10">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary mb-2 block">Pricing</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Simple, honest pricing</h2>
            <p className="text-muted-foreground">Start free. Upgrade when you're ready.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className={`relative rounded-xl border p-8 ${plan.highlighted ? "border-primary/50 bg-primary/5" : "border-border/50 bg-card/50"}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold bg-primary text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <div className="mb-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm ml-1">/{plan.period}</span>
                </div>
                <p className="text-muted-foreground text-sm mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-0.5">✓</span>
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                  onClick={() => navigate("/auth?mode=signup")}
                >
                  {plan.cta}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-5xl mb-6">🏆</div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to start practising?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of students already using Examly to prepare smarter, not harder.
            </p>
            <Button size="lg" onClick={() => navigate("/auth?mode=signup")} className="text-base px-8">
              Get Started For Free <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <p className="text-xs text-muted-foreground/60 mt-4">
              No credit card required · Free forever plan available
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/30 py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div>
              <span className="text-lg font-bold tracking-tight block mb-3">Examly</span>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI-powered exam practice for students and tutors worldwide.
              </p>
            </div>
            {[
              { heading: "Product", links: [{ text: "Features", href: "#features" }, { text: "How It Works", href: "#how-it-works" }, { text: "Pricing", href: "#pricing" }] },
              { heading: "Subjects", links: [{ text: "Mathematics", href: "#" }, { text: "Sciences", href: "#" }, { text: "English", href: "#" }, { text: "Humanities", href: "#" }] },
              { heading: "Legal", links: [{ text: "Privacy Policy", href: "#" }, { text: "Terms of Service", href: "#" }, { text: "About", href: "#" }] },
            ].map(col => (
              <div key={col.heading}>
                <h4 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">{col.heading}</h4>
                <ul className="space-y-2">
                  {col.links.map(l => (
                    <li key={l.text}>
                      <a href={l.href} className="text-sm text-muted-foreground/70 hover:text-muted-foreground transition-colors">{l.text}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-border/20 pt-8 text-center space-y-2">
            <p className="text-sm text-muted-foreground/60">© {new Date().getFullYear()} Examly. All rights reserved.</p>
            <p className="text-[11px] text-muted-foreground/40 max-w-2xl mx-auto leading-relaxed">
              Examly is an independent practice platform. Not affiliated with AQA, OCR, Pearson Edexcel, Cambridge Assessment, the College Board, or the IBO.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
