import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Calendar, Target, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface Goal {
  id: string;
  subject: string;
  subject_color: string;
  target_percentage: number;
  current_percentage?: number;
  deadline?: string;
  target_exams: number;
}

interface GoalInfoCardProps {
  goal?: Goal;
  onEdit?: (goalId: string) => void;
  onDelete?: (goalId: string) => void;
}

export const GoalInfoCard = ({ goal, onEdit, onDelete }: GoalInfoCardProps) => {
  if (!goal) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No revision goals set</p>
        </CardContent>
      </Card>
    );
  }

  const daysUntil = goal.deadline ? differenceInDays(new Date(goal.deadline), new Date()) : null;
  const progressToTarget = goal.current_percentage 
    ? Math.round((goal.current_percentage / goal.target_percentage) * 100)
    : 0;

  return (
    <Card className="border-l-4 transition-all hover:shadow-lg" style={{ borderLeftColor: goal.subject_color }}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Badge 
              style={{ backgroundColor: goal.subject_color }}
              className="mb-2"
            >
              {goal.subject}
            </Badge>
            <CardTitle className="text-base">Revision Goal</CardTitle>
          </div>
          <div className="flex gap-1">
            {onEdit && (
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => onEdit(goal.id)}
                className="h-8 w-8"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => onDelete(goal.id)}
                className="h-8 w-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Deadline */}
        {daysUntil !== null && goal.deadline && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{format(new Date(goal.deadline), 'MMM d, yyyy')}</span>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-primary">{daysUntil}</div>
              <div className="text-xs text-muted-foreground">days left</div>
            </div>
          </div>
        )}

        {/* Target Score */}
        <div className="flex items-center gap-2 text-sm">
          <Target className="w-4 h-4 text-muted-foreground" />
          <span>Target: {goal.target_percentage}%</span>
        </div>

        {/* Current Progress */}
        {goal.current_percentage !== undefined && (
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Current
              </span>
              <span className="font-medium">{goal.current_percentage}%</span>
            </div>
            <Progress value={progressToTarget} className="h-2" />
          </div>
        )}

        {/* Target Exams */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Target: {goal.target_exams} exams completed</span>
        </div>
      </CardContent>
    </Card>
  );
};
