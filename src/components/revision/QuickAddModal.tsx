import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface QuickAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Array<{ subject_name: string; subject_color: string }>;
  onAdd: (task: {
    subject: string;
    focusTopic: string;
    time: string;
    duration: number;
  }) => void;
  suggestedTime?: string;
}

export const QuickAddModal = ({ open, onOpenChange, subjects, onAdd, suggestedTime }: QuickAddModalProps) => {
  const [subject, setSubject] = useState("");
  const [focusTopic, setFocusTopic] = useState("");
  const [time, setTime] = useState(suggestedTime || "09:00");
  const [duration, setDuration] = useState("60");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !focusTopic) return;

    onAdd({
      subject,
      focusTopic,
      time,
      duration: parseInt(duration),
    });

    // Reset form
    setSubject("");
    setFocusTopic("");
    setTime(suggestedTime || "09:00");
    setDuration("60");
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
            <Select value={subject} onValueChange={setSubject}>
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
              </SelectContent>
            </Select>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
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