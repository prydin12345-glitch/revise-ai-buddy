import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Eye, EyeOff, X, ChevronDown, ChevronUp, AlertTriangle, Shuffle } from "lucide-react";

interface CurriculumTopicBadgeProps {
  profileName: string;
  topics: string[];
  questionCount: number;
  questionLimit: number | null;
  subjectColor: string;
  onRemoveProfile: () => void;
  /** Called when topics are toggled on/off for this session only */
  onActiveTopicsChange?: (activeTopics: string[]) => void;
}

export const CurriculumTopicBadge = ({
  profileName,
  topics,
  questionCount,
  questionLimit,
  subjectColor,
  onRemoveProfile,
  onActiveTopicsChange,
}: CurriculumTopicBadgeProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [deselectedTopics, setDeselectedTopics] = useState<Set<string>>(new Set());

  const activeTopics = topics.filter((t) => !deselectedTopics.has(t));

  const toggleTopic = (topic: string) => {
    setDeselectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) {
        next.delete(topic);
      } else {
        // Don't allow deselecting all
        if (activeTopics.length <= 1) return prev;
        next.add(topic);
      }
      const newActive = topics.filter((t) => !next.has(t));
      onActiveTopicsChange?.(newActive);
      return next;
    });
  };

  return (
    <div
      className="col-span-full rounded-xl border-2 transition-all"
      style={{ borderColor: subjectColor + "40", backgroundColor: subjectColor + "06" }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Header Row */}
        <div className="flex items-center gap-2 px-4 py-3">
          <Badge
            className="gap-1.5 text-xs font-semibold shrink-0"
            style={{ backgroundColor: subjectColor, color: "white" }}
          >
            {profileName}
          </Badge>

          <CollapsibleTrigger asChild>
            <button
              className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80 shrink-0"
              style={{ color: subjectColor }}
            >
              {isOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {activeTopics.length} topic{activeTopics.length !== 1 ? "s" : ""}
              {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </CollapsibleTrigger>

          {questionLimit && (
            <span className="text-[10px] text-muted-foreground ml-auto hidden sm:inline">
              max {questionLimit}Q
            </span>
          )}

          <span className="text-[10px] text-muted-foreground ml-auto sm:ml-0">
            AI selects from your curated topics
          </span>

          <button
            className="text-xs text-destructive/70 hover:text-destructive hover:underline ml-2 shrink-0"
            onClick={onRemoveProfile}
          >
            Remove
          </button>
        </div>

        {/* Collapsible Topic List */}
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            {/* Dynamic note */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Shuffle className="h-3 w-3" />
              AI will randomly select from these {activeTopics.length} topic{activeTopics.length !== 1 ? "s" : ""} to fit
              your {questionCount}-question limit.
            </div>

            {/* Topic Chips */}
            <div className="flex flex-wrap gap-1.5">
              {topics.map((topic) => {
                const isActive = !deselectedTopics.has(topic);
                return (
                  <button
                    key={topic}
                    onClick={() => toggleTopic(topic)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      isActive
                        ? "border-transparent text-white"
                        : "border-border bg-muted/50 text-muted-foreground line-through opacity-60"
                    }`}
                    style={isActive ? { backgroundColor: subjectColor + "CC" } : undefined}
                  >
                    {topic}
                    {isActive && <X className="h-3 w-3 opacity-60 hover:opacity-100" />}
                  </button>
                );
              })}
            </div>

            {/* Warning if only 1 topic left */}
            {activeTopics.length <= 1 && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  You must have at least one topic selected to generate an exam.
                </p>
              </div>
            )}

            {deselectedTopics.size > 0 && (
              <p className="text-[10px] text-muted-foreground/60 italic">
                Deselected topics apply to this session only — your saved profile is unchanged.
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
