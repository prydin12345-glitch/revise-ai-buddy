import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3 } from "lucide-react";

interface ExamSubmission {
  id: string;
  exam_id: string;
  submitted_at: string;
  total_score: number | null;
  total_marks: number | null;
  exam_title: string;
}

interface ScoreHistogramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: ExamSubmission[];
  studentName: string;
}

export const ScoreHistogramModal = ({
  open,
  onOpenChange,
  submissions,
  studentName
}: ScoreHistogramModalProps) => {
  // Create score ranges
  const ranges = [
    { range: "0-10", min: 0, max: 10 },
    { range: "11-20", min: 11, max: 20 },
    { range: "21-30", min: 21, max: 30 },
    { range: "31-40", min: 31, max: 40 },
    { range: "41-50", min: 41, max: 50 },
    { range: "51-60", min: 51, max: 60 },
    { range: "61-70", min: 61, max: 70 },
    { range: "71-80", min: 71, max: 80 },
    { range: "81-90", min: 81, max: 90 },
    { range: "91-100", min: 91, max: 100 },
  ];

  // Calculate histogram data
  const histogramData = ranges.map(({ range, min, max }) => {
    const examsInRange = submissions.filter(s => {
      if (s.total_score === null || !s.total_marks || s.total_marks === 0) return false;
      const percentage = (s.total_score / s.total_marks) * 100;
      return percentage >= min && percentage <= max;
    });

    return {
      range,
      count: examsInRange.length,
      exams: examsInRange.map(e => ({
        name: e.exam_title,
        score: e.total_score && e.total_marks ? Math.round((e.total_score / e.total_marks) * 100) : 0,
        date: new Date(e.submitted_at).toLocaleDateString("en-US", { 
          month: "short", 
          day: "numeric",
          year: "numeric"
        })
      }))
    };
  });

  const getBarColor = (range: string) => {
    const startValue = parseInt(range.split("-")[0]);
    if (startValue >= 80) return "hsl(142, 71%, 45%)"; // emerald
    if (startValue >= 60) return "hsl(210, 85%, 55%)"; // primary blue
    if (startValue >= 40) return "hsl(45, 93%, 47%)"; // amber
    return "hsl(0, 72%, 51%)"; // red
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg max-w-[250px]">
          <p className="font-semibold text-foreground mb-2">
            Score Range: {data.range}%
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            {data.count} exam{data.count !== 1 ? "s" : ""}
          </p>
          {data.exams.length > 0 && (
            <div className="space-y-1 border-t border-border pt-2">
              {data.exams.slice(0, 5).map((exam: any, i: number) => (
                <div key={i} className="text-xs">
                  <span className="font-medium">{exam.name}</span>
                  <span className="text-muted-foreground ml-2">
                    {exam.score}% • {exam.date}
                  </span>
                </div>
              ))}
              {data.exams.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{data.exams.length - 5} more
                </p>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const totalExams = submissions.filter(s => 
    s.total_score !== null && s.total_marks && s.total_marks > 0
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Score Distribution - {studentName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Distribution of {totalExams} exam score{totalExams !== 1 ? "s" : ""} across percentage ranges.
            Hover over bars to see exam details.
          </p>

          {totalExams > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={histogramData}
                  margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="range" 
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    label={{ 
                      value: "Number of Exams", 
                      angle: -90, 
                      position: "insideLeft",
                      style: { fontSize: 12, fill: "hsl(var(--muted-foreground))" }
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="count" 
                    radius={[4, 4, 0, 0]}
                  >
                    {histogramData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.range)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No exam data available
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(0, 72%, 51%)" }} />
              <span>0-39%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(45, 93%, 47%)" }} />
              <span>40-59%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(210, 85%, 55%)" }} />
              <span>60-79%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(142, 71%, 45%)" }} />
              <span>80-100%</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
