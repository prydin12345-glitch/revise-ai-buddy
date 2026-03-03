import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTextareaInsert } from "@/hooks/useTextareaInsert";
import { fuzzyMatch, getLocalSubtopics } from "@/lib/subtopic-dictionary";

interface ManualQuestionEditorProps {
  questionText: string;
  expectedAnswer: string;
  maxMarks: number;
  topicTag: string;
  subjectName: string;
  educationalTier?: string;
  onQuestionTextChange: (v: string) => void;
  onExpectedAnswerChange: (v: string) => void;
  onMaxMarksChange: (v: number) => void;
  onTopicTagChange: (v: string) => void;
}

// LaTeX shortcuts: detect common math patterns and offer conversion
const LATEX_PATTERNS: { pattern: RegExp; replacement: string; label: string }[] = [
  { pattern: /(\d+)\/(\d+)/, replacement: "$\\frac{$1}{$2}$", label: "fraction" },
  { pattern: /sqrt\(([^)]+)\)/, replacement: "$\\sqrt{$1}$", label: "square root" },
  { pattern: /\bpi\b/, replacement: "$\\pi$", label: "pi" },
  { pattern: /x\^(\d+)/, replacement: "$x^{$1}$", label: "exponent" },
];

export function ManualQuestionEditor({
  questionText,
  expectedAnswer,
  maxMarks,
  topicTag,
  subjectName,
  educationalTier,
  onQuestionTextChange,
  onExpectedAnswerChange,
  onMaxMarksChange,
  onTopicTagChange,
}: ManualQuestionEditorProps) {
  const [polishing, setPolishing] = useState(false);
  const [topicSearch, setTopicSearch] = useState("");
  const [topicOpen, setTopicOpen] = useState(false);
  const questionRef = useRef<HTMLTextAreaElement>(null);

  const { insertAtCursor } = useTextareaInsert({
    textareaRef: questionRef,
    value: questionText,
    onChange: onQuestionTextChange,
  });

  // Topic suggestions
  const rawSuggestions = topicSearch.length >= 2
    ? fuzzyMatch(topicSearch, subjectName)
    : getLocalSubtopics(subjectName);
  const suggestions = (Array.isArray(rawSuggestions) ? rawSuggestions : []).slice(0, 12);

  // LaTeX detection
  const detectedLatex = LATEX_PATTERNS.find((p) => p.pattern.test(questionText));

  const handleApplyLatex = () => {
    if (!detectedLatex) return;
    const newText = questionText.replace(detectedLatex.pattern, detectedLatex.replacement);
    onQuestionTextChange(newText);
  };

  const handlePolish = async () => {
    if (!questionText.trim()) return;
    setPolishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("polish-question", {
        body: { questionText, subjectName, educationalTier },
      });
      if (error) throw error;
      if (data?.polishedText) {
        onQuestionTextChange(data.polishedText);
        toast({ title: "Question polished", description: "Your question has been refined to exam-board style." });
      }
    } catch (err: any) {
      toast({ title: "Polish failed", description: err.message || "Try again later.", variant: "destructive" });
    } finally {
      setPolishing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Question text */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Question</Label>
          {/* Glassmorphism toolbar */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg backdrop-blur-md bg-card/30 border border-border/50">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => insertAtCursor("$  $", 2)}
            >
              <span className="font-serif italic">𝑥</span> LaTeX
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handlePolish}
              disabled={polishing || !questionText.trim()}
            >
              {polishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Polish
            </Button>
          </div>
        </div>
        <Textarea
          ref={questionRef}
          placeholder="Type your question here… Use $...$ for inline maths"
          value={questionText}
          onChange={(e) => onQuestionTextChange(e.target.value)}
          className="min-h-[120px] bg-card border-border resize-none font-mono text-sm"
        />
        {/* LaTeX hint */}
        {detectedLatex && (
          <button
            type="button"
            onClick={handleApplyLatex}
            className="mt-1.5 text-xs text-primary hover:underline"
          >
            Convert "{questionText.match(detectedLatex.pattern)?.[0]}" to {detectedLatex.label}?
          </button>
        )}
      </div>

      {/* Expected answer */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
          Mark Scheme / Expected Answer
        </Label>
        <Textarea
          placeholder="Describe the ideal answer, partial-credit steps, key terms…"
          value={expectedAnswer}
          onChange={(e) => onExpectedAnswerChange(e.target.value)}
          className="min-h-[100px] bg-card border-border resize-none text-sm"
        />
      </div>

      {/* Max marks & Topic tag row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
            Max Marks
          </Label>
          <Input
            type="number"
            min={1}
            max={25}
            value={maxMarks}
            onChange={(e) => onMaxMarksChange(Math.max(1, Math.min(25, parseInt(e.target.value) || 1)))}
            className="bg-card border-border"
          />
        </div>
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
            Topic Tag
          </Label>
          <div className="relative">
            <Input
              placeholder="Search topic…"
              value={topicOpen ? topicSearch : topicTag || ""}
              onFocus={() => { setTopicOpen(true); setTopicSearch(topicTag || ""); }}
              onChange={(e) => { setTopicSearch(e.target.value); setTopicOpen(true); }}
              onBlur={() => setTimeout(() => setTopicOpen(false), 200)}
              className="bg-card border-border"
            />
            {topicOpen && suggestions.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent truncate"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onTopicTagChange(s);
                      setTopicSearch(s);
                      setTopicOpen(false);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
