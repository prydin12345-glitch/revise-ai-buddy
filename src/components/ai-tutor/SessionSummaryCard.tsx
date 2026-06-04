import { BookOpen, X, RotateCcw } from 'lucide-react';

export interface SessionSummary {
  title: string;
  correctFollowups: number;
  totalFollowups: number;
  topicsReviewed: string[];
  keyTakeaway: string;
}

interface SessionSummaryCardProps {
  summary: SessionSummary;
  onDismiss: () => void;
  onRevisit: () => void;
}

export const SessionSummaryCard = ({
  summary,
  onDismiss,
  onRevisit,
}: SessionSummaryCardProps) => {
  return (
    <div
      className="mx-1 mb-3 rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden"
      style={{ animation: 'aiSuggestionFade 0.3s ease both' }}
    >
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
            <BookOpen size={11} className="text-primary" />
          </div>
          <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">
            Last session
          </span>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss summary"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      <div className="px-4 pb-3">
        <p className="text-[12.5px] font-semibold text-foreground truncate mb-1">
          {summary.title}
        </p>
        {summary.totalFollowups > 0 && (
          <p className="text-[11.5px] text-muted-foreground mb-1.5">
            {summary.correctFollowups}/{summary.totalFollowups} follow-up questions correct
          </p>
        )}
        <p className="text-[11.5px] text-foreground/80 leading-snug mb-3">
          {summary.keyTakeaway}
        </p>
        <button
          onClick={onRevisit}
          className="flex items-center gap-1.5 text-[11.5px] font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <RotateCcw size={11} />
          Continue this review
        </button>
      </div>
    </div>
  );
};
