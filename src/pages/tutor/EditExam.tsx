import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, ArrowLeft, Lock, Trash2, Plus, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { AssignModal } from "@/components/tutor/AssignModal";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ExamQuestion {
  id: string;
  question_number: string;
  question_text: string;
  question_type: string;
  marks: number;
  topic_tag?: string | null;
}

interface ExamAssignment {
  id: string;
  assignment_type: string;
  target_id: string | null;
  deadline: string | null;
  release_date: string | null;
  is_grades_released: boolean;
  class_name?: string | null;
}

interface ExamData {
  id: string;
  title: string;
  subject_id: string;
  exam_board: string | null;
  qualification_level: string | null;
  status: string;
  allow_retakes: boolean | null;
  shuffle_questions: boolean | null;
  show_feedback_per_question: boolean | null;
}

const examBoards = [
  { id: "aqa", name: "AQA" },
  { id: "edexcel", name: "Edexcel" },
  { id: "ocr", name: "OCR" },
  { id: "cie", name: "Cambridge International (CIE)" },
  { id: "ib", name: "International Baccalaureate (IB)" },
  { id: "wjec", name: "WJEC" },
  { id: "other", name: "Other" }
];

export default function EditExam() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exam, setExam] = useState<ExamData | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [assignments, setAssignments] = useState<ExamAssignment[]>([]);
  const [activeTab, setActiveTab] = useState("questions");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  
  // Editable fields
  const [title, setTitle] = useState("");
  const [examBoard, setExamBoard] = useState("");
  const [qualificationLevel, setQualificationLevel] = useState("");
  const [allowRetakes, setAllowRetakes] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [showFeedback, setShowFeedback] = useState(true);

  const isPublished = exam?.status === "published";

  useEffect(() => {
    if (examId) {
      fetchExamData();
    }
  }, [examId]);

  const fetchExamData = async () => {
    try {
      // Fetch exam details
      const { data: examData, error: examError } = await supabase
        .from("exams")
        .select("*")
        .eq("id", examId)
        .single();

      if (examError) throw examError;
      setExam(examData);
      setTitle(examData.title);
      setExamBoard(examData.exam_board || "");
      setQualificationLevel(examData.qualification_level || "");
      setAllowRetakes(examData.allow_retakes || false);
      setShuffleQuestions(examData.shuffle_questions || false);
      setShowFeedback(examData.show_feedback_per_question ?? true);

      // Fetch questions from drafts
      const { data: questionsData, error: questionsError } = await supabase
        .from("exam_question_drafts")
        .select("id, question_number, question_text, question_type, marks, topic_tag")
        .eq("exam_id", examId)
        .order("question_number");

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // Fetch assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("exam_assignments")
        .select("*")
        .eq("exam_id", examId)
        .eq("is_active", true);

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);
    } catch (error) {
      console.error("Error fetching exam data:", error);
      toast.error("Failed to load exam");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (isPublished) {
      toast.error("Cannot edit published exams");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("exams")
        .update({
          title,
          exam_board: examBoard || null,
          qualification_level: qualificationLevel || null,
          allow_retakes: allowRetakes,
          shuffle_questions: shuffleQuestions,
          show_feedback_per_question: showFeedback,
        })
        .eq("id", examId);

      if (error) throw error;
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateQuestion = async (questionId: string, field: string, value: string | number) => {
    if (isPublished) return;

    try {
      const { error } = await supabase
        .from("exam_question_drafts")
        .update({ [field]: value })
        .eq("id", questionId);

      if (error) throw error;

      setQuestions(prev => prev.map(q => 
        q.id === questionId ? { ...q, [field]: value } : q
      ));
    } catch (error) {
      console.error("Error updating question:", error);
      toast.error("Failed to update question");
    }
  };

  const handleDeleteQuestion = async () => {
    if (!deleteQuestionId || isPublished) return;

    try {
      const { error } = await supabase
        .from("exam_question_drafts")
        .delete()
        .eq("id", deleteQuestionId);

      if (error) throw error;

      setQuestions(prev => prev.filter(q => q.id !== deleteQuestionId));
      toast.success("Question deleted");
    } catch (error) {
      console.error("Error deleting question:", error);
      toast.error("Failed to delete question");
    } finally {
      setDeleteQuestionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">Exam not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tutor/exams")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{exam.title}</h1>
              {isPublished && (
                <Badge variant="default" className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Published
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {questions.length} questions • {exam.subject_id}
            </p>
          </div>
        </div>
      </div>

      {isPublished && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="py-3">
            <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              This exam is published and cannot be edited. Create a new version if changes are needed.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>

        {/* Questions Tab */}
        <TabsContent value="questions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exam Questions</CardTitle>
              <CardDescription>
                {isPublished ? "View exam questions (read-only)" : "Edit, reorder, or delete questions"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No questions found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead className="w-24">Type</TableHead>
                      <TableHead className="w-20">Marks</TableHead>
                      <TableHead className="w-32">Topic</TableHead>
                      {!isPublished && <TableHead className="w-16">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((question) => (
                      <TableRow key={question.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {!isPublished && <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />}
                            <span className="font-mono">{question.question_number}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isPublished ? (
                            <p className="text-sm line-clamp-2">{question.question_text}</p>
                          ) : (
                            <Textarea
                              value={question.question_text}
                              onChange={(e) => handleUpdateQuestion(question.id, "question_text", e.target.value)}
                              className="min-h-[60px] text-sm"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{question.question_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {isPublished ? (
                            <span>{question.marks}</span>
                          ) : (
                            <Input
                              type="number"
                              value={question.marks}
                              onChange={(e) => handleUpdateQuestion(question.id, "marks", parseInt(e.target.value) || 1)}
                              className="w-16"
                              min={1}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{question.topic_tag || "-"}</span>
                        </TableCell>
                        {!isPublished && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteQuestionId(question.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exam Settings</CardTitle>
              <CardDescription>
                {isPublished ? "View exam configuration (read-only)" : "Configure exam details and behavior"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Exam Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isPublished}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="examBoard">Exam Board</Label>
                  <Select value={examBoard} onValueChange={setExamBoard} disabled={isPublished}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select exam board" />
                    </SelectTrigger>
                    <SelectContent>
                      {examBoards.map((board) => (
                        <SelectItem key={board.id} value={board.id}>
                          {board.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level">Qualification Level</Label>
                  <Input
                    id="level"
                    value={qualificationLevel}
                    onChange={(e) => setQualificationLevel(e.target.value)}
                    placeholder="e.g., A-Level, GCSE"
                    disabled={isPublished}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Retakes</Label>
                    <p className="text-sm text-muted-foreground">
                      Students can retake the exam after submission
                    </p>
                  </div>
                  <Switch
                    checked={allowRetakes}
                    onCheckedChange={setAllowRetakes}
                    disabled={isPublished}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Shuffle Questions</Label>
                    <p className="text-sm text-muted-foreground">
                      Randomize question order for each student
                    </p>
                  </div>
                  <Switch
                    checked={shuffleQuestions}
                    onCheckedChange={setShuffleQuestions}
                    disabled={isPublished}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Feedback Per Question</Label>
                    <p className="text-sm text-muted-foreground">
                      Display feedback after each question is answered
                    </p>
                  </div>
                  <Switch
                    checked={showFeedback}
                    onCheckedChange={setShowFeedback}
                    disabled={isPublished}
                  />
                </div>
              </div>

              {!isPublished && (
                <Button onClick={handleSaveSettings} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Assignments</CardTitle>
                  <CardDescription>Manage exam assignments to students and groups</CardDescription>
                </div>
                <Button onClick={() => setShowAssignModal(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Assignment
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No assignments yet. Click "Add Assignment" to assign this exam.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Release Date</TableHead>
                      <TableHead>Grades</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell>{assignment.class_name || assignment.target_id || "All Students"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{assignment.assignment_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {assignment.deadline
                            ? format(new Date(assignment.deadline), "MMM d, yyyy HH:mm")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {assignment.release_date
                            ? format(new Date(assignment.release_date), "MMM d, yyyy HH:mm")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={assignment.is_grades_released ? "default" : "secondary"}>
                            {assignment.is_grades_released ? "Released" : "Hidden"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Question Confirmation */}
      <AlertDialog open={!!deleteQuestionId} onOpenChange={() => setDeleteQuestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuestion} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Modal */}
      {showAssignModal && examId && (
        <AssignModal
          open={showAssignModal}
          onOpenChange={setShowAssignModal}
          examId={examId}
          examTitle={exam.title}
          onAssigned={fetchExamData}
        />
      )}
    </div>
  );
}
