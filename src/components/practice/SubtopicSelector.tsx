/**
 * SubtopicSelector - Subtopic selection with search and custom entry
 * 
 * REGRESSION CHECKLIST (2026-01-09):
 * ✅ Enter key adds custom subtopic (same as clicking "Add X")
 * ✅ Click to add still works
 * ✅ AI interpretation toggle available
 */
import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, X, Sparkles } from "lucide-react";
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

interface SubtopicSelectorProps {
  subject: string;
  selectedSubtopics: string[];
  onSubtopicsChange: (subtopics: string[]) => void;
  educationalTier?: string;
  examBoard?: string;
  useAIInterpretation: boolean;
  onAIInterpretationChange: (value: boolean) => void;
}

export function SubtopicSelector({
  subject,
  selectedSubtopics,
  onSubtopicsChange,
  educationalTier,
  examBoard,
  useAIInterpretation,
  onAIInterpretationChange,
}: SubtopicSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [availableSubtopics, setAvailableSubtopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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
    !availableSubtopics.includes(subtopic);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="subtopic-selector">Select Subtopics</Label>
        <div className="flex items-center gap-2">
          <Switch
            id="ai-interpretation"
            checked={useAIInterpretation}
            onCheckedChange={onAIInterpretationChange}
          />
          <Label htmlFor="ai-interpretation" className="text-sm text-muted-foreground">
            Use AI interpretation
          </Label>
        </div>
      </div>

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
                // Add subtopic on Enter key press (same as clicking "Add X")
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
                      selectedSubtopics.includes(subtopic)
                        ? "opacity-100"
                        : "opacity-0"
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
              variant={isCustomSubtopic(subtopic) ? "secondary" : "default"}
              className="gap-1"
            >
              {isCustomSubtopic(subtopic) && (
                <Sparkles className="h-3 w-3" />
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
