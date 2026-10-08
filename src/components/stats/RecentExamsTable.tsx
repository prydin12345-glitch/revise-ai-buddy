import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { EmptyChartState } from "./EmptyChartState";

interface RecentExam {
  id: string;
  subject: string;
  subjectColor: string;
  examTitle: string;
  score: number;
  dateTaken: string;
  timeSpent: string;
  totalMarks: number;
  earnedMarks: number;
}

interface RecentExamsTableProps {
  exams: RecentExam[];
}

const PAGE_SIZE = 4;

export const RecentExamsTable = ({ exams }: RecentExamsTableProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim()) return exams;
    const q = search.toLowerCase();
    return exams.filter(
      (e) =>
        e.examTitle.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q),
    );
  }, [exams, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getStatusLabel = (score: number) => {
    if (score >= 80)
      return {
        text: "Excellent",
        className: "bg-success/10 text-success border-success/30",
      };
    if (score >= 60)
      return {
        text: "Good",
        className: "bg-warning/10 text-warning border-warning/30",
      };
    return {
      text: "Needs Work",
      className: "bg-destructive/10 text-destructive border-destructive/30",
    };
  };

  return (
    <div className="stats-panel overflow-hidden">
      {/* Header */}
      <div className="stats-panel-heading border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2>Recent exams</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              aria-label="Search exams"
              placeholder="Search exams"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-10 pl-8 text-sm w-full sm:w-[220px] bg-background"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {exams.length === 0 ? (
        <div className="p-6">
          <EmptyChartState
            message="No completed exams yet. Your results will appear here."
            icon={BookOpen}
            action={{
              label: "Go to My Exams",
              onClick: () => navigate("/my-exams"),
            }}
            height={200}
          />
        </div>
      ) : (
        <>
          {filtered.length === 0 ? (
            <p
              role="status"
              className="px-5 py-10 text-center text-sm text-muted-foreground"
            >
              No exams match your search.
            </p>
          ) : !isMobile ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    Exam
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    Score
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    Date
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((exam) => {
                  const status = getStatusLabel(exam.score);
                  return (
                    <TableRow key={exam.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                            style={{
                              background: `${exam.subjectColor}15`,
                              color: "hsl(var(--foreground))",
                            }}
                          >
                            {exam.subject.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground break-words">
                              {exam.examTitle}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {exam.subject}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-sm font-bold ${getScoreColor(exam.score)}`}
                        >
                          {Math.round(exam.score)}%
                        </span>
                        <span className="text-[11px] text-muted-foreground ml-1">
                          ({exam.earnedMarks}/{exam.totalMarks})
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${status.className}`}
                        >
                          {status.text}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {exam.dateTaken}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs min-h-10 px-3"
                          onClick={() => navigate(`/exam/${exam.id}/review`)}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="divide-y divide-border">
              {paginated.map((exam) => (
                <button
                  type="button"
                  key={exam.id}
                  className="w-full px-5 py-3 flex items-center gap-3 text-left"
                  onClick={() => navigate(`/exam/${exam.id}/review`)}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      background: `${exam.subjectColor}15`,
                      color: "hsl(var(--foreground))",
                    }}
                  >
                    {exam.subject.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground break-words">
                      {exam.examTitle}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {exam.dateTaken}
                    </div>
                  </div>
                  <span
                    className={`text-sm font-bold ${getScoreColor(exam.score)}`}
                  >
                    {Math.round(exam.score)}%
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}-
                {Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  aria-label="Previous results page"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="stats-chart-control rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <button
                      key={p}
                      aria-label={`Results page ${p}`}
                      aria-current={p === page ? "page" : undefined}
                      onClick={() => setPage(p)}
                      className={`stats-chart-control rounded-md text-xs font-medium transition-colors ${
                        p === page
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  aria-label="Next results page"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="stats-chart-control rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
