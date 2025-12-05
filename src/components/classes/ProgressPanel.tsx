import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { TrendingUp, Award, Clock } from "lucide-react";

interface ProgressPanelProps {
  completed: number;
  total: number;
  averageScore?: number;
  pendingFeedback?: number;
}

export const ProgressPanel = ({ completed, total, averageScore, pendingFeedback }: ProgressPanelProps) => {
  const pending = total - completed;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const data = [
    { name: "Completed", value: completed, color: "hsl(var(--success))" },
    { name: "Pending", value: pending || 0.1, color: "hsl(var(--muted))" },
  ];

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Your Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={35}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-foreground">{percentage}%</span>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{completed}/{total}</p>
            <p className="text-sm text-muted-foreground">Tasks completed</p>
          </div>
        </div>

        {averageScore !== undefined && averageScore > 0 && (
          <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg">
            <Award className="w-5 h-5 text-success" />
            <div>
              <p className="text-sm font-medium text-foreground">Average Score</p>
              <p className="text-lg font-bold text-success">{averageScore}%</p>
            </div>
          </div>
        )}

        {pendingFeedback !== undefined && pendingFeedback > 0 && (
          <div className="flex items-center gap-3 p-3 bg-warning/10 rounded-lg">
            <Clock className="w-5 h-5 text-warning" />
            <div>
              <p className="text-sm font-medium text-foreground">Pending Feedback</p>
              <p className="text-sm text-muted-foreground">{pendingFeedback} response(s) awaiting</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
