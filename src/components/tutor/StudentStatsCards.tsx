import { Users, TrendingUp, CheckCircle, AlertTriangle } from "lucide-react";
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
  
  // Helper text based on performance
  const getScoreHelper = () => {
    if (averageScore >= 80) return "Excellent";
    if (averageScore >= 60) return "Good progress";
    if (averageScore > 0) return "Needs work";
    return "No data";
  };

  const getCompletionHelper = () => {
    if (completionRate >= 90) return "Outstanding";
    if (completionRate >= 70) return "On track";
    if (completionRate > 0) return "Below target";
    return "No tasks";
  };

  const getWeakestTopicsDisplay = () => {
    if (weakestTopics.length === 0) return { value: "0", helper: "No issues" };
    return { 
      value: String(weakestTopics.length), 
      helper: weakestTopics.length === 1 ? "Needs attention" : "Need attention" 
    };
  };

  const weakestDisplay = getWeakestTopicsDisplay();

  if (loading) {
    return (
      <div className="flex flex-wrap items-center gap-6 py-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 lg:gap-8 py-2">
        {/* Total Students */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/30 border border-border/30 hover:border-primary/30 hover:bg-card/50 transition-all cursor-default"
              role="group"
              aria-label={`Total Students: ${totalStudents}`}
            >
              <div className="p-2 rounded-lg bg-primary/15">
                <Users className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold tracking-tight">{totalStudents}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {selectedGroup === "all" ? "All groups" : "In group"}
                </span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Total Students</p>
          </TooltipContent>
        </Tooltip>

        {/* Average Score */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onAverageScoreClick}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/30 border border-border/30 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              aria-label={`Average Score: ${averageScore > 0 ? Math.round(averageScore) + '%' : 'No data'}. Click for details.`}
            >
              <div className="p-2 rounded-lg bg-emerald-500/15">
                <TrendingUp className="h-5 w-5 text-emerald-500" aria-hidden="true" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-2xl font-bold tracking-tight text-emerald-500">
                  {averageScore > 0 ? `${Math.round(averageScore)}%` : "--"}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {getScoreHelper()}
                </span>
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Average Score — Click for details</p>
          </TooltipContent>
        </Tooltip>

        {/* Completion Rate */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onCompletionRateClick}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/30 border border-border/30 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              aria-label={`Completion Rate: ${completionRate > 0 ? Math.round(completionRate) + '%' : 'No data'}. Click for breakdown.`}
            >
              <div className="p-2 rounded-lg bg-blue-500/15">
                <CheckCircle className="h-5 w-5 text-blue-500" aria-hidden="true" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-2xl font-bold tracking-tight text-blue-500">
                  {completionRate > 0 ? `${Math.round(completionRate)}%` : "--"}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {getCompletionHelper()}
                </span>
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Completion Rate — Click for breakdown</p>
          </TooltipContent>
        </Tooltip>

        {/* Weakest Topics */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onWeakestTopicsClick}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/30 border border-border/30 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              aria-label={`${weakestDisplay.value} Weakest Topics. Click for analysis.`}
            >
              <div className="p-2 rounded-lg bg-amber-500/15">
                <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-2xl font-bold tracking-tight text-amber-500">
                  {weakestDisplay.value}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {weakestDisplay.helper}
                </span>
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Weakest Topics — Click for analysis</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};