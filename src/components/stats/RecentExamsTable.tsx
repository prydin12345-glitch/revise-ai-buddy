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
        e.subject.toLowerCase().includes(q)
    );
  }, [exams, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-orange-400";
    return "text-red-400";
  };

  const getStatusLabel = (score: number) => {
    if (score >= 80) return { text: "Excellent", className: "bg-green-500/10 text-green-500 border-green-500/20" };
    if (score >= 60) return { text: "Good", className: "bg-orange-400/10 text-orange-400 border-orange-400/20" };
    return { text: "Needs Work", className: "bg-red-400/10 text-red-400 border-red-400/20" };
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-[18px] py-3.5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-[13px] font-semibold text-foreground" style={{ letterSpacing: "-0.2px" }}>
              Recent Exams
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search exams"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-8 pl-8 text-xs w-[180px] bg-background"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {exams.length === 0 ? (
        <div className="p-6">
          <EmptyChartState
            message="No completed exams yet — start one now!"
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
          {!isMobile ? (
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
                              color: exam.subjectColor,
                            }}
                          >
                            {exam.subject.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">
                              {exam.examTitle}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {exam.subject}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-bold ${getScoreColor(exam.score)}`}>
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
                          className="text-xs h-7 px-3"
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
                <div
                  key={exam.id}
                  className="px-5 py-3 flex items-center gap-3"
                  onClick={() => navigate(`/exam/${exam.id}/review`)}
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      background: `${exam.subjectColor}15`,
                      color: exam.subjectColor,
                    }}
                  >
                    {exam.subject.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {exam.examTitle}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {exam.dateTaken}
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${getScoreColor(exam.score)}`}>
                    {Math.round(exam.score)}%
                  </span>
                </div>
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                        p === page
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
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