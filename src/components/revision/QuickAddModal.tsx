import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Array<{ subject_name: string; subject_color: string }>;
  onAdd: (task: {
    subject: string;
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
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [customSubjectColor, setCustomSubjectColor] = useState("#6B7280");

  const handleSubjectChange = (value: string) => {
    if (value === "other") {
      setIsCustomSubject(true);
      setSubject("");
    } else {
      setIsCustomSubject(false);
      setSubject(value);
    }
  };

  const handleSaveCustomSubject = async () => {
    if (!customSubjectName.trim()) return;
    
    if (onSaveSubject) {
      await onSaveSubject(customSubjectName, customSubjectColor);
    }
    
    setSubject(customSubjectName);
    setIsCustomSubject(false);
    setCustomSubjectName("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !focusTopic) return;

    onAdd({
      subject,
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
    setIsCustomSubject(false);
    setCustomSubjectName("");
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
            {!isCustomSubject ? (
              <Select value={subject} onValueChange={handleSubjectChange}>
                <SelectTrigger id="subject">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.subject_name} value={s.subject_name}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: s.subject_color }}
                        />
                        {s.subject_name}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="other">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      + Add Custom Subject
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter subject name"
                    value={customSubjectName}
                    onChange={(e) => setCustomSubjectName(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="color"
                    value={customSubjectColor}
                    onChange={(e) => setCustomSubjectColor(e.target.value)}
                    className="w-16 h-10 cursor-pointer"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveCustomSubject}
                    disabled={!customSubjectName.trim()}
                  >
                    Save Subject
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsCustomSubject(false);
                      setCustomSubjectName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <Input
                        id="time"
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 pointer-events-none" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Select start time</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
            <div className="flex items-center gap-2 text-sm">
              <Switch
                checked={reminderDaysBefore === 2}
                onCheckedChange={(checked) => setReminderDaysBefore(checked ? 2 : 1)}
              />
              <Label className="cursor-pointer">Remind me 2 days before (instead of 1 day)</Label>
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