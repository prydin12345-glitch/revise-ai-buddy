import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

interface TutorExamResultsChartProps {
  data: Array<{
    period: string;
    score: number;
    subject: string;
  }>;
  subjectColors: Record<string, string>;
}

export const TutorExamResultsChart = ({ data, subjectColors }: TutorExamResultsChartProps) => {
  // Group data by period and create multi-subject chart data
  const chartData = data.reduce((acc, item) => {
    const existing = acc.find(d => d.period === item.period);
    if (existing) {
      existing[item.subject] = item.score;
    } else {
      acc.push({
        period: item.period,
        [item.subject]: item.score
      });
    }
    return acc;
  }, [] as Array<{ period: string; [key: string]: number | string }>);

  // Get unique subjects
  const subjects = [...new Set(data.map(d => d.subject))];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Exam Results Over Time
        </CardTitle>
        <CardDescription>Score progression by subject</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="period"
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: "12px" }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: "12px" }}
                label={{ value: "Score (%)", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px"
                }}
                formatter={(value: any, name: string) => [`${Math.round(value)}%`, name]}
              />
              {subjects.map((subject) => (
                <Line
                  key={subject}
                  type="monotone"
                  dataKey={subject}
                  stroke={subjectColors[subject] || "#3B82F6"}
                  strokeWidth={2}
                  dot={{ fill: subjectColors[subject] || "#3B82F6", r: 4 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No exam data to display
          </div>
        )}
        
        {/* Legend */}
        {subjects.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-4 justify-center">
            {subjects.map((subject) => (
              <div key={subject} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: subjectColors[subject] || "#3B82F6" }}
                />
                <span className="text-sm text-muted-foreground">{subject}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
