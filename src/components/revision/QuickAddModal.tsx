import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubjectSelector } from "@/components/dashboard/SubjectSelector";
import { CustomTimePicker } from "./CustomTimePicker";

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
  }) => void;
  suggestedTime?: string;
  onSaveSubject?: (name: string, color: string) => Promise<void>;
}

export const QuickAddModal = ({ open, onOpenChange, subjects, onAdd, suggestedTime, onSaveSubject }: QuickAddModalProps) => {
  const [subject, setSubject] = useState("");
  const [focusTopic, setFocusTopic] = useState("");
  const [time, setTime] = useState(suggestedTime || "09:00");
  const [duration, setDuration] = useState("60");
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
  const [reminderDaysBefore, setReminderDaysBefore] = useState(1);
  const [subjectColor, setSubjectColor] = useState("#3b82f6");

  const handleSubjectChange = (value: string) => {
    setSubject(value);
    const existingSubject = subjects.find(s => s.subject_name === value);
    if (existingSubject) {
      setSubjectColor(existingSubject.subject_color);
    }
  };

  const handleColorChange = (color: string) => {
    setSubjectColor(color);
  };

  const handleSaveSubject = async (name: string, color: string) => {
    if (onSaveSubject) {
      await onSaveSubject(name, color);
    }
    setSubject(name);
    setSubjectColor(color);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !focusTopic) return;

    onAdd({
      subject,
      subject_color: subjectColor,
      focusTopic,
      time,
      duration: parseInt(duration),
      dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
      reminderDaysBefore,
    });

    // Reset form
    setSubject("");
    setFocusTopic("");
    setTime(suggestedTime || "09:00");
    setDuration("60");
    setDueDate(new Date());
    setReminderDaysBefore(1);
    setSubjectColor("#3b82f6");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Revision Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <SubjectSelector
              value={subject}
              color={subjectColor}
              onValueChange={handleSubjectChange}
              onColorChange={handleColorChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="topic">Focus Topic</Label>
            <Input
              id="topic"
              value={focusTopic}
              onChange={(e) => setFocusTopic(e.target.value)}
              placeholder="What will you revise?"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <CustomTimePicker value={time} onChange={setTime} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (min)</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="25">25 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="90">90 min</SelectItem>
                  <SelectItem value="120">120 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-blue-400" />
                  {dueDate ? format(dueDate, "PPP") : "Select due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  className="rounded-md border pointer-events-auto"
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </PopoverContent>
            </Popover>
          </div>

          {dueDate && (
            <div className="space-y-2">
              <Label htmlFor="reminder">Remind me before due date</Label>
              <Select 
                value={String(reminderDaysBefore)} 
                onValueChange={(value) => setReminderDaysBefore(parseInt(value))}
              >
                <SelectTrigger id="reminder" className="w-full min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="1">1 day before</SelectItem>
                  <SelectItem value="2">2 days before</SelectItem>
                  <SelectItem value="3">3 days before</SelectItem>
                  <SelectItem value="4">4 days before</SelectItem>
                  <SelectItem value="5">5 days before</SelectItem>
                  <SelectItem value="6">6 days before</SelectItem>
                  <SelectItem value="7">7 days before (1 week)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Task</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};