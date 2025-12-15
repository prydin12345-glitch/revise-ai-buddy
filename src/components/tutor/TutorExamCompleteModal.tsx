import { useState } from "react";
import { CheckCircle, Edit2, Send, Save, Download, Loader2, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StudentGroupSelector } from "./StudentGroupSelector";
import { ExamPDFPreviewModal } from "@/components/exam/ExamPDFPreviewModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TutorExamCompleteModalProps {
  draftId: string;
  totalQuestions: number;
  subjectColor: string;
  examName: string;
  onReview: () => void;
  onSaveAsDraft: () => void;
}

interface ExamQuestion {
  id: string;
  question_number: string;
  question_text: string;
  question_type: string;
  marks: number;
  options?: { label: string; text: string }[] | null;
  figure_urls?: string[] | null;
  correct_answer?: string | null;
  topic_tag?: string | null;
}

type MarksVisibility = 'immediate' | 'on_date' | 'manual';
type ExamStatus = 'draft' | 'published';

export function TutorExamCompleteModal({
  draftId,
  totalQuestions,
  subjectColor,
  examName,
  onReview,
  onSaveAsDraft,
}: TutorExamCompleteModalProps) {
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [examData, setExamData] = useState<{
    title: string;
    subject?: string;
    exam_board?: string;
    qualification_level?: string;
    questions: ExamQuestion[];
  } | null>(null);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [releaseDate, setReleaseDate] = useState("");
  const [deadline, setDeadline] = useState("");
  
  // Mark visibility settings
  const [marksVisibility, setMarksVisibility] = useState<MarksVisibility>('immediate');
  const [marksReleaseDate, setMarksReleaseDate] = useState("");
  
  // Exam status
  const [examStatus, setExamStatus] = useState<ExamStatus>('published');
  
  // Advanced options
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [allowRetakes, setAllowRetakes] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [showFeedbackPerQuestion, setShowFeedbackPerQuestion] = useState(true);
  const [timeLimitPerQuestion, setTimeLimitPerQuestion] = useState<string>("");
  
  const [isPublishing, setIsPublishing] = useState(false);

  const timestamp = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleDownloadPDF = async () => {
    setLoadingPDF(true);
    try {
      const { data: questions, error } = await supabase
        .from("exam_question_drafts")
        .select("*")
        .eq("exam_id", draftId)
        .order("question_number");

      if (error) throw error;

      const formattedQuestions: ExamQuestion[] = questions.map(q => ({
        id: q.id,
        question_number: q.question_number,
        question_text: q.question_text,
        question_type: q.question_type,
        marks: q.marks,
        options: q.options as { label: string; text: string }[] | null,
        figure_urls: q.figure_urls,
        correct_answer: q.correct_answer,
        topic_tag: q.topic_tag,
      }));

      setExamData({
        title: examName,
        questions: formattedQuestions,
      });
      setShowPDFModal(true);
    } catch (error) {
      console.error("Error fetching exam data:", error);
      toast.error("Failed to load exam for PDF");
    } finally {
      setLoadingPDF(false);
    }
  };

  const handleAssignAndPublish = async () => {
    if (examStatus === 'published' && !releaseDate) {
      toast.error("Please select a release date");
      return;
    }

    if (marksVisibility === 'on_date' && !marksReleaseDate) {
      toast.error("Please select a marks release date");
      return;
    }

    setIsPublishing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update exam with advanced settings
      const examUpdates: Record<string, unknown> = {
        allow_retakes: allowRetakes,
        shuffle_questions: shuffleQuestions,
        show_feedback_per_question: showFeedbackPerQuestion,
        time_limit_per_question: timeLimitPerQuestion ? parseInt(timeLimitPerQuestion) : null,
        status: examStatus,
      };

      await supabase
        .from("exams")
        .update(examUpdates)
        .eq("id", draftId);

      if (examStatus === 'draft') {
        toast.success(`Exam "${examName}" saved as draft`);
        window.location.href = '/tutor/exams';
        return;
      }

      // Publish the exam
      const { data: publishData, error: publishError } = await supabase.functions.invoke('publish-exam', {
        body: { draftId: examName }
      });

      if (publishError) throw publishError;

      // Create the assignment with mark visibility settings
      const assignmentData = {
        exam_id: publishData.examId,
        assigned_by: user.id,
        assignment_type: selectedGroup === "all" ? "all" : "group",
        target_id: selectedGroup === "all" ? null : selectedGroup,
        release_date: new Date(releaseDate).toISOString(),
        deadline: deadline ? new Date(deadline).toISOString() : null,
        is_active: true,
        is_grades_released: marksVisibility === 'immediate',
        marks_visibility: marksVisibility,
        marks_release_date: marksVisibility === 'on_date' && marksReleaseDate 
          ? new Date(marksReleaseDate).toISOString() 
          : null,
      };

      const { error: assignError } = await supabase
        .from("exam_assignments")
        .insert(assignmentData);

      if (assignError) throw assignError;

      toast.success(`Exam "${examName}" published and assigned successfully`);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto py-8">
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

          <div className="space-y-6">
            {/* Exam Status */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Exam Status</Label>
              <RadioGroup 
                value={examStatus} 
                onValueChange={(v) => setExamStatus(v as ExamStatus)}
                className="grid grid-cols-2 gap-4"
              >
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent transition-colors">
                  <RadioGroupItem value="draft" id="status-draft" />
                  <Label htmlFor="status-draft" className="cursor-pointer flex-1">
                    <span className="font-medium">Save as Draft</span>
                    <p className="text-xs text-muted-foreground">Hidden from students</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent transition-colors">
                  <RadioGroupItem value="published" id="status-published" />
                  <Label htmlFor="status-published" className="cursor-pointer flex-1">
                    <span className="font-medium">Publish Now</span>
                    <p className="text-xs text-muted-foreground">Visible to assigned groups</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {examStatus === 'published' && (
              <>
                {/* Assign To */}
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <StudentGroupSelector value={selectedGroup} onValueChange={setSelectedGroup} />
                </div>

                {/* Release Date */}
                <div className="space-y-2">
                  <Label htmlFor="releaseDate">Release Date *</Label>
                  <Input
                    id="releaseDate"
                    type="datetime-local"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                  />
                </div>

                {/* Deadline */}
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline (Optional)</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>

                {/* Mark Visibility */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Mark Visibility</Label>
                  <RadioGroup 
                    value={marksVisibility} 
                    onValueChange={(v) => setMarksVisibility(v as MarksVisibility)}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent transition-colors">
                      <RadioGroupItem value="immediate" id="marks-immediate" />
                      <Label htmlFor="marks-immediate" className="cursor-pointer flex-1">
                        <span className="font-medium">Show marks immediately</span>
                        <p className="text-xs text-muted-foreground">Students see marks right after submission</p>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent transition-colors">
                      <RadioGroupItem value="on_date" id="marks-on-date" />
                      <Label htmlFor="marks-on-date" className="cursor-pointer flex-1">
                        <span className="font-medium">Hide until release date</span>
                        <p className="text-xs text-muted-foreground">Marks visible after specified date</p>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent transition-colors">
                      <RadioGroupItem value="manual" id="marks-manual" />
                      <Label htmlFor="marks-manual" className="cursor-pointer flex-1">
                        <span className="font-medium">Manual release only</span>
                        <p className="text-xs text-muted-foreground">You control when marks are released</p>
                      </Label>
                    </div>
                  </RadioGroup>
                  
                  {marksVisibility === 'on_date' && (
                    <div className="space-y-2 pl-6 mt-2">
                      <Label htmlFor="marksReleaseDate">Marks Release Date *</Label>
                      <Input
                        id="marksReleaseDate"
                        type="datetime-local"
                        value={marksReleaseDate}
                        onChange={(e) => setMarksReleaseDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Advanced Options */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span className="font-medium">Advanced Options</span>
                  </div>
                  {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between border rounded-lg p-3">
                  <div className="space-y-0.5">
                    <Label>Allow Retakes</Label>
                    <p className="text-xs text-muted-foreground">
                      Students can retake the exam after submission
                    </p>
                  </div>
                  <Switch
                    checked={allowRetakes}
                    onCheckedChange={setAllowRetakes}
                  />
                </div>
                
                <div className="flex items-center justify-between border rounded-lg p-3">
                  <div className="space-y-0.5">
                    <Label>Shuffle Questions</Label>
                    <p className="text-xs text-muted-foreground">
                      Randomize question order for each student
                    </p>
                  </div>
                  <Switch
                    checked={shuffleQuestions}
                    onCheckedChange={setShuffleQuestions}
                  />
                </div>
                
                <div className="flex items-center justify-between border rounded-lg p-3">
                  <div className="space-y-0.5">
                    <Label>Show Feedback Per Question</Label>
                    <p className="text-xs text-muted-foreground">
                      Display AI feedback for each question answer
                    </p>
                  </div>
                  <Switch
                    checked={showFeedbackPerQuestion}
                    onCheckedChange={setShowFeedbackPerQuestion}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="timeLimitPerQuestion">Time Limit Per Question (seconds)</Label>
                  <Input
                    id="timeLimitPerQuestion"
                    type="number"
                    placeholder="Leave empty for no limit"
                    value={timeLimitPerQuestion}
                    onChange={(e) => setTimeLimitPerQuestion(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Set a time limit for each question
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
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
              {examStatus === 'draft' ? 'Save Draft' : 'Publish & Assign'}
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
            onClick={handleDownloadPDF}
            size="lg" 
            variant="outline" 
            className="w-full h-14 text-lg hover:bg-accent transition-all hover-scale"
            disabled={loadingPDF}
          >
            {loadingPDF ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Download className="h-5 w-5 mr-2" />
            )}
            Download as PDF
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

      {examData && (
        <ExamPDFPreviewModal
          open={showPDFModal}
          onOpenChange={setShowPDFModal}
          examData={examData}
          examTitle={examName}
        />
      )}
    </div>
  );
}