import { useState, useEffect, useRef } from "react";
import { useTopicPerformance, MASTERY_COLORS } from "@/hooks/useTopicPerformance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, FileText, Pencil, Trash2, Layers, Clock, Palette, Sparkles, Loader2, GraduationCap, Settings2 } from "lucide-react";
import { TopicSearchInput } from "./TopicSearchInput";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getTextColor, getBadgeColor } from "@/lib/color-contrast";
import { ColourSwatchPicker } from "./ColourSwatchPicker";
import { ColourConflictModal } from "./ColourConflictModal";
import { SuggestedTopicsModal } from "./SuggestedTopicsModal";
import { getNextAvailableColour, isSpecialisedSubject } from "@/lib/subject-colours";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { getRegionBoards } from "@/lib/board-level-mapping";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface SubjectCardProps {
  subject: { id: string; subject_name: string; subject_color: string; exam_board?: string | null };
  getTopicsForSubject: (s: string) => { id: string; topic: string }[];
  getProfilesForSubject: (s: string) => { id: string; profile_name: string; topics: string[]; question_count: number; educational_tier?: string | null; time_limit_minutes?: number | null }[];
  handleAddTopic: (subject: string, topic: string) => Promise<void>;
  removeTopic: (id: string) => Promise<void>;
  handleOpenCreateProfile: (subject: string) => void;
  handleOpenEditProfile: (subject: string, profile: { id: string; profile_name: string; topics: string[]; question_count: number; educational_tier?: string | null; time_limit_minutes?: number | null }) => void;
  deleteProfile: (id: string) => Promise<void>;
  /** All subject colours for conflict detection */
  allSubjects?: { id: string; subject_name: string; subject_color: string; exam_board?: string | null }[];
}

const MASTERY_LABELS = {
  untested: "Not yet tested",
  weak: "< 40% — needs work",
  developing: "40–70% — improving",
  strong: "> 70% — solid",
};

export const SubjectCard = ({
  subject,
  getTopicsForSubject,
  getProfilesForSubject,
  handleAddTopic,
  removeTopic,
  handleOpenCreateProfile,
  handleOpenEditProfile,
  deleteProfile,
  allSubjects = [],
}: SubjectCardProps) => {
  const subjectTopics = getTopicsForSubject(subject.subject_name);
  const subjectProfiles = getProfilesForSubject(subject.subject_name);
  const { getPerformance } = useTopicPerformance(subject.subject_name);
  const { saveOrUpdateSubject, refetch } = useUserSubjects();
  const { addTopic } = useSubjectProfiles();
  const { preferences } = useUserPreferences();
  const [colourPickerOpen, setColourPickerOpen] = useState(false);
  const [boardEditorOpen, setBoardEditorOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState(subject.exam_board || "");
  const [isCustomBoard, setIsCustomBoard] = useState(false);
  const [customBoardText, setCustomBoardText] = useState("");
  const customBoardRef = useRef<HTMLInputElement>(null);
  
  // Sync editingBoard when subject prop changes (after refetch)
  useEffect(() => {
    setEditingBoard(subject.exam_board || "");
  }, [subject.exam_board]);
  const [pendingColour, setPendingColour] = useState(subject.subject_color);
  const [showTopicSuggestions, setShowTopicSuggestions] = useState(false);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const VISIBLE_TOPIC_COUNT = 3;

  const regionBoards = getRegionBoards(preferences?.curriculum_region);

  // Conflict modal state
  const [conflict, setConflict] = useState<{ colour: string; subjectName: string } | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const showSuggestButton = isSpecialisedSubject(subject.subject_name) && subjectTopics.length < 3;

  const usedColours = allSubjects
    .filter(s => s.id !== subject.id)
    .map(s => s.subject_color);

  const handleColourSelect = async (newColour: string) => {
    setPendingColour(newColour);

    const conflicting = allSubjects.find(
      s => s.subject_color.toLowerCase() === newColour.toLowerCase() && s.id !== subject.id
    );

    if (conflicting) {
      setConflict({ colour: newColour, subjectName: conflicting.subject_name });
      setShowConflictModal(true);
      return;
    }

    await applyColour(newColour);
  };

  const applyColour = async (newColour: string) => {
    try {
      await saveOrUpdateSubject(subject.subject_name, newColour);
      await refetch();
      setColourPickerOpen(false);
    } catch (err) {
      console.error("Error changing colour:", err);
    }
  };

  const handleConflictConfirm = async () => {
    if (!conflict) return;
    // Reassign conflicting subject to next available colour
    const conflicting = allSubjects.find(
      s => s.subject_color.toLowerCase() === conflict.colour.toLowerCase() && s.id !== subject.id
    );
    if (conflicting) {
      const nextColour = getNextAvailableColour(
        allSubjects.map(s => s.subject_color)
      );
      await saveOrUpdateSubject(conflicting.subject_name, nextColour);
    }
    await applyColour(conflict.colour);
    setConflict(null);
  };

  const handleBoardSave = async (newBoard: string) => {
    try {
      const boardValue = newBoard === "__none" ? null : newBoard;
      setEditingBoard(newBoard === "__none" ? "" : newBoard);
      setIsCustomBoard(false);
      await saveOrUpdateSubject(subject.subject_name, subject.subject_color, boardValue);
      await refetch();
      setBoardEditorOpen(false);
    } catch (err) {
      console.error("Error updating exam board:", err);
      setEditingBoard(subject.exam_board || "");
    }
  };

  const handleCustomBoardSave = async () => {
    const trimmed = customBoardText.trim();
    if (!trimmed) return;
    await handleBoardSave(trimmed.toLowerCase());
  };

  return (
    <>
      <Card className="overflow-hidden relative group transition-shadow hover:shadow-lg">
        <div className="h-1.5 w-full" style={{ backgroundColor: subject.subject_color }} />
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: subject.subject_color,
                  color: getTextColor(subject.subject_color),
                }}
              >
                {subject.subject_name.charAt(0).toUpperCase()}
              </div>
              <h3 className="font-semibold text-foreground">{subject.subject_name}</h3>
              {(editingBoard || subject.exam_board) && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                  {(editingBoard || subject.exam_board || "").toUpperCase()}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {/* Edit subject button (exam board) */}
              <Popover open={boardEditorOpen} onOpenChange={(open) => {
                setBoardEditorOpen(open);
                if (open) {
                  const currentBoard = subject.exam_board || "";
                  setEditingBoard(currentBoard);
                  const isKnown = !currentBoard || currentBoard === "__none" || regionBoards.some(b => b.id === currentBoard);
                  setIsCustomBoard(!isKnown && !!currentBoard);
                  setCustomBoardText(!isKnown && currentBoard ? currentBoard : "");
                }
              }}>
                <PopoverTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Edit subject settings"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Exam Board
                    </Label>
                      <Select
                      value={isCustomBoard ? "other" : (editingBoard || "__none")}
                      onValueChange={(val) => {
                        if (val === "other") {
                          setIsCustomBoard(true);
                          setCustomBoardText("");
                          setTimeout(() => customBoardRef.current?.focus(), 50);
                        } else {
                          setIsCustomBoard(false);
                          const newBoard = val === "__none" ? "" : val;
                          setEditingBoard(newBoard);
                          handleBoardSave(newBoard);
                        }
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select exam board" />
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
                    {isCustomBoard && (
                      <div className="flex gap-2">
                        <Input
                          ref={customBoardRef}
                          placeholder="e.g. NZQA, SACE"
                          value={customBoardText}
                          onChange={(e) => setCustomBoardText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleCustomBoardSave(); }}
                          className="h-9 text-sm"
                        />
                        <Button size="sm" className="h-9 px-3" onClick={handleCustomBoardSave} disabled={!customBoardText.trim()}>
                          Save
                        </Button>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Changes which mark scheme style is used for this subject
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
              {/* Colour picker button */}
              <Popover open={colourPickerOpen} onOpenChange={setColourPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Change colour"
                  >
                    <Palette className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="end">
                  <ColourSwatchPicker
                    value={pendingColour}
                    onChange={handleColourSelect}
                    usedColours={usedColours}
                  />
                </PopoverContent>
              </Popover>
              <Badge variant="outline" className="text-xs font-normal">
                {subjectTopics.length} topics
              </Badge>
            </div>
          </div>

          {/* Topic Search Input */}
          <TopicSearchInput
            subjectName={subject.subject_name}
            existingTopics={subjectTopics.map((t) => t.topic)}
            onAddTopic={(topic) => handleAddTopic(subject.subject_name, topic)}
            placeholder="Search & add topic..."
            className="w-full"
          />

          {/* Legend */}
          <div className="flex flex-wrap gap-2 text-[10px]">
            {(["strong", "developing", "weak", "untested"] as const).map((level) => (
              <span key={level} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MASTERY_COLORS[level].text }} />
                <span className="text-muted-foreground capitalize">{level}</span>
              </span>
            ))}
          </div>

          {/* Topic Chips */}
          <div className="min-h-[40px]">
            {subjectTopics.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                <AnimatePresence mode="popLayout">
                  {(showAllTopics ? subjectTopics : subjectTopics.slice(0, VISIBLE_TOPIC_COUNT)).map((t) => {
                    const perf = getPerformance(t.topic);
                    const colors = MASTERY_COLORS[perf.mastery];
                    return (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                      >
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="secondary"
                                className="gap-1 cursor-pointer group/chip transition-colors rounded-full px-3 py-1 hover:opacity-80"
                                style={{
                                  backgroundColor: colors.bg,
                                  color: colors.text,
                                  borderColor: colors.border,
                                  borderWidth: "1px",
                                }}
                                onClick={() => removeTopic(t.id)}
                              >
                                {t.topic}
                                {perf.mastery !== "untested" && (
                                  <span className="text-[9px] opacity-70 ml-0.5">
                                    {perf.percentage}%
                                  </span>
                                )}
                                <X className="h-3 w-3 opacity-50 group-hover/chip:opacity-100 transition-opacity" />
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <p className="font-medium">{t.topic}</p>
                              <p className="text-muted-foreground">
                                {perf.questionsAttempted > 0
                                  ? `${perf.percentage}% accuracy · ${perf.questionsAttempted} questions`
                                  : "Not yet tested"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {subjectTopics.length > VISIBLE_TOPIC_COUNT && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary hover:text-primary px-2"
                    onClick={() => setShowAllTopics(!showAllTopics)}
                  >
                    {showAllTopics
                      ? 'Show less'
                      : `+${subjectTopics.length - VISIBLE_TOPIC_COUNT} more`}
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground py-2">
                <Layers className="h-4 w-4 opacity-40" />
                <p className="text-xs">No topics added yet.</p>
              </div>
            )}
          </div>

          {/* Suggest topics button for specialised/custom subjects with few topics */}
          {showSuggestButton && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => setShowTopicSuggestions(true)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Suggest topics for "{subject.subject_name}"
            </Button>
          )}

          {/* Exam Profiles Section */}
          <div className="border-t border-border/50 pt-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Exam Profiles
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 text-primary hover:text-primary"
                onClick={() => handleOpenCreateProfile(subject.subject_name)}
              >
                <Plus className="h-3 w-3" />
                Create
              </Button>
            </div>

            {subjectProfiles.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 italic">
                No profiles yet — create one to auto-fill exams.
              </p>
            ) : (
              <div className="space-y-2">
                {subjectProfiles.map((profile) => {
                  const tier = profile.educational_tier;
                  const tierLabelMap: Record<string, string> = {
                    secondary_14_16: "Level 2", college_16_18: "Level 3",
                    university_18plus: "Undergrad", level1: "Level 1",
                    level2: "Level 2", level3: "Level 3",
                    undergrad: "Undergrad", postgrad: "Postgrad", doctoral: "PhD",
                    vocational_entry: "Vocational", vocational_advanced: "Vocational Adv",
                    professional_cert: "Prof Cert", cpd: "CPD",
                  };
                  const tierLabel = tier && tier !== "other"
                    ? (tierLabelMap[tier] || tier)
                    : null;

                  return (
                    <div
                      key={profile.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 group/profile transition-colors hover:bg-muted"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">
                            {profile.profile_name}
                          </div>
                          {tierLabel && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {tierLabel}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 font-normal">
                          {profile.question_count}Q
                        </Badge>
                        {profile.time_limit_minutes && (
                          <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 font-normal gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {profile.time_limit_minutes}m
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover/profile:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => handleOpenEditProfile(subject.subject_name, profile)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => deleteProfile(profile.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>

      <ColourConflictModal
        open={showConflictModal}
        onOpenChange={setShowConflictModal}
        colour={conflict?.colour || ""}
        conflictingSubjectName={conflict?.subjectName || ""}
        replacementColour={getNextAvailableColour(allSubjects.map(s => s.subject_color))}
        onConfirm={handleConflictConfirm}
      />

      <SuggestedTopicsModal
        open={showTopicSuggestions}
        onOpenChange={setShowTopicSuggestions}
        subjectName={subject.subject_name}
        onAddTopics={async (topics) => {
          for (const t of topics) {
            await addTopic(subject.subject_name, t);
          }
        }}
      />
    </>
  );
};
