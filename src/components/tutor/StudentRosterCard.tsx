import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Eye, TrendingDown } from "lucide-react";

interface StudentRosterCardProps {
  student: {
    id: string;
    display_name: string | null;
    student_code: string | null;
    group_name: string;
    group_id: string;
    first_name?: string | null;
    completion_rate?: number;
    average_score?: number;
    weakest_subject?: string | null;
    exams_completed?: number;
    exams_assigned?: number;
  };
  onViewProgress: (studentId: string) => void;
}

export const StudentRosterCard = ({ student, onViewProgress }: StudentRosterCardProps) => {
  // Extract first name from display_name
  const firstName = student.first_name || student.display_name?.split(" ")[0] || "Student";
  const initials = firstName[0]?.toUpperCase() || "S";
  
  const completionRate = student.completion_rate ?? 0;
  const averageScore = student.average_score ?? 0;
  const examsCompleted = student.exams_completed ?? 0;
  const examsAssigned = student.exams_assigned ?? 0;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    if (score > 0) return "text-rose-500";
    return "text-muted-foreground";
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-accent/5 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <Avatar className="h-12 w-12 border-2 border-primary/20">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-foreground">
              {firstName}
            </p>
            {student.student_code && (
              <span className="text-muted-foreground font-mono text-sm">
                ({student.student_code})
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">
              {student.group_name}
            </Badge>
            
            {examsAssigned > 0 && (
              <span className="text-xs text-muted-foreground">
                {examsCompleted}/{examsAssigned} tasks
              </span>
            )}
          </div>
          
          {examsAssigned > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <Progress value={completionRate} className="h-1.5 flex-1 max-w-[100px]" />
              <span className="text-xs text-muted-foreground">
                {Math.round(completionRate)}%
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Average Score */}
        <div className="text-right hidden sm:block">
          <p className="text-xs text-muted-foreground">Avg Score</p>
          <p className={`text-lg font-bold ${getScoreColor(averageScore)}`}>
            {averageScore > 0 ? `${Math.round(averageScore)}%` : "--"}
          </p>
        </div>

        {/* Weakest Subject */}
        {student.weakest_subject && (
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md bg-rose-500/10 text-rose-500">
            <TrendingDown className="h-3 w-3" />
            <span className="text-xs font-medium truncate max-w-[80px]">
              {student.weakest_subject}
            </span>
          </div>
        )}

        <Button 
          onClick={() => onViewProgress(student.id)}
          className="gap-2"
          size="sm"
        >
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">View Progress</span>
        </Button>
      </div>
    </div>
  );
};
