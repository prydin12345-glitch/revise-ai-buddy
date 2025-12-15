import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CompletionBadge } from "@/components/tutor/CompletionBadge";
import { AssignModal } from "@/components/tutor/AssignModal";
import { PrintExamButton } from "@/components/exam/PrintExamButton";
import { useTutorExams } from "@/hooks/useTutorExams";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Loader2, Edit, UserPlus, Eye, BarChart3, Lock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
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

const ManageExams = () => {
  const navigate = useNavigate();
  const { exams, loading, refetch } = useTutorExams();
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<{ id: string; title: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<{ id: string; title: string; status: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAssignClick = (examId: string, examTitle: string) => {
    setSelectedExam({ id: examId, title: examTitle });
    setAssignModalOpen(true);
  };

  const handleEditClick = (examId: string, examStatus: string) => {
    // Navigate to edit page - it handles read-only mode for published exams
    navigate(`/tutor/exams/${examId}/edit`);
  };

  const handlePreviewClick = (examId: string) => {
    navigate(`/tutor/exams/${examId}/edit`);
  };

  const handleDeleteClick = (examId: string, examTitle: string, examStatus: string) => {
    setExamToDelete({ id: examId, title: examTitle, status: examStatus });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!examToDelete) return;

    setIsDeleting(true);
    try {
      // Delete related data first (cascade)
      await supabase.from("exam_question_drafts").delete().eq("exam_id", examToDelete.id);
      await supabase.from("exam_questions").delete().eq("exam_id", examToDelete.id);
      await supabase.from("exam_assignments").delete().eq("exam_id", examToDelete.id);
      await supabase.from("exam_submissions").delete().eq("exam_id", examToDelete.id);
      await supabase.from("exam_topics").delete().eq("exam_id", examToDelete.id);
      await supabase.from("exam_format").delete().eq("exam_id", examToDelete.id);
      await supabase.from("exam_timer").delete().eq("exam_id", examToDelete.id);
      await supabase.from("student_answers").delete().eq("exam_id", examToDelete.id);
      
      // Finally delete the exam
      const { error } = await supabase.from("exams").delete().eq("id", examToDelete.id);
      
      if (error) throw error;
      
      toast.success(`Exam "${examToDelete.title}" deleted successfully`);
      refetch();
    } catch (error) {
      console.error("Error deleting exam:", error);
      toast.error("Failed to delete exam");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setExamToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Exams</h1>
            <p className="text-muted-foreground">Create, assign, and track student exams</p>
          </div>
          <Button onClick={() => navigate("/tutor/exams/create")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Exam
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Exams</CardTitle>
            <CardDescription>Manage all exams you've created</CardDescription>
          </CardHeader>
          <CardContent>
            {exams.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No exams created yet</p>
                <Button onClick={() => navigate("/tutor/exams/create")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Exam
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned Groups</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map((exam) => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">{exam.title}</TableCell>
                      <TableCell>
                        <Badge variant={exam.status === "published" ? "default" : "secondary"}>
                          {exam.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {exam.assigned_groups.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {exam.assigned_groups.slice(0, 2).map((group, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {group}
                              </Badge>
                            ))}
                            {exam.assigned_groups.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{exam.assigned_groups.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {exam.deadline ? format(new Date(exam.deadline), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        <CompletionBadge 
                          completed={exam.completed_students} 
                          total={exam.total_students} 
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditClick(exam.id, exam.status)}
                              >
                                {exam.status === "published" ? (
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Edit className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {exam.status === "published" ? "View (read-only)" : "Edit exam"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAssignClick(exam.id, exam.title)}
                              >
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Assign to students</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/tutor/exams/${exam.id}/dashboard`)}
                              >
                                <BarChart3 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View dashboard</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreviewClick(exam.id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Preview questions</TooltipContent>
                          </Tooltip>
                          <PrintExamButton
                            examId={exam.id}
                            examTitle={exam.title}
                          />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(exam.id, exam.title, exam.status)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete exam</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {selectedExam && (
          <AssignModal
            open={assignModalOpen}
            onOpenChange={setAssignModalOpen}
            examId={selectedExam.id}
            examTitle={selectedExam.title}
            onAssigned={refetch}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Exam</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{examToDelete?.title}"?
                {examToDelete?.status === "published" && (
                  <span className="block mt-2 text-destructive font-medium">
                    Warning: This exam has been published. Deleting it will remove all student submissions.
                  </span>
                )}
                <span className="block mt-2">This action cannot be undone.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  );
};

export default ManageExams;
