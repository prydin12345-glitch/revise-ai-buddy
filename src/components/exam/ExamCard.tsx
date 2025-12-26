import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { 
  Play, 
  Eye, 
  Edit2, 
  Trash2, 
  Star, 
  GripVertical,
  Download,
  Clock,
  Calendar,
  BookOpen,
  ChevronRight
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ExamProgress {
  questionsCompleted: number;
  totalQuestions: number;
  percentComplete: number;
  timeRemaining: string;
  lastAccessed: string;
  examState: 'not-started' | 'in-progress' | 'completed';
}

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

interface ExamCardProps {
  exam: Exam;
  progress: ExamProgress;
  subjectColor: string;
  onEdit: (exam: Exam) => void;
  onDelete: (exam: Exam) => void;
  onToggleFavourite: (examId: string) => void;
  onDownloadPDF?: (exam: Exam) => void;
  isFavourite: boolean;
  isArchived?: boolean;
}

export const ExamCard = ({ 
  exam, 
  progress, 
  subjectColor, 
  onEdit, 
  onDelete, 
  onToggleFavourite,
  onDownloadPDF,
  isFavourite,
  isArchived = false
}: ExamCardProps) => {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: exam.id 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isArchived ? 0.6 : 1,
  };

  const getButtonConfig = () => {
    switch (progress.examState) {
      case 'completed':
        return {
          label: 'Review',
          icon: Eye,
          action: () => navigate(`/exam/${exam.id}/review`),
        };
      case 'in-progress':
        return {
          label: 'Continue',
          icon: Play,
          action: () => navigate(`/exam/${exam.id}/in-progress?mode=student`),
        };
      default:
        return {
          label: 'Start',
          icon: Play,
          action: () => navigate(`/exam/${exam.id}/preview`),
        };
    }
  };

  const buttonConfig = getButtonConfig();
  const ButtonIcon = buttonConfig.icon;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusConfig = () => {
    switch (progress.examState) {
      case 'completed':
        return {
          label: 'Completed',
          className: 'text-success bg-success/10',
        };
      case 'in-progress':
        return {
          label: 'In Progress',
          className: 'text-warning bg-warning/10',
        };
      default:
        return {
          label: 'Not Started',
          className: 'text-muted-foreground bg-muted',
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div ref={setNodeRef} style={style}>
      <Card 
        className={`group relative overflow-hidden transition-all duration-200 hover:shadow-lg ${
          isArchived ? 'pointer-events-none opacity-60' : ''
        }`}
        style={{
          borderLeft: `3px solid ${subjectColor}`,
        }}
      >
        <CardContent className="p-0">
          {/* ========== HEADER SECTION ========== */}
          <div className="p-5 pb-4">
            {/* Title Row with Drag Handle */}
            <div className="flex items-start gap-2 mb-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      {...attributes} 
                      {...listeners} 
                      className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity mt-1 hover:bg-accent p-1 rounded shrink-0"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Drag to reorder</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="flex-1 min-w-0">
                {/* Subject + Title */}
                <h3 className="font-semibold text-lg leading-tight text-foreground mb-1">
                  <span className="text-muted-foreground font-normal">{exam.subject_id}</span>
                  <span className="mx-2 text-muted-foreground/50">–</span>
                  <span>{exam.title}</span>
                </h3>
                
                {/* Progress indicator */}
                <div className="flex items-center gap-3 mt-2">
                  <Progress 
                    value={progress.percentComplete} 
                    className="h-1.5 flex-1 max-w-32 bg-muted"
                    indicatorColor={progress.examState === 'completed' ? 'hsl(var(--success))' : subjectColor}
                  />
                  <span className="text-xs text-muted-foreground">
                    {progress.percentComplete}% completed
                  </span>
                </div>
              </div>
            </div>

            {/* ========== METADATA SECTION ========== */}
            <div className="space-y-1.5 text-sm text-muted-foreground pl-7">
              {/* Topic */}
              {exam.exam_topics.length > 0 && (
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{exam.exam_topics[0].topic_name}</span>
                </div>
              )}
              
              {/* Created date */}
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Created: {formatDate(exam.created_at)}</span>
              </div>

              {/* Last accessed */}
              {progress.lastAccessed && progress.lastAccessed !== 'Never' && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Last accessed: {progress.lastAccessed}</span>
                </div>
              )}

              {/* Time remaining (if timer active) */}
              {progress.timeRemaining && progress.timeRemaining !== 'No timer' && progress.timeRemaining !== 'Completed' && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Time remaining: {progress.timeRemaining}</span>
                </div>
              )}
            </div>
          </div>

          {/* ========== DIVIDER ========== */}
          <Separator />

          {/* ========== ACTION ROW ========== */}
          <div className="px-5 py-3 flex items-center justify-between">
            {/* Left: Secondary Actions (icon-only, subtle) */}
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={(e) => { e.stopPropagation(); onToggleFavourite(exam.id); }}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Star className={`w-4 h-4 ${isFavourite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isFavourite ? 'Remove from favourites' : 'Add to favourites'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {onDownloadPDF && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={(e) => { e.stopPropagation(); onDownloadPDF(exam); }}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download PDF</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={(e) => { e.stopPropagation(); onEdit(exam); }}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit exam</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={(e) => { e.stopPropagation(); onDelete(exam); }}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete exam</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Right: Primary Action Button */}
            {exam.status === 'published' && (
              <Button
                size="sm"
                className="h-9 px-4 gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  buttonConfig.action();
                }}
              >
                <ButtonIcon className="w-4 h-4" />
                {buttonConfig.label}
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};