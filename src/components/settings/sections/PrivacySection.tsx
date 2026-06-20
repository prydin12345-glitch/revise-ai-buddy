import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ExternalLink,
  Loader2,
  Download,
  Check,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  LogOut,
  Cookie,
  Shield,
  Settings2,
  FileText,
} from "lucide-react";
import { openCookieSettings } from "@/components/CookieConsent";
import { SettingsTabHeader } from "@/components/settings/SettingsTabHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";


const CONFIRM_PHRASE = "delete my account";

export const PrivacySection = () => {
  const { preferences, loading, updatePreference } = useUserPreferences();
  const navigate = useNavigate();

  // Data export
  const [exportLoading, setExportLoading] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  // Account deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Post-deletion status screen
  type DeletionStatus = {
    phase: "deleting" | "signing-out" | "redirecting" | "success" | "error";
    message?: string;
    failures?: { table: string; error: string }[];
    countdown?: number;
  };
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus | null>(null);

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to export your data");
        return;
      }
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-user-data`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        },
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error ?? "Export failed");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `examly-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportDone(true);
      toast.success("Your data has been downloaded");
      setTimeout(() => setExportDone(false), 5000);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput.trim().toLowerCase() !== CONFIRM_PHRASE) {
      toast.error(`Please type "${CONFIRM_PHRASE}" to confirm`);
      return;
    }
    setDeleteLoading(true);
    setDeletionStatus({ phase: "deleting" });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setDeletionStatus({
          phase: "error",
          message: "You must be logged in to delete your account.",
        });
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

      // Collect any per-table failures returned by the edge function
      const failures: { table: string; error: string }[] = Array.isArray(result?.results)
        ? result.results
            .filter((r: { ok: boolean }) => !r.ok)
            .map((r: { table: string; error?: string }) => ({
              table: r.table,
              error: r.error ?? "Unknown error",
            }))
        : [];

      if (!response.ok || !result.success) {
        setDeletionStatus({
          phase: "error",
          message: result.error ?? "Deletion failed. Your account may not have been fully removed.",
          failures,
        });
        return;
      }

      // Sign out
      setDeletionStatus({ phase: "signing-out", failures });
      await supabase.auth.signOut();

      // Show success with countdown, then redirect
      setDeletionStatus({ phase: "success", failures, countdown: 5 });
      let remaining = 5;
      const interval = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(interval);
          navigate("/auth");
        } else {
          setDeletionStatus((s) => (s ? { ...s, countdown: remaining } : s));
        }
      }, 1000);
    } catch {
      setDeletionStatus({
        phase: "error",
        message: "Something went wrong. Please contact support.",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deletionStatus && (
        <DeletionStatusOverlay
          status={deletionStatus}
          onClose={() => setDeletionStatus(null)}
          onGoToLogin={() => navigate("/auth")}
        />
      )}

      <SettingsTabHeader
        icon={Shield}
        title="Privacy & Security"
        description="Your data, account, and privacy controls"
      />

      <SettingsCard
        icon={Settings2}
        title="Preferences"
        description="Privacy and cookie behaviour"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Label htmlFor="confirm-resolve" className="text-[13px] font-medium">Confirm before resolving feedback</Label>
            <p className="text-[12px] text-muted-foreground mt-0.5">Show confirmation when marking help threads as resolved</p>
          </div>
          <Switch
            id="confirm-resolve"
            checked={preferences?.confirm_resolve_feedback !== false}
            onCheckedChange={(checked) => updatePreference({ confirm_resolve_feedback: checked })}
          />
        </div>

        <div className="border-t border-border/40 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Label className="text-[13px] font-medium">Cookie preferences</Label>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Review or change which cookies Examly may store on this device.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openCookieSettings()}
            className="gap-2 shrink-0 w-full sm:w-auto"
          >
            <Cookie className="w-4 h-4" />
            Manage cookies
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Download}
        title="Data Export"
        description="Download your data under UK GDPR Article 20"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Label className="text-[13px] font-medium">Download your data</Label>
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
              Export a copy of all personal data Examly holds about your account —
              profile, exam results, practice history and subjects — as a JSON file.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            disabled={exportLoading}
            className="gap-2 shrink-0 w-full sm:w-auto"
          >
            {exportDone ? (
              <>
                <Check className="w-4 h-4 text-primary shrink-0" />
                Downloaded
              </>
            ) : exportLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export data
              </>
            )}
          </Button>
        </div>

        <div className="rounded-xl bg-muted/40 p-4 space-y-2 border-t border-border/40 pt-4">
          <p className="text-[13px] font-medium">Your rights under UK GDPR</p>
          <ul className="space-y-1.5">
            {[
              "Right to access — download all your data at any time",
              "Right to erasure — delete your account and all associated data",
              "Right to portability — your data is exported in a machine-readable format",
              "Right to rectification — update your profile and subjects in Settings",
            ].map((right) => (
              <li key={right} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span>{right}</span>
              </li>
            ))}
          </ul>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Trash2}
        title="Delete Account"
        description="Permanently delete your account and all associated data. This cannot be undone."
        destructive
      >
        {!showDeleteConfirm ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive w-full sm:w-auto"
          >
            <Trash2 className="w-4 h-4" />
            Delete my account
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-[13px] text-foreground">
                This will permanently delete your account, exam results,
                practice history, progress data and profile information.{" "}
                <span className="font-semibold">This cannot be undone.</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-confirm" className="text-[13px] font-medium">
                Type <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span> to confirm:
              </Label>
              <Input
                id="delete-confirm"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoFocus
                className={
                  deleteInput.trim().toLowerCase() === CONFIRM_PHRASE
                    ? "border-destructive"
                    : ""
                }
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInput("");
                }}
                disabled={deleteLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAccount}
                disabled={
                  deleteLoading ||
                  deleteInput.trim().toLowerCase() !== CONFIRM_PHRASE
                }
                className="flex-1 gap-2"
              >
                {deleteLoading ? (
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
      </SettingsCard>

      <SettingsCard
        icon={FileText}
        title="Legal"
        description="Policies and terms"
      >
        <Button variant="ghost" size="sm" className="gap-2" asChild>
          <a href="/privacy" target="_blank">
            Privacy Policy
            <ExternalLink className="w-4 h-4" />
          </a>
        </Button>
      </SettingsCard>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Post-deletion status overlay
// ────────────────────────────────────────────────────────────────────────────

type DeletionStatusOverlayProps = {
  status: {
    phase: "deleting" | "signing-out" | "redirecting" | "success" | "error";
    message?: string;
    failures?: { table: string; error: string }[];
    countdown?: number;
  };
  onClose: () => void;
  onGoToLogin: () => void;
};

const DeletionStatusOverlay = ({ status, onClose, onGoToLogin }: DeletionStatusOverlayProps) => {
  const { phase, message, failures, countdown } = status;
  const isError = phase === "error";
  const isSuccess = phase === "success";
  const isWorking = phase === "deleting" || phase === "signing-out" || phase === "redirecting";

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
      aria-labelledby="deletion-status-title"
    >
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-full bg-muted">
            {isError ? (
              <XCircle className="w-8 h-8 text-destructive" aria-hidden="true" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-8 h-8 text-primary" aria-hidden="true" />
            ) : (
              <Loader2 className="w-8 h-8 text-primary animate-spin" aria-hidden="true" />
            )}
          </div>
          <CardTitle id="deletion-status-title">
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
              ? message ?? "Something went wrong. Please contact support so we can finish removing your data."
              : isSuccess
                ? `Your account and personal data have been removed. You'll be sent to the login page${
                    typeof countdown === "number" ? ` in ${countdown}s` : ""
                  }.`
                : "Please don't close this window — we're securely removing your data."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Step list — only while working / on success */}
          {!isError && (
            <ol className="space-y-2.5">
              {steps.map((step, idx) => {
                const isDone = isSuccess ? true : idx < currentStepIndex;
                const isActive = idx === currentStepIndex && !isSuccess;
                return (
                  <li key={step.key} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
                      ) : isActive ? (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" aria-hidden="true" />
                      ) : (
                        <span className="block w-4 h-4 rounded-full border border-border" aria-hidden="true" />
                      )}
                    </span>
                    <span
                      className={
                        isDone || isActive
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {/* Per-table failure details (partial deletion warning) */}
          {failures && failures.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
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
              <p className="text-xs text-muted-foreground pl-6">
                Please contact support quoting these table names so we can complete the cleanup.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            {isError ? (
              <>
                <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
                  Close
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  asChild
                  className="flex-1"
                >
                  <a href="mailto:support@examly.app?subject=Account%20deletion%20issue">
                    Contact support
                  </a>
                </Button>
              </>
            ) : isSuccess ? (
              <Button
                variant="default"
                size="sm"
                onClick={onGoToLogin}
                className="flex-1 gap-2"
              >
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
