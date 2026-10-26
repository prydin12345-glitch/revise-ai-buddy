import { lazy, Suspense, useEffect, useState } from "react";
import { FileQuestion, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { StatsWrongQuestion } from "@/lib/subject-profile-stats";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import "@/styles/stats-question-review.css";

const QuestionRevisitContent = lazy(() => import("./QuestionRevisitContent"));

export interface QuestionsToRevisitProps {
  questions: StatsWrongQuestion[];
  scopeKey: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function QuestionsToRevisit({ questions, scopeKey, loading = false, error, onRetry }: QuestionsToRevisitProps) {
  // Tie the selected row to its scope during render, so an account/profile change
  // cannot show a stale solution for even one effect frame.
  const [selection, setSelection] = useState<{ scope: string; row: StatsWrongQuestion } | null>(null);
  const [limit, setLimit] = useState(3);
  const valid = questions.filter(row => Number.isFinite(row.score) && Number.isFinite(row.marks) && row.marks > 0 && row.score >= 0 && row.score < row.marks);
  const selected = selection?.scope === scopeKey ? valid.find(row => row.examId === selection.row.examId && row.questionId === selection.row.questionId) ?? null : null;
  useEffect(() => { setSelection(null); setLimit(3); }, [scopeKey]);
  return <section className="stats-panel stats-revisit" aria-labelledby="stats-revisit-title">
    <div className="stats-panel-heading"><h2 id="stats-revisit-title">Questions to revisit</h2></div>
    {loading ? <div className="space-y-3 p-5" role="status" aria-label="Loading questions to revisit"><Skeleton className="h-12"/><Skeleton className="h-12"/></div> : error ? <div className="p-5 text-sm" role="alert"><p>{error}</p>{onRetry && <Button variant="outline" className="mt-3" onClick={onRetry}>Retry questions</Button>}</div> : valid.length ? <>
      <div className="stats-revisit-list">{valid.slice(0, limit).map(row => <button key={`${row.examId}:${row.questionId}`} type="button" className="stats-question-row" onClick={() => setSelection({ scope: scopeKey, row })} aria-label={`Review question ${row.questionNumber}: ${row.topic || row.examTitle}`}>
        <span className="stats-question-number">Q{row.questionNumber}</span>
        <span className="stats-question-label"><strong>{row.topic || row.examTitle}</strong><small>{row.profileName} · {validDateLabel(row.date)}</small></span>
        <span className="stats-question-marks">{row.score}/{row.marks}<small>marks</small></span>
      </button>)}</div>
      {valid.length > limit && <div className="stats-revisit-footer"><button type="button" className="subject-stats-text-button" onClick={() => setLimit(value => value + 3)}>Show more questions <span className="sr-only">({valid.length - limit} remaining)</span></button></div>}
    </> : <div className="subject-stats-empty"><FileQuestion aria-hidden="true"/><h3>No questions to revisit yet</h3><p>Marked, released exam questions appear here.</p></div>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelection(null); }}>
      <DialogContent className="stats-question-dialog stats-chart-dialog max-w-3xl max-h-[88dvh] overflow-y-auto">
        <DialogHeader className="stats-question-dialog-header"><DialogTitle>Question review</DialogTitle><DialogDescription className="stats-question-meta">{selected ? `${selected.subject} · ${selected.profileName}` : "Released marked question"}</DialogDescription></DialogHeader>
        {selected && <Suspense fallback={<div role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true"/>Opening your marked review…</div>}><QuestionRevisitContent key={`${scopeKey}:${selected.examId}:${selected.questionId}:${selected.score}:${selected.date}`} row={selected}/></Suspense>}
      </DialogContent>
    </Dialog>
  </section>;
}

function validDateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? format(date, "d MMM") : "Marked exam";
}
