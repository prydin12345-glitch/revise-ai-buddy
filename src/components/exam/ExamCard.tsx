import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Play, 
  Eye, 
  Edit2, 
  Trash2, 
  Star, 
  GripVertical,
  Calculator,
  Beaker,
  BookOpen,
  Globe,
  FileText,
  Download,
  LucideIcon
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

const getSubjectIcon = (subject: string): LucideIcon => {
  const iconMap: Record<string, LucideIcon> = {
    'Mathematics': Calculator,
    'Math': Calculator,
    'Maths': Calculator,
    'Physics': Beaker,
    'Chemistry': Beaker,
    'Biology': BookOpen,
    'English': BookOpen,
    'Geography': Globe,
  };
  return iconMap[subject] || FileText;
};

const formatTimeRemaining = (timeString: string) => {
  if (timeString === "Completed" || timeString === "No timer") return timeString;
  return timeString;
};

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

  const SubjectIcon = getSubjectIcon(exam.subject_id);

  const getButtonConfig = () => {
    switch (progress.examState) {
      case 'completed':
        return {
          icon: Eye,
          tooltip: 'Review Exam',
          action: () => navigate(`/exam/${exam.id}/review`),
          bgColor: 'bg-success hover:bg-success/90',
        };
      case 'in-progress':
        return {
          icon: Play,
          tooltip: 'Continue Exam',
          action: () => navigate(`/exam/${exam.id}/in-progress?mode=student`),
          bgColor: `bg-[${subjectColor}] hover:opacity-90`,
        };
      default:
        return {
          icon: Play,
          tooltip: 'Begin Exam',
          action: () => navigate(`/exam/${exam.id}/preview`),
          bgColor: `bg-[${subjectColor}] hover:opacity-90`,
        };
    }
  };

  const buttonConfig = getButtonConfig();
  const ButtonIcon = buttonConfig.icon;

  return (
    <div ref={setNodeRef} style={style}>
      <Card 
        className={`group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
          isArchived ? 'pointer-events-none' : 'hover:shadow-2xl'
        }`}
        style={{
          borderWidth: '2px',
          borderColor: subjectColor,
          boxShadow: `0 2px 8px ${subjectColor}26`,
        }}
      >
        <CardContent className="p-4">
          {/* Top Row: Drag Handle + Title + Subject Tag */}
          <div className="flex items-start gap-3 mb-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    {...attributes} 
                    {...listeners} 
                    className="cursor-grab active:cursor-grabbing transition-opacity mt-1 hover:bg-accent p-1 rounded"
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Drag to reorder</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-xl line-clamp-2 mb-1 text-foreground">
                {exam.title}
              </h3>
              {exam.exam_topics.length > 0 && (
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {exam.exam_topics[0].topic_name}
                </p>
              )}
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    className="flex items-center gap-1.5 px-3 py-1.5 text-white font-medium whitespace-nowrap"
                    style={{ 
                      backgroundColor: subjectColor,
                    }}
                  >
                    <SubjectIcon className="w-3.5 h-3.5" />
                    {exam.subject_id}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Subject: {exam.subject_id}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Meta Row: Created Date + Action Icons */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-muted-foreground">
              Created: {new Date(exam.created_at).toLocaleDateString('en-GB')}
            </span>
            
            <div className="flex gap-1 transition-opacity">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={(e) => { e.stopPropagation(); onToggleFavourite(exam.id); }}
                      className="h-7 w-7"
                    >
                      <Star className={`w-3.5 h-3.5 ${isFavourite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
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
                        className="h-7 w-7"
                      >
                        <Download className="w-3.5 h-3.5" />
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
                      className="h-7 w-7"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
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
                      className="h-7 w-7 hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete exam</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Progress Info Row */}
          <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
            <span>
              {progress.lastAccessed && progress.lastAccessed !== 'Never' && (
                <>Last accessed: {progress.lastAccessed}</>
              )}
            </span>
            <span>{formatTimeRemaining(progress.timeRemaining)}</span>
          </div>

          {/* Progress Bar + Action Button Row */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="mb-1">
                <Progress 
                  value={progress.percentComplete} 
                  className="h-3 rounded-full"
                  indicatorColor={subjectColor}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {progress.questionsCompleted}/{progress.totalQuestions} completed
              </p>
            </div>

            {exam.status === 'published' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      className="h-10 w-10 rounded-full text-white shadow-lg transition-all duration-300 hover:scale-110"
                      style={{
                        backgroundColor: subjectColor,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        buttonConfig.action();
                      }}
                    >
                      <ButtonIcon className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{buttonConfig.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
};
