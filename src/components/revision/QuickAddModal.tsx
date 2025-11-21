import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubjectSelector } from "@/components/dashboard/SubjectSelector";
import { CustomTimePicker } from "./CustomTimePicker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuickAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Array<{ subject_name: string; subject_color: string }>;
  onAdd: (task: {
    subject: string;
    subject_color: string;
    focusTopic: string;
    time: string;
    duration: number;
    dueDate?: string;
    reminderDaysBefore?: number;
    linkedExamId?: string;
    linkedPracticeSetId?: string;
    targetScore?: number;
  }) => void;
  onUpdate?: (taskId: string, updates: {
    subject: string;
    subject_color: string;
    focusTopic: string;
    time: string;
    duration: number;
    dueDate?: string;
    reminderDaysBefore?: number;
    linkedExamId?: string;
    linkedPracticeSetId?: string;
    targetScore?: number;
  }) => void;
  editMode?: boolean;
  editTaskId?: string;
  suggestedTime?: string;
  onSaveSubject?: (name: string, color: string) => Promise<void>;
  preFilledData?: {
    subject?: string;
    focusTopic?: string;
    linkedExamId?: string;
    linkedPracticeSetId?: string;
    time?: string;
    duration?: number;
    dueDate?: string;
    reminderDaysBefore?: number;
    targetScore?: number;
  };
}

export const QuickAddModal = ({ open, onOpenChange, subjects, onAdd, onUpdate, editMode = false, editTaskId, suggestedTime, onSaveSubject, preFilledData }: QuickAddModalProps) => {
  const [subject, setSubject] = useState("");
  const [focusTopic, setFocusTopic] = useState("");
  const [time, setTime] = useState(suggestedTime || "09:00");
  const [duration, setDuration] = useState("60");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [reminderDaysBefore, setReminderDaysBefore] = useState(1);
  const [subjectColor, setSubjectColor] = useState("#3b82f6");
  const [linkedExamId, setLinkedExamId] = useState("");
  const [linkedPracticeSetId, setLinkedPracticeSetId] = useState("");
  const [targetScore, setTargetScore] = useState<number>();
  const [userExams, setUserExams] = useState<any[]>([]);
  const [userPracticeSets, setUserPracticeSets] = useState<any[]>([]);

  useEffect(() => {
    const loadUserContent = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: examsData } = await supabase
        .from("exams")
        .select("id, title, subject_id")
        .eq("user_id", user.id)
        .eq("status", "published");
      
      setUserExams(examsData || []);

      const { data: setsData } = await supabase
        .from("practice_question_sets")
        .select("id, set_name, subject_id")
        .eq("user_id", user.id)
        .eq("status", "published");
      
      setUserPracticeSets(setsData || []);
    };

    if (open) {
      loadUserContent();
    }
  }, [open]);

  useEffect(() => {
    if (preFilledData) {
      if (preFilledData.subject) setSubject(preFilledData.subject);
      if (preFilledData.focusTopic) setFocusTopic(preFilledData.focusTopic);
      if (preFilledData.linkedExamId) setLinkedExamId(preFilledData.linkedExamId);
      if (preFilledData.linkedPracticeSetId) setLinkedPracticeSetId(preFilledData.linkedPracticeSetId);
      if (preFilledData.time) setTime(preFilledData.time);
      if (preFilledData.duration) setDuration(preFilledData.duration.toString());
      if (preFilledData.dueDate) setDueDate(new Date(preFilledData.dueDate));
      if (preFilledData.reminderDaysBefore) setReminderDaysBefore(preFilledData.reminderDaysBefore);
      if (preFilledData.targetScore) setTargetScore(preFilledData.targetScore);
      
      // Set subject color
      const existingSubject = subjects.find(s => s.subject_name === preFilledData.subject);
      if (existingSubject) {
        setSubjectColor(existingSubject.subject_color);
      }
    }
  }, [preFilledData, subjects]);

  const handleSubjectChange = (value: string) => {
    setSubject(value);
    const existingSubject = subjects.find(s => s.subject_name === value);
    if (existingSubject) {
      setSubjectColor(existingSubject.subject_color);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !focusTopic) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (targetScore && (targetScore < 0 || targetScore > 100)) {
      toast.error("Target score must be between 0 and 100");
      return;
    }

    const taskData = {
      subject,
      subject_color: subjectColor,
      focusTopic,
      time,
      duration: parseInt(duration),
      dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
      reminderDaysBefore,
      linkedExamId: linkedExamId || undefined,
      linkedPracticeSetId: linkedPracticeSetId || undefined,
      targetScore,
    };

    if (editMode && editTaskId && onUpdate) {
      onUpdate(editTaskId, taskData);
    } else {
      onAdd(taskData);
    }

    // Reset form
    setSubject("");
    setFocusTopic("");
    setTime(suggestedTime || "09:00");
    setDuration("60");
    setDueDate(undefined);
    setReminderDaysBefore(1);
    setSubjectColor("#3b82f6");
    setLinkedExamId("");
    setLinkedPracticeSetId("");
    setTargetScore(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editMode ? 'Edit Revision Task' : 'Add Revision Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Subject</Label>
            <SubjectSelector
              value={subject}
              color={subjectColor}
              onValueChange={handleSubjectChange}
              onColorChange={setSubjectColor}
            />
          </div>

          <div className="space-y-2">
            <Label>Focus Topic</Label>
            <Input
              value={focusTopic}
              onChange={(e) => setFocusTopic(e.target.value)}
              placeholder="What will you revise?"
              required
              className="text-base h-11"
            />
          </div>

          <div className="space-y-2">
            <Label>Link to Exam or Practice Set (Optional)</Label>
            <Select 
              value={linkedExamId ? `exam-${linkedExamId}` : linkedPracticeSetId ? `set-${linkedPracticeSetId}` : "none"} 
              onValueChange={(value) => {
                if (value.startsWith('exam-')) {
                  setLinkedExamId(value.replace('exam-', ''));
                  setLinkedPracticeSetId("");
                } else if (value.startsWith('set-')) {
                  setLinkedPracticeSetId(value.replace('set-', ''));
                  setLinkedExamId("");
                } else {
                  setLinkedExamId("");
                  setLinkedPracticeSetId("");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select content" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No link</SelectItem>
                {userExams.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Exams</div>
                    {userExams.map((exam) => (
                      <SelectItem key={exam.id} value={`exam-${exam.id}`}>{exam.title}</SelectItem>
                    ))}
                  </>
                )}
                {userPracticeSets.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Practice Sets</div>
                    {userPracticeSets.map((set) => (
                      <SelectItem key={set.id} value={`set-${set.id}`}>{set.set_name}</SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {(linkedExamId || linkedPracticeSetId) && (
            <div className="space-y-2">
              <Label>Target Score (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                placeholder="e.g., 85"
                value={targetScore || ""}
                onChange={(e) => setTargetScore(e.target.value ? parseInt(e.target.value) : undefined)}
                className="text-base h-11"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Time</Label>
              <CustomTimePicker value={time} onChange={setTime} />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 mins</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Due Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-base h-11">
                  <CalendarIcon className="mr-2 h-5 w-5" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} />
              </PopoverContent>
            </Popover>
          </div>

          {dueDate && (
            <div className="space-y-2">
              <Label>Reminder</Label>
              <Select value={reminderDaysBefore.toString()} onValueChange={(v) => setReminderDaysBefore(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day before</SelectItem>
                  <SelectItem value="2">2 days before</SelectItem>
                  <SelectItem value="3">3 days before</SelectItem>
                  <SelectItem value="7">1 week before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{editMode ? 'Save Changes' : 'Add Task'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
