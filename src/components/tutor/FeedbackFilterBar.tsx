import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface FilterOptions {
  search: string;
  subject: string;
  examId: string;
}

interface FeedbackFilterBarProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  exams: { id: string; title: string; subject?: string }[];
  subjects: string[];
}

export const FeedbackFilterBar = ({ 
  filters, 
  onFiltersChange, 
  exams,
  subjects 
}: FeedbackFilterBarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const hasActiveFilters = filters.subject !== "all" || filters.examId !== "all";
  
  const clearFilters = () => {
    onFiltersChange({ search: "", subject: "all", examId: "all" });
  };

  return (
    <div className="space-y-2">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by student, exam, or question..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-9 h-9"
          />
        </div>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant={hasActiveFilters ? "default" : "outline"} 
              size="sm" 
              className="h-9 gap-1.5"
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 h-4 w-4 rounded-full bg-background text-foreground text-xs flex items-center justify-center">
                  {(filters.subject !== "all" ? 1 : 0) + (filters.examId !== "all" ? 1 : 0)}
                </span>
              )}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* Filter Options */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-card">
            <Select 
              value={filters.subject} 
              onValueChange={(value) => onFiltersChange({ ...filters, subject: value })}
            >
              <SelectTrigger className="w-[140px] h-8 text-sm">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={filters.examId} 
              onValueChange={(value) => onFiltersChange({ ...filters, examId: value })}
            >
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue placeholder="Exam" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exams</SelectItem>
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>{exam.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1 text-muted-foreground">
                <X className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
