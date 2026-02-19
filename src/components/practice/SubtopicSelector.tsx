/**
 * SubtopicSelector - Subtopic selection with search, custom entry, board detection, and AI topic pruning
 *
 * REGRESSION CHECKLIST (2026-02-19):
 * ✅ Enter key adds custom subtopic (same as clicking "Add X")
 * ✅ Click to add still works
 * ✅ AI interpretation toggle available
 * ✅ Board fingerprint detection badge
 * ✅ Auto-extracted topics from uploaded file (interactive pruning)
 */
import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, X, Sparkles, Scan, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Board fingerprint detection — runs purely on extracted text, no external call
type DetectedBoard = 'aqa' | 'edexcel' | 'ocr' | 'wjec' | null;

interface BoardDetectionResult {
  board: DetectedBoard;
  label: string;
  confidence: 'high' | 'medium' | null;
}

function detectBoardFingerprint(text: string): BoardDetectionResult {
  if (!text) return { board: null, label: 'Standard Academic Style', confidence: null };

  const lower = text.toLowerCase();

  // Score each board based on fingerprint patterns
  const scores: Record<string, number> = { aqa: 0, edexcel: 0, ocr: 0, wjec: 0 };

  // AQA: heavy "Evaluate", "Give", "Give one reason", specific header styles
  const aqaEval = (lower.match(/\bevaluate\b/g) || []).length;
  const aqaGive = (lower.match(/\bgive\b/g) || []).length;
  scores.aqa += aqaEval * 3 + aqaGive * 2;
  if (lower.includes('aqa') || lower.includes('assessment and qualifications')) scores.aqa += 20;

  // Edexcel: "Explain", "Analyse", data-heavy setups, Pearson references
  const edexcelExplain = (lower.match(/\bexplain\b/g) || []).length;
  const edexcelAnalyse = (lower.match(/\banalyse\b/g) || []).length;
  scores.edexcel += edexcelExplain * 2 + edexcelAnalyse * 3;
  if (lower.includes('edexcel') || lower.includes('pearson') || lower.includes('btec')) scores.edexcel += 20;

  // OCR: "Show that", "Determine", structured parts
  const ocrShow = (lower.match(/\bshow that\b/g) || []).length;
  const ocrDetermine = (lower.match(/\bdetermine\b/g) || []).length;
  scores.ocr += ocrShow * 3 + ocrDetermine * 2;
  if (lower.includes('ocr') || lower.includes('oxford cambridge')) scores.ocr += 20;

  // WJEC: Welsh references
  if (lower.includes('wjec') || lower.includes('cbac') || lower.includes('welsh')) scores.wjec += 25;

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore < 3) return { board: null, label: 'Standard Academic Style', confidence: null };

  const topBoard = (Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0]) as DetectedBoard;
  const boardLabels: Record<string, string> = {
    aqa: 'UK Board A Style',
    edexcel: 'UK Board B Style',
    ocr: 'UK Board C Style',
    wjec: 'Welsh Board Style',
  };

  return {
    board: topBoard,
    label: boardLabels[topBoard!] || 'Standard Academic Style',
    confidence: maxScore >= 10 ? 'high' : 'medium',
  };
}

interface SubtopicSelectorProps {
  subject: string;
  selectedSubtopics: string[];
  onSubtopicsChange: (subtopics: string[]) => void;
  educationalTier?: string;
  examBoard?: string;
  useAIInterpretation: boolean;
  onAIInterpretationChange: (value: boolean) => void;
  /** Topics extracted from uploaded document via Deep Topic Scan */
  autoExtractedTopics?: string[];
  /** Detected board from uploaded document text */
  detectedBoard?: BoardDetectionResult | null;
  /** True while scanning the uploaded file */
  isScanning?: boolean;
  onExamBoardDetected?: (board: DetectedBoard) => void;
}

export function SubtopicSelector({
  subject,
  selectedSubtopics,
  onSubtopicsChange,
  educationalTier,
  examBoard,
  useAIInterpretation,
  onAIInterpretationChange,
  autoExtractedTopics,
  detectedBoard,
  isScanning = false,
  onExamBoardDetected,
}: SubtopicSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [availableSubtopics, setAvailableSubtopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Track which auto-extracted topics the user has kept (all selected by default)
  const [keptAutoTopics, setKeptAutoTopics] = useState<Set<string>>(new Set());

  // When auto-extracted topics arrive, add them to selection and to "kept" set
  useEffect(() => {
    if (!autoExtractedTopics?.length) return;
    const newTopics = autoExtractedTopics.filter(t => !selectedSubtopics.includes(t));
    if (newTopics.length > 0) {
      onSubtopicsChange([...selectedSubtopics, ...newTopics]);
    }
    setKeptAutoTopics(new Set(autoExtractedTopics));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExtractedTopics]);

  useEffect(() => {
    if (subject) {
      loadSubtopics();
    }
  }, [subject, educationalTier, examBoard]);

  const loadSubtopics = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("subject_subtopics")
        .select("subtopic")
        .eq("subject", subject);

      if (educationalTier) {
        query = query.or(`educational_tier.eq.${educationalTier},educational_tier.is.null`);
      }
      if (examBoard) {
        query = query.or(`exam_board.eq.${examBoard},exam_board.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const subtopics = data?.map((item: any) => item.subtopic) || [];
      setAvailableSubtopics([...new Set(subtopics)]);
    } catch (error) {
      console.error("Error loading subtopics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (subtopic: string) => {
    if (selectedSubtopics.includes(subtopic)) {
      onSubtopicsChange(selectedSubtopics.filter((s) => s !== subtopic));
    } else {
      onSubtopicsChange([...selectedSubtopics, subtopic]);
    }
  };

  const handleRemove = (subtopic: string) => {
    onSubtopicsChange(selectedSubtopics.filter((s) => s !== subtopic));
    // Also remove from keptAutoTopics so it doesn't get re-added
    setKeptAutoTopics(prev => { const n = new Set(prev); n.delete(subtopic); return n; });
  };

  const handleAddCustom = () => {
    if (searchValue.trim() && !selectedSubtopics.includes(searchValue.trim())) {
      onSubtopicsChange([...selectedSubtopics, searchValue.trim()]);
      setSearchValue("");
      setOpen(false);
    }
  };

  const filteredSubtopics = availableSubtopics.filter((subtopic) =>
    subtopic.toLowerCase().includes(searchValue.toLowerCase())
  );

  const isCustomSubtopic = (subtopic: string) =>
    !availableSubtopics.includes(subtopic) && !keptAutoTopics.has(subtopic);

  const isAutoTopic = (subtopic: string) => keptAutoTopics.has(subtopic);

  // Detected board badge colour mapping
  const boardBadgeClass = detectedBoard?.board
    ? 'bg-primary/10 text-primary border-primary/30'
    : 'bg-muted text-muted-foreground border-border';

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label htmlFor="subtopic-selector">Select Subtopics</Label>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Detected board badge */}
          {(detectedBoard || isScanning) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border font-medium",
                    boardBadgeClass
                  )}>
                    {isScanning ? (
                      <>
                        <Scan className="h-3 w-3 animate-pulse" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Scan className="h-3 w-3" />
                        Detected Style: {detectedBoard!.label}
                        {detectedBoard?.confidence && (
                          <span className="opacity-60">({detectedBoard.confidence})</span>
                        )}
                      </>
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-48">
                    {isScanning
                      ? 'Scanning your document for board style fingerprints...'
                      : detectedBoard?.board
                        ? 'Board style inferred from command verbs and question structure in your uploaded document. You can override in Advanced Options.'
                        : 'No specific board fingerprint detected. Using standard academic style.'
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* AI interpretation toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="ai-interpretation"
              checked={useAIInterpretation}
              onCheckedChange={onAIInterpretationChange}
            />
            <Label htmlFor="ai-interpretation" className="text-sm text-muted-foreground">
              AI interpretation
            </Label>
          </div>
        </div>
      </div>

      {/* Auto-extracted topics section */}
      {autoExtractedTopics && autoExtractedTopics.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Topics found in your document</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-52">Tap any topic to remove it from your practice set before generating.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {autoExtractedTopics.map(topic => {
              const isKept = selectedSubtopics.includes(topic);
              return (
                <button
                  key={topic}
                  onClick={() => isKept ? handleRemove(topic) : onSubtopicsChange([...selectedSubtopics, topic])}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all",
                    isKept
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border line-through opacity-60"
                  )}
                >
                  {isKept ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                  {topic}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedSubtopics.filter(s => autoExtractedTopics.includes(s)).length} of {autoExtractedTopics.length} topics selected
          </p>
        </div>
      )}

      {/* Manual selection combobox */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={!subject}
          >
            {selectedSubtopics.length > 0
              ? `${selectedSubtopics.length} subtopic${selectedSubtopics.length > 1 ? "s" : ""} selected`
              : "Select subtopics..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput
              placeholder="Search or type new subtopic..."
              value={searchValue}
              onValueChange={setSearchValue}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchValue.trim() && !selectedSubtopics.includes(searchValue.trim())) {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
            />
            <CommandEmpty>
              <div className="p-4 text-center space-y-2">
                <p className="text-sm text-muted-foreground">No subtopic found</p>
                {searchValue && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddCustom}
                    className="w-full"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Add "{searchValue}" (AI will interpret)
                  </Button>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {filteredSubtopics.map((subtopic) => (
                <CommandItem
                  key={subtopic}
                  onSelect={() => handleSelect(subtopic)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedSubtopics.includes(subtopic) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {subtopic}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Subtopics Chips */}
      {selectedSubtopics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSubtopics.map((subtopic) => (
            <Badge
              key={subtopic}
              variant={isAutoTopic(subtopic) ? "default" : isCustomSubtopic(subtopic) ? "secondary" : "outline"}
              className="gap-1"
            >
              {isCustomSubtopic(subtopic) && !isAutoTopic(subtopic) && (
                <Sparkles className="h-3 w-3" />
              )}
              {isAutoTopic(subtopic) && (
                <Scan className="h-3 w-3" />
              )}
              {subtopic}
              <button
                onClick={() => handleRemove(subtopic)}
                className="ml-1 rounded-full hover:bg-background/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// Re-export the type so callers can use it
export type { BoardDetectionResult, DetectedBoard };
export { detectBoardFingerprint };
