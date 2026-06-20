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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Check, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { classifySubjectName } from "@/hooks/useSubjectCategory";
import { ColourSwatchPicker } from "./ColourSwatchPicker";
import { ColourConflictModal } from "./ColourConflictModal";
import { SuggestedTopicsModal } from "./SuggestedTopicsModal";
import { PRESET_COLOURS, getNextAvailableColour, isSpecialisedSubject } from "@/lib/subject-colours";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { getRegionBoards } from "@/lib/board-level-mapping";
import { EXAM_BOARD_OPTIONS } from "@/lib/board-scrubber";

interface SubjectOption {
  id: string;
  name: string;
  category: string;
}

interface AddSubjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSubjectNames: string[];
  onSubjectAdded: () => void;
  /** Colours already used by existing subjects */
  existingColours?: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  sciences: "#10b981",
  maths: "#3b82f6",
  mathematics: "#3b82f6",
  languages: "#8b5cf6",
  humanities: "#f59e0b",
  other: "#6b7280",
};

const CATEGORY_LABELS: Record<string, string> = {
  sciences: "Sciences",
  maths: "Mathematics",
  mathematics: "Mathematics",
  languages: "Languages",
  humanities: "Humanities",
  other: "Other",
};

export const AddSubjectModal = ({
  open,
  onOpenChange,
  existingSubjectNames,
  onSubjectAdded,
  existingColours = [],
}: AddSubjectModalProps) => {
  const { addTopic } = useSubjectProfiles();
  const { preferences } = useUserPreferences();
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<SubjectOption | null>(null);
  const [customName, setCustomName] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedColour, setSelectedColour] = useState(
    getNextAvailableColour(existingColours)
  );
  const [examBoard, setExamBoard] = useState<string>("");

  // "confirmed" = user picked a subject and is now on the confirmation view
  const [confirmed, setConfirmed] = useState(false);

  // Colour conflict state
  const [colourConflict, setColourConflict] = useState<{
    colour: string;
    conflictingSubjectName: string;
  } | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Topic suggestion state
  const [showTopicSuggestions, setShowTopicSuggestions] = useState(false);
  const [justAddedSubjectName, setJustAddedSubjectName] = useState("");

  // Region-filtered boards
  const regionBoards = getRegionBoards(preferences?.curriculum_region);

  useEffect(() => {
    if (open) {
      loadSubjects();
      setSearchQuery("");
      setSelectedSubject(null);
      setCustomName("");
      setShowCustom(false);
      setConfirmed(false);
      setSelectedColour(getNextAvailableColour(existingColours));
      // Seed exam board from the most common board among existing subjects,
      // falling back to empty. The global preferred_exam_board is no longer
      // used as a seed since the per-subject list is the source of truth.
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setExamBoard(""); return; }
        const { data: existing } = await supabase
          .from('user_subjects')
          .select('exam_board')
          .eq('user_id', user.id)
          .not('exam_board', 'is', null);
        const counts: Record<string, number> = {};
        existing?.forEach((s: { exam_board: string | null }) => {
          const b = s.exam_board?.trim();
          if (b) counts[b] = (counts[b] ?? 0) + 1;
        });
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
        setExamBoard(top);
      })();
    }
  }, [open, existingColours]);

  const loadSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, name, category")
      .eq("is_active", true)
      .order("name");
    if (!error && data) setSubjects(data);
  };

  const filtered = subjects.filter((s) => {
    const notAlready = !existingSubjectNames.some(
      (e) => e.toLowerCase() === s.name.toLowerCase()
    );
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || s.name.toLowerCase().includes(query) || s.category.toLowerCase().includes(query);
    return notAlready && matchesSearch;
  });

  const grouped = filtered.reduce<Record<string, SubjectOption[]>>((acc, s) => {
    const cat = s.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const categoryOrder = ["maths", "sciences", "languages", "humanities", "other"];

  const handleSelectFromList = (s: SubjectOption) => {
    setSelectedSubject(s);
    setConfirmed(true);
  };

  const handleAdd = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let subjectName: string;
      const colour = selectedColour || CATEGORY_COLORS.other;
      const boardValue = examBoard && examBoard !== "__none" ? examBoard : null;

      if (showCustom && customName.trim()) {
        subjectName = customName.trim();

        const [_, category] = await Promise.all([
          supabase.from("user_subjects").insert({
            user_id: user.id,
            subject_name: subjectName,
            subject_color: colour,
            is_custom: true,
            custom_name: subjectName,
            exam_board: boardValue,
          }),
          classifySubjectName(subjectName),
        ]);

        await supabase
          .from("user_subjects")
          .update({ subject_category: category })
          .eq("user_id", user.id)
          .ilike("subject_name", subjectName);

        toast.success(`Added "${subjectName}"`);
      } else if (selectedSubject) {
        subjectName = selectedSubject.name;

        const [_, category] = await Promise.all([
          supabase.from("user_subjects").insert({
            user_id: user.id,
            subject_id: selectedSubject.id,
            subject_name: subjectName,
            subject_color: colour,
            is_custom: false,
            exam_board: boardValue,
          }),
          classifySubjectName(subjectName),
        ]);

        await supabase
          .from("user_subjects")
          .update({ subject_category: category })
          .eq("user_id", user.id)
          .ilike("subject_name", subjectName);

        toast.success(`Added "${subjectName}"`);
      } else {
        return;
      }

      onSubjectAdded();
      onOpenChange(false);

      // Trigger AI topic suggestions for specialised subjects
      if (isSpecialisedSubject(subjectName)) {
        setJustAddedSubjectName(subjectName);
        // Small delay so modal transition completes
        setTimeout(() => setShowTopicSuggestions(true), 400);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add subject");
    } finally {
      setLoading(false);
    }
  };

  const handleColourChange = (newColour: string) => {
    setSelectedColour(newColour);
  };

  const handleAddSuggestedTopics = async (topics: string[]) => {
    for (const topic of topics) {
      await addTopic(justAddedSubjectName, topic);
    }
    toast.success(`Added ${topics.length} topic${topics.length !== 1 ? "s" : ""}`);
  };

  const confirmationName = showCustom ? customName.trim() : selectedSubject?.name || "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Subject</DialogTitle>
            <DialogDescription>
              {confirmed || (showCustom && customName.trim())
                ? "Configure your subject details"
                : "Search for a subject or add a custom one."}
            </DialogDescription>
          </DialogHeader>

          {/* --- Confirmation View (after selecting a subject) --- */}
          {(confirmed && !showCustom) ? (
            <div className="space-y-4">
              {/* Selected subject display */}
              <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: selectedColour, color: '#fff' }}
                >
                  {confirmationName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{confirmationName}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedSubject?.category ? CATEGORY_LABELS[selectedSubject.category] || selectedSubject.category : "Subject"}
                  </p>
                </div>
                <Check className="h-5 w-5 text-primary shrink-0" />
              </div>

              {/* Colour picker */}
              <ColourSwatchPicker
                value={selectedColour}
                onChange={handleColourChange}
                usedColours={existingColours}
              />

              {/* Exam Board dropdown */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Exam Board
                </Label>
                <Select value={examBoard || "__none"} onValueChange={(val) => setExamBoard(val === "__none" ? "" : val)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select exam board (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No preference</SelectItem>
                    {regionBoards.map((board) => (
                      <SelectItem key={board.id} value={board.id}>
                        {board.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Links this subject to a specific exam board for accurate question generation
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => {
                  setConfirmed(false);
                  setSelectedSubject(null);
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to list
              </Button>
            </div>
          ) : !showCustom ? (
            /* --- Search / Selection View --- */
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search subjects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-lg border border-border/50 p-1">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No subjects found
                  </p>
                ) : (
                  categoryOrder
                    .filter((cat) => grouped[cat]?.length)
                    .map((cat) => (
                      <div key={cat}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-2.5 pb-1">
                          {CATEGORY_LABELS[cat] || cat}
                        </p>
                        {grouped[cat].map((s) => (
                          <button
                            key={s.id}
                            onClick={() => handleSelectFromList(s)}
                            className="w-full text-left text-sm px-3 py-2 rounded-md flex items-center justify-between transition-colors hover:bg-muted text-foreground"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: CATEGORY_COLORS[s.category] || CATEGORY_COLORS.other }}
                              />
                              <span>{s.name}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ))
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-1.5 text-primary"
                onClick={() => setShowCustom(true)}
              >
                <Plus className="h-4 w-4" />
                Add Custom Subject
              </Button>
            </div>
          ) : (
            /* --- Custom Subject View --- */
            <div className="space-y-4">
              <div>
                <Label>Custom Subject Name</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Music Theory"
                />
              </div>

              <ColourSwatchPicker
                value={selectedColour}
                onChange={handleColourChange}
                usedColours={existingColours}
              />

              {/* Exam Board dropdown for custom subject too */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Exam Board
                </Label>
                <Select value={examBoard || "__none"} onValueChange={(val) => setExamBoard(val === "__none" ? "" : val)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select exam board (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No preference</SelectItem>
                    {regionBoards.map((board) => (
                      <SelectItem key={board.id} value={board.id}>
                        {board.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCustom(false)}
              >
                ← Back to list
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={
                loading ||
                (!showCustom && !selectedSubject) ||
                (showCustom && !customName.trim())
              }
            >
              Add Subject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Topic Suggestions Modal */}
      <SuggestedTopicsModal
        open={showTopicSuggestions}
        onOpenChange={setShowTopicSuggestions}
        subjectName={justAddedSubjectName}
        onAddTopics={handleAddSuggestedTopics}
      />
    </>
  );
};
