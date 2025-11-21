import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Target } from "lucide-react";

interface SubjectPerformanceChartProps {
  data: Array<{
    name: string;
    value: number;
    count: number;
    avgScore: number;
    color: string;
  }>;
  viewMode: 'score' | 'count';
  onViewModeChange: (mode: 'score' | 'count') => void;
}

export const SubjectPerformanceChart = ({ data, viewMode, onViewModeChange }: SubjectPerformanceChartProps) => {
  const chartData = data.map(item => ({
    ...item,
    value: viewMode === 'score' ? item.avgScore : item.count,
  }));

  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);
  const centerValue = viewMode === 'score' 
    ? `${Math.round(totalValue / chartData.length)}%`
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
          <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as 'score' | 'count')}>
            <TabsList className="grid grid-cols-2 w-48">
              <TabsTrigger value="score">By Score</TabsTrigger>
              <TabsTrigger value="count">By Count</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="relative">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
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
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <p className="text-3xl font-bold text-foreground">{centerValue}</p>
              <p className="text-xs text-muted-foreground">
                {viewMode === 'score' ? 'Avg Score' : 'Total Exams'}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.map((subject) => (
                <div key={subject.name} className="flex items-center gap-2 text-sm">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: subject.color }}
                  />
                  <span className="font-medium truncate">{subject.name}</span>
                  <span className="text-muted-foreground ml-auto">
                    {Math.round(subject.avgScore)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No completed exams yet — start one now!
          </div>
        )}
      </CardContent>
    </Card>
  );
};
