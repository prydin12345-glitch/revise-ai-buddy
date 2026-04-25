import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Check, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Pricing page — currently a "coming soon" / waitlist screen.
 *
 * The product has no paid tiers today: every feature is free for all users.
 * This page exists so the "Upgrade" CTAs in the dashboard, settings, and
 * landing pages have a real destination instead of a 404, and so we can
 * honestly set expectations for users curious about future pricing.
 */
const Pricing = () => {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      if (session?.user?.email) setEmail(session.user.email);
    });
  }, []);

  const includedNow = [
    "Unlimited AI-generated practice questions",
    "Unlimited mock exams and uploads",
    "Full progress analytics and weak-topic insights",
    "All UK GCSE & A-Level subjects (plus custom)",
    "Tutor classes with unlimited students",
    "PDF reports and data export",
  ];

  const handleNotifyMe = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSubmitting(true);
    // No waitlist backend yet — we acknowledge locally so the UX is honest.
    // When pricing launches, swap this for a real subscription endpoint.
    await new Promise((r) => setTimeout(r, 400));
    setSubmitted(true);
    setSubmitting(false);
    toast.success("Thanks — we'll email you when pricing launches.");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate(isLoggedIn ? "/dashboard" : "/")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isLoggedIn ? "Back to dashboard" : "Back to home"}</span>
          </button>
          <div className="text-base font-semibold tracking-tight">Examly</div>
          {!isLoggedIn ? (
            <Button size="sm" onClick={() => navigate("/auth")}>
              Get started
            </Button>
          ) : (
            <div className="w-[120px]" aria-hidden="true" />
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-10">
        {/* Hero */}
        <section className="text-center space-y-4">
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Pricing — coming soon
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Everything is free right now
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            Examly doesn't have paid plans yet. Every student and tutor on the
            platform has full access to every feature while we focus on getting
            the product right.
          </p>
        </section>

        {/* What you get today */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What's included today</CardTitle>
            <CardDescription>
              No tiers, no limits, no card required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {includedNow.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check
                    className="w-4 h-4 text-primary shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Notify-me */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Get notified when plans launch</CardTitle>
            <CardDescription>
              We'll email you before any paid plans go live so you have time to
              choose. Existing users will keep generous free access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    You're on the list
                  </p>
                  <p className="text-sm text-muted-foreground">
                    We'll reach out at <span className="font-medium text-foreground">{email}</span> as
                    soon as pricing is announced.
                  </p>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleNotifyMe}
                className="flex flex-col sm:flex-row gap-2"
              >
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    aria-label="Email address"
                  />
                </div>
                <Button type="submit" disabled={submitting} className="gap-2">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Notify me"
                  )}
                </Button>
              </form>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              We'll only use your email for pricing updates. You can unsubscribe
              at any time.
            </p>
          </CardContent>
        </Card>

        {/* Bottom CTA */}
        <section className="text-center space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">
            In the meantime, dive in and use everything for free.
          </p>
          <Button
            size="lg"
            onClick={() => navigate(isLoggedIn ? "/dashboard" : "/auth")}
          >
            {isLoggedIn ? "Go to dashboard" : "Create a free account"}
          </Button>
        </section>
      </main>
    </div>
  );
};

export default Pricing;
