import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Play, 
  Eye, 
  Trash2, 
  Star, 
  GripVertical,
  Calculator,
  Beaker,
  BookOpen,
  Globe,
  FileText,
  Clock,
  LucideIcon
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

const formatTimeSpent = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

export const PracticeSetCard = ({ 
  set, 
  progress, 
  subjectColor, 
  onDelete, 
  onToggleFavourite, 
  isFavourite,
  isRecovered = false
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

  const SubjectIcon = getSubjectIcon(set.subject_id);
  const percentComplete = (progress.questions_attempted / set.question_count) * 100;
  const isCompleted = progress.completed_at !== undefined;
  const estimatedTime = set.question_count * 2; // 2 minutes per question

  return (
    <div ref={setNodeRef} style={style}>
      <Card 
        className="group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
        style={{
          borderWidth: '2px',
          borderColor: subjectColor,
          boxShadow: `0 2px 8px ${subjectColor}26`,
        }}
      >
        <CardContent className="p-4">
          {/* Top Section: Subject Badge + Date */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge 
                style={{ 
                  backgroundColor: `${subjectColor}20`, 
                  color: subjectColor,
                  borderColor: subjectColor 
                }} 
                variant="outline" 
                className="text-xs font-medium"
              >
                <SubjectIcon className="h-3 w-3 mr-1" />
                {set.subject_id}
              </Badge>
              {isRecovered && (
                <Badge variant="secondary" className="text-xs">
                  Recovered
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(set.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Title + Drag Handle + Star */}
          <div className="flex items-start gap-3 mb-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-1">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Drag to reorder</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg truncate mb-1">{set.set_name}</h3>
              <div className="flex flex-wrap gap-1 mb-2">
                {set.subtopics.slice(0, 3).map((topic, idx) => (
                  <Badge 
                    key={idx}
                    variant="secondary"
                    className="text-xs"
                    style={{ backgroundColor: `${subjectColor}15`, color: subjectColor }}
                  >
                    {topic}
                  </Badge>
                ))}
                {set.subtopics.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{set.subtopics.length - 3}
                  </Badge>
                )}
              </div>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggleFavourite(set.id)}
                    className="h-8 w-8"
                  >
                    <Star className={`h-4 w-4 ${isFavourite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isFavourite ? 'Remove from favorites' : 'Add to favorites'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <FileText className="h-3 w-3" />
              <span>{set.question_count} questions</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>~{estimatedTime} min</span>
            </div>
            <div className="text-muted-foreground">
              Difficulty: <span className="font-medium capitalize">{set.difficulty_level || set.difficulty_mode}</span>
            </div>
            {progress.time_spent_seconds > 0 && (
              <div className="text-muted-foreground">
                Time spent: <span className="font-medium">{formatTimeSpent(progress.time_spent_seconds)}</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium" style={{ color: subjectColor }}>
                {progress.questions_attempted} / {set.question_count}
              </span>
            </div>
            <Progress 
              value={percentComplete} 
              indicatorColor={subjectColor}
              className="h-2"
            />
          </div>

          {/* Last Accessed */}
          <div className="text-xs text-muted-foreground mb-4">
            {isCompleted ? (
              <span className="text-green-600 dark:text-green-400 font-medium">
                ✓ Completed {new Date(progress.completed_at!).toLocaleDateString()}
              </span>
            ) : (
              <span>
                Last accessed: {new Date(progress.last_accessed_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="flex-1"
                    style={{ backgroundColor: subjectColor }}
                    onClick={() => navigate(`/practice-questions/${set.id}/take`)}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {progress.questions_attempted > 0 ? 'Continue' : 'Start Quiz'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {progress.questions_attempted > 0 ? 'Continue where you left off' : 'Begin practice quiz'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate(`/practice-questions/${set.id}/preview`)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Preview questions</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onDelete(set.id)}
                    className="hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete set</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};