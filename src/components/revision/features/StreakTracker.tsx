import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Flame } from "lucide-react";

interface StreakTrackerProps {
  currentStreak: number;
  longestStreak: number;
}

export const StreakTracker = ({ currentStreak, longestStreak }: StreakTrackerProps) => {
  const getMotivationalMessage = () => {
    if (currentStreak === 0) return "Complete a task today to start your streak!";
    if (currentStreak <= 3) return "Keep it up! 🔥";
    if (currentStreak <= 6) return "You're on fire! 🔥🔥";
    return "Amazing streak! Don't break the chain! 🔥🔥🔥";
  };

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
            <div className={`text-3xl font-bold transition-all duration-500 ${
              currentStreak > 0 ? 'text-orange-500 animate-pulse' : 'text-muted-foreground'
            }`}>
              {currentStreak}
            </div>
            <p className="text-xs text-muted-foreground">days current</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold text-muted-foreground">{longestStreak}</div>
            <p className="text-xs text-muted-foreground">personal best</p>
          </div>
        </div>
        
        <div className={`mt-3 p-2 rounded text-xs text-center transition-all ${
          currentStreak > 0 
            ? 'bg-orange-500/10 text-orange-500' 
            : 'bg-muted text-muted-foreground'
        }`}>
          {getMotivationalMessage()}
        </div>
      </CardContent>
    </Card>
  );
};
