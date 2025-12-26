import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, CheckCircle2, Clock, Flame } from "lucide-react";

interface TopStatsCardsProps {
  totalExams: number;
  completedExams: number;
  inProgressExams: number;
  currentStreak: number;
  longestStreak: number;
  onCardClick?: (type: 'exams' | 'scores' | 'study-hours' | 'streak') => void;
}

export const TopStatsCards = ({ 
  totalExams, 
  completedExams, 
  inProgressExams, 
  currentStreak, 
  longestStreak,
  onCardClick 
}: TopStatsCardsProps) => {
  const percentageComplete = totalExams > 0 ? (completedExams / totalExams) * 100 : 0;

  const cardClass = onCardClick 
    ? "shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary"
    : "shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card 
        className={cardClass}
        tabIndex={onCardClick ? 0 : undefined}
        role={onCardClick ? "button" : undefined}
        onClick={() => onCardClick?.('exams')}
        onKeyDown={(e) => {
          if (onCardClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onCardClick('exams');
          }
        }}
      >
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">Total Exams</p>
              <p className="text-3xl font-bold text-foreground">{totalExams}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>All created exams</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card 
        className={cardClass}
        tabIndex={onCardClick ? 0 : undefined}
        role={onCardClick ? "button" : undefined}
        onClick={() => onCardClick?.('scores')}
        onKeyDown={(e) => {
          if (onCardClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onCardClick('scores');
          }
        }}
      >
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-green-500/10">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">Completed</p>
              <p className="text-3xl font-bold text-foreground">{completedExams}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${percentageComplete}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round(percentageComplete)}% complete</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card 
        className={cardClass}
        tabIndex={onCardClick ? 0 : undefined}
        role={onCardClick ? "button" : undefined}
        onClick={() => onCardClick?.('study-hours')}
        onKeyDown={(e) => {
          if (onCardClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onCardClick('study-hours');
          }
        }}
      >
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-orange-500/10">
              <Clock className="h-6 w-6 text-orange-500" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">In Progress</p>
              <p className="text-3xl font-bold text-foreground">{inProgressExams}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Ready to complete</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card 
        className={cardClass}
        tabIndex={onCardClick ? 0 : undefined}
        role={onCardClick ? "button" : undefined}
        onClick={() => onCardClick?.('streak')}
        onKeyDown={(e) => {
          if (onCardClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onCardClick('streak');
          }
        }}
      >
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-orange-500/10">
              <Flame className="h-6 w-6 text-orange-500" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">Current Streak</p>
              <p className="text-3xl font-bold text-foreground">{currentStreak}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Longest: {longestStreak} days</span>
              <span>🔥</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
