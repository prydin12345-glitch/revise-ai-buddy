import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GraduationCap, Users, BookOpen, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(searchParams.get("mode") === "login" ? "login" : "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedRole, setSelectedRole] = useState<"student" | "teacher" | "tutor">("student");
  const [loading, setLoading] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const roleOptions = [
    { value: "student", label: "Student", icon: GraduationCap, description: "I'm here to learn and revise" },
    { value: "teacher", label: "Teacher", icon: BookOpen, description: "I want to create and assign exams" },
    { value: "tutor", label: "Tutor", icon: Users, description: "I tutor students privately" },
  ] as const;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          setPasswordError("Passwords do not match");
          setLoading(false);
          return;
        }
        if (password.length < 8) {
          setPasswordError("Password must be at least 8 characters");
          setLoading(false);
          return;
        }
        setPasswordError("");

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { first_name: firstName, last_name: lastName || null, signup_role: selectedRole },
          },
        });
        if (error) throw error;
        if (data.user && data.session) {
          toast({ title: "Account created!", description: "Welcome! Let's set up your profile." });
          navigate("/onboarding");
        } else {
          setConfirmedEmail(email);
          setShowEmailConfirmation(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back!", description: "Successfully logged in." });
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-background border-border/50 focus:border-primary transition-colors";

  return (
    <div className="min-h-screen flex bg-background text-foreground relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full opacity-10 blur-[120px]"
          style={{ background: "hsl(var(--primary))" }}
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/3 right-1/4 w-[300px] h-[300px] rounded-full opacity-10 blur-[120px]"
          style={{ background: "hsl(263 70% 58%)" }}
        />
      </div>

      {/* ── Left panel (desktop only) ── */}
      <div className="hidden md:flex flex-col justify-center w-1/2 p-16 relative z-10">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
          <button onClick={() => navigate("/")} className="text-2xl font-bold tracking-tight mb-12 block hover:opacity-80 transition-opacity bg-transparent border-none cursor-pointer text-foreground font-[inherit]">
            Examly
          </button>
          <h2 className="text-3xl font-bold mb-4 leading-tight">
            Smarter revision starts here
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-12 max-w-md">
            Join thousands of students generating unlimited AI-powered practice questions tailored to their exact syllabus.
          </p>

          <div className="space-y-4">
            {[
              { value: "10,000+", label: "Questions generated daily" },
              { value: "94%", label: "Of students improve their grade" },
              { value: "Free", label: "To get started — no card needed" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className="w-1 h-10 rounded-full bg-primary/50" />
                <div>
                  <div className="text-sm font-semibold">{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-16 relative z-10">
        {showEmailConfirmation ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
                <Mail size={24} className="text-primary" strokeWidth={1.8} />
              </div>
              <h2 className="text-xl font-bold mb-2">Check your email</h2>
              <p className="text-sm text-muted-foreground mb-2">
                We've sent a confirmation link to:
              </p>
              <div className="text-sm font-semibold text-primary mb-5">
                {confirmedEmail}
              </div>
              <p className="text-xs text-muted-foreground/70 leading-relaxed mb-7">
                Click the link in the email to verify your account and get started. The link will expire in 24 hours.
              </p>
              <Button
                variant="outline"
                className="w-full mb-3"
                onClick={async () => {
                  await supabase.auth.resend({ type: "signup", email: confirmedEmail });
                  toast({ title: "Email resent", description: "Check your inbox for the confirmation link." });
                }}
              >
                Resend confirmation email
              </Button>
              <button
                onClick={() => { setShowEmailConfirmation(false); setMode("login"); }}
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors bg-transparent border-none cursor-pointer font-[inherit]"
              >
                Back to sign in
              </button>
            </div>
            <div className="text-center mt-4">
              <span className="text-xs text-muted-foreground/40">Wrong email? </span>
              <button
                onClick={() => setShowEmailConfirmation(false)}
                className="text-xs text-primary hover:underline bg-transparent border-none cursor-pointer font-[inherit]"
              >
                Go back
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            {/* Mobile logo */}
            <div className="md:hidden text-center mb-8">
              <button onClick={() => navigate("/")} className="text-2xl font-bold tracking-tight bg-transparent border-none cursor-pointer text-foreground font-[inherit]">Examly</button>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-1">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {mode === "login" ? "Sign in to continue your revision" : "Start practising smarter today"}
              </p>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 md:p-8">
              <form onSubmit={handleAuth} className="space-y-5">
                {mode === "signup" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          First Name
                        </Label>
                        <Input id="firstName" type="text" placeholder="John" value={firstName} onChange={e => setFirstName(e.target.value)} required className={inputClass} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Last Name
                        </Label>
                        <Input id="lastName" type="text" placeholder="Doe" value={lastName} onChange={e => setLastName(e.target.value)} required className={inputClass} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">I am a...</Label>
                      <RadioGroup value={selectedRole} onValueChange={(v: any) => setSelectedRole(v)}>
                        {roleOptions.map(option => {
                          const Icon = option.icon;
                          return (
                            <div key={option.value} className="flex items-center space-x-3 border border-border/50 rounded-lg p-3 hover:border-primary/30 cursor-pointer transition-colors">
                              <RadioGroupItem value={option.value} id={option.value} />
                              <Label htmlFor={option.value} className="flex items-center gap-3 cursor-pointer flex-1">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Icon className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium">{option.label}</div>
                                  <div className="text-xs text-muted-foreground">{option.description}</div>
                                </div>
                              </Label>
                            </div>
                          );
                        })}
                      </RadioGroup>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</Label>
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className={inputClass} />
                </div>

                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => {
                        setConfirmPassword(e.target.value);
                        if (e.target.value !== password) {
                          setPasswordError("Passwords do not match");
                        } else {
                          setPasswordError("");
                        }
                      }}
                      required
                      className={`${inputClass} ${passwordError ? "border-destructive" : ""}`}
                    />
                    {passwordError && (
                      <p className="text-xs text-destructive mt-1">{passwordError}</p>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Please wait..." : mode === "signup" ? "Create Account" : "Sign In"}
                </Button>
              </form>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setPasswordError(""); setConfirmPassword(""); }} className="text-primary font-semibold hover:underline bg-transparent border-none cursor-pointer font-[inherit]">
                {mode === "login" ? "Sign up free" : "Sign in"}
              </button>
            </p>

            <div className="text-center mt-4">
              <button onClick={() => navigate("/")} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors bg-transparent border-none cursor-pointer font-[inherit]">
                ← Back to home
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Auth;
