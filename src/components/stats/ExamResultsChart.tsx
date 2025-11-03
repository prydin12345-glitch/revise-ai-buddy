import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp } from "lucide-react";

interface ExamResultsChartProps {
  data: Array<{
    period: string;
    [key: string]: number | string;
  }>;
  subjects: Array<{
    name: string;
    color: string;
  }>;
  timeRange: 'weekly' | 'monthly' | 'yearly';
  onTimeRangeChange: (range: 'weekly' | 'monthly' | 'yearly') => void;
  revisionGoals: Array<{
    subject: string;
    targetPercentage: number;
    deadline: string;
    currentAverage: number;
    color: string;
  }>;
}

export const ExamResultsChart = ({ 
  data, 
  subjects, 
  timeRange, 
  onTimeRangeChange,
  revisionGoals 
}: ExamResultsChartProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Exam Results Over Time
            </CardTitle>
            <CardDescription>Track your score progression by subject</CardDescription>
          </div>
          <Select value={timeRange} onValueChange={onTimeRangeChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 && subjects.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="period" 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                  label={{ value: 'Score (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: any) => [`${Math.round(value)}%`, '']}
                />
                {subjects.map((subject) => (
                  <Line
                    key={subject.name}
                    type="monotone"
                    dataKey={subject.name}
                    stroke={subject.color}
                    strokeWidth={3}
                    dot={{ fill: subject.color, r: 5 }}
                    connectNulls
                    name={subject.name}
                  />
                ))}
                {revisionGoals.map((goal) => (
                  <ReferenceLine
                    key={`goal-${goal.subject}`}
                    y={goal.targetPercentage}
                    stroke={goal.color}
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{ 
                      value: `${goal.subject} Target: ${goal.targetPercentage}%`, 
                      fill: goal.color,
                      position: 'right',
                      style: { fontSize: '11px' }
                    }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            {revisionGoals.length > 0 && (
              <div className="mt-4 space-y-2">
                {revisionGoals.map((goal) => (
                  <div key={goal.subject} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{goal.subject} Progress:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${Math.min((goal.currentAverage / goal.targetPercentage) * 100, 100)}%`,
                            backgroundColor: goal.color
                          }}
                        />
                      </div>
                      <span className="font-medium" style={{ color: goal.color }}>
                        {Math.round(goal.currentAverage)}% / {goal.targetPercentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            Complete some exams to see your progress over time
          </div>
        )}
      </CardContent>
    </Card>
  );
};
