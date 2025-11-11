import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";

interface TopBarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  nearestExam?: {
    title: string;
    date: Date;
    subject: string;
  };
  onQuickAdd: () => void;
}

export const TopBar = ({ currentDate, onDateChange, nearestExam, onQuickAdd }: TopBarProps) => {
  const handleToday = () => onDateChange(new Date());
  const handleTomorrow = () => onDateChange(addDays(new Date(), 1));

  return (
    <div className="flex items-center justify-between gap-4 p-4 border-b bg-card">
      {/* Date Control */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="w-4 h-4" />
              {format(currentDate, 'EEE, MMM d')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={(date) => date && onDateChange(date)}
            />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="sm" onClick={handleToday}>
          Today
        </Button>
        <Button variant="ghost" size="sm" onClick={handleTomorrow}>
          Tomorrow
        </Button>
      </div>

      {/* Exam Countdown */}
      {nearestExam && (
        <Badge variant="secondary" className="px-3 py-1.5 text-sm">
          {differenceInDays(nearestExam.date, new Date())} days until {nearestExam.title}
        </Badge>
      )}

      {/* Quick Add Button */}
      <Button 
        className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={onQuickAdd}
      >
        <Plus className="w-4 h-4" />
        Add Task
      </Button>
    </div>
  );
};