import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { X, Check, AlertCircle } from "lucide-react";

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

  useEffect(() => {
    if (open) {
      setProfileName(initialData?.profile_name || "");
      setSelectedTopics(initialData?.topics || []);
      setQuestionCount(initialData?.question_count || 15);
      setTopicSearch("");
    }
  }, [open, initialData]);

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const filteredTopics = availableTopics.filter(
    (t) => t.toLowerCase().includes(topicSearch.toLowerCase())
  );

  const handleSave = () => {
    if (!profileName.trim()) return;
    if (selectedTopics.length === 0) return;
    onSave(profileName.trim(), selectedTopics, questionCount);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto backdrop-blur-xl bg-card/95 border-border/50">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div
              className="w-2 h-8 rounded-full"
              style={{ backgroundColor: subjectColor }}
            />
            <div>
              <DialogTitle className="text-lg">
                {initialData ? "Edit" : "Create"} Exam Profile
              </DialogTitle>
              <DialogDescription className="text-xs">
                {subjectName} — select topics from your master list
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
              <span
                className="text-xl font-bold tabular-nums"
                style={{ color: subjectColor }}
              >
                {questionCount}
              </span>
            </div>
            <Slider
              min={5}
              max={20}
              step={1}
              value={[questionCount]}
              onValueChange={(v) => setQuestionCount(v[0])}
              style={{
                '--slider-range': subjectColor,
              } as React.CSSProperties}
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

            {/* Search */}
            <Input
              placeholder="Search topics..."
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
              className="h-9 text-sm"
            />

            {/* Topic list */}
            <div className="max-h-52 overflow-y-auto rounded-lg border border-border/50 bg-muted/30 p-1.5 space-y-0.5">
              {availableTopics.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                  <AlertCircle className="h-5 w-5 opacity-40" />
                  <p className="text-xs text-center">
                    Add master topics to this subject first, then you can select them here.
                  </p>
                </div>
              ) : filteredTopics.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No matching topics
                </p>
              ) : (
                filteredTopics.map((topic) => {
                  const isSelected = selectedTopics.includes(topic);
                  return (
                    <button
                      key={topic}
                      onClick={() => toggleTopic(topic)}
                      className={`w-full text-left text-sm px-3 py-2 rounded-md flex items-center justify-between transition-all ${
                        isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span>{topic}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
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
