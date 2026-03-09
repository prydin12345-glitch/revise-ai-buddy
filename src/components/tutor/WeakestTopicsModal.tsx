import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, BookOpen, TrendingDown, HelpCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface WeakTopic {
  topic: string;
  avgScore: number;
  totalQuestions: number;
  incorrectCount: number;
}

interface WeakestTopicsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weakTopics: WeakTopic[];
  studentName: string;
  strongestSubject: string | null;
  weakestSubject: string | null;
}

export const WeakestTopicsModal = ({
  open,
  onOpenChange,
  weakTopics,
  studentName,
  strongestSubject,
  weakestSubject
}: WeakestTopicsModalProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-blue-500";
    if (score >= 40) return "text-amber-500";
    return "text-rose-500";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-blue-500";
    if (score >= 40) return "bg-amber-500";
    return "bg-rose-500";
  };

  // Sort topics by score ascending (weakest first)
  const sortedTopics = [...weakTopics].sort((a, b) => a.avgScore - b.avgScore);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-amber-500" />
            Topic Analysis - {studentName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Subject Summary */}
          <div className="grid grid-cols-2 gap-3">
            {strongestSubject && (
              <Card className="bg-emerald-500/10 border-emerald-500/30">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs text-muted-foreground">Strongest</span>
                  </div>
                  <p className="font-semibold text-emerald-600 truncate">{strongestSubject}</p>
                </CardContent>
              </Card>
            )}
            {weakestSubject && (
              <Card className="bg-rose-500/10 border-rose-500/30">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                    <span className="text-xs text-muted-foreground">Needs Work</span>
                  </div>
                  <p className="font-semibold text-rose-600 truncate">{weakestSubject}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Topic Breakdown */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Topics Requiring Attention
            </h4>
            <ScrollArea className="h-[280px]">
              {sortedTopics.length > 0 ? (
                <div className="space-y-3 pr-2">
                  {sortedTopics.map((topic, index) => (
                    <Card key={topic.topic} className="bg-card/50">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className="text-xs px-1.5 py-0"
                              >
                                #{index + 1}
                              </Badge>
                              <p className="font-medium truncate text-sm">
                                {topic.topic}
                              </p>
                            </div>
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">
                                  {topic.incorrectCount} of {topic.totalQuestions} questions incorrect
                                </span>
                                <span className={`font-medium ${getScoreColor(topic.avgScore)}`}>
                                  {Math.round(topic.avgScore)}%
                                </span>
                              </div>
                              <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`absolute left-0 top-0 h-full rounded-full ${getProgressColor(topic.avgScore)}`}
                                  style={{ width: `${topic.avgScore}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <HelpCircle className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No topic data available</p>
                  <p className="text-xs">Complete more exams to see topic analysis</p>
                </div>
              )}
            </ScrollArea>
          </div>

          {sortedTopics.length > 0 && (
            <div className="pt-2 border-t text-xs text-muted-foreground">
              <p>
                💡 <strong>Tip:</strong> Focus revision on topics with scores below 60% for maximum improvement.
              </p>
              <p className="mt-1">
                Look for the "⚠ Not practised" indicator — these students may need a follow-up.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
