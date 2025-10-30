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
    if (dateState === "today") {
      onDateChange(addWeeks(currentDate, -1));
    } else if (dateState === "1-week") {
      onDateChange(addWeeks(currentDate, -1));
    } else if (dateState === "2-weeks") {
      onDateChange(addWeeks(currentDate, -2));
    } else if (dateState === "1-month") {
      onDateChange(addMonths(currentDate, -1));
    }
  };

  const handleNext = () => {
    if (dateState === "today") {
      onDateChange(addWeeks(currentDate, 1));
    } else if (dateState === "1-week") {
      onDateChange(addWeeks(currentDate, 1));
    } else if (dateState === "2-weeks") {
      onDateChange(addWeeks(currentDate, 2));
    } else if (dateState === "1-month") {
      onDateChange(addMonths(currentDate, 1));
    }
  };

  const getRelativeTimeLabel = () => {
    const today = new Date();
    
    if (isSameDay(currentDate, today)) {
      return "Today";
    }
    
    if (isPast(currentDate)) {
      const weeks = Math.abs(differenceInWeeks(currentDate, today));
      const months = Math.abs(differenceInMonths(currentDate, today));
      
      if (months >= 1) {
        return months === 1 ? "1 month ago" : `${months} months ago`;
      }
      return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
    }
    
    if (isFuture(currentDate)) {
      const weeks = differenceInWeeks(currentDate, today);
      const months = differenceInMonths(currentDate, today);
      
      if (months >= 1) {
        return months === 1 ? "1 month" : `${months} months`;
      }
      return weeks === 1 ? "1 week" : `${weeks} weeks`;
    }
    
    return "Today";
  };

  const getMonthDisplay = () => {
    return format(currentDate, 'MMM, yyyy');
  };

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-center gap-3">
        {/* Navigation Arrows */}
        <Button
          size="icon"
          variant="outline"
          onClick={handlePrevious}
          className="h-9 w-9"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Dynamic Relative Time Label */}
        <Button variant="outline" className="h-9 min-w-[140px]">
          {getRelativeTimeLabel()}
        </Button>

        {/* Month Dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 min-w-[120px] justify-start">
              <CalendarIcon className="mr-2 h-4 w-4" />
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

        <Button
          size="icon"
          variant="outline"
          onClick={handleNext}
          className="h-9 w-9"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* View Mode Tabs */}
        <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as any)} className="ml-2">
          <TabsList className="h-9">
            <TabsTrigger value="day" className="text-sm">Day</TabsTrigger>
            <TabsTrigger value="week" className="text-sm">Week</TabsTrigger>
            <TabsTrigger value="subject" className="text-sm">Subject</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Add Revision Button */}
      <Button onClick={onAddRevision} className="h-9">
        <Plus className="w-4 h-4 mr-2" />
        Add Revision
      </Button>
    </div>
  );
}
