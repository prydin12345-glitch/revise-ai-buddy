import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Eye, 
  Edit2, 
  Trash2, 
  Star, 
  Download,
  Clock,
  Calendar,
  BookOpen,
  ChevronRight
} from "lucide-react";
import { getBoardDisplayName } from "@/lib/board-scrubber";
import { LEVEL_DISPLAY_NAMES } from "@/lib/board-level-mapping";

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
  exam_board?: string | null;
  qualification_level?: string | null;
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

// Format progress to integer percentage
const formatProgress = (value: number): string => `${Math.round(value)}%`;

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
          icon: ChevronRight,
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

  return (
    <TooltipProvider delayDuration={200}>
      <Card 
        className={`group relative overflow-hidden transition-all duration-200 hover:shadow-lg min-h-[280px] flex flex-col ${
          isArchived ? 'opacity-60' : ''
        }`}
        style={{
          borderLeft: `3px solid ${subjectColor}`,
        }}
      >
        <CardContent className="p-0 flex flex-col flex-1">
          {/* ========== HEADER SECTION ========== */}
          <div className="p-6 pb-5 flex-1">
            {/* Title Row - Title first, subject second */}
            <div className="flex-1 min-w-0 mb-5">
              {/* Main Title (largest) */}
              <h3 className="font-semibold text-lg leading-tight text-foreground mb-1.5">
                {exam.title}
              </h3>
              {/* Subject (smaller, secondary) */}
              <p className="text-sm text-muted-foreground">{exam.subject_id}</p>

              {/* Board & Level tags */}
              {(exam.exam_board || exam.qualification_level) && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {exam.exam_board && (
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-semibold bg-primary/10 text-primary border-primary/30">
                      {getBoardDisplayName(exam.exam_board)}
                    </Badge>
                  )}
                  {exam.qualification_level && (
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground border-border">
                      {LEVEL_DISPLAY_NAMES[exam.qualification_level] ?? exam.qualification_level}
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Progress indicator - wider bar with percentage on same row */}
              <div className="flex items-center gap-3 mt-4">
                <Progress 
                  value={progress.percentComplete} 
                  className="h-1.5 flex-1 bg-muted"
                  indicatorColor={progress.examState === 'completed' ? 'hsl(var(--success))' : subjectColor}
                />
                <span className="text-xs text-muted-foreground font-medium shrink-0">
                  {formatProgress(progress.percentComplete)}
                </span>
              </div>
            </div>

            {/* ========== METADATA SECTION ========== */}
            <div className="space-y-3 text-sm text-muted-foreground mt-5">
              {/* Topic */}
              {exam.exam_topics.length > 0 && (
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{exam.exam_topics[0].topic_name}</span>
                </div>
              )}
              
              {/* Created date */}
              <div className="flex items-center gap-2.5">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Created: {formatDate(exam.created_at)}</span>
              </div>

              {/* Last accessed */}
              {progress.lastAccessed && progress.lastAccessed !== 'Never' && (
                <div className="flex items-center gap-2.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Last accessed: {progress.lastAccessed}</span>
                </div>
              )}

              {/* Time remaining (if timer active) */}
              {progress.timeRemaining && progress.timeRemaining !== 'No timer' && progress.timeRemaining !== 'Completed' && (
                <div className="flex items-center gap-2.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Time remaining: {progress.timeRemaining}</span>
                </div>
              )}
            </div>
          </div>

          {/* ========== DIVIDER ========== */}
          <Separator />

          {/* ========== ACTION ROW ========== */}
          <div className="px-6 py-4 flex items-center justify-between">
            {/* Left: Secondary Actions (icon-only, subtle) */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={(e) => { e.stopPropagation(); onToggleFavourite(exam.id); }}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    disabled={isArchived}
                  >
                    <Star className={`w-4 h-4 ${isFavourite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isFavourite ? 'Remove from favourites' : 'Add to favourites'}</p>
                </TooltipContent>
              </Tooltip>

              {onDownloadPDF && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={(e) => { e.stopPropagation(); onDownloadPDF(exam); }}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      disabled={isArchived}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Download PDF</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={(e) => { e.stopPropagation(); onEdit(exam); }}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    disabled={isArchived}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit exam</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={(e) => { e.stopPropagation(); onDelete(exam); }}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    disabled={isArchived}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete exam</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Right: Primary Action - Circular Icon Button */}
            {exam.status === 'published' && !isArchived && (
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
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
