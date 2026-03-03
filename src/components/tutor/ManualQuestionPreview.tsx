import { MathRenderer } from "@/components/MathRenderer";
import { Badge } from "@/components/ui/badge";

interface ManualQuestionPreviewProps {
  questionNumber: number;
  questionText: string;
  maxMarks: number;
  topicTag?: string;
  expectedAnswer?: string;
  showAnswer?: boolean;
}

export function ManualQuestionPreview({
  questionNumber,
  questionText,
  maxMarks,
  topicTag,
  expectedAnswer,
  showAnswer = false,
}: ManualQuestionPreviewProps) {
  if (!questionText.trim()) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground/60">
        <p className="text-sm italic">Start typing to see a live preview…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Question header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <span className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-primary/15 text-primary text-sm font-bold">
            {questionNumber}
          </span>
          <div className="flex-1">
            <MathRenderer content={questionText} hasMath={/\$[^$]+\$/.test(questionText)} />
          </div>
        </div>
        <Badge variant="outline" className="flex-shrink-0 border-primary/30 text-primary font-semibold text-xs">
          {maxMarks} {maxMarks === 1 ? "mark" : "marks"}
        </Badge>
      </div>

      {/* Topic tag */}
      {topicTag && (
        <div className="pl-10">
          <Badge variant="secondary" className="text-xs">{topicTag}</Badge>
        </div>
      )}

      {/* Answer lines placeholder */}
      <div className="pl-10 space-y-2">
        {Array.from({ length: Math.min(maxMarks + 1, 6) }).map((_, i) => (
          <div key={i} className="h-px bg-border/50 w-full" />
        ))}
      </div>

      {/* Expected answer (if toggled) */}
      {showAnswer && expectedAnswer && (
        <div className="pl-10 mt-4 p-3 rounded-lg bg-accent/30 border border-accent">
          <p className="text-xs font-semibold text-accent-foreground mb-1">Mark Scheme</p>
          <MathRenderer content={expectedAnswer} hasMath={/\$[^$]+\$/.test(expectedAnswer)} className="text-sm" />
        </div>
      )}
    </div>
  );
}
