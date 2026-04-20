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
import { getSubjectColor } from "@/utils/subjectColors";

interface ClassCardProps {
  id: string;
  name: string;
  subjects: string[];
  studentCount: number;
  assignmentCount: number;
  inviteCode: string | null;
  /** Optional persisted settings from student_groups.settings */
  settings?: {
    subject_name?: string | null;
    subject_color?: string | null;
    educational_level?: string | null;
    exam_board?: string | null;
  } | null;
  description?: string | null;
  onViewClass: () => void;
  onCopyInvite: () => void;
  onAnnounce: () => void;
}

const LEVEL_LABELS: Record<string, string> = {
  secondary: "GCSE",
  sixth_form: "A-Level",
  university: "University",
};

export const ClassCard = ({
  name,
  subjects,
  studentCount,
  assignmentCount,
  settings,
  description,
  onViewClass,
  onCopyInvite,
  onAnnounce,
}: ClassCardProps) => {
  const primarySubject = settings?.subject_name || subjects[0] || "";
  const accentColor = getSubjectColor(primarySubject, settings?.subject_color ?? null);
  const levelLabel = settings?.educational_level ? LEVEL_LABELS[settings.educational_level] : null;
  const examBoard = settings?.exam_board || null;

  return (
    <div
      className={cn(
        "group relative rounded-xl bg-card p-5",
        "border border-border/50 hover:border-border",
        "transition-all duration-200 ease-out",
        "hover:shadow-lg hover:shadow-black/5",
        "hover:-translate-y-0.5",
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
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pl-3">
          <h3 className="text-lg font-semibold text-foreground truncate mb-1.5">{name}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {primarySubject && (
              <Badge
                variant="secondary"
                className="text-xs font-medium"
                style={{
                  backgroundColor: `${accentColor}15`,
                  color: accentColor,
                  borderColor: `${accentColor}30`,
                }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                  style={{ background: accentColor }}
                />
                {primarySubject}
              </Badge>
            )}
            {levelLabel && (
              <Badge variant="outline" className="text-xs">
                {levelLabel}
              </Badge>
            )}
            {examBoard && (
              <Badge variant="outline" className="text-xs">
                {examBoard}
              </Badge>
            )}
          </div>
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

      {/* Description */}
      {description && (
        <p className="pl-3 text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
          {description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 pl-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          <span>{studentCount} {studentCount === 1 ? "student" : "students"}</span>
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
          style={{ background: accentColor, color: "white" }}
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
