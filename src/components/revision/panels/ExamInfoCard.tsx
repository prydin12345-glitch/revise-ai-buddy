import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Target, TrendingUp } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface Exam {
  id: string;
  title: string;
  subject: string;
  subject_color: string;
  date: string;
  target_percentage: number;
  current_percentage?: number;
}

interface ExamInfoCardProps {
  nearestExam?: Exam;
}

export const ExamInfoCard = ({ nearestExam }: ExamInfoCardProps) => {
  if (!nearestExam) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No upcoming exams</p>
        </CardContent>
      </Card>
    );
  }

  const daysUntil = differenceInDays(new Date(nearestExam.date), new Date());
  const progressToTarget = nearestExam.current_percentage 
    ? Math.round((nearestExam.current_percentage / nearestExam.target_percentage) * 100)
    : 0;

  return (
    <Card className="border-l-4" style={{ borderLeftColor: nearestExam.subject_color }}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <Badge 
              style={{ backgroundColor: nearestExam.subject_color }}
              className="mb-2"
            >
              {nearestExam.subject}
            </Badge>
            <CardTitle className="text-base">{nearestExam.title}</CardTitle>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{daysUntil}</div>
            <div className="text-xs text-muted-foreground">days left</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Exam Date */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span>{format(new Date(nearestExam.date), 'EEEE, MMMM d, yyyy')}</span>
        </div>

        {/* Target Score */}
        <div className="flex items-center gap-2 text-sm">
          <Target className="w-4 h-4 text-muted-foreground" />
          <span>Target: {nearestExam.target_percentage}%</span>
        </div>

        {/* Current Progress */}
        {nearestExam.current_percentage && (
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Current
              </span>
              <span className="font-medium">{nearestExam.current_percentage}%</span>
            </div>
            <Progress value={progressToTarget} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
