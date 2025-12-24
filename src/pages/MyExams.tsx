import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, Settings, Calendar, Loader2, Edit2, Trash2, GripVertical, CheckCircle, CheckCheck, Star, Grid3x3, Archive, LayoutGrid, List, Filter, X, Plus, Eye, Play, Beaker, Calculator, BookOpen, Globe, FileText, RotateCcw, Download } from "lucide-react";
import { StudentPDFDownloadModal } from "@/components/student/StudentPDFDownloadModal";
import { useStudentPDF } from "@/hooks/useStudentPDF";
import { ExamCard } from "@/components/exam/ExamCard";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

interface SortableExamCardProps {
  exam: Exam;
  onEdit: (exam: Exam) => void;
  onDelete: (exam: Exam) => void;
  onView: (exam: Exam) => void;
  onBeginExam: (exam: Exam) => void;
  subjectColor: string;
  onToggleFavourite: (examId: string) => void;
  isFavourite: boolean;
  examState: 'not-started' | 'in-progress' | 'completed';
  getExamButtonConfig: (exam: Exam) => any;
  onDownloadPDF: (exam: Exam) => void;
}

const SortableExamCard = ({ exam, onEdit, onDelete, onView, onBeginExam, subjectColor, onToggleFavourite, isFavourite, examState, getExamButtonConfig, onDownloadPDF }: SortableExamCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exam.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="hover:shadow-xl transition-all group">
        <CardContent className="p-5">
          {/* Top Section: Subject + Date */}
          <div className="flex items-center justify-between mb-3">
            <Badge 
              style={{ 
                backgroundColor: `${subjectColor}20`, 
                color: subjectColor,
                borderColor: subjectColor 
              }} 
              variant="outline" 
              className="text-xs font-medium"
            >
              {exam.subject_id}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(exam.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Middle Section: Title + Actions */}
          <div className="flex items-start gap-3 mb-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity mt-1 hover:text-primary hover:bg-primary/10 p-1 rounded">
                    <GripVertical className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Drag to reorder</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <div className="flex-1 cursor-pointer" onClick={() => onView(exam)}>
              <h3 className="font-bold text-lg line-clamp-2 mb-1">{exam.title}</h3>
              {exam.exam_topics.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {exam.exam_topics[0].topic_name}
                </p>
              )}
            </div>

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onDownloadPDF(exam); }} className="h-7 w-7" title="Download PDF">
                <Download className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onToggleFavourite(exam.id); }} className="h-7 w-7">
                <Star className={`w-3.5 h-3.5 ${isFavourite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              </Button>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit(exam); }} className="h-7 w-7">
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onDelete(exam); }} className="h-7 w-7 hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Bottom Section: Action Buttons */}
          <div className="flex gap-2 pt-3 border-t">
            {examState === 'in-progress' && (
              <Badge variant="outline" className="border-orange-500/50 text-orange-600 bg-orange-50 dark:bg-orange-950/20 text-xs mr-auto">
                In Progress
              </Badge>
            )}
            {(() => {
              const buttonConfig = getExamButtonConfig(exam);
              if (!buttonConfig) {
                return <span className="text-xs px-2 py-1 bg-accent rounded capitalize">{exam.status}</span>;
              }
              const Icon = buttonConfig.icon;
              return (
                <>
                  <Button 
                    className={buttonConfig.className}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      buttonConfig.action(); 
                    }}
                    size="sm"
                  >
                    {Icon && <Icon className="w-4 h-4 mr-2" />}
                    {buttonConfig.label}
                  </Button>
                  {buttonConfig.secondaryButton && (
                    <Button 
                      variant="outline"
                      style={{ borderColor: subjectColor, color: subjectColor }}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        buttonConfig.secondaryButton.action(); 
                      }}
                      size="sm"
                    >
                      {buttonConfig.secondaryButton.icon && <buttonConfig.secondaryButton.icon className="w-4 h-4 mr-2" />}
                      {buttonConfig.secondaryButton.label}
                    </Button>
                  )}
                </>
              );
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const SortableExamListItem = ({ exam, onEdit, onDelete, onView, onBeginExam, subjectColor, onToggleFavourite, isFavourite, examState, getExamButtonConfig, onDownloadPDF }: SortableExamCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exam.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="hover:shadow-md transition-all group">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing hover:text-primary hover:bg-primary/10 p-1 rounded transition-colors">
                    <GripVertical className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Drag to reorder</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onView(exam)}>
              <h3 className="font-semibold text-base truncate">{exam.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  style={{ 
                    backgroundColor: `${subjectColor}20`, 
                    color: subjectColor,
                    borderColor: subjectColor 
                  }} 
                  variant="outline" 
                  className="text-xs"
                >
                  {exam.subject_id}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(exam.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {examState === 'in-progress' && (
                <Badge variant="outline" className="border-orange-500/50 text-orange-600 bg-orange-50 dark:bg-orange-950/20 text-xs">
                  In Progress
                </Badge>
              )}
              {(() => {
                const buttonConfig = getExamButtonConfig(exam);
                if (!buttonConfig) {
                  return <span className="text-xs px-2 py-1 bg-accent rounded capitalize">{exam.status}</span>;
                }
                const Icon = buttonConfig.icon;
                return (
                  <>
                    <Button 
                      size="sm" 
                      className={buttonConfig.className}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        buttonConfig.action(); 
                      }}
                    >
                      {Icon && <Icon className="w-4 h-4 mr-2" />}
                      {buttonConfig.label}
                    </Button>
                    {buttonConfig.secondaryButton && (
                      <Button 
                        variant="outline"
                        style={{ borderColor: subjectColor, color: subjectColor }}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          buttonConfig.secondaryButton.action(); 
                        }}
                        size="sm"
                      >
                        {buttonConfig.secondaryButton.icon && <buttonConfig.secondaryButton.icon className="w-4 h-4 mr-2" />}
                        {buttonConfig.secondaryButton.label}
                      </Button>
                    )}
                  </>
                );
              })()}
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={(e) => { e.stopPropagation(); onDownloadPDF(exam); }}
                className="h-8 w-8"
                title="Download PDF"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={(e) => { e.stopPropagation(); onToggleFavourite(exam.id); }}
                className="h-8 w-8"
              >
                <Star className={`w-4 h-4 ${isFavourite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              </Button>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit(exam); }} className="h-8 w-8">
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onDelete(exam); }} className="h-8 w-8 hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const MyExams = () => {
  const navigate = useNavigate();
  const { subjects, getSubjectColor } = useUserSubjects();
  const { generateStudentPDF, isGenerating: isPDFGenerating } = useStudentPDF();
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
  const [hasAnswersForPdfExam, setHasAnswersForPdfExam] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'published' | 'completed' | 'favourite' | 'all' | 'archive'>('published');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
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
        .order('display_order', { ascending: true, nullsFirst: false })
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

  const handleView = (exam: Exam) => {
    // Container click routes to preview page
    navigate(`/exam/${exam.id}/preview`);
  };

  const handleBeginExam = (exam: Exam) => {
    setSelectedExam(exam);
    setBeginExamDialogOpen(true);
  };

  const getExamButtonConfig = (exam: Exam) => {
    const state = examStates.get(exam.id);
    
    if (exam.status !== 'published') {
      return null;
    }
    
    switch (state) {
      case 'completed':
        return {
          label: 'Review',
          action: () => navigate(`/exam/${exam.id}/review`),
          className: 'bg-green-600 hover:bg-green-700',
          icon: Eye,
          secondaryButton: {
            label: 'Retake',
            action: () => handleRetakeExam(exam),
            icon: RotateCcw,
          }
        };
      case 'in-progress':
        return {
          label: 'Continue',
          action: () => navigate(`/exam/${exam.id}/in-progress?mode=student`),
          className: 'bg-orange-600 hover:bg-orange-700',
          icon: null
        };
      case 'not-started':
      default:
        return {
          label: 'Begin Exam',
          action: () => handleBeginExam(exam),
          className: 'bg-blue-600 hover:bg-blue-700',
          icon: null
        };
    }
  };

  const handleDownloadPDF = async (exam: Exam) => {
    // Check if student has answers for this exam
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { count } = await supabase
      .from('student_answers')
      .select('*', { count: 'exact', head: true })
      .eq('exam_id', exam.id)
      .eq('student_id', user.id);
    
    setHasAnswersForPdfExam((count || 0) > 0);
    setPdfExam(exam);
    setPdfModalOpen(true);
  };

  const handlePDFDownload = async (includeAnswers: boolean) => {
    if (!pdfExam) return;
    await generateStudentPDF({
      contentType: 'exam',
      contentId: pdfExam.id,
      includeAnswers,
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

      // Delete existing submission and answers to allow retake
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
      
      // Reload exams to update state
      await loadExams();
      
      // Navigate to fresh exam
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

      // Check if student has already submitted this exam
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = filteredExams.findIndex((exam) => exam.id === active.id);
    const newIndex = filteredExams.findIndex((exam) => exam.id === over.id);

    const reorderedExams = arrayMove(filteredExams, oldIndex, newIndex);
    
    // Update local state immediately for smooth UX
    const updatedExams = exams.map(exam => {
      const reorderedIndex = reorderedExams.findIndex(e => e.id === exam.id);
      if (reorderedIndex !== -1) {
        return { ...exam, display_order: reorderedIndex };
      }
      return exam;
    });
    setExams(updatedExams);

    // Persist to database
    try {
      const updates = reorderedExams.map((exam, index) => 
        supabase.from('exams').update({ display_order: index }).eq('id', exam.id)
      );
      await Promise.all(updates);
      toast({ title: "Success", description: "Exam order updated" });
    } catch (error: any) {
      toast({ title: "Reorder Failed", description: error.message, variant: "destructive" });
      loadExams(); // Reload to restore correct order
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

  const getFilteredExamsByTab = () => {
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
  };

  const applyFilters = (examsToFilter: Exam[]) => {
    let filtered = examsToFilter;

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
  };

  const filteredExams = applyFilters(getFilteredExamsByTab());

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">My Exams</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="icon"
                    className="bg-blue-500 hover:bg-blue-600 h-12 w-12 rounded-full shadow-lg"
                    onClick={() => setNewExamDialogOpen(true)}
                  >
                    <Plus className="w-6 h-6 text-white" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Create New Exam</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 overflow-x-auto scrollbar-hide">
            <TabsList className="inline-flex h-12 items-center justify-start rounded-none border-0 bg-transparent p-0 overflow-x-auto scrollbar-hide">
              <TabsTrigger 
                value="published" 
                className="rounded-none border-b-2 border-transparent px-6 py-3 text-sm font-medium transition-all data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-blue-600"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Published
              </TabsTrigger>
              <TabsTrigger 
                value="completed" 
                className="rounded-none border-b-2 border-transparent px-6 py-3 text-sm font-medium transition-all data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-blue-600"
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                Completed
              </TabsTrigger>
              <TabsTrigger 
                value="favourite" 
                className="rounded-none border-b-2 border-transparent px-6 py-3 text-sm font-medium transition-all data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-blue-600"
              >
                <Star className="w-4 h-4 mr-2" />
                Favourite
              </TabsTrigger>
              <TabsTrigger 
                value="all" 
                className="rounded-none border-b-2 border-transparent px-6 py-3 text-sm font-medium transition-all data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-blue-600"
              >
                <Grid3x3 className="w-4 h-4 mr-2" />
                All
              </TabsTrigger>
              <TabsTrigger 
                value="archive" 
                className="rounded-none border-b-2 border-transparent px-6 py-3 text-sm font-medium transition-all data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-blue-600"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center justify-end gap-2 py-2 md:py-0 md:pl-4 md:border-l h-auto md:h-12">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="h-8 w-8"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="h-8 w-8"
            >
              <List className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterPanelOpen(true)}
              className="h-8"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filteredExams.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-2xl font-semibold mb-2">No exams yet</h3>
            <p className="text-muted-foreground mb-6">Upload your first exam to get started</p>
            <Button onClick={() => navigate("/upload")}><Upload className="mr-2" />Upload Exam</Button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredExams.map(e => e.id)} strategy={verticalListSortingStrategy}>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredExams.map((exam) => {
                    const progress = examProgress.get(exam.id) || {
                      questionsCompleted: 0,
                      totalQuestions: 0,
                      percentComplete: 0,
                      timeRemaining: "No timer",
                      lastAccessed: "Never",
                      examState: 'not-started',
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
                        isFavourite={favouriteExamIds.includes(exam.id)}
                        isArchived={activeTab === 'archive'}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredExams.map((exam) => {
                    const progress = examProgress.get(exam.id) || {
                      questionsCompleted: 0,
                      totalQuestions: 0,
                      percentComplete: 0,
                      timeRemaining: "No timer",
                      lastAccessed: "Never",
                      examState: 'not-started',
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
                        isFavourite={favouriteExamIds.includes(exam.id)}
                        isArchived={activeTab === 'archive'}
                      />
                    );
                  })}
                </div>
              )}
            </SortableContext>
          </DndContext>
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

      {/* New Exam Modal */}
      <Dialog open={newExamDialogOpen} onOpenChange={setNewExamDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Exam</DialogTitle>
            <DialogDescription>
              Choose how you'd like to create your exam
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <Button
              variant="outline"
              className="h-24 flex-col gap-2 hover:bg-blue-50 hover:border-blue-600 transition-all"
              onClick={() => {
                setNewExamDialogOpen(false);
                navigate("/upload");
              }}
            >
              <Upload className="w-8 h-8 text-blue-600" />
              <div className="text-center">
                <div className="font-semibold">Create Mock Exam</div>
                <div className="text-xs text-muted-foreground">Upload and format exam papers</div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              className="h-24 flex-col gap-2 hover:bg-blue-50 hover:border-blue-600 transition-all"
              onClick={() => {
                setNewExamDialogOpen(false);
                navigate("/practice-questions/new");
              }}
            >
              <Settings className="w-8 h-8 text-blue-600" />
              <div className="text-center">
                <div className="font-semibold">Create Practice Questions</div>
                <div className="text-xs text-muted-foreground">Generate custom question sets</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Download Modal */}
      <StudentPDFDownloadModal
        open={pdfModalOpen}
        onOpenChange={setPdfModalOpen}
        contentType="exam"
        contentId={pdfExam?.id || ''}
        contentTitle={pdfExam?.title || ''}
        hasAnswers={hasAnswersForPdfExam}
        onDownload={handlePDFDownload}
      />
    </DashboardLayout>
  );
};

export default MyExams;
