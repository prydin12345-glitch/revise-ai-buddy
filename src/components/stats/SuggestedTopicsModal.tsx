import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";

interface SuggestedTopicsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectName: string;
  educationalTier?: string;
  onAddTopics: (topics: string[]) => void;
}

export const SuggestedTopicsModal = ({
  open,
  onOpenChange,
  subjectName,
  educationalTier,
  onAddTopics,
}: SuggestedTopicsModalProps) => {
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !subjectName) return;
    setLoading(true);
    setSuggestedTopics([]);
    setSelectedTopics([]);

    const fetchSuggestions = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("suggest-subject-topics", {
          body: {
            subjectName,
            educationalTier: educationalTier || "General",
          },
        });

        if (error) throw error;
        const topics: string[] = data?.topics || [];
        setSuggestedTopics(topics);
        setSelectedTopics(topics); // pre-select all
      } catch (err) {
        console.error("Failed to fetch topic suggestions:", err);
        setSuggestedTopics([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [open, subjectName, educationalTier]);

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Suggested topics</DialogTitle>
          <DialogDescription>
            AI-generated topics for{" "}
            <span className="text-primary font-medium italic">{subjectName}</span>.
            Select the ones you want to track.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-muted-foreground">Generating topics…</span>
          </div>
        ) : suggestedTopics.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No suggestions available for this subject.
          </p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {suggestedTopics.map(topic => (
              <button
                key={topic}
                type="button"
                onClick={() => toggleTopic(topic)}
                className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selectedTopics.includes(topic)
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-muted border border-transparent"
                }`}
              >
                <Checkbox checked={selectedTopics.includes(topic)} className="pointer-events-none" />
                <span className="text-foreground">{topic}</span>
              </button>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          You can always add more topics later.
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip for now
          </Button>
          <Button
            onClick={() => { onAddTopics(selectedTopics); onOpenChange(false); }}
            disabled={selectedTopics.length === 0}
          >
            Add {selectedTopics.length} topic{selectedTopics.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
