import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp } from "lucide-react";

interface ExamSubmission {
  student_id: string;
  student_name: string;
  exam_id: string;
  exam_title: string;
  total_score: number | null;
  total_marks: number | null;
  submitted_at: string | null;
}

interface AggregateScoreHistogramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: ExamSubmission[];
}

export const AggregateScoreHistogramModal = ({
  open,
  onOpenChange,
  submissions,
}: AggregateScoreHistogramModalProps) => {
  const ranges = [
    { label: "0-10", min: 0, max: 10 },
    { label: "11-20", min: 11, max: 20 },
    { label: "21-30", min: 21, max: 30 },
    { label: "31-40", min: 31, max: 40 },
    { label: "41-50", min: 41, max: 50 },
    { label: "51-60", min: 51, max: 60 },
    { label: "61-70", min: 61, max: 70 },
    { label: "71-80", min: 71, max: 80 },
    { label: "81-90", min: 81, max: 90 },
    { label: "91-100", min: 91, max: 100 },
  ];

  const histogramData = ranges.map((range) => {
    const examsInRange = submissions.filter((s) => {
      if (s.total_score === null || !s.total_marks) return false;
      const percentage = (s.total_score / s.total_marks) * 100;
      return percentage >= range.min && percentage <= range.max;
    });

    return {
      range: range.label,
      count: examsInRange.length,
      exams: examsInRange.map((s) => ({
        student: s.student_name,
        exam: s.exam_title,
        score: s.total_score && s.total_marks 
          ? Math.round((s.total_score / s.total_marks) * 100) 
          : 0,
        date: s.submitted_at,
      })),
    };
  });

  const getBarColor = (range: string) => {
    const num = parseInt(range.split("-")[0]);
    if (num >= 81) return "hsl(var(--chart-2))";
    if (num >= 61) return "hsl(var(--chart-1))";
    if (num >= 41) return "hsl(var(--chart-4))";
    return "hsl(var(--destructive))";
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;
    
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 max-w-xs">
        <p className="font-semibold text-sm mb-2">Score Range: {data.range}%</p>
        <p className="text-xs text-muted-foreground mb-2">{data.count} exam{data.count !== 1 ? "s" : ""}</p>
        {data.exams.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {data.exams.slice(0, 5).map((exam: any, i: number) => (
              <div key={i} className="text-xs border-t border-border/50 pt-1">
                <span className="font-medium">{exam.student}</span>
                <span className="text-muted-foreground"> - {exam.exam}</span>
                <span className="text-primary ml-1">({exam.score}%)</span>
              </div>
            ))}
            {data.exams.length > 5 && (
              <p className="text-xs text-muted-foreground">+{data.exams.length - 5} more</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const totalExams = submissions.filter(s => s.total_score !== null && s.total_marks).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            Score Distribution
          </DialogTitle>
          <DialogDescription>
            Distribution of scores across {totalExams} completed exam{totalExams !== 1 ? "s" : ""} from all students
          </DialogDescription>
        </DialogHeader>

        {totalExams === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No exam data available yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={histogramData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis 
                  dataKey="range" 
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {histogramData.map((entry, index) => (
                    <Cell key={index} fill={getBarColor(entry.range)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(var(--destructive))" }} />
                <span className="text-muted-foreground">0-40%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(var(--chart-4))" }} />
                <span className="text-muted-foreground">41-60%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                <span className="text-muted-foreground">61-80%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
                <span className="text-muted-foreground">81-100%</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
