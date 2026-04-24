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
  ShieldCheck,
  CheckCircle2,
  XCircle,
  LogOut,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in");
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
      if (!response.ok || !result.success) {
        toast.error(result.error ?? "Deletion failed. Please contact support.");
        return;
      }
      await supabase.auth.signOut();
      toast.success("Your account has been deleted");
      navigate("/auth");
    } catch {
      toast.error("Something went wrong. Please contact support.");
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Privacy Controls</CardTitle>
          <CardDescription>Manage your data and privacy preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Label htmlFor="save-history">Save Revision History</Label>
              <p className="text-sm text-muted-foreground">Keep track of your past revision sessions</p>
            </div>
            <Switch
              id="save-history"
              checked={preferences?.save_revision_history}
              onCheckedChange={(checked) => updatePreference({ save_revision_history: checked })}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Label htmlFor="confirm-resolve">Confirm before resolving feedback</Label>
              <p className="text-sm text-muted-foreground">Show confirmation when marking help threads as resolved</p>
            </div>
            <Switch
              id="confirm-resolve"
              checked={preferences?.confirm_resolve_feedback !== false}
              onCheckedChange={(checked) => updatePreference({ confirm_resolve_feedback: checked })}
            />
          </div>

          <div className="pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Clear Activity Logs
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all your activity logs. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Logs
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="pt-4">
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <a href="/privacy" target="_blank">
                Privacy Policy
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Your Data — UK GDPR */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Your Data
          </CardTitle>
          <CardDescription>
            Manage your personal data in accordance with UK GDPR
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Label>Download your data</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Export a copy of all personal data Examly holds about your
                account — profile, exam results, practice history and subjects —
                as a JSON file. This is your right under UK GDPR Article 20.
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

          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
            <p className="text-sm font-medium">Your rights under UK GDPR</p>
            <ul className="space-y-1.5">
              {[
                "Right to access — download all your data at any time",
                "Right to erasure — delete your account and all associated data",
                "Right to portability — your data is exported in a machine-readable format",
                "Right to rectification — update your profile and subjects in Settings",
              ].map((right) => (
                <li key={right} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{right}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Enhance your account security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Label>Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
            </div>
            <Button variant="outline" size="sm" disabled className="w-full sm:w-auto">
              Coming Soon
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>Manage your active login sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border p-4 bg-muted/50">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium">Current Device</p>
                <p className="text-sm text-muted-foreground">Last active: Now</p>
              </div>
              <Button variant="ghost" size="sm" disabled className="w-full sm:w-auto">
                This Device
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              Log Out All Other Sessions
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone — Delete Account */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your Examly account and all associated data.
            This includes your exam history, practice results, progress data
            and profile. If you are a tutor your classes will be deactivated.
            This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                <p className="text-sm text-foreground">
                  This will permanently delete your account, exam results,
                  practice history, progress data and profile information.{" "}
                  <span className="font-semibold">This cannot be undone.</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-confirm" className="text-sm">
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
        </CardContent>
      </Card>
    </div>
  );
};
