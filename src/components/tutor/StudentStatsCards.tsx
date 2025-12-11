import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, CheckCircle, AlertTriangle, Info, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

interface StudentStatsCardsProps {
  totalStudents: number;
  averageScore: number;
  completionRate: number;
  weakestTopics: string[];
  selectedGroup: string;
  loading?: boolean;
  onAverageScoreClick?: () => void;
  onCompletionRateClick?: () => void;
  onWeakestTopicsClick?: () => void;
}

export const StudentStatsCards = ({
  totalStudents,
  averageScore,
  completionRate,
  weakestTopics,
  selectedGroup,
  loading = false,
  onAverageScoreClick,
  onCompletionRateClick,
  onWeakestTopicsClick,
}: StudentStatsCardsProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="min-h-[140px]">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <Card className="min-h-[140px] bg-gradient-to-br from-card to-primary/5 border-border/50 hover:shadow-lg hover:border-primary/20 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Students
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p>Number of students in {selectedGroup === "all" ? "all groups" : "selected group"}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-3xl font-bold tracking-tight">{totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedGroup === "all" ? "Across all groups" : "In selected group"}
            </p>
          </CardContent>
        </Card>

        {/* Average Score */}
        <Card 
          className={`min-h-[140px] bg-gradient-to-br from-card to-emerald-500/5 border-border/50 hover:shadow-lg hover:border-emerald-500/20 transition-all duration-300 ${onAverageScoreClick ? "cursor-pointer hover:scale-[1.01]" : ""}`}
          onClick={onAverageScoreClick}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Score
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p>Average score across all completed exams and practice sets. Click for details.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              {onAverageScoreClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-3xl font-bold tracking-tight">
              {averageScore > 0 ? `${Math.round(averageScore)}%` : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {averageScore >= 80 ? "Excellent performance" : 
               averageScore >= 60 ? "Good progress" : 
               averageScore > 0 ? "Needs improvement" : "No data yet"}
            </p>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card 
          className={`min-h-[140px] bg-gradient-to-br from-card to-blue-500/5 border-border/50 hover:shadow-lg hover:border-blue-500/20 transition-all duration-300 ${onCompletionRateClick ? "cursor-pointer hover:scale-[1.01]" : ""}`}
          onClick={onCompletionRateClick}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completion Rate
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p>Tasks completed ÷ tasks assigned × 100. Click for breakdown.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <CheckCircle className="h-4 w-4 text-blue-500" />
              </div>
              {onCompletionRateClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-3xl font-bold tracking-tight">
              {completionRate > 0 ? `${Math.round(completionRate)}%` : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {completionRate >= 90 ? "Outstanding" : 
               completionRate >= 70 ? "On track" : 
               completionRate > 0 ? "Below target" : "No assignments yet"}
            </p>
          </CardContent>
        </Card>

        {/* Weakest Topics */}
        <Card 
          className={`min-h-[140px] bg-gradient-to-br from-card to-amber-500/5 border-border/50 hover:shadow-lg hover:border-amber-500/20 transition-all duration-300 ${onWeakestTopicsClick ? "cursor-pointer hover:scale-[1.01]" : ""}`}
          onClick={onWeakestTopicsClick}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Weakest Topics
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p>Topics with lowest average scores. Click for detailed analysis.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              {onWeakestTopicsClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {weakestTopics.length > 0 ? (
              <div className="space-y-1">
                {weakestTopics.slice(0, 3).map((topic, index) => (
                  <div
                    key={topic}
                    className="text-sm font-medium truncate"
                    style={{ opacity: 1 - index * 0.2 }}
                  >
                    {topic}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Insufficient data
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};
