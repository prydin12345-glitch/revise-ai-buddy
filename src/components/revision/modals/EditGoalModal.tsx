import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubjectSelector } from "@/components/dashboard/SubjectSelector";

interface Goal {
  id: string;
  subject: string;
  subject_color: string;
  target_percentage: number;
  current_percentage?: number;
  deadline?: string;
  target_exams: number;
}

interface EditGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
  subjects: Array<{ subject_name: string; subject_color: string }>;
  onSave: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

export const EditGoalModal = ({ open, onOpenChange, goal, subjects, onSave }: EditGoalModalProps) => {
  const [subject, setSubject] = useState("");
  const [subjectColor, setSubjectColor] = useState("#3b82f6");
  const [targetPercentage, setTargetPercentage] = useState("80");
  const [targetExams, setTargetExams] = useState("10");
  const [deadline, setDeadline] = useState<Date | undefined>();

  useEffect(() => {
    if (goal) {
      setSubject(goal.subject);
      setSubjectColor(goal.subject_color);
      setTargetPercentage(String(goal.target_percentage));
      setTargetExams(String(goal.target_exams));
      setDeadline(goal.deadline ? new Date(goal.deadline) : undefined);
    }
  }, [goal]);

  const handleSubjectChange = (value: string) => {
    setSubject(value);
    const existingSubject = subjects.find(s => s.subject_name === value);
    if (existingSubject) {
      setSubjectColor(existingSubject.subject_color);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal || !subject) return;

    await onSave(goal.id, {
      subject,
      subject_color: subjectColor,
      target_percentage: parseInt(targetPercentage),
      target_exams: parseInt(targetExams),
      deadline: deadline ? format(deadline, 'yyyy-MM-dd') : undefined,
    });

    onOpenChange(false);
  };

  if (!goal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Revision Goal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <SubjectSelector
              value={subject}
              color={subjectColor}
              onValueChange={handleSubjectChange}
              onColorChange={setSubjectColor}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetPercentage">Target Score (%)</Label>
            <Input
              id="targetPercentage"
              type="number"
              min="0"
              max="100"
              value={targetPercentage}
              onChange={(e) => setTargetPercentage(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetExams">Target Exams Completed</Label>
            <Input
              id="targetExams"
              type="number"
              min="1"
              value={targetExams}
              onChange={(e) => setTargetExams(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Deadline (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !deadline && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deadline ? format(deadline, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={deadline}
                  onSelect={setDeadline}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
