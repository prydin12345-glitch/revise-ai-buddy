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
import { format, startOfWeek, endOfWeek, addWeeks, addMonths } from "date-fns";

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

  const getDateRangeDisplay = () => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'MMM yyyy');
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

        {/* Date State Dropdown */}
        <Select value={dateState} onValueChange={onDateStateChange}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="1-week">1 Week</SelectItem>
            <SelectItem value="2-weeks">2 Weeks</SelectItem>
            <SelectItem value="1-month">1 Month</SelectItem>
          </SelectContent>
        </Select>

        {/* Month Dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 min-w-[140px] justify-start">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {getDateRangeDisplay()}
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
