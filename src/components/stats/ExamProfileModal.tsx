import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { X, Check } from "lucide-react";

interface ExamProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectName: string;
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
  availableTopics,
  onSave,
  initialData,
}: ExamProfileModalProps) => {
  const [profileName, setProfileName] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(20);
  const [topicSearch, setTopicSearch] = useState("");

  useEffect(() => {
    if (open) {
      setProfileName(initialData?.profile_name || "");
      setSelectedTopics(initialData?.topics || []);
      setQuestionCount(initialData?.question_count || 20);
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
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit" : "Create"} Exam Profile — {subjectName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Profile Name</Label>
            <Input
              placeholder="e.g. Paper 1, Paper 2"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Question Count ({questionCount})</Label>
            <Slider
              min={5}
              max={50}
              step={1}
              value={[questionCount]}
              onValueChange={(v) => setQuestionCount(v[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5</span>
              <span>50</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Topics ({selectedTopics.length} selected)</Label>
            {selectedTopics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedTopics.map((topic) => (
                  <Badge
                    key={topic}
                    variant="secondary"
                    className="cursor-pointer gap-1"
                    onClick={() => toggleTopic(topic)}
                  >
                    {topic}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
            <Input
              placeholder="Search topics..."
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
            />
            <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
              {filteredTopics.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  {availableTopics.length === 0
                    ? "Add master topics first"
                    : "No matching topics"}
                </p>
              ) : (
                filteredTopics.map((topic) => {
                  const isSelected = selectedTopics.includes(topic);
                  return (
                    <button
                      key={topic}
                      onClick={() => toggleTopic(topic)}
                      className={`w-full text-left text-sm px-2 py-1.5 rounded-md flex items-center justify-between transition-colors ${
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      <span>{topic}</span>
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!profileName.trim() || selectedTopics.length === 0}
          >
            {initialData ? "Update" : "Create"} Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
