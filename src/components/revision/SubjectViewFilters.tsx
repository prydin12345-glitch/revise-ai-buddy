import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface SubjectViewFiltersProps {
  subjects: string[];
  selectedSubjects: string[];
  onSubjectToggle: (subject: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  showCompleted: boolean;
  onShowCompletedToggle: () => void;
}

export const SubjectViewFilters = ({
  subjects,
  selectedSubjects,
  onSubjectToggle,
  sortBy,
  onSortChange,
  searchQuery,
  onSearchChange,
  showCompleted,
  onShowCompletedToggle,
}: SubjectViewFiltersProps) => {
  return (
    <div className="space-y-3">
      {/* Modern Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search topics, exams..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter Dropdown */}
        <Select onValueChange={onSubjectToggle}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select subjects..." />
          </SelectTrigger>
          <SelectContent className="bg-background border-border z-[100]">
            {subjects.map((subject) => (
              <SelectItem key={subject} value={subject}>
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort Dropdown */}
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border-border z-[100]">
            <SelectItem value="date-desc">Date (Newest First)</SelectItem>
            <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
            <SelectItem value="duration-desc">Duration (Longest First)</SelectItem>
            <SelectItem value="duration-asc">Duration (Shortest First)</SelectItem>
            <SelectItem value="status-todo">Status (To-Do First)</SelectItem>
            <SelectItem value="status-done">Status (Done First)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Selected Subjects */}
      {selectedSubjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSubjects.map((subject) => (
            <Badge key={subject} variant="secondary" className="gap-1">
              {subject}
              <button
                onClick={() => onSubjectToggle(subject)}
                className="ml-1 hover:bg-foreground/20 rounded-full"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => selectedSubjects.forEach(onSubjectToggle)}
            className="h-6 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
};
