import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag, Flame, Puzzle, FileText, Star, X } from "lucide-react";

export type FeedbackTag = "urgent" | "needs_review" | "follow_up" | "high_priority";

interface TagConfig {
  label: string;
  icon: React.ReactNode;
  className: string;
}

export const TAG_CONFIG: Record<FeedbackTag, TagConfig> = {
  urgent: {
    label: "Urgent",
    icon: <Flame className="h-3 w-3" />,
    className: "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20"
  },
  needs_review: {
    label: "Needs Review",
    icon: <Puzzle className="h-3 w-3" />,
    className: "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
  },
  follow_up: {
    label: "Follow Up",
    icon: <FileText className="h-3 w-3" />,
    className: "bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20"
  },
  high_priority: {
    label: "High Priority",
    icon: <Star className="h-3 w-3" />,
    className: "bg-purple-500/10 text-purple-600 border-purple-500/30 hover:bg-purple-500/20"
  }
};

interface FeedbackPriorityTagsProps {
  activeTags: FeedbackTag[];
  onTagToggle: (tag: FeedbackTag) => void;
  readonly?: boolean;
}

export const FeedbackPriorityTags = ({ 
  activeTags, 
  onTagToggle,
  readonly = false 
}: FeedbackPriorityTagsProps) => {
  const [open, setOpen] = useState(false);

  if (readonly) {
    return (
      <div className="flex flex-wrap gap-1">
        {activeTags.map((tag) => {
          const config = TAG_CONFIG[tag];
          return (
            <Badge key={tag} variant="outline" className={`text-xs gap-1 ${config.className}`}>
              {config.icon}
              {config.label}
            </Badge>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Display active tags */}
      {activeTags.map((tag) => {
        const config = TAG_CONFIG[tag];
        return (
          <Badge 
            key={tag} 
            variant="outline" 
            className={`text-xs gap-1 cursor-pointer ${config.className}`}
            onClick={() => onTagToggle(tag)}
          >
            {config.icon}
            {config.label}
            <X className="h-2.5 w-2.5 ml-0.5" />
          </Badge>
        );
      })}

      {/* Add tag button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full">
            <Tag className="h-3 w-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Add Tag</p>
            {(Object.keys(TAG_CONFIG) as FeedbackTag[])
              .filter(tag => !activeTags.includes(tag))
              .map((tag) => {
                const config = TAG_CONFIG[tag];
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      onTagToggle(tag);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${config.className}`}
                  >
                    {config.icon}
                    {config.label}
                  </button>
                );
              })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
