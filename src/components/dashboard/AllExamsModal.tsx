import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Filter, X, FileText } from "lucide-react";
import { ExamRowItem, ExamWithSubmission } from "./ExamRowItem";
import { EXAM_BOARD_OPTIONS } from "@/lib/board-scrubber";
import { Skeleton } from "@/components/ui/skeleton";

interface AllExamsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exams: ExamWithSubmission[];
  loading: boolean;
  getSubjectColor: (subject: string) => string;
}

type SortOption = 'recent' | 'oldest' | 'title' | 'subject';
type StatusFilter = 'all' | 'in_progress' | 'completed' | 'not_started';

const PAGE_SIZE = 10;

export const AllExamsModal = ({ 
  open, 
  onOpenChange, 
  exams, 
  loading,
  getSubjectColor 
}: AllExamsModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Get unique subjects from exams
  const uniqueSubjects = useMemo(() => {
    return [...new Set(exams.map(e => e.subject_id))].sort();
  }, [exams]);

  // Filter and sort exams
  const filteredExams = useMemo(() => {
    let result = [...exams];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(exam => 
        exam.title.toLowerCase().includes(query) ||
        exam.subject_id.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(exam => {
        const status = exam.submission?.status;
        if (statusFilter === 'in_progress') return status === 'in_progress';
        if (statusFilter === 'completed') return status === 'completed' || status === 'submitted' || status === 'graded';
        if (statusFilter === 'not_started') return !status;
        return true;
      });
    }

    // Subject filter
    if (selectedSubjects.length > 0) {
      result = result.filter(exam => selectedSubjects.includes(exam.subject_id));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'subject':
          return a.subject_id.localeCompare(b.subject_id);
        default:
          return 0;
      }
    });

    return result;
  }, [exams, searchQuery, sortBy, statusFilter, selectedSubjects]);

  // Paginated results
  const paginatedExams = useMemo(() => {
    return filteredExams.slice(0, page * PAGE_SIZE);
  }, [filteredExams, page]);

  const hasMoreResults = paginatedExams.length < filteredExams.length;

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subject) 
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter('all');
    setSelectedSubjects([]);
    setPage(1);
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || selectedSubjects.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="text-xl font-bold">All Exams</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Search, filter, and resume your latest work
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-6 py-4 space-y-3 border-b border-border bg-muted/30">
          <div className="flex gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or subject..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-10"
              />
            </div>

            {/* Filter button */}
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-10 w-10 relative"
                >
                  <Filter className="w-4 h-4" />
                  {(selectedSubjects.length > 0 || statusFilter !== 'all') && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4" align="end">
                <div className="space-y-4">
                  {/* Status filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select 
                      value={statusFilter} 
                      onValueChange={(v) => {
                        setStatusFilter(v as StatusFilter);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="not_started">Not Started</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Subject filter */}
                  {uniqueSubjects.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Subjects</label>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {uniqueSubjects.map(subject => (
                          <div key={subject} className="flex items-center gap-2">
                            <Checkbox
                              id={subject}
                              checked={selectedSubjects.includes(subject)}
                              onCheckedChange={() => toggleSubject(subject)}
                            />
                            <label 
                              htmlFor={subject} 
                              className="text-sm cursor-pointer flex items-center gap-2"
                            >
                              <span 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: getSubjectColor(subject) }}
                              />
                              {subject}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Sort dropdown */}
            <Select 
              value={sortBy} 
              onValueChange={(v) => {
                setSortBy(v as SortOption);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="title">Title A–Z</SelectItem>
                <SelectItem value="subject">Subject</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active filters display */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="text-xs gap-1">
                  "{searchQuery}"
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-destructive" 
                    onClick={() => {
                      setSearchQuery("");
                      setPage(1);
                    }}
                  />
                </Badge>
              )}
              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs gap-1 capitalize">
                  {statusFilter.replace('_', ' ')}
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-destructive" 
                    onClick={() => {
                      setStatusFilter('all');
                      setPage(1);
                    }}
                  />
                </Badge>
              )}
              {selectedSubjects.map(subject => (
                <Badge key={subject} variant="secondary" className="text-xs gap-1">
                  {subject}
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-destructive" 
                    onClick={() => toggleSubject(subject)}
                  />
                </Badge>
              ))}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={clearFilters}
              >
                Clear all
              </Button>
            </div>
          )}
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-4 space-y-3">
            {loading ? (
              // Loading skeletons
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 rounded-xl border border-border">
                  <Skeleton className="h-5 w-3/4 mb-3" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              ))
            ) : paginatedExams.length === 0 ? (
              // Empty state
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground text-sm">
                  {hasActiveFilters 
                    ? "No exams match your filters"
                    : "No exams yet — create one or start a practice set."
                  }
                </p>
                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-2"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              // Exam list
              <>
                {paginatedExams.map(exam => (
                  <ExamRowItem 
                    key={exam.id} 
                    exam={exam}
                    subjectColor={getSubjectColor(exam.subject_id)}
                    showLastAccessed
                  />
                ))}

                {/* Load more button */}
                {hasMoreResults && (
                  <div className="pt-4 text-center">
                    <Button 
                      variant="outline" 
                      onClick={() => setPage(p => p + 1)}
                      className="w-full"
                    >
                      Show more results ({filteredExams.length - paginatedExams.length} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer with count */}
        <div className="px-6 py-3 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          Showing {paginatedExams.length} of {filteredExams.length} exams
        </div>
      </DialogContent>
    </Dialog>
  );
};
