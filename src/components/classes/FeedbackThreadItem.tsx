import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, CheckCircle, Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FeedbackThread {
  id: string;
  question_id: string;
  student_comment: string;
  tutor_response?: string;
  status: string;
  created_at: string;
  responded_at?: string;
  exam_id: string;
}

interface FeedbackThreadItemProps {
  thread: FeedbackThread;
  questionNumber?: string;
  onViewThread?: (thread: FeedbackThread) => void;
}

export const FeedbackThreadItem = ({ 
  thread, 
  questionNumber,
  onViewThread 
}: FeedbackThreadItemProps) => {
  const isPending = thread.status === "pending";

  return (
    <div className="p-3 border rounded-lg bg-card hover:bg-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {questionNumber ? `Question ${questionNumber}` : "Question"}
            </span>
            <Badge 
              variant={isPending ? "secondary" : "default"}
              className={`text-xs ${isPending ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"}`}
            >
              {isPending ? (
                <>
                  <Clock className="w-3 h-3 mr-1" />
                  Pending
                </>
              ) : (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Responded
                </>
              )}
            </Badge>
          </div>
          
          <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
            {thread.student_comment}
          </p>
          
          {thread.tutor_response && (
            <p className="text-xs text-primary line-clamp-1 mt-1.5 pl-3 border-l-2 border-primary">
              {thread.tutor_response}
            </p>
          )}
          
          <p className="text-xs text-muted-foreground mt-1.5">
            {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
          </p>
        </div>

        {onViewThread && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => onViewThread(thread)}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};
