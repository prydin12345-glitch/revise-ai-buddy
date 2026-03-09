import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { UnifiedTopicScore } from "@/hooks/useUnifiedTopicPerformance";

interface WeakTopicNudgeProps {
  weakTopics: UnifiedTopicScore[];
}

export const WeakTopicNudge = ({ weakTopics }: WeakTopicNudgeProps) => {
  const navigate = useNavigate();

  if (weakTopics.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-destructive">
      <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {weakTopics.length} weak topic{weakTopics.length > 1 ? "s" : ""} need
              attention
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {weakTopics
                .slice(0, 3)
                .map((t) => t.topic)
                .join(", ")}
              {weakTopics.length > 3
                ? ` and ${weakTopics.length - 3} more`
                : ""}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={() => navigate("/stats?tab=weak-topics")}
        >
          View & Practice →
        </Button>
      </CardContent>
    </Card>
  );
};
