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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Hours</p>
              <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            {Object.entries(hoursBySubject)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([subject, minutes]) => (
                <div key={subject} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{subject}</span>
                  <span className="font-medium">{(minutes / 60).toFixed(1)}h</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed Tasks</p>
              <p className="text-2xl font-bold">
                {completedTasks} / {tasks.length}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{
                  width: `${tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Target className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Most Revised Topic</p>
              <p className="text-lg font-bold truncate">{mostRevisedTopic}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {topicCounts[mostRevisedTopic] || 0} revision session{topicCounts[mostRevisedTopic] !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
