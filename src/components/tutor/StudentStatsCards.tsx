import { Card, CardContent } from "@/components/ui/card";
import { Users, TrendingUp, Target, AlertCircle } from "lucide-react";

interface StudentStatsCardsProps {
  totalStudents: number;
  averageScore: number;
  completionRate: number;
  weakestTopics: string[];
  selectedGroup: string;
}

export const StudentStatsCards = ({
  totalStudents,
  averageScore,
  completionRate,
  weakestTopics,
  selectedGroup
}: StudentStatsCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">Total Students</p>
              <p className="text-3xl font-bold text-foreground">{totalStudents}</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {selectedGroup === "all" ? "Across all groups" : "In selected group"}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <TrendingUp className="h-6 w-6 text-emerald-500" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">Average Score</p>
              <p className="text-3xl font-bold text-foreground">
                {averageScore > 0 ? `${Math.round(averageScore)}%` : "--"}
              </p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {averageScore > 0 ? "Across all completed exams" : "No data yet"}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-amber-500/10">
              <Target className="h-6 w-6 text-amber-500" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
              <p className="text-3xl font-bold text-foreground">
                {completionRate > 0 ? `${Math.round(completionRate)}%` : "--"}
              </p>
            </div>
          </div>
          {completionRate > 0 && (
            <div className="space-y-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            {completionRate > 0 ? "Tasks completed vs assigned" : "No data yet"}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-rose-500/10">
              <AlertCircle className="h-6 w-6 text-rose-500" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">Weakest Topics</p>
              <p className="text-xl font-bold text-foreground truncate max-w-[120px]">
                {weakestTopics.length > 0 ? weakestTopics[0] : "--"}
              </p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {weakestTopics.length > 1 
              ? `+${weakestTopics.length - 1} more subjects need attention`
              : weakestTopics.length > 0 
                ? "Needs improvement"
                : "No data yet"
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
