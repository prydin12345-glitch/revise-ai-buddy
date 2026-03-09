import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, BookOpen, FileText, Zap, CheckCircle2 } from "lucide-react";
import { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";
import { Skeleton } from "@/components/ui/skeleton";

interface WeakTopicsTabProps {
  topics: UnifiedTopicScore[];
  loading: boolean;
}

const MASTERY_CONFIG = {
  weak: {
    border: "border-l-destructive",
    badge: "bg-destructive/10 text-destructive border-destructive/20",
    bar: "bg-destructive",
    label: "Weak",
  },
  developing: {
    border: "border-l-amber-500",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    bar: "bg-amber-500",
    label: "Developing",
  },
  strong: {
    border: "border-l-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    bar: "bg-emerald-500",
    label: "Strong",
  },
  untested: {
    border: "border-l-muted-foreground/30",
    badge: "bg-muted text-muted-foreground border-border",
    bar: "bg-muted-foreground/30",
    label: "Untested",
  },
};

export const WeakTopicsTab = ({ topics, loading }: WeakTopicsTabProps) => {
  const navigate = useNavigate();

  const handlePracticeWeakTopic = (topicName: string) => {
    navigate(`/create-practice-questions?subtopic=${encodeURIComponent(topicName)}`);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-12">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No Topic Data Yet</p>
            <p className="text-sm mb-4">
              Complete exams or practice quizzes to see your topic-level performance breakdown.
            </p>
            <Button variant="outline" onClick={() => navigate("/create-practice-questions")}>
              <FileText className="w-4 h-4 mr-2" />
              Start Practicing
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const weakCount = topics.filter((t) => t.mastery === "weak").length;
  const developingCount = topics.filter((t) => t.mastery === "developing").length;
  const strongCount = topics.filter((t) => t.mastery === "strong").length;

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="py-3 px-4">
            <p className="text-2xl font-bold text-destructive">{weakCount}</p>
            <p className="text-xs text-muted-foreground">Weak</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="py-3 px-4">
            <p className="text-2xl font-bold text-amber-500">{developingCount}</p>
            <p className="text-xs text-muted-foreground">Developing</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="py-3 px-4">
            <p className="text-2xl font-bold text-emerald-500">{strongCount}</p>
            <p className="text-xs text-muted-foreground">Strong</p>
          </CardContent>
        </Card>
      </div>

      {/* Topic cards */}
      <div className="space-y-3">
        {topics
          .filter((t) => t.mastery !== "untested")
          .map((topic) => {
            const config = MASTERY_CONFIG[topic.mastery];

            return (
              <Card
                key={topic.topic}
                className={`border-l-4 ${config.border} transition-colors`}
              >
                <CardContent className="py-4 px-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold truncate">
                      {topic.topic}
                    </span>
                    <Badge variant="outline" className={`text-xs shrink-0 ${config.badge}`}>
                      {config.label}
                    </Badge>
                  </div>

                  {/* Score breakdown */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {topic.examScore !== null && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Exam: <strong className="text-foreground">{topic.examScore}%</strong>
                      </span>
                    )}
                    {topic.practiceScore !== null && (
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Practice: <strong className="text-foreground">{topic.practiceScore}%</strong>
                      </span>
                    )}
                    <span>
                      Combined: <strong className="text-foreground">{topic.unifiedScore}%</strong>
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${config.bar}`}
                      style={{ width: `${topic.unifiedScore}%` }}
                    />
                  </div>

                  {/* Practice nudge for weak topics */}
                  {topic.mastery === "weak" && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {topic.practicedSinceLastExam ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            Practised since last exam
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 text-amber-500" />
                            Not practised since last exam
                          </>
                        )}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => handlePracticeWeakTopic(topic.topic)}
                      >
                        Practice now →
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
};
