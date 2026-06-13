import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, AlertTriangle, Shuffle, Settings2, Info, Clock } from "lucide-react";
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
  // Show the "session only" reminder once per edit episode, not on every tick.
  const sessionToastShownRef = useRef(false);

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

  // One quiet reminder per editing episode (reset when the popover reopens).
  const noteSessionEdit = () => {
    if (sessionToastShownRef.current) return;
    sessionToastShownRef.current = true;
    toast("Adjusted for this exam only — your saved profile is unchanged.", { duration: 3000 });
  };

  const handleSessionQuestionChange = (value: number) => {
    setSessionQuestionOverride(value);
    onSessionQuestionCountChange?.(value);
    noteSessionEdit();
  };

  const handleSessionTimeChange = (value: number) => {
    setSessionTimeOverride(value);
    onSessionTimeLimitChange?.(value);
    noteSessionEdit();
  };

  const effectiveQuestionCount = sessionQuestionOverride ?? questionCount;
  const effectiveTimeLimit = sessionTimeOverride ?? profileTimeLimit;

  return (
    <div
      className="col-span-full rounded-xl border overflow-hidden"
      style={{ borderColor: subjectColor + "33", backgroundColor: subjectColor + "06" }}
    >
      {/* Header: profile · topic count · session · remove (calm single row) */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: subjectColor + "1A" }}>
        <Badge
          className="text-xs font-semibold shrink-0"
          style={{ backgroundColor: subjectColor, color: "white" }}
        >
          {profileName}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {activeTopics.length} of {topics.length} topic{topics.length !== 1 ? "s" : ""} active
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Session overrides — quiet icon button + popover (logic unchanged) */}
          <Popover open={showSessionPopover} onOpenChange={(open) => { setShowSessionPopover(open); if (open) sessionToastShownRef.current = false; }}>
            <PopoverTrigger asChild>
              <button
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors hover:bg-muted/50"
                style={{
                  borderColor: hasSessionOverrides ? subjectColor + "60" : 'hsl(var(--border))',
                  color: hasSessionOverrides ? subjectColor : 'hsl(var(--muted-foreground))',
                }}
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Session</span>
                {hasSessionOverrides && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: subjectColor }} />}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4 space-y-4" align="end">
              <div>
                <p className="text-xs font-semibold mb-1">Session overrides</p>
                <p className="text-[10px] text-muted-foreground">
                  Changes here apply to this session only. Your saved profile is unchanged.
                </p>
              </div>

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

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <Label className="text-xs">Time limit (minutes)</Label>
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
                  Reset to profile defaults
                </Button>
              )}
            </PopoverContent>
          </Popover>

          <button
            className="text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
            onClick={onRemoveProfile}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Body: a calm helper line + all topics visible as toggle chips */}
      <div className="px-4 py-3.5 space-y-3">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Shuffle className="h-3 w-3 shrink-0" />
          The AI picks from these {activeTopics.length} topic{activeTopics.length !== 1 ? "s" : ""} to fill your {effectiveQuestionCount}-question paper. Tap a topic to exclude it.
        </div>

        <div className="flex flex-wrap gap-1.5">
          {topics.map((topic) => {
            const isActive = !deselectedTopics.has(topic);
            return (
              <button
                key={topic}
                onClick={() => toggleTopic(topic)}
                title={isActive ? "Tap to exclude" : "Tap to include"}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  isActive
                    ? "border-transparent text-white"
                    : "border-border bg-muted/40 text-muted-foreground line-through opacity-60"
                }`}
                style={isActive ? { backgroundColor: subjectColor } : undefined}
              >
                {topic}
                {isActive && <X className="h-3 w-3 opacity-50" />}
              </button>
            );
          })}
        </div>

        {activeTopics.length <= 1 && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Keep at least one topic active to generate an exam.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
