import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Target } from "lucide-react";
import { useState } from "react";

interface TutorSubjectPerformanceChartProps {
  data: Array<{
    name: string;
    avgScore: number;
    count: number;
    color: string;
  }>;
}

export const TutorSubjectPerformanceChart = ({ data }: TutorSubjectPerformanceChartProps) => {
  const [viewMode, setViewMode] = useState<"score" | "count">("score");

  const chartData = data.map(item => ({
    ...item,
    value: viewMode === "score" ? item.avgScore : item.count
  }));

  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);
  const centerValue = viewMode === "score"
    ? chartData.length > 0 ? `${Math.round(totalValue / chartData.length)}%` : "0%"
    : totalValue.toString();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold" style={{ color: data.color }}>{data.name}</p>
          <p className="text-sm text-muted-foreground">Avg Score: {Math.round(data.avgScore)}%</p>
          <p className="text-sm text-muted-foreground">Exams: {data.count}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Subject Performance
            </CardTitle>
            <CardDescription>Breakdown by subject</CardDescription>
          </div>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "score" | "count")}>
            <TabsList className="grid grid-cols-2 w-40">
              <TabsTrigger value="score">By Score</TabsTrigger>
              <TabsTrigger value="count">By Count</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="relative flex flex-col items-center">
            <div className="relative w-full h-[280px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered text overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">{centerValue}</p>
                  <p className="text-xs text-muted-foreground">
                    {viewMode === "score" ? "Avg Score" : "Total Exams"}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 w-full">
              {data.map((subject) => (
                <div key={subject.name} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: subject.color }}
                  />
                  <span className="font-medium truncate flex-1">{subject.name}</span>
                  <span className="text-muted-foreground">
                    {Math.round(subject.avgScore)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground">
            No exam data to display
          </div>
        )}
      </CardContent>
    </Card>
  );
};
