// src/components/dashboard/ActivityAllModal.tsx
import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Filter, X, ChevronRight, FileText } from "lucide-react";
import type { MockExam, Quiz } from "./types";

type Tab = "exams" | "quizzes";
type StatusFilter = "all" | "done" | "in-progress" | "not-started";
type Sort = "recent" | "title" | "subject" | "score-high" | "score-low";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab: Tab;
  mockExams: MockExam[];
  quizzes: Quiz[];
  onOpenExam: (id: string) => void;
  onStartQuiz: (id: string) => void;
}

export default function ActivityAllModal({
  open, onOpenChange, initialTab, mockExams, quizzes, onOpenExam, onStartQuiz,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("recent");

  // reset tab when modal reopens
  useMemo(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  const allSubjects = useMemo(() => {
    const src = tab === "exams" ? mockExams.map((e) => e.subject) : quizzes.map((q) => q.subject);
    return [...new Set(src.filter(Boolean))].sort();
  }, [tab, mockExams, quizzes]);

  const toggleSubject = (s: string) =>
    setSubjects((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const filteredExams = useMemo(() => {
    let r = [...mockExams];
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((e) => e.title.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q));
    }
    if (status !== "all") r = r.filter((e) => e.status === status);
    if (subjects.length) r = r.filter((e) => subjects.includes(e.subject));
    switch (sort) {
      case "title": r.sort((a, b) => a.title.localeCompare(b.title)); break;
      case "subject": r.sort((a, b) => a.subject.localeCompare(b.subject)); break;
      case "score-high": r.sort((a, b) => b.score - a.score); break;
      case "score-low": r.sort((a, b) => a.score - b.score); break;
      default: break; // "recent" preserves incoming order
    }
    return r;
  }, [mockExams, query, status, subjects, sort]);

  const filteredQuizzes = useMemo(() => {
    let r = [...quizzes];
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((x) => x.title.toLowerCase().includes(q) || x.subject.toLowerCase().includes(q));
    }
    if (subjects.length) r = r.filter((x) => subjects.includes(x.subject));
    switch (sort) {
      case "title": r.sort((a, b) => a.title.localeCompare(b.title)); break;
      case "subject": r.sort((a, b) => a.subject.localeCompare(b.subject)); break;
      case "score-high": r.sort((a, b) => (b.best ?? -1) - (a.best ?? -1)); break;
      case "score-low": r.sort((a, b) => (a.best ?? Infinity) - (b.best ?? Infinity)); break;
      default: break;
    }
    return r;
  }, [quizzes, query, subjects, sort]);

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setSubjects([]);
  };
  const hasActive = query || status !== "all" || subjects.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col p-0">
        <DialogHeader className="border-b border-border p-6 pb-4">
          <DialogTitle className="text-xl font-bold">Recent Activity</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Search and filter your exams and practice quizzes
          </DialogDescription>
        </DialogHeader>

        {/* Tab switch */}
        <div className="flex gap-1 border-b border-border bg-muted/30 px-6 py-3">
          <TabBtn active={tab === "exams"} onClick={() => setTab("exams")}>
            Mock Exams <span className="ml-1 opacity-70">({mockExams.length})</span>
          </TabBtn>
          <TabBtn active={tab === "quizzes"} onClick={() => setTab("quizzes")}>
            Practice Quizzes <span className="ml-1 opacity-70">({quizzes.length})</span>
          </TabBtn>
        </div>

        {/* Toolbar */}
        <div className="space-y-3 border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title or subject…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 pl-9"
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative h-10 w-10">
                  <Filter className="h-4 w-4" />
                  {(subjects.length > 0 || status !== "all") && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4" align="end">
                <div className="space-y-4">
                  {tab === "exams" && (
                    <div>
                      <label className="mb-2 block text-sm font-medium">Status</label>
                      <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="done">Completed</SelectItem>
                          <SelectItem value="in-progress">In progress</SelectItem>
                          <SelectItem value="not-started">Not started</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {allSubjects.length > 0 && (
                    <div>
                      <label className="mb-2 block text-sm font-medium">Subjects</label>
                      <div className="max-h-32 space-y-2 overflow-y-auto">
                        {allSubjects.map((s) => (
                          <div key={s} className="flex items-center gap-2">
                            <Checkbox
                              id={`s-${s}`}
                              checked={subjects.includes(s)}
                              onCheckedChange={() => toggleSubject(s)}
                            />
                            <label htmlFor={`s-${s}`} className="cursor-pointer text-sm">{s}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="h-10 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="title">Title A–Z</SelectItem>
                <SelectItem value="subject">Subject</SelectItem>
                <SelectItem value="score-high">Highest score</SelectItem>
                <SelectItem value="score-low">Lowest score</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActive && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Filters:</span>
              {query && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  "{query}" <X className="h-3 w-3 cursor-pointer" onClick={() => setQuery("")} />
                </Badge>
              )}
              {status !== "all" && (
                <Badge variant="secondary" className="gap-1 text-xs capitalize">
                  {status.replace("-", " ")}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setStatus("all")} />
                </Badge>
              )}
              {subjects.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1 text-xs">
                  {s} <X className="h-3 w-3 cursor-pointer" onClick={() => toggleSubject(s)} />
                </Badge>
              ))}
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          )}
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-1 py-3">
            {tab === "exams" ? (
              filteredExams.length === 0 ? (
                <Empty hasFilters={hasActive} onClear={clearFilters} />
              ) : (
                filteredExams.map((e) => (
                  <ExamRow key={e.id} exam={e} onClick={() => { onOpenExam(e.id); onOpenChange(false); }} />
                ))
              )
            ) : filteredQuizzes.length === 0 ? (
              <Empty hasFilters={hasActive} onClear={clearFilters} />
            ) : (
              filteredQuizzes.map((q) => (
                <QuizRow key={q.id} quiz={q} onClick={() => { onStartQuiz(q.id); onOpenChange(false); }} />
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border bg-muted/30 px-6 py-3 text-xs text-muted-foreground">
          Showing {tab === "exams" ? filteredExams.length : filteredQuizzes.length} of{" "}
          {tab === "exams" ? mockExams.length : quizzes.length}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Empty({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="py-12 text-center">
      <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground opacity-50" />
      <p className="text-sm text-muted-foreground">
        {hasFilters ? "Nothing matches your filters." : "Nothing here yet."}
      </p>
      {hasFilters && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

function scoreChip(score: number): string {
  if (score >= 70) return "bg-success/15 text-success";
  if (score >= 40) return "bg-warning/15 text-warning";
  if (score > 0) return "bg-danger/15 text-danger";
  return "bg-white/[0.06] text-muted-foreground";
}

function ExamRow({ exam, onClick }: { exam: MockExam; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-lg border border-transparent px-2 py-3 text-left transition-colors hover:bg-panel-2"
    >
      <span className="h-[34px] w-[3px] flex-none rounded-full" style={{ background: exam.color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{exam.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          {exam.subject}
          <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
          {exam.when}
        </span>
      </span>
      {exam.status === "not-started" ? (
        <span className="flex-none rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Not started
        </span>
      ) : (
        <span className={`flex-none rounded-[9px] px-2.5 py-1.5 text-[12.5px] font-extrabold tabular-nums ${scoreChip(exam.score)}`}>
          {exam.score}%
        </span>
      )}
      <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
    </button>
  );
}

function QuizRow({ quiz, onClick }: { quiz: Quiz; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3.5 rounded-lg border border-transparent px-2 py-3 text-left transition-colors hover:bg-panel-2"
    >
      <span className="h-[34px] w-[3px] flex-none rounded-full" style={{ background: quiz.color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{quiz.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          {quiz.subject}
          <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
          {quiz.questions} questions
          {quiz.best != null && (
            <>
              <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
              best {quiz.best}%
            </>
          )}
        </span>
      </span>
      <span className="flex-none rounded-[9px] bg-primary/15 px-3.5 py-1.5 text-[12.5px] font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {quiz.best == null ? "Start" : "Retry"}
      </span>
    </button>
  );
}
