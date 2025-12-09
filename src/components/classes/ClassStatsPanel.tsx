import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Target, CheckCircle2, Clock } from "lucide-react";

interface ClassStatsPanelProps {
  totalAssigned: number;
  totalCompleted: number;
  averageScore?: number;
  pendingFeedback: number;
}

export const ClassStatsPanel = ({ 
  totalAssigned, 
  totalCompleted, 
  averageScore,
  pendingFeedback 
}: ClassStatsPanelProps) => {
  const completionRate = totalAssigned > 0 
    ? Math.round((totalCompleted / totalAssigned) * 100) 
    : 0;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Class Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Target className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xl font-bold text-foreground">{completionRate}%</p>
            <p className="text-xs text-muted-foreground">Completion Rate</p>
          </div>
          
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl font-bold text-foreground">{totalCompleted}/{totalAssigned}</p>
            <p className="text-xs text-muted-foreground">Tasks Done</p>
          </div>
        </div>

        {averageScore !== undefined && (
          <div className="p-3 bg-primary/10 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Average Score</span>
            <span className="text-lg font-bold text-primary">{averageScore}%</span>
          </div>
        )}

        {pendingFeedback > 0 && (
          <div className="p-3 bg-amber-500/10 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Pending Feedback
            </span>
            <span className="text-lg font-bold text-amber-600">{pendingFeedback}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
