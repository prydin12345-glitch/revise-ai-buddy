import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FeedbackThread {
  id: string;
  question_id: string;
  student_comment: string;
  tutor_response: string | null;
  status: string;
  created_at: string;
}

interface FlaggedQuestionsPanelProps {
  threads: FeedbackThread[];
  onRespond?: (threadId: string) => void;
}

export const FlaggedQuestionsPanel = ({ threads, onRespond }: FlaggedQuestionsPanelProps) => {
  const pendingThreads = threads.filter(t => t.status === "pending");
  const respondedThreads = threads.filter(t => t.status === "responded");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Feedback Threads
        </CardTitle>
        <CardDescription>
          {pendingThreads.length > 0 
            ? `${pendingThreads.length} pending response${pendingThreads.length !== 1 ? "s" : ""}`
            : "All feedback addressed"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {threads.length > 0 ? (
          <div className="space-y-3">
            {threads.slice(0, 5).map((thread) => (
              <div
                key={thread.id}
                className="p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {thread.status === "pending" ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Responded
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">
                      {thread.student_comment}
                    </p>
                    {thread.tutor_response && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        <span className="font-medium">Your response:</span> {thread.tutor_response}
                      </p>
                    )}
                  </div>
                  {thread.status === "pending" && onRespond && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRespond(thread.id)}
                    >
                      Respond
                    </Button>
                  )}
                </div>
              </div>
            ))}
            
            {threads.length > 5 && (
              <p className="text-center text-sm text-muted-foreground">
                +{threads.length - 5} more threads
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[150px] text-muted-foreground">
            <AlertCircle className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">No feedback threads yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
