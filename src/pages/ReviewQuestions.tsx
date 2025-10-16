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
import { Loader2, Save, X, Edit2, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface QuestionDraft {
  id: string;
  question_number: string; // Changed to string to support sub-numbering (1.1, 2a, etc.)
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
}

export default function ReviewQuestions() {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<QuestionDraft>>({});

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

  const proceedToFormat = () => {
    navigate(`/upload/${draftId}/preview`);
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
            title="Review Extracted Questions"
            subtitle={`Review and edit ${drafts.length} questions extracted from your PDF`}
            step="Step 4 of 4"
          />
          <Button onClick={proceedToFormat} size="lg">
            Proceed to Publish
          </Button>
        </div>

        {lowConfidenceCount > 0 && (
          <Card className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 mb-6">
            <p className="text-yellow-800 dark:text-yellow-200">
              ⚠️ {lowConfidenceCount} question(s) have low extraction confidence. Please review carefully.
            </p>
          </Card>
        )}

        <div className="space-y-4">
          {drafts.map((draft) => (
            <Card key={draft.id} className="p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">Q{draft.question_number}</Badge>
                  <Badge>{draft.question_type.toUpperCase()}</Badge>
                  <Badge variant="secondary">{draft.marks} marks</Badge>
                  <Badge variant="outline">Page {draft.original_page_number}</Badge>
                  <Badge 
                    variant={draft.extraction_confidence >= 0.9 ? "default" : draft.extraction_confidence >= 0.7 ? "secondary" : "destructive"}
                  >
                    {Math.round(draft.extraction_confidence * 100)}% confidence
                  </Badge>
                  {draft.has_figures && <Badge>Has Figures</Badge>}
                  {draft.has_tables && <Badge>Has Tables</Badge>}
                </div>
                <div className="flex gap-2">
                  {editingId === draft.id ? (
                    <>
                      <Button size="sm" onClick={saveEdit}>
                        <Save className="h-4 w-4 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => startEdit(draft)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteQuestion(draft.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {editingId === draft.id ? (
                <div className="space-y-4">
                  <div>
                    <Label>Question Text</Label>
                    <Textarea
                      value={editForm.question_text || ''}
                      onChange={(e) => setEditForm({...editForm, question_text: e.target.value})}
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Question Type</Label>
                      <Select
                        value={editForm.question_type}
                        onValueChange={(value) => setEditForm({...editForm, question_type: value})}
                      >
                        <SelectTrigger>
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
                        value={editForm.marks || 1}
                        onChange={(e) => setEditForm({...editForm, marks: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label>Difficulty</Label>
                      <Select
                        value={editForm.difficulty_level || ''}
                        onValueChange={(value) => setEditForm({...editForm, difficulty_level: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {editForm.question_type === 'mcq' && (
                    <div className="space-y-2">
                      <Label>Options</Label>
                      {['a', 'b', 'c', 'd'].map(option => (
                        <div key={option} className="flex gap-2">
                          <Input
                            placeholder={`Option ${option.toUpperCase()}`}
                            value={editForm.options?.[option] || ''}
                            onChange={(e) => setEditForm({
                              ...editForm,
                              options: {...editForm.options, [option]: e.target.value}
                            })}
                          />
                        </div>
                      ))}
                      <div>
                        <Label>Correct Answer</Label>
                        <Select
                          value={editForm.correct_answer || ''}
                          onValueChange={(value) => setEditForm({...editForm, correct_answer: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select correct option..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="a">A</SelectItem>
                            <SelectItem value="b">B</SelectItem>
                            <SelectItem value="c">C</SelectItem>
                            <SelectItem value="d">D</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap">{draft.question_text}</p>
                  
                  {draft.question_type === 'mcq' && draft.options && (
                    <div className="space-y-2 ml-4">
                      {Object.entries(draft.options).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className={draft.correct_answer === key ? "font-semibold text-green-600" : ""}>
                            {key.toUpperCase()}) {value as string}
                          </span>
                          {draft.correct_answer === key && (
                            <Badge variant="default" className="ml-2">Correct</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {draft.topic_tag && (
                    <p className="text-sm text-muted-foreground">
                      Topic: {draft.topic_tag}
                    </p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
