import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

interface ProgressItemProps {
  examId: string;
  title: string;
  className?: string;
  subject?: string;
  score: number;
  totalMarks: number;
}

export const ProgressItem = ({ 
  examId,
  title, 
  className, 
  subject, 
  score, 
  totalMarks 
}: ProgressItemProps) => {
  const navigate = useNavigate();
  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;

  return (
    <div className="p-4 rounded-xl bg-card/50 border border-border/50 space-y-3 hover:bg-card/70 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-sm text-foreground uppercase tracking-wide">
          {title}
        </span>
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          {score}/{totalMarks} Marks
        </span>
      </div>
      
      <div className="flex items-center gap-3">
        <Progress value={percentage} className="flex-1 h-2" />
        <Button 
          size="icon" 
          className="rounded-full w-8 h-8 bg-primary hover:bg-primary/90 flex-shrink-0"
          onClick={() => navigate(`/review/${examId}`)}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      
      {(className || subject) && (
        <p className="text-xs text-muted-foreground">
          [{className}{subject && `: ${subject}`}]
        </p>
      )}
    </div>
  );
};
