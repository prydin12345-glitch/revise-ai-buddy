import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, Flame } from "lucide-react";

interface DailyGoalBarProps {
  targetMinutes: number;
  completedMinutes: number;
  blocksCompleted: number;
  longestFocusBlock: number;
  streak?: number;
}

export const DailyGoalBar = ({
  targetMinutes,
  completedMinutes,
  blocksCompleted,
  longestFocusBlock,
  streak,
}: DailyGoalBarProps) => {
  const progressPercentage = Math.min((completedMinutes / targetMinutes) * 100, 100);
  const targetHours = Math.floor(targetMinutes / 60);
  const targetMins = targetMinutes % 60;
  const completedHours = Math.floor(completedMinutes / 60);
  const completedMins = completedMinutes % 60;

  return (
    <Card className="p-4">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Today's plan</h3>
            <p className="text-xs text-muted-foreground">
              {completedHours}h {completedMins}m / {targetHours}h {targetMins}m revision
            </p>
          </div>
          {streak !== undefined && streak > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/10">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-orange-500">{streak}</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <Progress value={progressPercentage} className="h-2" />

        {/* Micro-metrics */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            <span>{blocksCompleted} block{blocksCompleted !== 1 ? 's' : ''} completed</span>
          </div>
          {longestFocusBlock > 0 && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>Longest: {longestFocusBlock}m</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};