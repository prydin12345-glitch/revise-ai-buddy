import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, X, ChevronDown, ChevronUp, AlertTriangle, Shuffle, Settings2, Info, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CurriculumTopicBadgeProps {
  profileName: string;
  topics: string[];
  questionCount: number;
  questionLimit: number | null;
  subjectColor: string;
  onRemoveProfile: () => void;
  /** Called when topics are toggled on/off for this session only */
  onActiveTopicsChange?: (activeTopics: string[]) => void;
  /** Called when session question count changes */
  onSessionQuestionCountChange?: (count: number) => void;
  /** Called when session time limit changes */
  onSessionTimeLimitChange?: (minutes: number | null) => void;
  /** Profile's saved educational tier */
  profileEducationalTier?: string | null;
  /** Profile's saved time limit */
  profileTimeLimit?: number | null;
  /** Called when educational tier is overridden for this session */
  onSessionEducationalTierChange?: (tier: string) => void;
}

export const CurriculumTopicBadge = ({
  profileName,
  topics,
  questionCount,
  questionLimit,
  subjectColor,
  onRemoveProfile,
  onActiveTopicsChange,
  onSessionQuestionCountChange,
  onSessionTimeLimitChange,
  profileEducationalTier,
  profileTimeLimit,
  onSessionEducationalTierChange,
}: CurriculumTopicBadgeProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [deselectedTopics, setDeselectedTopics] = useState<Set<string>>(new Set());
  const [sessionQuestionOverride, setSessionQuestionOverride] = useState<number | null>(null);
  const [sessionTimeOverride, setSessionTimeOverride] = useState<number | null>(null);
  const [showSessionPopover, setShowSessionPopover] = useState(false);

  const activeTopics = topics.filter((t) => !deselectedTopics.has(t));
  const hasSessionOverrides = deselectedTopics.size > 0 || sessionQuestionOverride !== null || sessionTimeOverride !== null;

  const toggleTopic = (topic: string) => {
    setDeselectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) {
        next.delete(topic);
      } else {
        if (activeTopics.length <= 1) return prev;
        next.add(topic);
      }
      const newActive = topics.filter((t) => !next.has(t));
      onActiveTopicsChange?.(newActive);
      return next;
    });
  };

  const handleSessionQuestionChange = (value: number) => {
    setSessionQuestionOverride(value);
    onSessionQuestionCountChange?.(value);
    toast("Settings adjusted for this session. Your permanent profile remains unchanged.", {
      duration: 3000,
    });
  };

  const handleSessionTimeChange = (value: number) => {
    setSessionTimeOverride(value);
    onSessionTimeLimitChange?.(value);
    toast("Settings adjusted for this session. Your permanent profile remains unchanged.", {
      duration: 3000,
    });
  };

  const effectiveQuestionCount = sessionQuestionOverride ?? questionCount;
  const effectiveTimeLimit = sessionTimeOverride ?? profileTimeLimit;

  return (
    <div
      className="col-span-full rounded-xl border-2 transition-all"
      style={{ borderColor: subjectColor + "40", backgroundColor: subjectColor + "06" }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Header Row */}
        <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
          <Badge
            className="gap-1.5 text-xs font-semibold shrink-0"
            style={{ backgroundColor: subjectColor, color: "white" }}
          >
            {profileName}
          </Badge>

          {/* Topic count with tooltip preview */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              {!isOpen && (
                <TooltipContent side="bottom" className="max-w-xs p-3">
                  <p className="text-xs font-semibold mb-1.5">Topics in this profile:</p>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {activeTopics.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{t}</span>
                    ))}
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {/* Session Overrides Popover */}
          <Popover open={showSessionPopover} onOpenChange={setShowSessionPopover}>
            <PopoverTrigger asChild>
              <button
                className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:opacity-80 shrink-0 px-2 py-1 rounded-md border"
                style={{ 
                  borderColor: hasSessionOverrides ? subjectColor + "60" : 'hsl(var(--border))',
                  color: hasSessionOverrides ? subjectColor : 'hsl(var(--muted-foreground))',
                  backgroundColor: hasSessionOverrides ? subjectColor + "08" : 'transparent',
                }}
              >
                <Settings2 className="h-3 w-3" />
                Session
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4 space-y-4" align="start">
              <div>
                <p className="text-xs font-semibold mb-1">Session Overrides</p>
                <p className="text-[10px] text-muted-foreground">
                  Changes here apply to this session only. Your saved profile is unchanged.
                </p>
              </div>

              {/* Question Count Override */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Questions</Label>
                  <span className="text-sm font-bold tabular-nums" style={{ color: subjectColor }}>
                    {sessionQuestionOverride ?? questionCount}
                  </span>
                </div>
                <Slider
                  min={1}
                  max={questionLimit || 30}
                  step={1}
                  value={[sessionQuestionOverride ?? questionCount]}
                  onValueChange={(v) => handleSessionQuestionChange(v[0])}
                  style={{
                    '--slider-track': 'hsl(var(--muted))',
                    '--slider-range': subjectColor,
                  } as React.CSSProperties}
                />
              </div>

              {/* Time Limit Override */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <Label className="text-xs">Time Limit (minutes)</Label>
                </div>
                <Input
                  type="number"
                  min={0}
                  placeholder={profileTimeLimit ? `Profile default: ${profileTimeLimit}` : "No limit"}
                  value={sessionTimeOverride ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setSessionTimeOverride(null);
                      onSessionTimeLimitChange?.(null);
                    } else {
                      handleSessionTimeChange(parseInt(v) || 0);
                    }
                  }}
                  className="h-8 text-sm"
                />
              </div>

              {/* Tight time warning */}
              {effectiveTimeLimit && activeTopics.length > 0 && effectiveTimeLimit < activeTopics.length * 3 && (
                <div className="flex items-start gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                  <Info className="h-3 w-3 shrink-0 mt-0.5" />
                  This is a tight time limit for {activeTopics.length} topics. Consider adding more time!
                </div>
              )}

              {hasSessionOverrides && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs h-7"
                  onClick={() => {
                    setSessionQuestionOverride(null);
                    setSessionTimeOverride(null);
                    setDeselectedTopics(new Set());
                    onActiveTopicsChange?.(topics);
                    onSessionQuestionCountChange?.(questionCount);
                    onSessionTimeLimitChange?.(profileTimeLimit ?? null);
                    setShowSessionPopover(false);
                  }}
                >
                  Reset to Profile Defaults
                </Button>
              )}
            </PopoverContent>
          </Popover>

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
              your {effectiveQuestionCount}-question limit.
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

            {hasSessionOverrides && (
              <p className="text-[10px] text-muted-foreground/60 italic">
                Session overrides active — your saved profile is unchanged.
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
