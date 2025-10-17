import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Clock, FileText, Info } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function ExamSettings() {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  
  // Format settings
  const [useOriginal, setUseOriginal] = useState(true);
  const [customFormat, setCustomFormat] = useState({
    mcq: { count: 5, marksEach: 2 },
    shortAnswer: { count: 3, marksEach: 5 },
    longForm: { count: 2, marksEach: 10 },
  });

  // Timer settings
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [duration, setDuration] = useState(60);

  const getTotalMarks = () => {
    if (useOriginal) return "As per original";
    return (
      customFormat.mcq.count * customFormat.mcq.marksEach +
      customFormat.shortAnswer.count * customFormat.shortAnswer.marksEach +
      customFormat.longForm.count * customFormat.longForm.marksEach
    );
  };

  const handleSave = async () => {
    if (timerEnabled && duration <= 0) {
      toast({
        title: "Invalid Duration",
        description: "Please enter a positive duration",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Save format
      const format = {
        useOriginal,
        ...(useOriginal ? {} : customFormat),
      };

      const { error: formatError } = await supabase.functions.invoke('save-exam-format', {
        body: { draftId, format },
      });

      if (formatError) throw formatError;

      // Save timer
      const { error: timerError } = await supabase.functions.invoke('save-exam-timer', {
        body: { draftId, enabled: timerEnabled, duration },
      });

      if (timerError) throw timerError;

      toast({
        title: "Settings Saved",
        description: "Proceeding to review",
      });

      navigate(`/upload/${draftId}/preview`);
    } catch (error: any) {
      console.error('Save settings error:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <PageContainer maxWidth="lg">
        <PageHeader
          title="Exam Settings"
          subtitle="Configure format and timing for your exam"
          step="Step 2 of 4"
          backTo="/upload"
        />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Format Section */}
            <Card className="p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Format Selection</h2>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <Label className="text-base font-medium">Use Original Structure</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        AI generates new questions matching the original format
                      </p>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="font-medium mb-2">Structure Preservation Mode</p>
                          <ul className="text-xs space-y-1 list-disc list-inside">
                            <li>Preserves question count, types, and mark distribution</li>
                            <li>AI generates NEW questions testing similar concepts</li>
                            <li>Different wording and scenarios (copyright-safe)</li>
                            <li>Image-based questions are automatically handled</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Switch
                    checked={useOriginal}
                    onCheckedChange={setUseOriginal}
                  />
                </div>

                {!useOriginal && (
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-base font-medium">Custom Format</h3>

                    {/* MCQ */}
                    <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                      <Label className="text-sm font-medium">Multiple Choice Questions</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Count</Label>
                          <Input
                            type="number"
                            value={customFormat.mcq.count}
                            onChange={(e) => setCustomFormat({
                              ...customFormat,
                              mcq: { ...customFormat.mcq, count: parseInt(e.target.value) || 0 },
                            })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Marks Each</Label>
                          <Input
                            type="number"
                            value={customFormat.mcq.marksEach}
                            onChange={(e) => setCustomFormat({
                              ...customFormat,
                              mcq: { ...customFormat.mcq, marksEach: parseInt(e.target.value) || 0 },
                            })}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Short Answer */}
                    <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                      <Label className="text-sm font-medium">Short Answer Questions</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Count</Label>
                          <Input
                            type="number"
                            value={customFormat.shortAnswer.count}
                            onChange={(e) => setCustomFormat({
                              ...customFormat,
                              shortAnswer: { ...customFormat.shortAnswer, count: parseInt(e.target.value) || 0 },
                            })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Marks Each</Label>
                          <Input
                            type="number"
                            value={customFormat.shortAnswer.marksEach}
                            onChange={(e) => setCustomFormat({
                              ...customFormat,
                              shortAnswer: { ...customFormat.shortAnswer, marksEach: parseInt(e.target.value) || 0 },
                            })}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Long Form */}
                    <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                      <Label className="text-sm font-medium">Long Form Questions</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Count</Label>
                          <Input
                            type="number"
                            value={customFormat.longForm.count}
                            onChange={(e) => setCustomFormat({
                              ...customFormat,
                              longForm: { ...customFormat.longForm, count: parseInt(e.target.value) || 0 },
                            })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Marks Each</Label>
                          <Input
                            type="number"
                            value={customFormat.longForm.marksEach}
                            onChange={(e) => setCustomFormat({
                              ...customFormat,
                              longForm: { ...customFormat.longForm, marksEach: parseInt(e.target.value) || 0 },
                            })}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Timer Section */}
            <Card className="p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2 mb-6">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Timer Setup</h2>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <Label className="text-base font-medium">Enable Timer</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add a time limit to the exam
                      </p>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Students will see a countdown timer and must submit before time runs out.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Switch
                    checked={timerEnabled}
                    onCheckedChange={setTimerEnabled}
                  />
                </div>

                {timerEnabled && (
                  <div className="pt-4 border-t space-y-2">
                    <Label className="text-sm font-medium">Duration (minutes)</Label>
                    <Input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                      min="1"
                      placeholder="Enter duration in minutes"
                      className="text-base"
                    />
                    <p className="text-sm text-muted-foreground">
                      Students will have {duration} minutes to complete the exam
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-6 shadow-[var(--shadow-card)] sticky top-6">
              <h3 className="text-lg font-semibold mb-4">Configuration Summary</h3>
              
              <div className="space-y-4">
                <div className="pb-4 border-b">
                  <p className="text-sm text-muted-foreground mb-1">Format</p>
                  <p className="font-medium">
                    {useOriginal ? "Original Structure" : "Custom Format"}
                  </p>
                </div>

                <div className="pb-4 border-b">
                  <p className="text-sm text-muted-foreground mb-1">Total Marks</p>
                  <p className="font-medium">{getTotalMarks()}</p>
                </div>

                {!useOriginal && (
                  <div className="pb-4 border-b space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">MCQ</span>
                      <span>{customFormat.mcq.count} × {customFormat.mcq.marksEach}m</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Short Answer</span>
                      <span>{customFormat.shortAnswer.count} × {customFormat.shortAnswer.marksEach}m</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Long Form</span>
                      <span>{customFormat.longForm.count} × {customFormat.longForm.marksEach}m</span>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Timer</p>
                  <p className="font-medium">
                    {timerEnabled ? `${duration} minutes` : "No time limit"}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-6 button-glow"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                    Saving...
                  </>
                ) : (
                  "Continue to Review & Publish"
                )}
              </Button>
            </Card>
          </div>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}