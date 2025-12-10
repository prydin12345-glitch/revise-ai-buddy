import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Eye, TrendingDown, Users } from "lucide-react";

interface StudentRosterCardProps {
  student: {
    id: string;
    first_name?: string | null;
    display_name: string | null;
    student_code: string | null;
    group_id: string;
    group_name: string;
    completion_rate?: number;
    average_score?: number;
    weakest_subject?: string | null;
    exams_completed?: number;
    exams_assigned?: number;
  };
  onViewProgress: (studentId: string) => void;
  animationDelay?: number;
}

export const StudentRosterCard = ({ student, onViewProgress, animationDelay = 0 }: StudentRosterCardProps) => {
  const firstName = student.first_name || student.display_name?.split(" ")[0] || "Student";
  const initials = firstName.charAt(0).toUpperCase();
  const studentId = student.student_code || "N/A";
  const completionRate = student.completion_rate || 0;
  const averageScore = student.average_score || 0;
  const examsCompleted = student.exams_completed || 0;
  const examsAssigned = student.exams_assigned || 0;

  // Determine performance ring color
  const getPerformanceRingColor = () => {
    if (averageScore >= 80) return "ring-emerald-500/50";
    if (averageScore >= 60) return "ring-amber-500/50";
    if (averageScore > 0) return "ring-rose-500/50";
    return "ring-border";
  };

  // Determine score color
  const getScoreColor = () => {
    if (averageScore >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (averageScore >= 60) return "text-amber-600 dark:text-amber-400";
    if (averageScore > 0) return "text-rose-600 dark:text-rose-400";
    return "text-muted-foreground";
  };

  return (
    <Card 
      className="group bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 animate-fade-in"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <Avatar className={`h-12 w-12 ring-2 ${getPerformanceRingColor()} transition-all duration-300 group-hover:ring-primary/50`}>
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Student Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold truncate">
                {firstName} <span className="text-muted-foreground font-normal">({studentId})</span>
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs font-normal gap-1">
                <Users className="h-3 w-3" />
                {student.group_name}
              </Badge>
              {student.weakest_subject && (
                <Badge variant="outline" className="text-xs font-normal gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30">
                  <TrendingDown className="h-3 w-3" />
                  {student.weakest_subject}
                </Badge>
              )}
            </div>
          </div>

          {/* Progress Stats */}
          <div className="hidden sm:flex flex-col items-end gap-1 min-w-[120px]">
            <div className="flex items-center gap-2 w-full">
              <span className="text-xs text-muted-foreground">Progress</span>
              <Progress 
                value={completionRate} 
                className="h-2 flex-1 bg-muted/50" 
              />
              <span className="text-xs font-medium w-8 text-right">{examsCompleted}/{examsAssigned}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Avg Score:</span>
              <span className={`text-sm font-bold ${getScoreColor()}`}>
                {averageScore > 0 ? `${Math.round(averageScore)}%` : "--"}
              </span>
            </div>
          </div>

          {/* Mobile Stats */}
          <div className="flex sm:hidden flex-col items-end gap-0.5">
            <span className={`text-lg font-bold ${getScoreColor()}`}>
              {averageScore > 0 ? `${Math.round(averageScore)}%` : "--"}
            </span>
            <span className="text-xs text-muted-foreground">{examsCompleted}/{examsAssigned} done</span>
          </div>

          {/* View Progress Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewProgress(student.id)}
            className="gap-2 bg-primary/5 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 active:scale-95"
          >
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">View Progress</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
