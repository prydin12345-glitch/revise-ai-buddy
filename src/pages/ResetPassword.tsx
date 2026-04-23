import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);

  // Supabase sends the recovery token as a URL fragment.
  // Listen for PASSWORD_RECOVERY event or existing session.
  useEffect(() => {
    let ready = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
          ready = true;
          setSessionReady(true);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        ready = true;
        setSessionReady(true);
      }
    });

    const timeout = setTimeout(() => {
      if (!ready) setInvalidLink(true);
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const validatePassword = (pw: string) => ({
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
    longer: pw.length >= 12,
  });

  const checks = validatePassword(password);
  // Required checks (must pass to submit)
  const requiredChecks = {
    length: checks.length,
    uppercase: checks.uppercase,
    number: checks.number,
  };
  const allChecksPassed = Object.values(requiredChecks).every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  // Strength score (0-5) based on all signals
  const strengthScore = password.length === 0
    ? 0
    : Object.values(checks).filter(Boolean).length;

  const strength = (() => {
    if (password.length === 0) return { label: "", level: 0, color: "transparent", textColor: "text-muted-foreground" };
    if (strengthScore <= 2) return { label: "Weak", level: 1, color: "hsl(var(--destructive))", textColor: "text-destructive" };
    if (strengthScore === 3) return { label: "Fair", level: 2, color: "hsl(38 92% 50%)", textColor: "text-[hsl(38_92%_45%)]" };
    if (strengthScore === 4) return { label: "Good", level: 3, color: "hsl(142 71% 45%)", textColor: "text-[hsl(142_71%_40%)]" };
    if (strengthScore === 5) return { label: "Strong", level: 4, color: "hsl(142 76% 36%)", textColor: "text-[hsl(142_76%_32%)]" };
    return { label: "Very strong", level: 5, color: "hsl(160 84% 30%)", textColor: "text-[hsl(160_84%_28%)]" };
  })();

  const handleResetPassword = async () => {
    if (!allChecksPassed) {
      toast.error("Password does not meet requirements");
      return;
    }
    if (!passwordsMatch) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 md:p-8">
          {/* Invalid link state */}
          {invalidLink && !sessionReady && (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-5">
                <AlertCircle size={24} className="text-destructive" strokeWidth={1.8} />
              </div>
              <h2 className="text-xl font-bold mb-2">Link expired or invalid</h2>
              <p className="text-sm text-muted-foreground mb-6">
                This password reset link has expired or has already been used. Reset links are valid for 1 hour.
              </p>
              <Button className="w-full" onClick={() => navigate("/auth")}>
                Request a new link
              </Button>
            </div>
          )}

          {/* Loading state */}
          {!invalidLink && !sessionReady && (
            <div className="text-center py-8">
              <div
                className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"
                style={{ animation: "rp-spin 0.8s linear infinite" }}
              />
              <p className="text-sm text-muted-foreground">Verifying your reset link...</p>
              <style>{`@keyframes rp-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Success state */}
          {success && (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={24} className="text-primary" strokeWidth={1.8} />
              </div>
              <h2 className="text-xl font-bold mb-2">Password updated</h2>
              <p className="text-sm text-muted-foreground">
                Your password has been changed successfully. Redirecting you to your dashboard...
              </p>
            </div>
          )}

          {/* Main reset form */}
          {sessionReady && !success && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Lock size={22} className="text-primary" strokeWidth={1.8} />
                </div>
                <h1 className="text-xl font-bold mb-1">Set a new password</h1>
                <p className="text-sm text-muted-foreground">
                  Choose a strong password for your Examly account
                </p>
              </div>

              {/* New password */}
              <div className="space-y-2 mb-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoFocus
                    className="w-full bg-background border border-border/50 rounded-md px-3 py-2 pr-10 text-sm outline-none focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Strength meter + Requirements */}
              {password.length > 0 && (
                <div className="mb-4 space-y-3">
                  {/* Strength bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Password strength</span>
                      <span className={`text-xs font-semibold ${strength.textColor}`}>
                        {strength.label}
                      </span>
                    </div>
                    <div
                      className="flex gap-1"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={5}
                      aria-valuenow={strength.level}
                      aria-label={`Password strength: ${strength.label || "none"}`}
                    >
                      {[1, 2, 3, 4, 5].map(i => (
                        <div
                          key={i}
                          className="h-1.5 flex-1 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: i <= strength.level ? strength.color : "hsl(var(--muted))",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Requirements list */}
                  <div className="space-y-1.5">
                    {[
                      { key: "length", label: "At least 8 characters", required: true },
                      { key: "uppercase", label: "One uppercase letter", required: true },
                      { key: "number", label: "One number", required: true },
                      { key: "lowercase", label: "One lowercase letter (recommended)", required: false },
                      { key: "symbol", label: "One symbol (recommended)", required: false },
                      { key: "longer", label: "12+ characters (stronger)", required: false },
                    ].map(req => {
                      const passed = checks[req.key as keyof typeof checks];
                      return (
                        <div key={req.key} className="flex items-center gap-2 text-xs">
                          <div
                            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors ${
                              passed
                                ? req.required
                                  ? "bg-primary/20"
                                  : "bg-[hsl(142_71%_45%)]/20"
                                : "bg-muted"
                            }`}
                          >
                            {passed && (
                              <CheckCircle
                                size={10}
                                className={req.required ? "text-primary" : "text-[hsl(142_71%_40%)]"}
                              />
                            )}
                          </div>
                          <span
                            className={
                              passed
                                ? "text-foreground"
                                : req.required
                                  ? "text-muted-foreground"
                                  : "text-muted-foreground/70"
                            }
                          >
                            {req.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Confirm password */}
              <div className="space-y-2 mb-5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleResetPassword()}
                    placeholder="Repeat your new password"
                    className={`w-full bg-background border rounded-md px-3 py-2 pr-10 text-sm outline-none transition-colors ${
                      confirmPassword.length > 0
                        ? passwordsMatch
                          ? "border-primary"
                          : "border-destructive"
                        : "border-border/50 focus:border-primary"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>

              <Button
                className="w-full"
                disabled={loading || !allChecksPassed || !passwordsMatch}
                onClick={handleResetPassword}
              >
                {loading ? "Updating password..." : "Set new password"}
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
