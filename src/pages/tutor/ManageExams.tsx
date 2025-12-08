import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CompletionBadge } from "@/components/tutor/CompletionBadge";
import { AssignModal } from "@/components/tutor/AssignModal";
import { useTutorExams } from "@/hooks/useTutorExams";
import { Plus, Loader2, Edit, UserPlus, Eye, BarChart3, Lock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const ManageExams = () => {
  const navigate = useNavigate();
  const { exams, loading, refetch } = useTutorExams();
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<{ id: string; title: string } | null>(null);

  const handleAssignClick = (examId: string, examTitle: string) => {
    setSelectedExam({ id: examId, title: examTitle });
    setAssignModalOpen(true);
  };

  const handleEditClick = (examId: string, examStatus: string) => {
    if (examStatus === "published") {
      toast.info("Published exams cannot be edited. Create a new version if needed.");
      return;
    }
    navigate(`/exam-settings/${examId}`);
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
                                disabled={exam.status === "published"}
                              >
                                {exam.status === "published" ? (
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Edit className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            {exam.status === "published" && (
                              <TooltipContent>
                                Published exams cannot be edited
                              </TooltipContent>
                            )}
                          </Tooltip>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAssignClick(exam.id, exam.title)}
                            title="Assign"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/tutor/exams/${exam.id}/dashboard`)}
                            title="View Dashboard"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/exam-preview/${exam.id}`)}
                            title="Preview Questions"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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
      </div>
  );
};

export default ManageExams;
