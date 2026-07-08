import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ExternalLink,
  Loader2,
  Download,
  Check,
  Cookie,
} from "lucide-react";
import { openCookieSettings } from "@/components/CookieConsent";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingRow } from "@/components/settings/SettingRow";

export const PrivacySection = () => {
  const { preferences, loading, updatePreference } = useUserPreferences();
  const [exportLoading, setExportLoading] = useState(false);
  const [exportDone, setExportDone] = useState(false);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsCard title="Preferences" description="Privacy and cookie behaviour.">
        <SettingRow
          label="Confirm before resolving feedback"
          description="Show a confirmation prompt when marking help threads as resolved."
          htmlFor="confirm-resolve"
        >
          <Switch
            id="confirm-resolve"
            checked={preferences?.confirm_resolve_feedback !== false}
            onCheckedChange={(checked) =>
              updatePreference({ confirm_resolve_feedback: checked })
            }
          />
        </SettingRow>

        <SettingRow
          label="Cookie preferences"
          description="Review or change which cookies Examly may store on this device."
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => openCookieSettings()}
            className="gap-2 min-h-[44px]"
          >
            <Cookie className="w-4 h-4" />
            Manage cookies
          </Button>
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        title="Data export"
        description="Download your data under UK GDPR Article 20."
      >
        <SettingRow
          label="Download your data"
          description="Export all personal data Examly holds about your account — profile, exam results, practice history and subjects — as a JSON file."
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            disabled={exportLoading}
            className="gap-2 min-h-[44px]"
          >
            {exportDone ? (
              <>
                <Check className="w-4 h-4 text-primary" />
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
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Legal" description="Policies and terms.">
        <SettingRow label="Privacy policy" description="How Examly handles your data.">
          <Button variant="outline" size="sm" className="gap-2 min-h-[44px]" asChild>
            <a href="/privacy" target="_blank" rel="noreferrer">
              View policy
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </SettingRow>
      </SettingsCard>
    </div>
  );
};
