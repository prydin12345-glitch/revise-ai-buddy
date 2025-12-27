import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExamManagementCard } from "@/components/tutor/ExamManagementCard";
import { AssignModal } from "@/components/tutor/AssignModal";
import { useTutorExams } from "@/hooks/useTutorExams";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, 
  Loader2, 
  Search, 
  SlidersHorizontal,
  ArrowUpDown,
  FileText,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SortOption = "newest" | "oldest" | "deadline" | "completion";
type StatusFilter = "all" | "published" | "draft" | "closed";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "deadline", label: "By deadline" },
  { value: "completion", label: "By completion %" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "closed", label: "Closed" },
];

const ManageExams = () => {
  const navigate = useNavigate();
  const { exams, loading, refetch } = useTutorExams();
  const { subjects, getSubjectColor } = useUserSubjects();
  
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<{ id: string; title: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<{ id: string; title: string; status: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Filters and search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get unique subjects and groups from exams
  const uniqueSubjects = useMemo(() => {
    const subjectSet = new Set(exams.map(e => e.subject_id));
    return Array.from(subjectSet).filter(Boolean);
  }, [exams]);

  const uniqueGroups = useMemo(() => {
    const groupSet = new Set(exams.flatMap(e => e.assigned_groups));
    return Array.from(groupSet).filter(Boolean);
  }, [exams]);

  // Filter and sort exams
  const filteredExams = useMemo(() => {
    let result = [...exams];

    // Search filter
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase();
      result = result.filter(exam => 
        exam.title.toLowerCase().includes(search) ||
        exam.subject_id.toLowerCase().includes(search) ||
        exam.assigned_groups.some(g => g.toLowerCase().includes(search))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(exam => exam.status.toLowerCase() === statusFilter);
    }

    // Subject filter
    if (subjectFilter !== "all") {
      result = result.filter(exam => exam.subject_id === subjectFilter);
    }

    // Group filter
    if (groupFilter !== "all") {
      result = result.filter(exam => exam.assigned_groups.includes(groupFilter));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "deadline":
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        case "completion":
          return b.completion_percentage - a.completion_percentage;
        default:
          return 0;
      }
    });

    return result;
  }, [exams, debouncedSearch, statusFilter, subjectFilter, groupFilter, sortBy]);

  const handleAssignClick = (examId: string, examTitle: string) => {
    setSelectedExam({ id: examId, title: examTitle });
    setAssignModalOpen(true);
  };

  const handleDeleteClick = (examId: string, examTitle: string, examStatus: string) => {
    setExamToDelete({ id: examId, title: examTitle, status: examStatus });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!examToDelete) return;

    setIsDeleting(true);
    try {
      await supabase.from("exam_question_drafts").delete().eq("exam_id", examToDelete.id);
      await supabase.from("exam_questions").delete().eq("exam_id", examToDelete.id);
      await supabase.from("exam_assignments").delete().eq("exam_id", examToDelete.id);
      await supabase.from("exam_submissions").delete().eq("exam_id", examToDelete.id);
      await supabase.from("exam_topics").delete().eq("exam_id", examToDelete.id);
      await supabase.from("exam_format").delete().eq("exam_id", examToDelete.id);
      await supabase.from("exam_timer").delete().eq("exam_id", examToDelete.id);
      await supabase.from("student_answers").delete().eq("exam_id", examToDelete.id);
      
      const { error } = await supabase.from("exams").delete().eq("id", examToDelete.id);
      
      if (error) throw error;
      
      toast.success(`Exam "${examToDelete.title}" deleted successfully`);
      refetch();
    } catch (error) {
      console.error("Error deleting exam:", error);
      toast.error("Failed to delete exam");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setExamToDelete(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSubjectFilter("all");
    setGroupFilter("all");
    setSortBy("newest");
  };

  const hasActiveFilters = statusFilter !== "all" || subjectFilter !== "all" || groupFilter !== "all" || searchQuery;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading exams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Exams</h1>
          <p className="text-muted-foreground mt-1">
            Create, assign, and track student exams
          </p>
        </div>
        <Button 
          onClick={() => navigate("/tutor/exams/create")}
          className="gap-2 rounded-xl shadow-lg shadow-primary/20"
        >
          <Plus className="h-4 w-4" />
          Create Exam
        </Button>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col gap-4">
        {/* Search and primary controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search exams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl bg-background/50 border-border/50"
            />
          </div>
          
          <div className="flex gap-2">
            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-xl">
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="hidden sm:inline">Sort</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setSortBy(option.value as SortOption)}
                    className={sortBy === option.value ? "bg-accent" : ""}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Filters Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="gap-2 rounded-xl relative"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_FILTERS.map((filter) => (
                        <SelectItem key={filter.value} value={filter.value}>
                          {filter.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {uniqueSubjects.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Subject</label>
                    <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All subjects</SelectItem>
                        {uniqueSubjects.map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {uniqueGroups.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Assigned Group</label>
                    <Select value={groupFilter} onValueChange={setGroupFilter}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All groups</SelectItem>
                        {uniqueGroups.map((group) => (
                          <SelectItem key={group} value={group}>
                            {group}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full" 
                    onClick={clearFilters}
                  >
                    Clear all filters
                  </Button>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Active filters pills */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Active filters:</span>
            {statusFilter !== "all" && (
              <Badge variant="secondary" className="text-xs gap-1">
                Status: {statusFilter}
                <button 
                  onClick={() => setStatusFilter("all")}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            )}
            {subjectFilter !== "all" && (
              <Badge variant="secondary" className="text-xs gap-1">
                Subject: {subjectFilter}
                <button 
                  onClick={() => setSubjectFilter("all")}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            )}
            {groupFilter !== "all" && (
              <Badge variant="secondary" className="text-xs gap-1">
                Group: {groupFilter}
                <button 
                  onClick={() => setGroupFilter("all")}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Exam Cards Grid */}
      {exams.length === 0 ? (
        // Empty state - no exams at all
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="rounded-full bg-muted/30 p-6 mb-6">
            <FileText className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Create your first exam</h3>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Get started by creating an exam. You can upload past papers or create new questions from scratch.
          </p>
          <Button 
            onClick={() => navigate("/tutor/exams/create")}
            className="gap-2 rounded-xl"
          >
            <Plus className="h-4 w-4" />
            Create Exam
          </Button>
        </div>
      ) : filteredExams.length === 0 ? (
        // Empty state - no results matching filters
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="rounded-full bg-muted/30 p-5 mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No exams match your filters</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            Try adjusting your search or filter criteria
          </p>
          <Button variant="outline" onClick={clearFilters} className="rounded-xl">
            Clear all filters
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Results count */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {filteredExams.length} of {exams.length} exam{exams.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {filteredExams.map((exam) => (
              <ExamManagementCard
                key={exam.id}
                exam={exam}
                subjectColor={getSubjectColor(exam.subject_id)}
                onAssign={handleAssignClick}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {selectedExam && (
        <AssignModal
          open={assignModalOpen}
          onOpenChange={setAssignModalOpen}
          examId={selectedExam.id}
          examTitle={selectedExam.title}
          onAssigned={refetch}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{examToDelete?.title}"?
              {examToDelete?.status === "published" && (
                <span className="block mt-2 text-destructive font-medium">
                  Warning: This exam has been published. Deleting it will remove all student submissions.
                </span>
              )}
              <span className="block mt-2">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ManageExams;
