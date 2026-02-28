import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { X, Check, AlertCircle, Plus, ChevronsUpDown } from "lucide-react";
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

interface ExamProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectName: string;
  subjectColor: string;
  availableTopics: string[];
  onSave: (profileName: string, topics: string[], questionCount: number) => void;
  initialData?: {
    profile_name: string;
    topics: string[];
    question_count: number;
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

  useEffect(() => {
    if (open) {
      setProfileName(initialData?.profile_name || "");
      setSelectedTopics(initialData?.topics || []);
      setQuestionCount(initialData?.question_count || 15);
      setTopicSearch("");
    }
  }, [open, initialData]);

  // Merge user's master topics with the dictionary for this subject
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
    onSave(profileName.trim(), selectedTopics, questionCount);
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

          {/* Question Limit */}
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
              max={20}
              step={1}
              value={[questionCount]}
              onValueChange={(v) => setQuestionCount(v[0])}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>5</span>
              <span>20</span>
            </div>
          </div>

          {/* Topic Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Topics ({selectedTopics.length} selected)
            </Label>

            {/* Selected chips */}
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

            {/* Topic Search Popover */}
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
