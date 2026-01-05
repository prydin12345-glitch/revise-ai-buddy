import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, BookOpen, HelpCircle, TrendingDown } from "lucide-react";

interface TopicAnalysis {
  topic: string;
  avgScore: number;
  incorrectCount: number;
  totalAttempts: number;
  questionNumbers: string[];
}

interface AggregateWeakestTopicsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicData: TopicAnalysis[];
}

export const AggregateWeakestTopicsModal = ({
  open,
  onOpenChange,
  topicData,
}: AggregateWeakestTopicsModalProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 60) return "text-blue-600 dark:text-blue-400";
    if (score >= 40) return "text-amber-600 dark:text-amber-400";
    return "text-destructive";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-blue-500";
    if (score >= 40) return "bg-amber-500";
    return "bg-destructive";
  };

  const sortedTopics = [...topicData].sort((a, b) => a.avgScore - b.avgScore);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden border-border/50 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            Topics Needing Attention
          </DialogTitle>
          <DialogDescription>
            Specific topics where students are struggling most, based on question-level analysis
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4 -mr-4">
          {sortedTopics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No topic data available</p>
              <p className="text-sm mt-1">Topic analysis will appear once students complete exams with tagged questions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedTopics.map((topic, index) => (
                <div
                  key={topic.topic}
                  className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-md ${index < 3 ? "bg-destructive/10" : "bg-muted"}`}>
                        {index < 3 ? (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        ) : (
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">{topic.topic}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {topic.incorrectCount} incorrect answer{topic.incorrectCount !== 1 ? "s" : ""} out of {topic.totalAttempts} attempt{topic.totalAttempts !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-bold ${getScoreColor(topic.avgScore)}`}>
                        {Math.round(topic.avgScore)}%
                      </span>
                      <p className="text-xs text-muted-foreground">avg score</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`absolute left-0 top-0 h-full rounded-full transition-all ${getProgressColor(topic.avgScore)}`}
                        style={{ width: `${topic.avgScore}%` }}
                      />
                    </div>

                    {topic.questionNumbers.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <span className="text-xs text-muted-foreground">Related questions:</span>
                        {topic.questionNumbers.slice(0, 5).map((qNum) => (
                          <Badge key={qNum} variant="outline" className="text-xs">
                            Q{qNum}
                          </Badge>
                        ))}
                        {topic.questionNumbers.length > 5 && (
                          <span className="text-xs text-muted-foreground">
                            +{topic.questionNumbers.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {topic.avgScore < 50 && (
                    <div className="mt-3 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        💡 Consider reviewing this topic with students or providing additional practice materials
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
