import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, Loader2, CheckCircle, CheckCheck, Star, Archive, Filter, Plus, Eye, RotateCcw, Search, ArrowUpDown, X, Settings, LayoutList } from "lucide-react";
import { StudentPDFDownloadModal } from "@/components/student/StudentPDFDownloadModal";
import { useStudentPDF } from "@/hooks/useStudentPDF";
import { ExamCard } from "@/components/exam/ExamCard";
import { MyWorkTabBar } from "@/components/shared/MyWorkTabBar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useUserSubjects } from "@/hooks/useUserSubjects";

interface Exam {
  id: string;
  title: string;
  subject_id: string;
  created_at: string;
  status: string;
  type: string;
  display_order?: number;
  exam_topics: Array<{ topic_name: string }>;
}

interface ExamProgress {
  questionsCompleted: number;
  totalQuestions: number;
  percentComplete: number;
  timeRemaining: string;
  lastAccessed: string;
  examState: 'not-started' | 'in-progress' | 'completed';
}

type TabType = 'published' | 'completed' | 'favourite' | 'all' | 'archive';
type SortType = 'last-accessed' | 'created' | 'title' | 'progress';

const TABS: { value: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'published', label: 'Published', icon: CheckCircle },
  { value: 'completed', label: 'Completed', icon: CheckCheck },
  { value: 'favourite', label: 'Favourite', icon: Star },
  { value: 'all', label: 'All', icon: LayoutList },
  { value: 'archive', label: 'Archive', icon: Archive },
];

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: 'last-accessed', label: 'Last accessed' },
  { value: 'created', label: 'Created date' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'progress', label: 'Progress (high → low)' },
];

const MyExams = () => {
  const navigate = useNavigate();
  const { subjects, getSubjectColor } = useUserSubjects();
  const { generateStudentPDF } = useStudentPDF();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [beginExamDialogOpen, setBeginExamDialogOpen] = useState(false);
  const [retakeExamDialogOpen, setRetakeExamDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [editForm, setEditForm] = useState({ title: "", subject_id: "", created_at: "" });
  
  // PDF Download Modal State
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfExam, setPdfExam] = useState<Exam | null>(null);
  
  // Tab, sort, search state
  const [activeTab, setActiveTab] = useState<TabType>('published');
  const [sortBy, setSortBy] = useState<SortType>('last-accessed');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [completedExamIds, setCompletedExamIds] = useState<string[]>([]);
  const [favouriteExamIds, setFavouriteExamIds] = useState<string[]>([]);
  const [examStates, setExamStates] = useState<Map<string, 'not-started' | 'in-progress' | 'completed'>>(new Map());
  const [examProgress, setExamProgress] = useState<Map<string, ExamProgress>>(new Map());
  const [filters, setFilters] = useState({
    subjects: [] as string[],
    status: [] as string[],
    dateRange: { start: '', end: '' },
    dateType: 'published' as 'published' | 'accessed',
  });
  const [newExamDialogOpen, setNewExamDialogOpen] = useState(false);

  // Safety cleanup: sometimes a modal (e.g. Quit dialog) can leave the page in a
  // non-interactive state by setting pointer-events: none on a top-level element.
  // Ensure My Exams is always clickable when it mounts.
  const restoreGlobalPointerEvents = useCallback(() => {
    if (typeof document === 'undefined') return;

    const candidates: Array<HTMLElement | null> = [
      document.body,
      document.documentElement,
      document.getElementById('root'),
    ];

    for (const el of candidates) {
      if (!el) continue;
      if (el.style.pointerEvents === 'none') {
        el.style.pointerEvents = '';
      }
    }

    // Also clear any stale inline pointer-events left on other containers.
    // (We avoid touching class-based pointer-events like `disabled:pointer-events-none`.)
    const inlineStyled = document.querySelectorAll<HTMLElement>('[style*="pointer-events"]');
    inlineStyled.forEach((el) => {
      if (el.style.pointerEvents === 'none') el.style.pointerEvents = '';
    });
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    restoreGlobalPointerEvents();
    loadExams();

    const channel = supabase
      .channel('exams-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, () => loadExams())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadExams = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('exams')
        .select('*, exam_topics(topic_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExams(data || []);

      // Batch fetch exam states and progress for all exams
      if (data && data.length > 0) {
        const examIds = data.map(exam => exam.id);

        // Fetch all submissions at once with last_accessed_at
        const { data: allSubmissions } = await supabase
          .from('exam_submissions')
          .select('exam_id, status, time_remaining_seconds, last_accessed_at, exam_started_at')
          .eq('student_id', user.id)
          .in('exam_id', examIds);

        // Separate completed vs in-progress
        const submittedExamIds = new Set(
          allSubmissions?.filter(s => s.status === 'submitted' || s.status === 'completed' || s.status === 'graded').map(s => s.exam_id) || []
        );
        const inProgressExamIds = new Set(
          allSubmissions?.filter(s => s.status === 'in_progress').map(s => s.exam_id) || []
        );

        setCompletedExamIds(Array.from(submittedExamIds));

        // Fetch all student answers at once with counts
        const { data: allAnswers } = await supabase
          .from('student_answers')
          .select('exam_id')
          .eq('student_id', user.id)
          .in('exam_id', examIds);

        const examIdsWithAnswers = new Set(allAnswers?.map(a => a.exam_id) || []);

        // Fetch questions count for all exams
        const { data: questionsData } = await supabase
          .from('exam_questions')
          .select('exam_id')
          .in('exam_id', examIds);

        // Fetch timer settings for all exams
        const { data: timerData } = await supabase
          .from('exam_timer')
          .select('exam_id, enabled, duration_minutes')
          .in('exam_id', examIds);

        // Create lookup maps
        const submissionsMap = new Map(allSubmissions?.map(s => [s.exam_id, s]) || []);
        const answersCountMap = new Map<string, number>();
        allAnswers?.forEach(a => {
          answersCountMap.set(a.exam_id, (answersCountMap.get(a.exam_id) || 0) + 1);
        });
        const questionsCountMap = new Map<string, number>();
        questionsData?.forEach(q => {
          questionsCountMap.set(q.exam_id, (questionsCountMap.get(q.exam_id) || 0) + 1);
        });
        const timerMap = new Map(timerData?.map(t => [t.exam_id, t]) || []);

        // Determine states and calculate progress
        const statesMap = new Map();
        const progressMap = new Map<string, ExamProgress>();

        data.forEach(exam => {
          let state: 'not-started' | 'in-progress' | 'completed';
          
          if (exam.status !== 'published') {
            state = 'not-started';
          } else if (submittedExamIds.has(exam.id)) {
            state = 'completed';
          } else if (inProgressExamIds.has(exam.id) || examIdsWithAnswers.has(exam.id)) {
            state = 'in-progress';
          } else {
            state = 'not-started';
          }

          statesMap.set(exam.id, state);

          // Calculate progress
          const totalQuestions = questionsCountMap.get(exam.id) || 0;
          const questionsCompleted = state === 'completed' ? totalQuestions : (answersCountMap.get(exam.id) || 0);
          const percentComplete = totalQuestions > 0 ? (questionsCompleted / totalQuestions) * 100 : 0;

          // Calculate time remaining
          let timeRemaining = "No timer";
          const timer = timerMap.get(exam.id);
          const submission = submissionsMap.get(exam.id);
          
          if (state === 'completed') {
            timeRemaining = "Completed";
          } else if (timer?.enabled) {
            if (submission?.time_remaining_seconds !== undefined && submission.time_remaining_seconds !== null) {
              const hours = Math.floor(submission.time_remaining_seconds / 3600);
              const minutes = Math.floor((submission.time_remaining_seconds % 3600) / 60);
              if (hours > 0) {
                timeRemaining = `${hours}hr ${minutes}min`;
              } else {
                timeRemaining = `${minutes}min`;
              }
            } else if (timer.duration_minutes) {
              const hours = Math.floor(timer.duration_minutes / 60);
              const minutes = timer.duration_minutes % 60;
              if (hours > 0) {
                timeRemaining = `${hours}hr ${minutes}min`;
              } else {
                timeRemaining = `${minutes}min`;
              }
            }
          }

          // Format last accessed
          let lastAccessed = "Never";
          if (submission?.last_accessed_at) {
            lastAccessed = new Date(submission.last_accessed_at).toLocaleDateString('en-GB');
          } else if (submission?.exam_started_at) {
            lastAccessed = new Date(submission.exam_started_at).toLocaleDateString('en-GB');
          }

          progressMap.set(exam.id, {
            questionsCompleted,
            totalQuestions,
            percentComplete,
            timeRemaining,
            lastAccessed,
            examState: state,
          });
        });

        setExamStates(statesMap);
        setExamProgress(progressMap);
      }

      // Fetch favourite exams
      const { data: favourites, error: favouritesError } = await supabase
        .from('favourite_exams')
        .select('exam_id')
        .eq('user_id', user.id);

      if (!favouritesError) {
        setFavouriteExamIds(favourites?.map(f => f.exam_id) || []);
      }
    } catch (error: any) {
      toast({ title: "Load Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleBeginExam = (exam: Exam) => {
    setSelectedExam(exam);
    setBeginExamDialogOpen(true);
  };

  const handleDownloadPDF = async (exam: Exam) => {
    setPdfExam(exam);
    setPdfModalOpen(true);
  };

  const handlePDFDownload = async () => {
    if (!pdfExam) return;
    await generateStudentPDF({
      contentType: 'exam',
      contentId: pdfExam.id,
    });
  };

  const handleRetakeExam = (exam: Exam) => {
    setSelectedExam(exam);
    setRetakeExamDialogOpen(true);
  };

  const handleConfirmRetake = async () => {
    if (!selectedExam) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('exam_submissions')
        .delete()
        .eq('exam_id', selectedExam.id)
        .eq('student_id', user.id);
      
      await supabase
        .from('student_answers')
        .delete()
        .eq('exam_id', selectedExam.id)
        .eq('student_id', user.id);

      setRetakeExamDialogOpen(false);
      await loadExams();
      navigate(`/exam/${selectedExam.id}/live?mode=student`);
      toast({ title: "Success", description: "Starting fresh exam session" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleConfirmBeginExam = async () => {
    if (!selectedExam) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: submission } = await supabase
        .from('exam_submissions')
        .select('id')
        .eq('exam_id', selectedExam.id)
        .eq('student_id', user.id)
        .maybeSingle();

      setBeginExamDialogOpen(false);

      if (submission) {
        navigate(`/exam/${selectedExam.id}/review`);
      } else {
        navigate(`/exam/${selectedExam.id}/live?mode=student`);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (exam: Exam) => {
    setSelectedExam(exam);
    setEditForm({
      title: exam.title,
      subject_id: exam.subject_id,
      created_at: new Date(exam.created_at).toISOString().split('T')[0],
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedExam) return;

    try {
      const { error } = await supabase
        .from('exams')
        .update({
          title: editForm.title,
          subject_id: editForm.subject_id,
          created_at: editForm.created_at || selectedExam.created_at,
        })
        .eq('id', selectedExam.id);

      if (error) throw error;

      toast({ title: "Success", description: "Exam updated successfully" });
      setEditDialogOpen(false);
      loadExams();
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = (exam: Exam) => {
    setSelectedExam(exam);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedExam) return;

    try {
      const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', selectedExam.id);

      if (error) throw error;

      toast({ title: "Success", description: "Exam deleted successfully" });
      setDeleteDialogOpen(false);
      setExams(exams.filter(e => e.id !== selectedExam.id));
    } catch (error: any) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleFavourite = async (examId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const isFav = favouriteExamIds.includes(examId);

      if (isFav) {
        await supabase
          .from('favourite_exams')
          .delete()
          .eq('user_id', user.id)
          .eq('exam_id', examId);
        setFavouriteExamIds(favouriteExamIds.filter(id => id !== examId));
      } else {
        await supabase
          .from('favourite_exams')
          .insert({ user_id: user.id, exam_id: examId });
        setFavouriteExamIds([...favouriteExamIds, examId]);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getFilteredExamsByTab = useCallback(() => {
    switch (activeTab) {
      case 'published':
        return exams.filter(e => e.status === 'published');
      case 'completed':
        return exams.filter(e => completedExamIds.includes(e.id));
      case 'favourite':
        return exams.filter(e => favouriteExamIds.includes(e.id));
      case 'archive':
        return exams.filter(e => e.status === 'archived');
      case 'all':
      default:
        return exams;
    }
  }, [activeTab, exams, completedExamIds, favouriteExamIds]);

  const applyFilters = useCallback((examsToFilter: Exam[]) => {
    let filtered = examsToFilter;

    // Apply search
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.subject_id.toLowerCase().includes(query) ||
        e.exam_topics.some(t => t.topic_name.toLowerCase().includes(query))
      );
    }

    if (filters.subjects.length > 0) {
      filtered = filtered.filter(e => 
        filters.subjects.some(s => 
          e.subject_id.toLowerCase() === s.toLowerCase()
        )
      );
    }

    if (filters.status.length > 0) {
      filtered = filtered.filter(e => {
        if (filters.status.includes('active') && e.status === 'published') return true;
        if (filters.status.includes('in-progress') && completedExamIds.includes(e.id)) return true;
        if (filters.status.includes('finished') && completedExamIds.includes(e.id)) return true;
        return false;
      });
    }

    if (filters.dateRange.start || filters.dateRange.end) {
      filtered = filtered.filter(e => {
        const examDate = new Date(e.created_at);
        const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null;
        const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null;

        if (startDate && examDate < startDate) return false;
        if (endDate && examDate > endDate) return false;
        return true;
      });
    }

    return filtered;
  }, [debouncedSearch, filters, completedExamIds]);

  const sortedExams = useMemo(() => {
    const filtered = applyFilters(getFilteredExamsByTab());
    
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'last-accessed': {
          const aProgress = examProgress.get(a.id);
          const bProgress = examProgress.get(b.id);
          const aDate = aProgress?.lastAccessed === 'Never' ? new Date(0) : new Date(aProgress?.lastAccessed || 0);
          const bDate = bProgress?.lastAccessed === 'Never' ? new Date(0) : new Date(bProgress?.lastAccessed || 0);
          return bDate.getTime() - aDate.getTime();
        }
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'progress': {
          const aPercent = examProgress.get(a.id)?.percentComplete || 0;
          const bPercent = examProgress.get(b.id)?.percentComplete || 0;
          return bPercent - aPercent;
        }
        default:
          return 0;
      }
    });
  }, [applyFilters, getFilteredExamsByTab, sortBy, examProgress]);

  const getSortLabel = () => {
    return SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Unified Tab Bar */}
        <MyWorkTabBar />

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">My Exams</h1>
          
          {/* Create Button - compact pill */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2" aria-label="Create new exam or practice set">
                <Plus className="w-4 h-4" />
                Create
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate("/upload")} className="gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                Create Mock Exam
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/practice-questions/new")} className="gap-2 cursor-pointer">
                <Settings className="w-4 h-4" />
                Create Practice Questions
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Controls Bar - Order: Search → Tabs → Sort/Filter */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search Bar (First) */}
            <div className="relative flex-1 max-w-md order-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search exams…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
                aria-label="Search exams"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Segmented Control Tabs (Second) */}
            <div className="flex-shrink-0 overflow-x-auto scrollbar-hide order-2">
              <div className="inline-flex p-1 bg-muted rounded-lg gap-1">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setActiveTab(tab.value)}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                        activeTab === tab.value
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                      }`}
                      aria-label={`Filter by ${tab.label}`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sort + Filter Controls (Third) */}
            <div className="flex items-center gap-2 order-3">
              {/* Sort Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 h-10 shrink-0" aria-label="Sort exams">
                    <ArrowUpDown className="w-4 h-4" />
                    <span className="hidden sm:inline">Sort: {getSortLabel()}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {SORT_OPTIONS.map((option) => (
                    <DropdownMenuItem 
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={`cursor-pointer ${sortBy === option.value ? 'bg-accent' : ''}`}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Filter Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterPanelOpen(true)}
                className="gap-2 h-10 shrink-0"
                aria-label="Open filter panel"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filter</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : sortedExams.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-2xl font-semibold mb-2">No exams yet</h3>
            <p className="text-muted-foreground mb-6">Upload your first exam to get started</p>
            <Button onClick={() => navigate("/upload")}>
              <Upload className="mr-2" />
              Upload Exam
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {sortedExams.map((exam) => {
              const progress = examProgress.get(exam.id) || {
                questionsCompleted: 0,
                totalQuestions: 0,
                percentComplete: 0,
                timeRemaining: "No timer",
                lastAccessed: "Never",
                examState: 'not-started' as const,
              };
              
              return (
                <ExamCard 
                  key={exam.id} 
                  exam={exam}
                  progress={progress}
                  subjectColor={getSubjectColor(exam.subject_id)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleFavourite={handleToggleFavourite}
                  onDownloadPDF={handleDownloadPDF}
                  isFavourite={favouriteExamIds.includes(exam.id)}
                  isArchived={activeTab === 'archive'}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Exam</DialogTitle>
            <DialogDescription>Update the exam details below</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Exam Title</Label>
              <Input 
                id="title" 
                value={editForm.title} 
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="Enter exam title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Select value={editForm.subject_id} onValueChange={(value) => setEditForm({ ...editForm, subject_id: value })}>
                <SelectTrigger id="subject">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.subject_name}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: subject.subject_color }}
                        />
                        {subject.subject_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date (Optional)</Label>
              <Input 
                id="date" 
                type="date" 
                value={editForm.created_at} 
                onChange={(e) => setEditForm({ ...editForm, created_at: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{selectedExam?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Begin Exam Dialog */}
      <AlertDialog open={beginExamDialogOpen} onOpenChange={setBeginExamDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Begin Live Exam</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to start the live exam. Timer will begin and answers will be saved automatically. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBeginExam} className="bg-blue-600 hover:bg-blue-700">
              Start Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retake Exam Dialog */}
      <AlertDialog open={retakeExamDialogOpen} onOpenChange={setRetakeExamDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retake this exam?</AlertDialogTitle>
            <AlertDialogDescription>
              Retaking this exam will generate a fresh version with the same questions.
              Your previous score and stats will remain saved and visible in your dashboard and stats page.
              Are you sure you want to retake this exam?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRetake} className="bg-blue-600 hover:bg-blue-700">
              Retake Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Filter Panel */}
      <Sheet open={filterPanelOpen} onOpenChange={setFilterPanelOpen}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filter Exams</SheetTitle>
            <SheetDescription>
              Apply filters to find specific exams
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-6">
            {/* Subject Filter */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Subject</Label>
              <Select 
                value={filters.subjects[0] || 'all'} 
                onValueChange={(value) => {
                  if (value === 'all') {
                    setFilters({ ...filters, subjects: [] });
                  } else {
                    setFilters({ ...filters, subjects: [value] });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.subject_name}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: subject.subject_color }}
                        />
                        {subject.subject_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Status</Label>
              <div className="space-y-2">
                {['active', 'in-progress', 'finished'].map((status) => (
                  <div key={status} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status}`}
                      checked={filters.status.includes(status)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilters({ ...filters, status: [...filters.status, status] });
                        } else {
                          setFilters({ ...filters, status: filters.status.filter(s => s !== status) });
                        }
                      }}
                    />
                    <label
                      htmlFor={`status-${status}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize cursor-pointer"
                    >
                      {status.replace('-', ' ')}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Date Filter */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Time & Date</Label>
              
              <Select 
                value={filters.dateType} 
                onValueChange={(value: 'published' | 'accessed') => 
                  setFilters({ ...filters, dateType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Published Date</SelectItem>
                  <SelectItem value="accessed">Last Accessed</SelectItem>
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="date-start" className="text-xs">From</Label>
                  <Input
                    id="date-start"
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => setFilters({ 
                      ...filters, 
                      dateRange: { ...filters.dateRange, start: e.target.value } 
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-end" className="text-xs">To</Label>
                  <Input
                    id="date-end"
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => setFilters({ 
                      ...filters, 
                      dateRange: { ...filters.dateRange, end: e.target.value } 
                    })}
                  />
                </div>
              </div>
            </div>

            {/* Active Filters Display */}
            {(filters.subjects.length > 0 || filters.status.length > 0 || filters.dateRange.start || filters.dateRange.end) && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Active Filters</Label>
                <div className="flex flex-wrap gap-2">
                  {filters.subjects.map((subject) => (
                    <Badge key={subject} variant="secondary" className="gap-1">
                      {subject}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => setFilters({ 
                          ...filters, 
                          subjects: filters.subjects.filter(s => s !== subject) 
                        })}
                      />
                    </Badge>
                  ))}
                  {filters.status.map((status) => (
                    <Badge key={status} variant="secondary" className="gap-1 capitalize">
                      {status.replace('-', ' ')}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => setFilters({ 
                          ...filters, 
                          status: filters.status.filter(s => s !== status) 
                        })}
                      />
                    </Badge>
                  ))}
                  {(filters.dateRange.start || filters.dateRange.end) && (
                    <Badge variant="secondary" className="gap-1">
                      {filters.dateRange.start || '...'} - {filters.dateRange.end || '...'}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => setFilters({ 
                          ...filters, 
                          dateRange: { start: '', end: '' } 
                        })}
                      />
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setFilters({
                  subjects: [],
                  status: [],
                  dateRange: { start: '', end: '' },
                  dateType: 'published',
                });
              }}
              className="flex-1"
            >
              Clear Filters
            </Button>
            <Button 
              onClick={() => setFilterPanelOpen(false)}
              className="flex-1"
            >
              Apply
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* PDF Download Modal */}
      <StudentPDFDownloadModal
        open={pdfModalOpen}
        onOpenChange={setPdfModalOpen}
        contentType="exam"
        contentId={pdfExam?.id || ''}
        contentTitle={pdfExam?.title || ''}
        onDownload={handlePDFDownload}
      />
    </DashboardLayout>
  );
};

export default MyExams;