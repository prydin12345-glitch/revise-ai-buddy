import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarIcon, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfWeek, endOfWeek, addWeeks, addMonths, differenceInWeeks, differenceInMonths, isSameDay, isPast, isFuture } from "date-fns";

interface DateNavigationBarProps {
  viewMode: "week" | "day" | "subject";
  onViewModeChange: (mode: "week" | "day" | "subject") => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  dateState: string;
  onDateStateChange: (state: string) => void;
  onAddRevision: () => void;
}

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export function DateNavigationBar({
  viewMode,
  onViewModeChange,
  currentDate,
  onDateChange,
  dateState,
  onDateStateChange,
  onAddRevision,
}: DateNavigationBarProps) {
  const handlePrevious = () => {
    if (viewMode === "day") {
      onDateChange(addDays(currentDate, -1));
    } else {
      if (dateState === "today") {
        onDateChange(addWeeks(currentDate, -1));
      } else if (dateState === "1-week") {
        onDateChange(addWeeks(currentDate, -1));
      } else if (dateState === "2-weeks") {
        onDateChange(addWeeks(currentDate, -2));
      } else if (dateState === "1-month") {
        onDateChange(addMonths(currentDate, -1));
      }
    }
  };

  const handleNext = () => {
    if (viewMode === "day") {
      onDateChange(addDays(currentDate, 1));
    } else {
      if (dateState === "today") {
        onDateChange(addWeeks(currentDate, 1));
      } else if (dateState === "1-week") {
        onDateChange(addWeeks(currentDate, 1));
      } else if (dateState === "2-weeks") {
        onDateChange(addWeeks(currentDate, 2));
      } else if (dateState === "1-month") {
        onDateChange(addMonths(currentDate, 1));
      }
    }
  };

  const getRelativeTimeLabel = () => {
    const today = new Date();
    
    if (isSameDay(currentDate, today)) {
      return "Today";
    }
    
    // Check if within current week
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    
    if (currentDate >= weekStart && currentDate <= weekEnd && !isSameDay(currentDate, today)) {
      return "This Week";
    }
    
    const diffDays = Math.round((currentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    
    if (isPast(currentDate)) {
      const weeks = Math.abs(differenceInWeeks(currentDate, today));
      const months = Math.abs(differenceInMonths(currentDate, today));
      
      if (months >= 1) {
        return months === 1 ? "1 month ago" : `${months} months ago`;
      }
      if (weeks >= 1) {
        return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
      }
      return format(currentDate, 'EEE, d');
    }
    
    if (isFuture(currentDate)) {
      const weeks = differenceInWeeks(currentDate, today);
      const months = differenceInMonths(currentDate, today);
      
      if (months >= 1) {
        return months === 1 ? "1 month" : `${months} months`;
      }
      if (weeks >= 1) {
        return weeks === 1 ? "1 week" : `${weeks} weeks`;
      }
      return format(currentDate, 'EEE, d');
    }
    
    return "Today";
  };

  const getMonthDisplay = () => {
    return format(currentDate, 'MMM, yyyy');
  };

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-center gap-3">
        {/* Date Navigation Group */}
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            onClick={handlePrevious}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button variant="outline" className="h-9 min-w-[140px]">
            {getRelativeTimeLabel()}
          </Button>

          <Button
            size="icon"
            variant="outline"
            onClick={handleNext}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Month Dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 min-w-[120px] justify-start gap-2">
              <CalendarIcon className="h-4 w-4" />
              {getMonthDisplay()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={(date) => date && onDateChange(date)}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* View Mode Tabs and Add Button */}
      <div className="flex items-center gap-2">
        <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as any)}>
          <TabsList className="h-9">
            <TabsTrigger value="day" className="text-sm">Day</TabsTrigger>
            <TabsTrigger value="week" className="text-sm">Week</TabsTrigger>
            <TabsTrigger value="subject" className="text-sm">Subject</TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Circular Add Revision Button */}
        <Button 
          onClick={onAddRevision} 
          size="icon"
          className="h-9 w-9 rounded-full"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
