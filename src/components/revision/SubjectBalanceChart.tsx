import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { TrendingDown } from "lucide-react";

interface SubjectStats {
  subject: string;
  subject_color: string;
  total_minutes: number;
  blocks_count: number;
}

interface SubjectBalanceChartProps {
  stats: SubjectStats[];
  weekStart: Date;
}

export const SubjectBalanceChart = ({ stats, weekStart }: SubjectBalanceChartProps) => {
  if (stats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Subject Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No revision data for this week yet
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalMinutes = stats.reduce((sum, stat) => sum + stat.total_minutes, 0);
  const chartData = stats.map((stat) => ({
    name: stat.subject,
    value: stat.total_minutes,
    percentage: ((stat.total_minutes / totalMinutes) * 100).toFixed(0),
    color: stat.subject_color,
  }));

  // Find under-served subjects (less than expected percentage)
  const expectedPercentage = 100 / stats.length;
  const underServed = chartData.filter(
    (data) => parseFloat(data.percentage) < expectedPercentage * 0.7
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Subject Balance</CardTitle>
        <p className="text-xs text-muted-foreground">
          This week • {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m total
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => `${Math.floor(value / 60)}h ${value % 60}m`}
            />
            <Legend
              formatter={(value, entry: any) => `${value} (${entry.payload.percentage}%)`}
              iconType="circle"
              wrapperStyle={{ fontSize: "12px" }}
            />
          </PieChart>
        </ResponsiveContainer>

        {underServed.length > 0 && (
          <div className="mt-4 p-3 bg-muted/50 rounded-md">
            <div className="flex items-start gap-2">
              <TrendingDown className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-foreground mb-1">Under-served subjects:</p>
                {underServed.map((subject) => (
                  <p key={subject.name} className="text-muted-foreground">
                    {subject.name}: {subject.percentage}% (under target)
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};