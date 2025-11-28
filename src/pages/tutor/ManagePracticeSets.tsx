import { useNavigate } from "react-router-dom";
import { TutorLayout } from "@/components/tutor/TutorLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CompletionBadge } from "@/components/tutor/CompletionBadge";
import { useTutorPracticeSets } from "@/hooks/useTutorPracticeSets";
import { Plus, Loader2, Edit, UserPlus, Eye, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const ManagePracticeSets = () => {
  const navigate = useNavigate();
  const { practiceSets, loading } = useTutorPracticeSets();

  if (loading) {
    return (
      <TutorLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </TutorLayout>
    );
  }

  return (
    <TutorLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Practice Sets</h1>
            <p className="text-muted-foreground">Create and manage practice questions for students</p>
          </div>
          <Button onClick={() => navigate("/create-practice-questions")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Practice Set
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Practice Sets</CardTitle>
            <CardDescription>Manage all practice question sets</CardDescription>
          </CardHeader>
          <CardContent>
            {practiceSets.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No practice sets created yet</p>
                <Button onClick={() => navigate("/create-practice-questions")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Practice Set
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Topics</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {practiceSets.map((set) => (
                    <TableRow key={set.id}>
                      <TableCell className="font-medium">{set.set_name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {set.subtopics.slice(0, 2).map((topic, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                          {set.subtopics.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{set.subtopics.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {set.difficulty_level || "Mixed"}
                        </Badge>
                      </TableCell>
                      <TableCell>{set.question_count}</TableCell>
                      <TableCell>
                        <Badge variant={set.status === "completed" ? "default" : "secondary"}>
                          {set.status || "draft"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <CompletionBadge 
                          completed={set.completion_count} 
                          total={set.total_assigned} 
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/practice-set-preview/${set.id}`)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toast.info("Assign feature coming soon")}
                            title="Assign"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/practice-set-preview/${set.id}`)}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toast.info("Analytics coming soon")}
                            title="Analytics"
                          >
                            <BarChart3 className="h-4 w-4" />
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
      </div>
    </TutorLayout>
  );
};

export default ManagePracticeSets;
