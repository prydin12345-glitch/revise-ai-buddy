import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Lock } from "lucide-react";

export default function FormatExam() {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const [useOriginal, setUseOriginal] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileLocked, setProfileLocked] = useState(false);
  const [profileQuestionCount, setProfileQuestionCount] = useState<number | null>(null);
  const [customFormat, setCustomFormat] = useState({
    mcq: { count: 5, marksEach: 2 },
    shortAnswer: { count: 3, marksEach: 5 },
    longForm: { count: 2, marksEach: 10 },
  });

  // Load existing exam_format on mount to avoid overwriting profile settings
  useEffect(() => {
    const loadExistingFormat = async () => {
      if (!draftId) return;
      try {
        const { data } = await supabase
          .from('exam_format')
          .select('*')
          .eq('exam_id', draftId)
          .maybeSingle();

        if (data) {
          const isProfileLocked = data.use_original_structure === false &&
            !data.mcq_count && !data.long_form_count && !!data.short_answer_count;

          if (isProfileLocked) {
            // Profile set the question count — preserve it
            setProfileLocked(true);
            setProfileQuestionCount(data.short_answer_count);
            setUseOriginal(false);
          } else {
            setUseOriginal(data.use_original_structure ?? true);
            if (!data.use_original_structure) {
              setCustomFormat({
                mcq: { count: data.mcq_count || 0, marksEach: data.mcq_marks_each || 2 },
                shortAnswer: { count: data.short_answer_count || 0, marksEach: data.short_answer_marks_each || 5 },
                longForm: { count: data.long_form_count || 0, marksEach: data.long_form_marks_each || 10 },
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to load existing format:', err);
      } finally {
        setLoading(false);
      }
    };
    loadExistingFormat();
  }, [draftId]);

  const handleSave = async () => {
    setSaving(true);

    try {
      if (profileLocked) {
        // Profile is locked — don't overwrite, just proceed
        toast({ title: "Format Saved", description: "Proceeding to timer setup" });
        navigate(`/upload/${draftId}/timer`);
        return;
      }

      const format = {
        useOriginal,
        ...(useOriginal ? {} : customFormat),
      };

      const { error } = await supabase.functions.invoke('save-exam-format', {
        body: { draftId, format },
      });

      if (error) throw error;

      toast({ title: "Format Saved", description: "Proceeding to timer setup" });
      navigate(`/upload/${draftId}/timer`);
    } catch (error: any) {
      console.error('Save format error:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save format",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-background p-6 flex items-center justify-center">
          <p className="text-muted-foreground">Loading format…</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Exam Format</h1>
            <p className="text-muted-foreground">
              Choose your exam structure
            </p>
          </div>

          <div className="bg-card rounded-lg p-8 border border-border space-y-6">
            {profileLocked ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
                <Lock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Locked by Exam Profile
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Generating {profileQuestionCount} questions as set by your profile
                  </p>
                </div>
                <Badge variant="secondary" className="ml-auto">{profileQuestionCount}Q</Badge>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-foreground text-lg">Use Original Structure</Label>
                    <p className="text-sm text-muted-foreground">
                      Keep the exam as uploaded
                    </p>
                  </div>
                  <Switch
                    checked={useOriginal}
                    onCheckedChange={setUseOriginal}
                  />
                </div>

                {!useOriginal && (
                  <div className="space-y-6 pt-4 border-t border-border">
                    <h3 className="text-lg font-semibold text-foreground">Custom Format</h3>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-foreground">Multiple Choice Questions</Label>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div>
                            <Label className="text-sm text-muted-foreground">Count</Label>
                            <Input
                              type="number"
                              value={customFormat.mcq.count}
                              onChange={(e) => setCustomFormat({
                                ...customFormat,
                                mcq: { ...customFormat.mcq, count: parseInt(e.target.value) || 0 },
                              })}
                              className="bg-muted border-border text-foreground"
                            />
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Marks Each</Label>
                            <Input
                              type="number"
                              value={customFormat.mcq.marksEach}
                              onChange={(e) => setCustomFormat({
                                ...customFormat,
                                mcq: { ...customFormat.mcq, marksEach: parseInt(e.target.value) || 0 },
                              })}
                              className="bg-muted border-border text-foreground"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-foreground">Short Answer Questions</Label>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div>
                            <Label className="text-sm text-muted-foreground">Count</Label>
                            <Input
                              type="number"
                              value={customFormat.shortAnswer.count}
                              onChange={(e) => setCustomFormat({
                                ...customFormat,
                                shortAnswer: { ...customFormat.shortAnswer, count: parseInt(e.target.value) || 0 },
                              })}
                              className="bg-muted border-border text-foreground"
                            />
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Marks Each</Label>
                            <Input
                              type="number"
                              value={customFormat.shortAnswer.marksEach}
                              onChange={(e) => setCustomFormat({
                                ...customFormat,
                                shortAnswer: { ...customFormat.shortAnswer, marksEach: parseInt(e.target.value) || 0 },
                              })}
                              className="bg-muted border-border text-foreground"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-foreground">Long Form Questions</Label>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div>
                            <Label className="text-sm text-muted-foreground">Count</Label>
                            <Input
                              type="number"
                              value={customFormat.longForm.count}
                              onChange={(e) => setCustomFormat({
                                ...customFormat,
                                longForm: { ...customFormat.longForm, count: parseInt(e.target.value) || 0 },
                              })}
                              className="bg-muted border-border text-foreground"
                            />
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Marks Each</Label>
                            <Input
                              type="number"
                              value={customFormat.longForm.marksEach}
                              onChange={(e) => setCustomFormat({
                                ...customFormat,
                                longForm: { ...customFormat.longForm, marksEach: parseInt(e.target.value) || 0 },
                              })}
                              className="bg-muted border-border text-foreground"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {saving ? "Saving..." : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
