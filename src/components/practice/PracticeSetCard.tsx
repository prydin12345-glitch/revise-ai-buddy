import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { 
  Play, 
  Eye, 
  Trash2, 
  Star, 
  Download,
  Clock,
  Calendar,
  BookOpen,
  ChevronRight,
  FileText
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PracticeSetProgress {
  questions_attempted: number;
  last_accessed_at: string;
  completed_at?: string;
  time_spent_seconds: number;
}

interface PracticeSet {
  id: string;
  set_name: string;
  subject_id: string;
  subtopics: string[];
  difficulty_mode: string;
  difficulty_level: string;
  question_count: number;
  created_at: string;
  educational_tier?: string;
  exam_board?: string;
}

interface PracticeSetCardProps {
  set: PracticeSet;
  progress: PracticeSetProgress;
  subjectColor: string;
  onDelete: (setId: string) => void;
  onToggleFavourite: (setId: string) => void;
  isFavourite: boolean;
  isRecovered?: boolean;
  onDownloadPDF?: (setId: string) => void;
}

// Format progress to integer percentage
const formatProgress = (value: number): string => `${Math.round(value)}%`;

const formatTimeSpent = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

const formatDate = (dateStr: string | undefined | null) => {
  if (!dateStr) return null;
  
  const date = new Date(dateStr);
  // Check for invalid date or epoch (01/01/1970)
  if (isNaN(date.getTime()) || date.getTime() < 86400000) {
    return null;
  }
  
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const PracticeSetCard = ({ 
  set, 
  progress, 
  subjectColor, 
  onDelete, 
  onToggleFavourite, 
  isFavourite,
  isRecovered = false,
  onDownloadPDF
}: PracticeSetCardProps) => {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: set.id 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const percentComplete = set.question_count > 0 
    ? (progress.questions_attempted / set.question_count) * 100 
    : 0;
  const isCompleted = !!progress.completed_at && formatDate(progress.completed_at);
  const estimatedTime = set.question_count * 2; // 2 minutes per question

  const getButtonConfig = () => {
    if (isCompleted) {
      return {
        label: 'Review',
        icon: Eye,
        action: () => navigate(`/practice-questions/${set.id}/preview`),
      };
    }
    if (progress.questions_attempted > 0) {
      return {
        label: 'Continue',
        icon: ChevronRight,
        action: () => navigate(`/practice-questions/${set.id}/take`),
      };
    }
    return {
      label: 'Start',
      icon: Play,
      action: () => navigate(`/practice-questions/${set.id}/take`),
    };
  };

  const buttonConfig = getButtonConfig();
  const ButtonIcon = buttonConfig.icon;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card 
        className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg min-h-[280px] flex flex-col"
        style={{
          borderLeft: `3px solid ${subjectColor}`,
        }}
      >
        <CardContent className="p-0 flex flex-col flex-1">
          {/* ========== HEADER SECTION ========== */}
          <div className="p-6 pb-5 flex-1">
            {/* Title Row */}
            <div className="flex-1 min-w-0 mb-5">
              {/* Main Title */}
              <h3 className="font-semibold text-lg leading-tight text-foreground mb-1.5">
                {set.set_name}
              </h3>
              {/* Subject */}
              <p className="text-sm text-muted-foreground">{set.subject_id}</p>
              
              {/* Progress indicator */}
              <div className="flex items-center gap-3 mt-4">
                <Progress 
                  value={percentComplete} 
                  className="h-1.5 flex-1 bg-muted"
                  indicatorColor={isCompleted ? 'hsl(var(--success))' : subjectColor}
                />
                <span className="text-xs text-muted-foreground font-medium shrink-0">
                  {formatProgress(percentComplete)}
                </span>
              </div>
            </div>

            {/* ========== METADATA SECTION ========== */}
            <div className="space-y-3 text-sm text-muted-foreground mt-5">
              {/* Questions count */}
              <div className="flex items-center gap-2.5">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>{set.question_count} questions</span>
              </div>

              {/* Estimated time */}
              <div className="flex items-center gap-2.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>~{estimatedTime} min</span>
              </div>

              {/* Difficulty */}
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Difficulty: <span className="capitalize">{set.difficulty_level || set.difficulty_mode || 'Medium'}</span></span>
              </div>

              {/* Time spent (if any) */}
              {progress.time_spent_seconds > 0 && (
                <div className="flex items-center gap-2.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Time spent: {formatTimeSpent(progress.time_spent_seconds)}</span>
                </div>
              )}

              {/* Created date */}
              <div className="flex items-center gap-2.5">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Created: {formatDate(set.created_at) || 'Unknown'}</span>
              </div>

              {/* Completion status */}
              {isCompleted ? (
                <div className="flex items-center gap-2.5 text-green-600 dark:text-green-400 font-medium">
                  <span>✓ Completed {formatDate(progress.completed_at)}</span>
                </div>
              ) : progress.questions_attempted > 0 ? (
                <div className="flex items-center gap-2.5">
                  <span>{progress.questions_attempted} / {set.question_count} answered</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* ========== DIVIDER ========== */}
          <Separator />

          {/* ========== ACTION ROW ========== */}
          <div className="px-6 py-4 flex items-center justify-between">
            {/* Left: Secondary Actions */}
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={(e) => { e.stopPropagation(); onToggleFavourite(set.id); }}
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

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={(e) => { e.stopPropagation(); navigate(`/practice-questions/${set.id}/preview`); }}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Preview questions</p>
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
                        onClick={(e) => { e.stopPropagation(); onDownloadPDF(set.id); }}
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
                      onClick={(e) => { e.stopPropagation(); onDelete(set.id); }}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete set</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Right: Primary Action - Circular Icon Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      buttonConfig.action();
                    }}
                    aria-label={buttonConfig.label}
                  >
                    <ButtonIcon className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{buttonConfig.label}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};