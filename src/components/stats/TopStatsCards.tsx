import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, CheckCircle2, Clock } from "lucide-react";

interface TopStatsCardsProps {
  totalExams: number;
  completedExams: number;
  inProgressExams: number;
}

export const TopStatsCards = ({ totalExams, completedExams, inProgressExams }: TopStatsCardsProps) => {
  const percentageComplete = totalExams > 0 ? (completedExams / totalExams) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
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

      <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">Completed</p>
              <p className="text-3xl font-bold text-foreground">{completedExams}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-success rounded-full transition-all duration-500"
                style={{ width: `${percentageComplete}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round(percentageComplete)}% complete</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-warning/10">
              <Clock className="h-6 w-6 text-warning" />
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
    </div>
  );
};
