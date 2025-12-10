import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, BookOpen, Target, Clock, Award } from "lucide-react";
import { useTutorStudentStats } from "@/hooks/useTutorStudentStats";
import { TutorExamResultsChart } from "./TutorExamResultsChart";
import { TutorSubjectPerformanceChart } from "./TutorSubjectPerformanceChart";
import { StudentRecentExamsTable } from "./StudentRecentExamsTable";
import { FlaggedQuestionsPanel } from "./FlaggedQuestionsPanel";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StudentProgressDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    id: string;
    display_name: string | null;
    student_code: string | null;
    group_name: string;
    first_name?: string | null;
  } | null;
}

export const StudentProgressDashboard = ({
  open,
  onOpenChange,
  student
}: StudentProgressDashboardProps) => {
  const { stats, loading } = useTutorStudentStats(student?.id || null);

  if (!student) return null;

  const firstName = student.first_name || student.display_name?.split(" ")[0] || "Student";
  const initials = firstName[0]?.toUpperCase() || "S";

  // Build subject color map
  const subjectColors: Record<string, string> = {};
  stats?.subjectPerformance.forEach(s => {
    subjectColors[s.name] = s.color;
  });

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-xl">
                {firstName}
                {student.student_code && (
                  <span className="text-muted-foreground font-normal ml-2 font-mono text-base">
                    ({student.student_code})
                  </span>
                )}
              </DialogTitle>
              <Badge variant="secondary" className="mt-1">
                {student.group_name}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)]">
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : stats ? (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{stats.completedExams}</p>
                          <p className="text-xs text-muted-foreground">Exams Completed</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <Award className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {stats.averageScore > 0 ? `${Math.round(stats.averageScore)}%` : "--"}
                          </p>
                          <p className="text-xs text-muted-foreground">Average Score</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                          <Target className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {stats.completionRate > 0 ? `${Math.round(stats.completionRate)}%` : "--"}
                          </p>
                          <p className="text-xs text-muted-foreground">Completion Rate</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-violet-500/10">
                          <Clock className="h-5 w-5 text-violet-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {stats.totalTimeSpent > 0 ? formatTime(stats.totalTimeSpent) : "--"}
                          </p>
                          <p className="text-xs text-muted-foreground">Time Spent</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <TutorExamResultsChart
                    data={stats.examResultsOverTime}
                    subjectColors={subjectColors}
                  />
                  <TutorSubjectPerformanceChart
                    data={stats.subjectPerformance}
                  />
                </div>

                {/* Bottom Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <StudentRecentExamsTable
                    exams={stats.submissions}
                    studentId={student.id}
                    subjectColors={subjectColors}
                  />
                  <FlaggedQuestionsPanel
                    threads={stats.feedbackThreads}
                  />
                </div>

                {/* Weakest/Strongest Subjects */}
                {(stats.weakestSubject || stats.strongestSubject) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stats.strongestSubject && (
                      <Card className="border-emerald-500/30 bg-emerald-500/5">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Strongest Subject</p>
                              <p className="text-lg font-bold text-emerald-600">{stats.strongestSubject}</p>
                            </div>
                            <Award className="h-8 w-8 text-emerald-500/50" />
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {stats.weakestSubject && (
                      <Card className="border-rose-500/30 bg-rose-500/5">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Needs Improvement</p>
                              <p className="text-lg font-bold text-rose-600">{stats.weakestSubject}</p>
                            </div>
                            <Target className="h-8 w-8 text-rose-500/50" />
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                No data available for this student
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
