import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function FormatExam() {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const [useOriginal, setUseOriginal] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customFormat, setCustomFormat] = useState({
    mcq: { count: 5, marksEach: 2 },
    shortAnswer: { count: 3, marksEach: 5 },
    longForm: { count: 2, marksEach: 10 },
  });

  const handleSave = async () => {
    setSaving(true);

    try {
      const format = {
        useOriginal,
        ...(useOriginal ? {} : customFormat),
      };

      const { error } = await supabase.functions.invoke('save-exam-format', {
        body: { draftId, format },
      });

      if (error) throw error;

      toast({
        title: "Format Saved",
        description: "Proceeding to timer setup",
      });

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

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0f1727] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Exam Format</h1>
            <p className="text-muted-foreground">
              Choose your exam structure
            </p>
          </div>

          <div className="bg-white/5 rounded-lg p-8 border border-white/10 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white text-lg">Use Original Structure</Label>
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
              <div className="space-y-6 pt-4 border-t border-white/10">
                <h3 className="text-lg font-semibold text-white">Custom Format</h3>

                <div className="space-y-4">
                  <div>
                    <Label className="text-white">Multiple Choice Questions</Label>
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
                          className="bg-[#1a2332] border-white/10 text-white"
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
                          className="bg-[#1a2332] border-white/10 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-white">Short Answer Questions</Label>
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
                          className="bg-[#1a2332] border-white/10 text-white"
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
                          className="bg-[#1a2332] border-white/10 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-white">Long Form Questions</Label>
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
                          className="bg-[#1a2332] border-white/10 text-white"
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
                          className="bg-[#1a2332] border-white/10 text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-[#1e40af] hover:bg-[#1e40af]/90"
            >
              {saving ? "Saving..." : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
