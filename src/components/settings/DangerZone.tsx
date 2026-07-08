import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  LogOut,
} from "lucide-react";

const CONFIRM_PHRASE = "delete my account";

type DeletionStatus = {
  phase: "deleting" | "signing-out" | "redirecting" | "success" | "error";
  message?: string;
  failures?: { table: string; error: string }[];
  countdown?: number;
};

export const DangerZone = () => {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<DeletionStatus | null>(null);

  const handleDelete = async () => {
    if (input.trim().toLowerCase() !== CONFIRM_PHRASE) return;
    setLoading(true);
    setStatus({ phase: "deleting" });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus({ phase: "error", message: "You must be logged in to delete your account." });
        return;
      }
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        },
      );
      const result = await response.json().catch(() => ({}));
      const failures: { table: string; error: string }[] = Array.isArray(result?.results)
        ? result.results
            .filter((r: { ok: boolean }) => !r.ok)
            .map((r: { table: string; error?: string }) => ({
              table: r.table,
              error: r.error ?? "Unknown error",
            }))
        : [];

      if (!response.ok || !result.success) {
        setStatus({
          phase: "error",
          message: result.error ?? "Deletion failed. Your account may not have been fully removed.",
          failures,
        });
        return;
      }
      setStatus({ phase: "signing-out", failures });
      await supabase.auth.signOut();
      setStatus({ phase: "success", failures, countdown: 5 });
      let remaining = 5;
      const interval = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(interval);
          navigate("/auth");
        } else {
          setStatus((s) => (s ? { ...s, countdown: remaining } : s));
        }
      }, 1000);
    } catch {
      setStatus({ phase: "error", message: "Something went wrong. Please contact support." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {status && (
        <DeletionStatusOverlay
          status={status}
          onClose={() => setStatus(null)}
          onGoToLogin={() => navigate("/auth")}
        />
      )}

      <section className="rounded-xl border border-destructive/30 bg-destructive/5 mt-10">
        <header className="px-5 pt-5 pb-4 border-b border-destructive/20">
          <h3 className="text-sm font-semibold tracking-tight text-destructive">
            Danger zone
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Irreversible actions. Please proceed with caution.
          </p>
        </header>

        <div className="px-5 py-5">
          {!showConfirm ? (
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8 lg:items-center">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Delete account</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Permanently delete your account, exam results, practice history and all
                  associated data. This cannot be undone.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirm(true)}
                className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive w-full sm:w-auto min-h-[44px]"
              >
                <Trash2 className="w-4 h-4" />
                Delete my account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-foreground leading-relaxed">
                  This will permanently delete your account, exam results, practice history,
                  progress data and profile information.{" "}
                  <span className="font-semibold">This cannot be undone.</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-confirm" className="text-sm font-medium">
                  Type <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span> to confirm:
                </Label>
                <Input
                  id="delete-confirm"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  autoFocus
                  className={cn_border(input)}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowConfirm(false);
                    setInput("");
                  }}
                  disabled={loading}
                  className="flex-1 min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={loading || input.trim().toLowerCase() !== CONFIRM_PHRASE}
                  className="flex-1 gap-2 min-h-[44px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    "Permanently delete"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

function cn_border(input: string) {
  return input.trim().toLowerCase() === CONFIRM_PHRASE ? "border-destructive" : "";
}

// ────────────────────────────────────────────────────────────────────────────
// Deletion status overlay
// ────────────────────────────────────────────────────────────────────────────

type DeletionStatusOverlayProps = {
  status: DeletionStatus;
  onClose: () => void;
  onGoToLogin: () => void;
};

const DeletionStatusOverlay = ({ status, onClose, onGoToLogin }: DeletionStatusOverlayProps) => {
  const { phase, message, failures, countdown } = status;
  const isError = phase === "error";
  const isSuccess = phase === "success";

  const steps = [
    { key: "deleting", label: "Removing your data from our servers" },
    { key: "signing-out", label: "Signing you out of all sessions" },
    { key: "success", label: "Redirecting you to the login page" },
  ] as const;

  const currentStepIndex =
    phase === "deleting" ? 0 : phase === "signing-out" ? 1 : phase === "success" ? 2 : -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-full bg-muted">
            {isError ? (
              <XCircle className="w-8 h-8 text-destructive" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-8 h-8 text-primary" />
            ) : (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            )}
          </div>
          <CardTitle>
            {isError
              ? "Account deletion failed"
              : isSuccess
                ? "Account deleted"
                : phase === "signing-out"
                  ? "Signing you out…"
                  : "Deleting your account…"}
          </CardTitle>
          <CardDescription>
            {isError
              ? message ?? "Something went wrong. Please contact support."
              : isSuccess
                ? `Your account and personal data have been removed. You'll be sent to the login page${
                    typeof countdown === "number" ? ` in ${countdown}s` : ""
                  }.`
                : "Please don't close this window — we're securely removing your data."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isError && (
            <ol className="space-y-2.5">
              {steps.map((step, idx) => {
                const isDone = isSuccess ? true : idx < currentStepIndex;
                const isActive = idx === currentStepIndex && !isSuccess;
                return (
                  <li key={step.key} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      ) : isActive ? (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      ) : (
                        <span className="block w-4 h-4 rounded-full border border-border" />
                      )}
                    </span>
                    <span className={isDone || isActive ? "text-foreground" : "text-muted-foreground"}>
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {failures && failures.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-foreground">
                  {isError ? "We couldn't finish removing some data:" : "Some data may not have been fully removed:"}
                </p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto pl-6 list-disc">
                {failures.map((f, i) => (
                  <li key={`${f.table}-${i}`}>
                    <span className="font-mono">{f.table}</span> — {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            {isError ? (
              <>
                <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
                  Close
                </Button>
                <Button variant="default" size="sm" asChild className="flex-1">
                  <a href="mailto:support@examly.app?subject=Account%20deletion%20issue">
                    Contact support
                  </a>
                </Button>
              </>
            ) : isSuccess ? (
              <Button variant="default" size="sm" onClick={onGoToLogin} className="flex-1 gap-2">
                <LogOut className="w-4 h-4" />
                Go to login now
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled className="flex-1 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Working…
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
