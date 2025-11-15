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
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

interface MissedTask {
  id: string;
  subject: string;
  subject_color: string;
  focus_topic: string | null;
  exam_title: string | null;
  date: string;
  time: string;
  duration: number | null;
}

interface AutoRescheduleModalProps {
  missedTasks: MissedTask[];
  onReschedule: (reschedules: Record<string, { date: Date; time: string }>) => void;
  onDismiss: () => void;
}

export const AutoRescheduleModal = ({ missedTasks, onReschedule, onDismiss }: AutoRescheduleModalProps) => {
  const [selectedSlots, setSelectedSlots] = useState<Record<string, { date: Date; time: string }>>({});
  
  const hours = Array.from({ length: 16 }, (_, i) => {
    const hour = i + 7;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  const handleReschedule = () => {
    onReschedule(selectedSlots);
    setSelectedSlots({});
  };

  return (
    <Dialog open={missedTasks.length > 0} onOpenChange={onDismiss}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Reschedule Missed Tasks</DialogTitle>
          <DialogDescription>
            You have {missedTasks.length} task(s) that weren't completed. 
            Would you like to reschedule them?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto max-h-[400px]">
          {missedTasks.map(task => {
            const hasSelection = selectedSlots[task.id];
            
            return (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <div className="flex-1">
                  <Badge style={{ backgroundColor: task.subject_color }}>
                    {task.subject}
                  </Badge>
                  <p className="font-medium mt-1">{task.focus_topic || task.exam_title}</p>
                  <p className="text-xs text-muted-foreground">
                    Originally: {format(new Date(task.date), 'EEE, MMM d')} at {task.time}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  {/* Date Picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {hasSelection?.date 
                          ? format(hasSelection.date, 'MMM d')
                          : 'Date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={hasSelection?.date}
                        onSelect={(date) => {
                          if (date) {
                            setSelectedSlots(prev => ({
                              ...prev,
                              [task.id]: { 
                                date, 
                                time: prev[task.id]?.time || '09:00' 
                              }
                            }));
                          }
                        }}
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Time Picker */}
                  <Select
                    value={hasSelection?.time || ''}
                    onValueChange={(time) => {
                      setSelectedSlots(prev => ({
                        ...prev,
                        [task.id]: { 
                          date: prev[task.id]?.date || new Date(), 
                          time 
                        }
                      }));
                    }}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Time" />
                    </SelectTrigger>
                    <SelectContent>
                      {hours.map(hour => (
                        <SelectItem key={hour} value={hour}>
                          {hour}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onDismiss}>Skip for now</Button>
          <Button 
            onClick={handleReschedule}
            disabled={Object.keys(selectedSlots).length === 0}
          >
            Reschedule {Object.keys(selectedSlots).length} task(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
