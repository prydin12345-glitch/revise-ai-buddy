import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Check, Plus, ChevronsUpDown, Clock } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fuzzyMatch, getLocalSubtopics } from "@/lib/subtopic-dictionary";
import { ExamProfileAdvanced, DEFAULT_ADVANCED, type AdvancedSettings } from "./ExamProfileAdvanced";

const EDUCATIONAL_TIERS = [
  { id: "ks3", name: "KS3 (Age 11–14)", group: "UK" },
  { id: "secondary_14_16", name: "GCSE (Age 14–16)", group: "UK" },
  { id: "college_16_18", name: "A-Level (Age 16–18)", group: "UK" },
  { id: "university_18plus", name: "University / Degree", group: "UK" },
  { id: "apprenticeship", name: "Apprenticeship", group: "Professional" },
  { id: "hnc_hnd", name: "HNC / HND", group: "Professional" },
  { id: "professional_certification", name: "Professional Certification", group: "Professional" },
  { id: "cpd", name: "CPD / Continuing Professional Development", group: "Professional" },
  { id: "ib_diploma", name: "IB Diploma", group: "International" },
  { id: "ap", name: "AP (Advanced Placement)", group: "International" },
  { id: "cambridge_igcse", name: "Cambridge IGCSE", group: "International" },
  { id: "other", name: "Other (specify below)", group: "Other" },
];

interface ExamProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectName: string;
  subjectColor: string;
  availableTopics: string[];
  onSave: (
    profileName: string,
    topics: string[],
    questionCount: number,
    educationalTier?: string,
    timeLimitMinutes?: number | null,
    advanced?: AdvancedSettings
  ) => void;
  initialData?: {
    profile_name: string;
    topics: string[];
    question_count: number;
    educational_tier?: string | null;
    time_limit_minutes?: number | null;
    structure_preset?: string | null;
    mcq_count?: number | null;
    mcq_position?: string | null;
    mark_distribution?: Record<number, number> | null;
    include_extended?: boolean | null;
    extended_marks?: number | null;
    difficulty_progression?: string | null;
    calculator_policy?: string | null;
  };
}

export const ExamProfileModal = ({
  open,
  onOpenChange,
  subjectName,
  subjectColor,
  availableTopics,
  onSave,
  initialData,
}: ExamProfileModalProps) => {
  const [profileName, setProfileName] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(15);
  const [topicSearch, setTopicSearch] = useState("");
  const [topicPopoverOpen, setTopicPopoverOpen] = useState(false);
  const [educationalTier, setEducationalTier] = useState("");
  const [customTier, setCustomTier] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<string>("");
  const [advanced, setAdvanced] = useState<AdvancedSettings>(DEFAULT_ADVANCED);

  useEffect(() => {
    if (open) {
      setProfileName(initialData?.profile_name || "");
      setSelectedTopics(initialData?.topics || []);
      setQuestionCount(initialData?.question_count || 15);
      const tier = initialData?.educational_tier || "";
      const isKnown = EDUCATIONAL_TIERS.some((t) => t.id === tier);
      setEducationalTier(isKnown || !tier ? tier : "other");
      setCustomTier(isKnown || !tier ? "" : tier);
      setTimeLimitMinutes(
        initialData?.time_limit_minutes != null ? String(initialData.time_limit_minutes) : ""
      );
      setTopicSearch("");
      setAdvanced({
        structurePreset: initialData?.structure_preset || "custom",
        mcqCount: initialData?.mcq_count ?? 0,
        mcqPosition: initialData?.mcq_position || "start",
        markDistribution: (initialData?.mark_distribution as Record<number, number>) || {},
        includeExtended: initialData?.include_extended ?? false,
        extendedMarks: initialData?.extended_marks ?? 0,
        difficultyProgression: initialData?.difficulty_progression || "ascending",
        calculatorPolicy: initialData?.calculator_policy || "allowed",
      });
    }
  }, [open, initialData]);

  const allTopics = useMemo(() => {
    const dictTopics = getLocalSubtopics(subjectName);
    return [...new Set([...availableTopics, ...dictTopics])];
  }, [subjectName, availableTopics]);

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const filteredTopics = useMemo(() => {
    const unselected = allTopics.filter((t) => !selectedTopics.includes(t));
    if (!topicSearch.trim()) return unselected.slice(0, 40);
    return unselected.filter((t) => fuzzyMatch(topicSearch, t));
  }, [allTopics, selectedTopics, topicSearch]);

  const isCustom =
    topicSearch.trim() &&
    !allTopics.some((t) => t.toLowerCase() === topicSearch.trim().toLowerCase()) &&
    !selectedTopics.some((t) => t.toLowerCase() === topicSearch.trim().toLowerCase());

  const handleSave = () => {
    if (!profileName.trim() || selectedTopics.length === 0) return;
    const timeVal = timeLimitMinutes ? parseInt(timeLimitMinutes) : null;
    const finalTier = educationalTier === "other" ? customTier : educationalTier;
    onSave(profileName.trim(), selectedTopics, questionCount, finalTier || undefined, timeVal, advanced);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto backdrop-blur-xl bg-card/95 border-border/50">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-8 rounded-full" style={{ backgroundColor: subjectColor }} />
            <div>
              <DialogTitle className="text-lg">
                {initialData ? "Edit" : "Create"} Exam Profile
              </DialogTitle>
              <DialogDescription className="text-xs">
                {subjectName} — select topics for this profile
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Profile Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Profile Name
            </Label>
            <Input
              placeholder="e.g. Paper 1, Paper 2, Unit Test 3"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="h-10"
            />
          </div>

          {/* Educational Level */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Educational Level
            </Label>
            <Select
              value={educationalTier}
              onValueChange={(v) => {
                setEducationalTier(v);
                if (v !== "other") setCustomTier("");
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select level (optional)..." />
              </SelectTrigger>
              <SelectContent>
                {["UK", "Professional", "International", "Other"].map((group) => {
                  const items = EDUCATIONAL_TIERS.filter((t) => t.group === group);
                  if (items.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-1">
                        {group}
                      </p>
                      {items.map((tier) => (
                        <SelectItem key={tier.id} value={tier.id}>
                          {tier.name}
                        </SelectItem>
                      ))}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
            {educationalTier === "other" && (
              <div className="mt-2 space-y-1">
                <Input
                  value={customTier}
                  onChange={(e) => setCustomTier(e.target.value)}
                  placeholder="e.g. HNC/HND, NVQ Level 3, AWS Certification..."
                  className="h-9 border-primary/50"
                />
                <p className="text-[11px] text-muted-foreground">
                  The AI will interpret your qualification level when generating questions
                </p>
              </div>
            )}
          </div>

          {/* Question Limit — max raised to 40 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Question Limit
              </Label>
              <span className="text-xl font-bold tabular-nums" style={{ color: subjectColor }}>
                {questionCount}
              </span>
            </div>
            <Slider
              min={5}
              max={40}
              step={1}
              value={[questionCount]}
              onValueChange={(v) => setQuestionCount(v[0])}
              style={{
                "--slider-track": "hsl(var(--muted))",
                "--slider-range": subjectColor,
              } as React.CSSProperties}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>5</span>
              <span>40</span>
            </div>
          </div>

          {/* Time Limit */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Time Limit (minutes)
              </Label>
            </div>
            <Input
              type="number"
              min={0}
              placeholder="e.g. 60 (leave blank for no limit)"
              value={timeLimitMinutes}
              onChange={(e) => setTimeLimitMinutes(e.target.value)}
              className="h-10"
            />
          </div>

          {/* Topic Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Topics ({selectedTopics.length} selected)
            </Label>

            {selectedTopics.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTopics.map((topic) => (
                  <Badge
                    key={topic}
                    className="cursor-pointer gap-1 rounded-full px-3 py-1 text-xs transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: subjectColor + "20",
                      color: subjectColor,
                      borderColor: subjectColor + "40",
                    }}
                    onClick={() => toggleTopic(topic)}
                  >
                    {topic}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}

            <Popover open={topicPopoverOpen} onOpenChange={setTopicPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between h-9 text-sm font-normal"
                >
                  <span className="text-muted-foreground">Search & add topics...</span>
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Type to search..."
                    value={topicSearch}
                    onValueChange={setTopicSearch}
                  />
                  {filteredTopics.length === 0 && !isCustom && (
                    <CommandEmpty>No topics found.</CommandEmpty>
                  )}
                  <CommandGroup className="max-h-52 overflow-y-auto">
                    {isCustom && (
                      <CommandItem
                        onSelect={() => {
                          toggleTopic(topicSearch.trim());
                          setTopicSearch("");
                        }}
                        className="gap-2"
                      >
                        <Plus className="h-3.5 w-3.5 text-primary" />
                        Add "{topicSearch.trim()}"
                      </CommandItem>
                    )}
                    {filteredTopics.map((topic) => (
                      <CommandItem key={topic} value={topic} onSelect={() => toggleTopic(topic)}>
                        <Check className="mr-2 h-3.5 w-3.5 opacity-0" />
                        {topic}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Advanced Settings */}
          <ExamProfileAdvanced
            settings={advanced}
            onChange={setAdvanced}
            questionLimit={questionCount}
            subjectColor={subjectColor}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!profileName.trim() || selectedTopics.length === 0}
            style={{ backgroundColor: subjectColor }}
            className="text-white hover:opacity-90"
          >
            {initialData ? "Update" : "Create"} Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
