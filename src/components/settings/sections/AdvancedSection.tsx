import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Loader2 } from "lucide-react";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingRow } from "@/components/settings/SettingRow";

export const AdvancedSection = () => {
  const { preferences, loading, updatePreference } = useUserPreferences();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Accessibility"
        description="Customise display options for easier reading."
      >
        <SettingRow
          label="Font size"
          description="Scales the entire app's base font size."
          htmlFor="font-size"
        >
          <Select
            value={preferences?.font_size}
            onValueChange={(value: "small" | "medium" | "large") =>
              updatePreference({ font_size: value })
            }
          >
            <SelectTrigger id="font-size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium (default)</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          label="High contrast mode"
          description="Increase contrast for better visibility."
          htmlFor="high-contrast"
        >
          <Switch
            id="high-contrast"
            checked={preferences?.high_contrast_mode}
            onCheckedChange={(checked) =>
              updatePreference({ high_contrast_mode: checked })
            }
          />
        </SettingRow>
      </SettingsCard>
    </div>
  );
};
