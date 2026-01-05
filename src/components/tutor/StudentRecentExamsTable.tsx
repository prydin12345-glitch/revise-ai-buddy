import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, ArrowUpDown, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface ExamSubmission {
  id: string;
  exam_id: string;
  submitted_at: string;
  total_score: number | null;
  total_marks: number | null;
  time_taken_seconds: number | null;
  exam_title: string;
  subject_id: string;
}

interface StudentRecentExamsTableProps {
  exams: ExamSubmission[];
  studentId: string;
  subjectColors: Record<string, string>;
}

export const StudentRecentExamsTable = ({ exams, studentId, subjectColors }: StudentRecentExamsTableProps) => {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<"date" | "score">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const sortedExams = [...exams].sort((a, b) => {
    if (sortBy === "date") {
      const dateA = new Date(a.submitted_at).getTime();
      const dateB = new Date(b.submitted_at).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    } else {
      const scoreA = a.total_score && a.total_marks ? (a.total_score / a.total_marks) * 100 : 0;
      const scoreB = b.total_score && b.total_marks ? (b.total_score / b.total_marks) * 100 : 0;
      return sortOrder === "asc" ? scoreA - scoreB : scoreB - scoreA;
    }
  });

  const toggleSort = (column: "date" | "score") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    return "text-rose-500";
  };

  const formatTime = (seconds: number | null) => {
    if (!seconds) return "--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Recent Exams
        </CardTitle>
        <CardDescription>Student's completed exam submissions</CardDescription>
      </CardHeader>
      <CardContent>
        {exams.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Exam Title</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => toggleSort("score")}
                    >
                      Score
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => toggleSort("date")}
                    >
                      Date
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedExams.slice(0, 10).map((exam) => {
                  const score = exam.total_score && exam.total_marks 
                    ? (exam.total_score / exam.total_marks) * 100 
                    : 0;
                  const subjectColor = subjectColors[exam.subject_id] || "#3B82F6";
                  
                  return (
                    <TableRow key={exam.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          style={{
                            backgroundColor: `${subjectColor}20`,
                            borderColor: subjectColor,
                            color: subjectColor
                          }}
                        >
                          {exam.subject_id}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {exam.exam_title}
                      </TableCell>
                      <TableCell>
                        <span className={`font-semibold ${getScoreColor(score)}`}>
                          {score > 0 ? `${Math.round(score)}%` : "--"}
                        </span>
                        {exam.total_score !== null && exam.total_marks && (
                          <span className="text-muted-foreground text-xs ml-1">
                            ({exam.total_score}/{exam.total_marks})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(exam.submitted_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTime(exam.time_taken_seconds)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/tutor/exams/${exam.exam_id}/student/${studentId}`)}
                          className="gap-1"
                        >
                          Review
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
            <BookOpen className="h-12 w-12 mb-4 opacity-50" />
            <p>No completed exams yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
