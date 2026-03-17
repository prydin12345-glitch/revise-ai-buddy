import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRegionBoards, getLevelsForBoard, LEVEL_DISPLAY_NAMES, BOARD_LEVEL_MAP } from "@/lib/board-level-mapping";
import { getBoardDisplayName } from "@/lib/board-scrubber";
import { supabase } from "@/integrations/supabase/client";

const REGIONS = [
  { id: "GB", label: "🇬🇧 United Kingdom" },
  { id: "US", label: "🇺🇸 United States" },
  { id: "IN", label: "🇮🇳 India" },
  { id: "AU", label: "🇦🇺 Australia" },
  { id: "IB", label: "🌐 International / IB" },
  { id: "IE", label: "🇮🇪 Ireland" },
  { id: "NZ", label: "🇳🇿 New Zealand" },
  { id: "Other", label: "🌍 Other" },
];

interface ProfileSetupStepProps {
  onComplete: () => void;
  defaultRegion?: string | null;
  defaultBoard?: string | null;
  defaultLevel?: string | null;
}

const ProfileSetupStep = ({ onComplete, defaultRegion, defaultBoard, defaultLevel }: ProfileSetupStepProps) => {
  const [region, setRegion] = useState(defaultRegion ?? "");
  const [board, setBoard] = useState(defaultBoard ?? "");
  const [level, setLevel] = useState(defaultLevel ?? "");
  const [saving, setSaving] = useState(false);

  const regionBoards = region && region !== "Other" ? getRegionBoards(region) : [];
  const boardLevels = board ? (BOARD_LEVEL_MAP[board] ?? []) : [];
  const allFilled = !!region && !!board && !!level;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Save to user_preferences
      const { error: prefError } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          curriculum_region: region,
          preferred_exam_board: board,
          preferred_educational_level: level,
        }, { onConflict: "user_id" });

      if (prefError) {
        console.error("Error saving preferences:", prefError);
      }

      // Update onboarding status
      await supabase
        .from("user_onboarding_status")
        .upsert({
          user_id: user.id,
          role: "student",
          profile_completed: true,
          last_step: "profile",
        }, { onConflict: "user_id,role" });

      onComplete();
    } catch (err) {
      console.error("Error saving profile setup:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Set up your study profile</h3>
        <p className="text-sm text-muted-foreground">
          This helps us generate questions in exactly the right style for your exams. You can change this any time in Settings.
        </p>
      </div>

      {/* Region */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Where are you studying?
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              onClick={() => { setRegion(r.id); setBoard(""); setLevel(""); }}
              className={cn(
                "px-3 py-2.5 rounded-lg border text-sm text-left transition-all",
                region === r.id
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border bg-card text-muted-foreground hover:border-muted-foreground/50"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Board */}
      {region && region !== "Other" && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your exam board
          </Label>
          <Select value={board} onValueChange={(val) => { setBoard(val); setLevel(""); }}>
            <SelectTrigger>
              <SelectValue placeholder="Select your exam board..." />
            </SelectTrigger>
            <SelectContent>
              {regionBoards.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!board && (
            <p className="text-xs text-muted-foreground">
              Not sure? Pick the one most of your subjects use.
            </p>
          )}
        </div>
      )}

      {/* Level */}
      {board && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your current level
          </Label>
          <div className="flex flex-col gap-1.5">
            {boardLevels.map((levelId) => (
              <button
                key={levelId}
                onClick={() => setLevel(levelId)}
                className={cn(
                  "px-3 py-2.5 rounded-lg border text-sm text-left transition-all",
                  level === levelId
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border bg-card text-muted-foreground hover:border-muted-foreground/50"
                )}
              >
                {LEVEL_DISPLAY_NAMES[levelId] ?? levelId}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {allFilled && (
        <div className="p-3 rounded-lg bg-primary/5 border-l-3 border-primary text-sm text-muted-foreground">
          <Check className="inline-block w-4 h-4 text-green-500 mr-1.5 -mt-0.5" />
          Your questions will be generated in{" "}
          <strong className="text-foreground">
            {getBoardDisplayName(board)} {LEVEL_DISPLAY_NAMES[level]}
          </strong>{" "}
          style
        </div>
      )}

      <div className="space-y-2 pt-2">
        <Button
          onClick={handleSave}
          disabled={!allFilled || saving}
          className="w-full"
        >
          {saving ? "Saving..." : "Continue"}
          {!saving && <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>
        <Button
          variant="ghost"
          onClick={onComplete}
          className="w-full text-muted-foreground text-xs"
        >
          Skip for now — I'll set this up in Settings
        </Button>
      </div>
    </div>
  );
};

export default ProfileSetupStep;
