import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

interface Task {
  id: string;
  focus_topic: string | null;
  exam_title: string | null;
  subject: string;
}

interface SessionFeedbackModalProps {
  task: Task | null;
  onSubmit: (feedback: {
    confidence: number;
    understood: boolean;
    notes: string;
  }) => void;
  onSkip: () => void;
}

export const SessionFeedbackModal = ({ task, onSubmit, onSkip }: SessionFeedbackModalProps) => {
  const [confidence, setConfidence] = useState(3);
  const [notes, setNotes] = useState('');
  const [understood, setUnderstood] = useState(true);
  
  const handleSubmit = () => {
    onSubmit({ confidence, understood, notes });
    // Reset form
    setConfidence(3);
    setNotes('');
    setUnderstood(true);
  };

  return (
    <Dialog open={!!task} onOpenChange={onSkip}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How did it go?</DialogTitle>
          <DialogDescription>
            You just completed: <strong>{task?.focus_topic || task?.exam_title}</strong> ({task?.subject})
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Confidence Rating */}
          <div>
            <Label>Confidence Level (1-5)</Label>
            <Slider
              value={[confidence]}
              onValueChange={([val]) => setConfidence(val)}
              min={1}
              max={5}
              step={1}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Not confident</span>
              <span className="font-medium">{confidence}/5</span>
              <span>Very confident</span>
            </div>
          </div>
          
          {/* Understanding Check */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="understood"
              checked={understood}
              onCheckedChange={(checked) => setUnderstood(checked === true)}
            />
            <Label htmlFor="understood" className="cursor-pointer">
              I understood the material well
            </Label>
          </div>
          
          {/* Notes */}
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any key points, questions, or areas to review?"
              className="mt-1"
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="ghost" onClick={onSkip}>Skip</Button>
          <Button onClick={handleSubmit}>
            Save Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
