import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Flame } from "lucide-react";

interface StreakTrackerProps {
  currentStreak: number;
  longestStreak: number;
}

export const StreakTracker = ({ currentStreak, longestStreak }: StreakTrackerProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          Study Streak
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-orange-500">{currentStreak}</div>
            <p className="text-xs text-muted-foreground">days current</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold text-muted-foreground">{longestStreak}</div>
            <p className="text-xs text-muted-foreground">personal best</p>
          </div>
        </div>
        
        {currentStreak > 0 && (
          <div className="mt-3 p-2 bg-orange-500/10 rounded text-xs text-center">
            🔥 Keep it up! Don't break the chain!
          </div>
        )}
        
        {currentStreak === 0 && (
          <div className="mt-3 p-2 bg-muted rounded text-xs text-center text-muted-foreground">
            Complete a task today to start your streak!
          </div>
        )}
      </CardContent>
    </Card>
  );
};
