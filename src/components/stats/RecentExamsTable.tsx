import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, ArrowUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

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

export const RecentExamsTable = ({ exams }: RecentExamsTableProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedExams = [...exams].sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = new Date(a.dateTaken).getTime();
      const dateB = new Date(b.dateTaken).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    } else {
      return sortOrder === 'asc' ? a.score - b.score : b.score - a.score;
    }
  });

  const toggleSort = (column: 'date' | 'score') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Recent Exams
        </CardTitle>
        <CardDescription>Your latest exam submissions</CardDescription>
      </CardHeader>
      <CardContent>
        {exams.length > 0 ? (
          <>
            {/* Desktop Table View */}
            {!isMobile && (
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
                          onClick={() => toggleSort('score')}
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
                          onClick={() => toggleSort('date')}
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
                    {sortedExams.map((exam) => (
                      <TableRow key={exam.id}>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            style={{ 
                              backgroundColor: `${exam.subjectColor}20`,
                              borderColor: exam.subjectColor,
                              color: exam.subjectColor
                            }}
                          >
                            {exam.subject}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{exam.examTitle}</TableCell>
                        <TableCell>
                          <span className={`font-semibold ${getScoreColor(exam.score)}`}>
                            {Math.round(exam.score)}%
                          </span>
                          <span className="text-muted-foreground text-xs ml-1">
                            ({exam.earnedMarks}/{exam.totalMarks})
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{exam.dateTaken}</TableCell>
                        <TableCell className="text-muted-foreground">{exam.timeSpent}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => navigate(`/exam/${exam.id}/review`)}
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Mobile Card View */}
            {isMobile && (
              <div className="space-y-3">
                <div className="flex gap-2 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSort('score')}
                    className={sortBy === 'score' ? 'bg-accent' : ''}
                  >
                    Sort by Score
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSort('date')}
                    className={sortBy === 'date' ? 'bg-accent' : ''}
                  >
                    Sort by Date
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </div>
                {sortedExams.map((exam) => (
                  <div 
                    key={exam.id}
                    className="p-4 rounded-lg border bg-card space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <Badge 
                          variant="outline"
                          style={{ 
                            backgroundColor: `${exam.subjectColor}20`,
                            borderColor: exam.subjectColor,
                            color: exam.subjectColor
                          }}
                        >
                          {exam.subject}
                        </Badge>
                        <p className="font-medium">{exam.examTitle}</p>
                      </div>
                      <span className={`text-2xl font-bold ${getScoreColor(exam.score)}`}>
                        {Math.round(exam.score)}%
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>Marks: {exam.earnedMarks}/{exam.totalMarks}</span>
                      <span>Date: {exam.dateTaken}</span>
                      <span>Time: {exam.timeSpent}</span>
                    </div>

                    <Button 
                      className="w-full"
                      size="sm"
                      onClick={() => navigate(`/exam/${exam.id}/review`)}
                    >
                      Review Exam
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground space-y-4">
            <p>No completed exams yet — start one now!</p>
            <Button onClick={() => navigate('/my-exams')}>
              Go to My Exams
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};