import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { TrendingUp, BarChart3, Shuffle } from "lucide-react";

interface DifficultySettingsProps {
  mode: "fixed" | "increasing" | "mixed";
  level: "easy" | "medium" | "hard";
  onModeChange: (mode: "fixed" | "increasing" | "mixed") => void;
  onLevelChange: (level: "easy" | "medium" | "hard") => void;
}

export function DifficultySettings({
  mode,
  level,
  onModeChange,
  onLevelChange,
}: DifficultySettingsProps) {
  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-2">
        <Label className="text-base font-semibold">Difficulty Mode</Label>
        <p className="text-sm text-muted-foreground">
          Choose how question difficulty should be distributed
        </p>
      </div>

      <RadioGroup value={mode} onValueChange={onModeChange} className="space-y-4">
        <div className="flex items-start space-x-3">
          <RadioGroupItem value="fixed" id="fixed" className="mt-1" />
          <div className="flex-1 space-y-1">
            <Label htmlFor="fixed" className="flex items-center gap-2 cursor-pointer">
              <BarChart3 className="h-4 w-4" />
              Fixed Difficulty
            </Label>
            <p className="text-sm text-muted-foreground">
              All questions at the same difficulty level
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <RadioGroupItem value="increasing" id="increasing" className="mt-1" />
          <div className="flex-1 space-y-1">
            <Label htmlFor="increasing" className="flex items-center gap-2 cursor-pointer">
              <TrendingUp className="h-4 w-4" />
              Increasing Difficulty
            </Label>
            <p className="text-sm text-muted-foreground">
              Questions progressively get harder from easy to hard
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <RadioGroupItem value="mixed" id="mixed" className="mt-1" />
          <div className="flex-1 space-y-1">
            <Label htmlFor="mixed" className="flex items-center gap-2 cursor-pointer">
              <Shuffle className="h-4 w-4" />
              Mixed Difficulty
            </Label>
            <p className="text-sm text-muted-foreground">
              Balanced mix of easy, medium, and hard questions
            </p>
          </div>
        </div>
      </RadioGroup>

      {mode === "fixed" && (
        <div className="space-y-2 pt-4 border-t">
          <Label htmlFor="difficulty-level">Difficulty Level</Label>
          <Select value={level} onValueChange={onLevelChange}>
            <SelectTrigger id="difficulty-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </Card>
  );
}
