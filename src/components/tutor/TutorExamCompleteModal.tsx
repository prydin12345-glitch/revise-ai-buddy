import { useState } from "react";
import { CheckCircle, Edit2, Send, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StudentGroupSelector } from "./StudentGroupSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface TutorExamCompleteModalProps {
  draftId: string;
  totalQuestions: number;
  subjectColor: string;
  examName: string;
  onReview: () => void;
  onSaveAsDraft: () => void;
}

export function TutorExamCompleteModal({
  totalQuestions,
  subjectColor,
  examName,
  onReview,
  onSaveAsDraft,
}: TutorExamCompleteModalProps) {
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [releaseDate, setReleaseDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [gradesHidden, setGradesHidden] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  const timestamp = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleAssignAndPublish = async () => {
    if (!releaseDate) {
      toast.error("Please select a release date");
      return;
    }

    setIsPublishing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // First, publish the exam
      const { data: publishData, error: publishError } = await supabase.functions.invoke('publish-exam', {
        body: { draftId: examName }
      });

      if (publishError) throw publishError;

      // Then create the assignment
      const assignmentData = {
        exam_id: publishData.examId,
        assigned_by: user.id,
        assignment_type: selectedGroup === "all" ? "all" : "group",
        target_id: selectedGroup === "all" ? null : selectedGroup,
        release_date: new Date(releaseDate).toISOString(),
        deadline: deadline ? new Date(deadline).toISOString() : null,
        is_active: true,
        is_grades_released: !gradesHidden
      };

      const { error: assignError } = await supabase
        .from("exam_assignments")
        .insert(assignmentData);

      if (assignError) throw assignError;

      toast.success(`Exam "${examName}" published and assigned successfully`);
      
      // Navigate to manage exams page
      window.location.href = '/tutor/exams';
    } catch (error) {
      console.error("Error publishing and assigning exam:", error);
      toast.error("Failed to publish and assign exam");
    } finally {
      setIsPublishing(false);
    }
  };

  if (showAssignmentForm) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
        <Card className="max-w-2xl w-full mx-4 p-8 shadow-2xl border-primary/20 animate-scale-in">
          <div className="text-center mb-6">
            <Send 
              className="h-12 w-12 mx-auto mb-4"
              style={{ color: subjectColor }}
            />
            <h2 
              className="text-2xl font-bold mb-2"
              style={{ color: subjectColor }}
            >
              Assign & Publish Exam
            </h2>
            <p className="text-muted-foreground">
              Configure assignment settings for "{examName}"
            </p>
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assign To</Label>
              <StudentGroupSelector value={selectedGroup} onValueChange={setSelectedGroup} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="releaseDate">Release Date *</Label>
              <Input
                id="releaseDate"
                type="datetime-local"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline (Optional)</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Hide Grades</Label>
                <p className="text-sm text-muted-foreground">
                  Keep grades hidden until you manually release them
                </p>
              </div>
              <Switch
                checked={gradesHidden}
                onCheckedChange={setGradesHidden}
              />
            </div>
          </div>

          <Separator className="my-6" />

          <div className="flex gap-3">
            <Button 
              onClick={() => setShowAssignmentForm(false)} 
              variant="outline" 
              className="flex-1"
            >
              Back
            </Button>
            <Button 
              onClick={handleAssignAndPublish}
              disabled={isPublishing}
              className="flex-1"
              style={{ backgroundColor: subjectColor }}
            >
              {isPublishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish & Assign
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <Card className="max-w-2xl w-full mx-4 p-8 shadow-2xl border-primary/20 animate-scale-in">
        {/* Success Icon & Message */}
        <div className="text-center mb-6">
          <CheckCircle 
            className="h-16 w-16 mx-auto mb-4 animate-scale-in"
            style={{ color: subjectColor }}
          />
          <h2 
            className="text-3xl font-bold mb-2"
            style={{ color: subjectColor }}
          >
            Exam generated successfully!
          </h2>
          <p className="text-muted-foreground">
            {totalQuestions} questions created • Generated on {timestamp}
          </p>
        </div>

        <Separator className="my-6" />

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={onReview} 
            size="lg" 
            variant="outline" 
            className="w-full h-14 text-lg hover:bg-accent transition-all hover-scale"
          >
            <Edit2 className="h-5 w-5 mr-2" />
            Review Questions
          </Button>
          
          <Button 
            onClick={() => setShowAssignmentForm(true)}
            size="lg" 
            className="w-full h-14 text-lg button-glow"
            style={{ backgroundColor: subjectColor }}
          >
            <Send className="h-5 w-5 mr-2" />
            Assign & Publish
          </Button>
          
          <Button 
            onClick={onSaveAsDraft} 
            size="lg" 
            variant="secondary" 
            className="w-full h-14 text-lg hover:bg-secondary/80 transition-all hover-scale"
          >
            <Save className="h-5 w-5 mr-2" />
            Save as Draft
          </Button>
        </div>
      </Card>
    </div>
  );
}
