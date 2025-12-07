import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, X, Edit2, Trash2, Sparkles, Image as ImageIcon, Grid3x3, RefreshCw, Play } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { MathRenderer } from "@/components/MathRenderer";

interface QuestionDraft {
  id: string;
  question_number: string;
  question_type: string;
  question_text: string;
  marks: number;
  options?: any;
  correct_answer?: string;
  original_page_number: number;
  has_figures: boolean;
  has_tables: boolean;
  figure_urls: string[];
  topic_tag: string;
  difficulty_level: string;
  extraction_confidence: number;
  is_verified?: boolean;
  generation_status?: string;
  image_handling_strategy?: string;
  original_question_text?: string;
  is_flagged?: boolean;
  flag_reason?: string;
}

export default function ReviewQuestions() {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<QuestionDraft>>({});
  const [showOnlyAI, setShowOnlyAI] = useState(false);
  const [showImageWarnings, setShowImageWarnings] = useState(true);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (draftId) {
      fetchDrafts();
    }
  }, [draftId]);

  const fetchDrafts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('exam_question_drafts')
      .select('*')
      .eq('exam_id', draftId)
      .order('question_number');

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load questions",
        variant: "destructive",
      });
    } else {
      setDrafts(data || []);
    }
    setLoading(false);
  };

  const startEdit = (draft: QuestionDraft) => {
    setEditingId(draft.id);
    setEditForm(draft);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const { error } = await supabase
      .from('exam_question_drafts')
      .update(editForm)
      .eq('id', editingId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Question updated",
      });
      fetchDrafts();
      setEditingId(null);
      setEditForm({});
    }
  };

  const deleteQuestion = async (id: string) => {
    const { error } = await supabase
      .from('exam_question_drafts')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete question",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Question deleted",
      });
      fetchDrafts();
    }
  };

  const regenerateQuestion = async (question: QuestionDraft) => {
    setRegeneratingId(question.id);
    
    try {
      // Call edge function to regenerate this specific question
      const { data, error } = await supabase.functions.invoke('regenerate-question', {
        body: { 
          questionId: question.id,
          originalText: question.original_question_text || question.question_text,
          topicTag: question.topic_tag,
          questionType: question.question_type,
          marks: question.marks,
          difficultyLevel: question.difficulty_level
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Question regenerated successfully",
      });

      fetchDrafts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to regenerate question",
        variant: "destructive",
      });
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleFlag = async (questionId: string, reason: string) => {
    const { error } = await supabase
      .from('exam_question_drafts')
      .update({ 
        is_flagged: true, 
        flag_reason: reason 
      })
      .eq('id', questionId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to flag question",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Question Flagged",
        description: "This question is marked for review",
      });
      fetchDrafts();
    }
  };

  const handleRegenerateFlagged = async () => {
    const flaggedQuestions = drafts.filter(d => d.is_flagged);
    
    for (const question of flaggedQuestions) {
      await regenerateQuestion(question);
    }
  };

  const handleBeginExam = async () => {
    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke('publish-exam', {
        body: { draftId }
      });

      if (error) throw error;

      toast({
        title: "Starting Exam",
        description: "Taking you to your exam...",
      });

      navigate(`/exam/${data.examId}/live?mode=student`);
    } catch (error: any) {
      toast({
        title: "Failed to Start Exam",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveAndPublish = async () => {
    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke('publish-exam', {
        body: { draftId }
      });

      if (error) throw error;

      toast({
        title: "Exam Saved",
        description: "Your exam has been added to My Exams",
      });

      navigate('/my-exams');
    } catch (error: any) {
      toast({
        title: "Failed to Save Exam",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  // Filter questions based on user preferences
  const filteredQuestions = drafts.filter(q => {
    if (showOnlyAI && q.generation_status !== 'ai_generated') return false;
    return true;
  });

  // Question source badge component
  const QuestionSourceBadge = ({ question }: { question: QuestionDraft }) => {
    if (question.generation_status === 'ai_generated') {
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Sparkles className="h-3 w-3 mr-1" />
          AI-Generated
        </Badge>
      );
    }
    
    if (question.generation_status === 'image_referenced') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                <ImageIcon className="h-3 w-3 mr-1" />
                Image Referenced
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>This question references an image from the original document. Students will need access to the PDF.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    if (question.generation_status === 'structure_inspired') {
      return (
        <Badge variant="outline">
          <Grid3x3 className="h-3 w-3 mr-1" />
          Inspired by Original Structure
        </Badge>
      );
    }
    
    return null;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageContainer>
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </PageContainer>
      </DashboardLayout>
    );
  }

  const lowConfidenceCount = drafts.filter(d => d.extraction_confidence < 0.7).length;

  return (
    <DashboardLayout>
      <PageContainer maxWidth="lg">
        <div className="flex items-center justify-between mb-8">
          <PageHeader
            title="Review Generated Questions"
            subtitle={`Review and edit ${drafts.length} questions generated by AI from your PDF`}
            backTo={`/upload/${draftId}/settings`}
          />
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch
                  id="ai-only"
                  checked={showOnlyAI}
                  onCheckedChange={setShowOnlyAI}
                />
                <Label htmlFor="ai-only" className="text-sm">Show only AI-generated</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="image-warnings"
                  checked={showImageWarnings}
                  onCheckedChange={setShowImageWarnings}
                />
                <Label htmlFor="image-warnings" className="text-sm">Show image warnings</Label>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-muted-foreground">
                {filteredQuestions.length} of {drafts.length} questions
              </div>
              {drafts.some(d => d.is_flagged) && (
                <Button onClick={handleRegenerateFlagged} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerate Flagged
                </Button>
              )}
            </div>
          </div>
        </Card>

        {lowConfidenceCount > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ {lowConfidenceCount} question{lowConfidenceCount > 1 ? 's' : ''} with low extraction confidence. Please review carefully.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {filteredQuestions.map((draft) => (
            <Card key={draft.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline" className="font-mono font-bold">
                    Q{draft.question_number}
                  </Badge>
                  <Badge variant="secondary">
                    {draft.question_type === 'mcq' ? 'MCQ' : draft.question_type === 'short_answer' ? 'Short Answer' : 'Long Form'}
                  </Badge>
                  <Badge>{draft.marks} marks</Badge>
                   {draft.extraction_confidence < 0.7 && (
                     <Badge variant="destructive">Low Confidence</Badge>
                   )}
                   {draft.is_flagged && (
                     <Badge variant="destructive" className="ml-2">
                       Flagged: {draft.flag_reason}
                     </Badge>
                   )}
                   <QuestionSourceBadge question={draft} />
                 </div>

                {editingId !== draft.id && (
                  <div className="flex gap-2">
                    {(draft.generation_status === 'ai_generated' || draft.generation_status === 'structure_inspired') && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => regenerateQuestion(draft)}
                              disabled={regeneratingId === draft.id}
                            >
                              {regeneratingId === draft.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                  Regenerate
                                </>
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Generate a new version of this question using AI</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(draft)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteQuestion(draft.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {editingId === draft.id ? (
                <div className="space-y-4">
                  <div>
                    <Label>Question Text</Label>
                    <Textarea
                      value={editForm.question_text || ''}
                      onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                      rows={4}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Question Type</Label>
                      <Select
                        value={editForm.question_type || ''}
                        onValueChange={(value) => setEditForm({ ...editForm, question_type: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcq">Multiple Choice</SelectItem>
                          <SelectItem value="short_answer">Short Answer</SelectItem>
                          <SelectItem value="long_form">Long Form</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Marks</Label>
                      <Input
                        type="number"
                        value={editForm.marks || 0}
                        onChange={(e) => setEditForm({ ...editForm, marks: parseInt(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Topic Tag (optional)</Label>
                    <Input
                      value={editForm.topic_tag || ''}
                      onChange={(e) => setEditForm({ ...editForm, topic_tag: e.target.value })}
                      placeholder="e.g., Biology - Cell Structure"
                      className="mt-1"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={saveEdit} size="sm">
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button onClick={cancelEdit} variant="outline" size="sm">
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <MathRenderer 
                    content={draft.question_text}
                    latex={(draft as any).question_latex}
                    hasMath={(draft as any).has_math}
                    className="mb-3"
                  />

                  {draft.question_type === 'mcq' && draft.options && Array.isArray(draft.options) && (
                    <div className="space-y-2 mb-3 pl-4 border-l-2">
                      {draft.options.map((opt, i) => {
                        const optionLetter = String.fromCharCode(65 + i);
                        return (
                          <div key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="font-medium">{optionLetter})</span>
                            <MathRenderer 
                              content={opt as string} 
                              hasMath={(draft as any).has_math}
                              inline={true}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                   <div className="flex items-center gap-2 mt-3">
                     {draft.topic_tag && (
                       <Badge variant="outline">{draft.topic_tag}</Badge>
                     )}
                     {!draft.is_flagged && (
                       <>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => handleFlag(draft.id, 'too_difficult')}
                         >
                           🚩 Too Difficult
                         </Button>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => handleFlag(draft.id, 'off_spec')}
                         >
                           ⚠️ Off-Spec
                         </Button>
                       </>
                     )}
                   </div>

                   {/* Show original vs generated comparison */}
                  {draft.original_question_text && showImageWarnings && (
                    <Collapsible className="mt-4">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8">
                          <ImageIcon className="h-3 w-3 mr-2" />
                          View Original Question
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <Card className="p-4 bg-muted/50 mt-2">
                          <p className="text-xs text-muted-foreground mb-2">
                            Original (with image reference):
                          </p>
                          <p className="text-sm">{draft.original_question_text}</p>
                        </Card>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>

        <div className="mt-8 flex gap-4 justify-end flex-wrap">
          <Button
            onClick={handleSaveAndPublish}
            size="lg"
            variant="secondary"
            className="h-12 px-6 hover-scale"
            disabled={publishing}
          >
            {publishing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Publishing...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                Save and Publish
              </>
            )}
          </Button>
          
          <Button
            onClick={handleBeginExam}
            size="lg"
            className="h-12 px-8 button-glow"
            disabled={publishing}
          >
            {publishing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Starting...
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                Begin Exam
              </>
            )}
          </Button>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
