import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Clock, CheckCircle, XCircle, User, Flag } from "lucide-react";
import { format } from "date-fns";
import { MathRenderer } from "@/components/MathRenderer";
import { MechanicsFigurePanel, detectDiagramConfig } from "@/components/mechanics";
import { CircuitFigurePanel } from "@/components/circuit";
import { detectCircuitConfig } from "@/components/circuit/circuit-detector";

interface Question {
  id: string;
  questionNumber: string;
  questionText: string;
  questionType: string;
  marks: number;
  correctAnswer: string | null;
}

interface Answer {
  questionId: string;
  answerText: string | null;
  score: number | null;
  isCorrect: boolean | null;
  feedback: string | null;
  isFlagged: boolean;
}

interface StudentData {
  name: string;
  code: string;
  submittedAt: string | null;
  timeTaken: number | null;
  totalScore: number | null;
  totalMarks: number | null;
  isLate: boolean;
}

const StudentExamReview = () => {
  const { examId, studentId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [examTitle, setExamTitle] = useState("");
  const [student, setStudent] = useState<StudentData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);

  useEffect(() => {
    const loadStudentReview = async () => {
      if (!examId || !studentId) return;

      try {
        // Load exam
        const { data: exam } = await supabase
          .from("exams")
          .select("title")
          .eq("id", examId)
          .single();

        if (exam) setExamTitle(exam.title);

        // Load student profile
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name, display_name, student_code")
          .eq("id", studentId)
          .single();

        // Load submission
        const { data: submission } = await supabase
          .from("exam_submissions")
          .select("*")
          .eq("exam_id", examId)
          .eq("student_id", studentId)
          .single();

        if (profile && submission) {
          setStudent({
            name: profile.display_name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
            code: profile.student_code || "-",
            submittedAt: submission.submitted_at,
            timeTaken: submission.time_taken_seconds,
            totalScore: submission.total_score ? Number(submission.total_score) : null,
            totalMarks: submission.total_marks,
            isLate: submission.is_late || false,
          });
        }

        // Load questions
        const { data: questionsData } = await supabase
          .from("exam_questions")
          .select("id, question_number, question_text, question_type, marks, correct_answer")
          .eq("exam_id", examId)
          .order("question_number");

        if (questionsData) {
          setQuestions(questionsData.map(q => ({
            id: q.id,
            questionNumber: q.question_number,
            questionText: q.question_text,
            questionType: q.question_type,
            marks: q.marks,
            correctAnswer: q.correct_answer,
          })));
        }

        // Load answers
        const { data: answersData } = await supabase
          .from("student_answers")
          .select("*")
          .eq("exam_id", examId)
          .eq("student_id", studentId);

        if (answersData) {
          setAnswers(answersData.map(a => ({
            questionId: a.question_id,
            answerText: a.answer_text,
            score: a.score ? Number(a.score) : null,
            isCorrect: a.is_correct,
            feedback: a.feedback,
            isFlagged: a.is_flagged || false,
          })));
        }
      } catch (error) {
        console.error("Error loading student review:", error);
        toast.error("Failed to load student submission");
      } finally {
        setLoading(false);
      }
    };

    loadStudentReview();
  }, [examId, studentId]);

  const formatTime = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getAnswerForQuestion = (questionId: string) => {
    return answers.find(a => a.questionId === questionId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">Submission not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/tutor/exams/${examId}/dashboard`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{examTitle}</h1>
          <p className="text-muted-foreground">Student Submission Review</p>
        </div>
      </div>

      {/* Student Info Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-lg">{student.name}</p>
                <p className="text-sm text-muted-foreground">Code: {student.code}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Submitted</p>
                <p className="font-medium">
                  {student.submittedAt ? format(new Date(student.submittedAt), "PPP p") : "-"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Time Taken</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatTime(student.timeTaken)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Score</p>
                <p className="font-bold text-lg">
                  {student.totalScore !== null && student.totalMarks ? (
                    <>
                      {student.totalScore}/{student.totalMarks}
                      <span className="text-muted-foreground font-normal text-sm ml-1">
                        ({((student.totalScore / student.totalMarks) * 100).toFixed(0)}%)
                      </span>
                    </>
                  ) : (
                    "-"
                  )}
                </p>
              </div>
              {student.isLate && (
                <Badge variant="destructive">Late</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions and Answers */}
      <ScrollArea className="h-[calc(100vh-300px)]">
        <div className="space-y-4">
          {questions.map((question, index) => {
            const answer = getAnswerForQuestion(question.id);
            
            return (
              <Card key={question.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-muted-foreground">Q{question.questionNumber}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {question.questionType.replace("_", " ")}
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {answer?.isFlagged && (
                        <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
                          <Flag className="h-3 w-3" />
                          Flagged
                        </Badge>
                      )}
                      {answer?.isCorrect !== null && (
                        answer.isCorrect ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )
                      )}
                      <Badge variant="secondary">
                        {answer?.score ?? 0}/{question.marks} marks
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Question Text */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Question</p>
                    <p className="text-sm">{question.questionText}</p>
                  </div>

                  {/* Student's Answer */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Student's Answer</p>
                    <div className="p-3 rounded-md bg-muted/50 border">
                      <p className="text-sm whitespace-pre-wrap">
                        {answer?.answerText || <span className="italic text-muted-foreground">No answer provided</span>}
                      </p>
                    </div>
                  </div>

                  {/* Correct Answer (for MCQ/short answer) */}
                  {question.correctAnswer && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Correct Answer</p>
                      <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
                        <p className="text-sm">{question.correctAnswer}</p>
                      </div>
                    </div>
                  )}

                  {/* AI Feedback */}
                  {answer?.feedback && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">AI Feedback</p>
                      <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
                        <p className="text-sm whitespace-pre-wrap">{answer.feedback}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default StudentExamReview;
