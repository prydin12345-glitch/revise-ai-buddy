import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DateNavigationBarProps {
  viewMode: "week" | "day" | "subject";
  onViewModeChange: (mode: "week" | "day" | "subject") => void;
  currentWeekStart: Date;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  onDateStateChange: (state: string) => void;
  onMonthChange: (month: string) => void;
}

export function DateNavigationBar({
  viewMode,
  onViewModeChange,
  currentWeekStart,
  onNavigatePrevious,
  onNavigateNext,
  onDateStateChange,
  onMonthChange,
}: DateNavigationBarProps) {
  const getWeekDateRange = () => {
    const endDate = new Date(currentWeekStart);
    endDate.setDate(endDate.getDate() + 6);
    return `${currentWeekStart.toLocaleDateString('en-US', { month: 'short' })} ${currentWeekStart.getFullYear()}`;
  };

  const getCurrentMonth = () => {
    return currentWeekStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-card border-b">
      {/* Left Section: Navigation Controls */}
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={onNavigatePrevious}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Date State Selector */}
        <Select defaultValue="today" onValueChange={onDateStateChange}>
          <SelectTrigger className="w-[120px] h-8 text-sm">
            <SelectValue placeholder="Today" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="1week">1 Week</SelectItem>
            <SelectItem value="2weeks">2 Weeks</SelectItem>
            <SelectItem value="1month">1 Month</SelectItem>
          </SelectContent>
        </Select>

        {/* Month Selector */}
        <Select value={getCurrentMonth()} onValueChange={onMonthChange}>
          <SelectTrigger className="w-[140px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => {
              const date = new Date();
              date.setMonth(i);
              const value = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
              return (
                <SelectItem key={i} value={value}>
                  {value}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Button
          size="icon"
          variant="ghost"
          onClick={onNavigateNext}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Right Section: View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as any)}>
        <TabsList className="h-8">
          <TabsTrigger value="day" className="text-sm px-3">Day</TabsTrigger>
          <TabsTrigger value="week" className="text-sm px-3">Week</TabsTrigger>
          <TabsTrigger value="subject" className="text-sm px-3">Subject</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
