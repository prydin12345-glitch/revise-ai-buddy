import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Clock } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function TimerSetup() {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);

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
      const { error } = await supabase.functions.invoke('save-exam-timer', {
        body: { draftId, enabled: timerEnabled, duration },
      });

      if (error) throw error;

      toast({
        title: "Timer Configured",
        description: "Proceeding to preview",
      });

      navigate(`/upload/${draftId}/preview`);
    } catch (error: any) {
      console.error('Save timer error:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save timer",
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
            <h1 className="text-3xl font-bold text-white mb-2">Timer Setup</h1>
            <p className="text-muted-foreground">
              Configure time limits for your exam
            </p>
          </div>

          <div className="bg-white/5 rounded-lg p-8 border border-white/10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-[#1e40af]" />
                <div>
                  <Label className="text-white text-lg">Enable Timer</Label>
                  <p className="text-sm text-muted-foreground">
                    Add a time limit to the exam
                  </p>
                </div>
              </div>
              <Switch
                checked={timerEnabled}
                onCheckedChange={setTimerEnabled}
              />
            </div>

            {timerEnabled && (
              <div className="pt-4 border-t border-white/10">
                <Label className="text-white">Duration (minutes)</Label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                  min="1"
                  className="mt-2 bg-[#1a2332] border-white/10 text-white"
                  placeholder="Enter duration in minutes"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Students will have {duration} minutes to complete the exam
                </p>
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-[#1e40af] hover:bg-[#1e40af]/90"
            >
              {saving ? "Saving..." : "Continue to Preview"}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
