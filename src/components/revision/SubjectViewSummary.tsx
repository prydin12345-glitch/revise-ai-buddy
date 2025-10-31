import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle2, Target } from "lucide-react";

interface RevisionTask {
  subject: string;
  duration?: number;
  is_completed: boolean;
  focus_topic?: string;
}

interface SubjectViewSummaryProps {
  tasks: RevisionTask[];
}

export const SubjectViewSummary = ({ tasks }: SubjectViewSummaryProps) => {
  // Calculate statistics
  const totalHours = tasks.reduce((sum, task) => sum + (task.duration || 0), 0) / 60;
  const completedTasks = tasks.filter(t => t.is_completed).length;
  
  // Find most revised topic
  const topicCounts = tasks.reduce((acc, task) => {
    const topic = task.focus_topic || "General";
    acc[topic] = (acc[topic] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const mostRevisedTopic = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || "N/A";

  // Hours by subject
  const hoursBySubject = tasks.reduce((acc, task) => {
    acc[task.subject] = (acc[task.subject] || 0) + (task.duration || 0);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-wrap gap-3">
      <Card className="flex-1 min-w-[200px]">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Hours</p>
              <p className="text-xl font-bold">{totalHours.toFixed(1)}h</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 min-w-[200px]">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-green-500/10">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-xl font-bold">
                {completedTasks} / {tasks.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 min-w-[200px]">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-blue-500/10">
              <Target className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Top Topic</p>
              <p className="text-lg font-bold truncate">{mostRevisedTopic}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
