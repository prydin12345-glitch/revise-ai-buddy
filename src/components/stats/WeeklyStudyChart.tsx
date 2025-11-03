import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Clock } from "lucide-react";

interface WeeklyStudyChartProps {
  data: Array<{
    day: string;
    [key: string]: number | string;
  }>;
  subjects: Array<{
    name: string;
    color: string;
  }>;
}

export const WeeklyStudyChart = ({ data, subjects }: WeeklyStudyChartProps) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.fill }}
              />
              <span>{entry.name}:</span>
              <span className="font-medium ml-auto">{entry.value.toFixed(1)}h</span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-border text-sm font-semibold">
            Total: {total.toFixed(1)}h
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Weekly Study Activity
        </CardTitle>
        <CardDescription>Hours studied per subject each day</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 && subjects.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="day" 
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
                label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              {subjects.map((subject) => (
                <Bar
                  key={subject.name}
                  dataKey={subject.name}
                  stackId="study"
                  fill={subject.color}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Start tracking your study time in Revision Plan
          </div>
        )}
      </CardContent>
    </Card>
  );
};
