import { Users, ClipboardList, Copy, Eye, Megaphone, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ClassCardProps {
  id: string;
  name: string;
  subjects: string[];
  studentCount: number;
  assignmentCount: number;
  inviteCode: string | null;
  onViewClass: () => void;
  onCopyInvite: () => void;
  onAnnounce: () => void;
}

const subjectColors: Record<string, string> = {
  'Mathematics': 'hsl(221, 83%, 53%)',
  'Maths': 'hsl(221, 83%, 53%)',
  'Physics': 'hsl(262, 83%, 58%)',
  'Chemistry': 'hsl(142, 71%, 45%)',
  'Biology': 'hsl(142, 76%, 36%)',
  'English': 'hsl(25, 95%, 53%)',
  'History': 'hsl(32, 95%, 44%)',
  'Geography': 'hsl(173, 80%, 40%)',
};

const getSubjectColor = (subject: string): string => {
  for (const [key, color] of Object.entries(subjectColors)) {
    if (subject.toLowerCase().includes(key.toLowerCase())) {
      return color;
    }
  }
  return 'hsl(var(--primary))';
};

export const ClassCard = ({
  name,
  subjects,
  studentCount,
  assignmentCount,
  onViewClass,
  onCopyInvite,
  onAnnounce,
}: ClassCardProps) => {
  const primarySubject = subjects[0] || '';
  const accentColor = getSubjectColor(primarySubject);

  return (
    <div 
      className={cn(
        "group relative rounded-xl bg-card p-5",
        "border border-border/50 hover:border-border",
        "transition-all duration-200 ease-out",
        "hover:shadow-lg hover:shadow-black/5",
        "hover:-translate-y-0.5"
      )}
      style={{
        background: `linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card)) 95%, ${accentColor}10 100%)`,
      }}
    >
      {/* Accent bar */}
      <div 
        className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full opacity-80"
        style={{ backgroundColor: accentColor }}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 pl-3">
          <h3 className="text-lg font-semibold text-foreground truncate mb-2">
            {name}
          </h3>
          {subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {subjects.slice(0, 3).map((subject, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary"
                  className="text-xs font-medium"
                  style={{
                    backgroundColor: `${getSubjectColor(subject)}15`,
                    color: getSubjectColor(subject),
                    borderColor: `${getSubjectColor(subject)}30`,
                  }}
                >
                  {subject}
                </Badge>
              ))}
              {subjects.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{subjects.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCopyInvite}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Invite Link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAnnounce}>
              <Megaphone className="w-4 h-4 mr-2" />
              Post Announcement
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 pl-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          <span>{studentCount} {studentCount === 1 ? 'student' : 'students'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ClipboardList className="w-4 h-4" />
          <span>{assignmentCount} active</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pl-3">
        <Button 
          onClick={onViewClass}
          className="flex-1"
          size="sm"
        >
          <Eye className="w-4 h-4 mr-2" />
          View Class
        </Button>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                onClick={onCopyInvite}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy invite link</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                onClick={onAnnounce}
              >
                <Megaphone className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Post announcement</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};
