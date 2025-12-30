import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Eye, Users } from "lucide-react";

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

  // Determine performance indicator color
  const getPerformanceColor = () => {
    if (averageScore >= 80) return { ring: "ring-emerald-500/40", text: "text-emerald-500", bg: "bg-emerald-500" };
    if (averageScore >= 60) return { ring: "ring-amber-500/40", text: "text-amber-500", bg: "bg-amber-500" };
    if (averageScore > 0) return { ring: "ring-rose-500/40", text: "text-rose-500", bg: "bg-rose-500" };
    return { ring: "ring-border", text: "text-muted-foreground", bg: "bg-muted" };
  };

  const performanceColors = getPerformanceColor();

  return (
    <Card 
      className="group bg-card/40 border-border/40 hover:border-primary/30 hover:bg-card/60 transition-all duration-200 animate-fade-in"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Avatar with performance ring */}
          <Avatar className={`h-11 w-11 ring-2 ${performanceColors.ring} transition-all shrink-0`}>
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-base">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Student Name + ID (Primary info) */}
          <div className="min-w-0 flex-shrink-0">
            <h3 className="text-sm font-semibold text-foreground truncate leading-tight">
              {firstName}
            </h3>
            <p className="text-xs text-muted-foreground/70 truncate">
              {studentId}
            </p>
          </div>

          {/* Class Badge (Secondary info) */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <Badge 
              variant="outline" 
              className="text-xs font-normal bg-muted/30 border-border/50 text-muted-foreground gap-1 px-2 py-0.5"
            >
              <Users className="h-3 w-3 opacity-70" />
              {student.group_name}
            </Badge>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Progress Stats (Tertiary info) - Desktop */}
          <div className="hidden md:flex flex-col items-end gap-1.5 min-w-[130px]">
            <div className="flex items-center gap-2 w-full">
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider w-14">Progress</span>
              <Progress 
                value={completionRate} 
                className="h-1.5 flex-1 bg-muted/40" 
              />
              <span className="text-xs font-medium text-muted-foreground w-10 text-right tabular-nums">
                {examsCompleted}/{examsAssigned}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Avg</span>
              <span className={`text-sm font-bold tabular-nums ${performanceColors.text}`}>
                {averageScore > 0 ? `${Math.round(averageScore)}%` : "--"}
              </span>
            </div>
          </div>

          {/* Mobile Stats */}
          <div className="flex md:hidden flex-col items-end gap-0.5 min-w-[50px]">
            <span className={`text-base font-bold tabular-nums ${performanceColors.text}`}>
              {averageScore > 0 ? `${Math.round(averageScore)}%` : "--"}
            </span>
            <span className="text-[10px] text-muted-foreground/60 tabular-nums">
              {examsCompleted}/{examsAssigned}
            </span>
          </div>

          {/* View Progress Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewProgress(student.id)}
            className="gap-1.5 bg-primary/5 border-primary/25 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95 shrink-0"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">View</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};