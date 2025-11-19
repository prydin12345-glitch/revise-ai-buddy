import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, X } from "lucide-react";
import { format } from "date-fns";

interface FilterDropdownProps {
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

export const FilterDropdown = ({
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
}: FilterDropdownProps) => {
  const [open, setOpen] = useState(false);

  const handleSubjectToggle = (subject: string) => {
    if (selectedSubjects.includes(subject)) {
      onSubjectsChange(selectedSubjects.filter(s => s !== subject));
    } else {
      onSubjectsChange([...selectedSubjects, subject]);
    }
  };

  const handleClearFilters = () => {
    onSubjectsChange([]);
    onDateRangeChange({ from: null, to: null });
    onCompletionStatusChange('all');
    onLinkedContentChange('all');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <Badge 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="default"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Filters</h3>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date Range</Label>
            <Calendar
              mode="range"
              selected={{ from: dateRange.from || undefined, to: dateRange.to || undefined }}
              onSelect={(range) => onDateRangeChange({ from: range?.from || null, to: range?.to || null })}
              className="rounded-md border"
            />
            {(dateRange.from || dateRange.to) && (
              <p className="text-xs text-muted-foreground">
                {dateRange.from && format(dateRange.from, 'PP')} 
                {dateRange.from && dateRange.to && ' - '}
                {dateRange.to && format(dateRange.to, 'PP')}
              </p>
            )}
          </div>

          {/* Subjects */}
          {subjects.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Subjects</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {subjects.map((subject) => (
                  <div key={subject} className="flex items-center space-x-2">
                    <Checkbox
                      id={`subject-${subject}`}
                      checked={selectedSubjects.includes(subject)}
                      onCheckedChange={() => handleSubjectToggle(subject)}
                    />
                    <label
                      htmlFor={`subject-${subject}`}
                      className="text-sm cursor-pointer"
                    >
                      {subject}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completion Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <RadioGroup value={completionStatus} onValueChange={onCompletionStatusChange as any}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="status-all" />
                <Label htmlFor="status-all" className="text-sm cursor-pointer">All Tasks</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="completed" id="status-completed" />
                <Label htmlFor="status-completed" className="text-sm cursor-pointer">Completed</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pending" id="status-pending" />
                <Label htmlFor="status-pending" className="text-sm cursor-pointer">Pending</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Linked Content */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Linked Content</Label>
            <RadioGroup value={linkedContent} onValueChange={onLinkedContentChange as any}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="linked-all" />
                <Label htmlFor="linked-all" className="text-sm cursor-pointer">All</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="exam" id="linked-exam" />
                <Label htmlFor="linked-exam" className="text-sm cursor-pointer">Linked to Exam</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="practice" id="linked-practice" />
                <Label htmlFor="linked-practice" className="text-sm cursor-pointer">Linked to Practice</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="none" id="linked-none" />
                <Label htmlFor="linked-none" className="text-sm cursor-pointer">No Links</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
