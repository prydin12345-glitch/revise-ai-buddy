import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus, Search } from "lucide-react";
import { format, addDays } from "date-fns";
import { FilterDropdown } from "./FilterDropdown";

interface TopBarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  nearestExam?: {
    title: string;
    daysUntil: number;
  };
  onQuickAdd: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showCompleted: boolean;
  onToggleCompleted: () => void;
  subjects: string[];
  selectedSubjects: string[];
  onSubjectsChange: (subjects: string[]) => void;
  dateRange: { from: Date | null; to: Date | null };
  onDateRangeChange: (range: { from: Date | null; to: Date | null }) => void;
  completionStatus: 'all' | 'completed' | 'pending';
  onCompletionStatusChange: (status: 'all' | 'completed' | 'pending') => void;
  linkedContent: 'all' | 'exam' | 'practice' | 'none';
  onLinkedContentChange: (filter: 'all' | 'exam' | 'practice' | 'none') => void;
  activeFilterCount: number;
}

export const TopBar = ({ 
  currentDate, 
  onDateChange, 
  nearestExam, 
  onQuickAdd,
  searchQuery,
  onSearchChange,
  showCompleted,
  onToggleCompleted,
  subjects,
  selectedSubjects,
  onSubjectsChange,
  dateRange,
  onDateRangeChange,
  completionStatus,
  onCompletionStatusChange,
  linkedContent,
  onLinkedContentChange,
  activeFilterCount
}: TopBarProps) => {
  const handleToday = () => onDateChange(new Date());
  const handleTomorrow = () => onDateChange(addDays(new Date(), 1));

  return (
    <div className="space-y-4">
      {/* Top Row: Date Picker & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-card rounded-lg border">
        {/* Date Picker */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(currentDate, 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={currentDate}
                onSelect={(date) => date && onDateChange(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          {/* Quick Date Buttons */}
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleToday}>
              Today
            </Button>
            <Button variant="ghost" size="sm" onClick={handleTomorrow}>
              Tomorrow
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input 
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Exam Countdown Badge */}
        {nearestExam && (
          <Badge variant="secondary" className="text-sm">
            {nearestExam.title} in {nearestExam.daysUntil} days
          </Badge>
        )}
      </div>

      {/* Bottom Row: Controls */}
      <div className="flex items-center justify-between gap-4 px-4">
        {/* Show Completed Toggle */}
        <div className="flex items-center gap-2">
          <Switch 
            id="show-completed"
            checked={showCompleted}
            onCheckedChange={onToggleCompleted}
          />
          <Label htmlFor="show-completed" className="text-sm cursor-pointer">
            Show Completed
          </Label>
        </div>

        {/* Filter & Add Task Buttons */}
        <div className="flex items-center gap-2">
          <FilterDropdown
            subjects={subjects}
            selectedSubjects={selectedSubjects}
            onSubjectsChange={onSubjectsChange}
            dateRange={dateRange}
            onDateRangeChange={onDateRangeChange}
            completionStatus={completionStatus}
            onCompletionStatusChange={onCompletionStatusChange}
            linkedContent={linkedContent}
            onLinkedContentChange={onLinkedContentChange}
            activeFilterCount={activeFilterCount}
          />
          <Button onClick={onQuickAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>
    </div>
  );
};