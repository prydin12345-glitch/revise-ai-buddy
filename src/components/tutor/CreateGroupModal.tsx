import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Search, ChevronDown, Plus, Check, Copy, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getSubjectColor, PRESET_COLORS } from "@/utils/subjectColors";

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface SubjectOption {
  id: string;
  name: string;
  category: string;
  slug: string;
}

const EDUCATIONAL_LEVELS = [
  { value: "secondary", label: "GCSE / Secondary", short: "GCSE", ages: "14–16", tier: "Level 1" },
  { value: "sixth_form", label: "A-Level / Sixth Form", short: "A-Level", ages: "16–18", tier: "Level 2" },
  { value: "university", label: "University", short: "University", ages: "18+", tier: "Level 3" },
];

const EXAM_BOARDS = ["AQA", "Edexcel", "OCR", "WJEC", "CCEA", "Cambridge", "IB", "Other"];

const CATEGORY_ORDER = ["maths", "sciences", "humanities", "languages", "other"];
const CATEGORY_LABELS: Record<string, string> = {
  maths: "Mathematics",
  sciences: "Sciences & Engineering",
  humanities: "Humanities & Social Sciences",
  languages: "Languages",
  other: "Creative & Applied",
};

const generateInviteCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `EXM-${code}`;
};

export const CreateGroupModal = ({ open, onOpenChange, onSuccess }: CreateGroupModalProps) => {
  const { toast } = useToast();
  const [groupName, setGroupName] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<SubjectOption | null>(null);
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [educationalLevel, setEducationalLevel] = useState("sixth_form");
  const [examBoard, setExamBoard] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("30");
  const [subjectColor, setSubjectColor] = useState<string>(PRESET_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdGroup, setCreatedGroup] = useState<{ name: string; invite_code: string } | null>(null);

  // Subject search
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectPopoverOpen, setSubjectPopoverOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) loadSubjects();
  }, [open]);

  useEffect(() => {
    if (subjectPopoverOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [subjectPopoverOpen]);

  // Auto-update colour when subject changes
  useEffect(() => {
    const name = selectedSubject?.name || customSubjectName;
    if (name) {
      setSubjectColor(getSubjectColor(name));
    }
  }, [selectedSubject, customSubjectName]);

  const loadSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, name, category, slug")
      .eq("is_active", true)
      .order("name");
    if (!error && data) setSubjects(data);
  };

  const filteredGrouped = useMemo(() => {
    const query = subjectSearch.toLowerCase().trim();
    const filtered = query ? subjects.filter((s) => s.name.toLowerCase().includes(query)) : subjects;
    const grouped: Record<string, SubjectOption[]> = {};
    for (const s of filtered) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }
    return CATEGORY_ORDER
      .filter((cat) => grouped[cat]?.length)
      .map((cat) => ({ category: cat, label: CATEGORY_LABELS[cat] || cat, subjects: grouped[cat] }));
  }, [subjects, subjectSearch]);

  const handleSelectSubject = (subject: SubjectOption) => {
    setSelectedSubject(subject);
    setCustomSubjectName("");
    setShowCustomInput(false);
    setSubjectPopoverOpen(false);
    setSubjectSearch("");
  };

  const handleCustomSubject = () => {
    setShowCustomInput(true);
    setSubjectPopoverOpen(false);
    setSelectedSubject(null);
    setSubjectSearch("");
  };

  const handleClearSubject = () => {
    setSelectedSubject(null);
    setCustomSubjectName("");
    setShowCustomInput(false);
  };

  const subjectName = selectedSubject?.name || customSubjectName.trim() || null;
  const levelInfo = EDUCATIONAL_LEVELS.find((l) => l.value === educationalLevel);

  const resetForm = () => {
    setGroupName("");
    setSelectedSubject(null);
    setCustomSubjectName("");
    setShowCustomInput(false);
    setEducationalLevel("sixth_form");
    setExamBoard("");
    setDescription("");
    setCapacity("30");
    setSubjectColor(PRESET_COLORS[0]);
    setCreatedGroup(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!groupName.trim()) {
      toast({ title: "Error", description: "Please enter a class name", variant: "destructive" });
      return;
    }
    if (!subjectName) {
      toast({ title: "Error", description: "Please select a subject", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const inviteCode = generateInviteCode();

      const { data: newGroup, error } = await supabase
        .from("student_groups")
        .insert({
          tutor_id: user.id,
          name: groupName.trim(),
          description: description.trim() || null,
          subjects_covered: [subjectName],
          invite_code: inviteCode,
          capacity: parseInt(capacity) || 30,
          is_active: true,
          settings: {
            educational_level: educationalLevel,
            educational_tier: levelInfo?.tier || "Level 2",
            subject_id: selectedSubject?.id || null,
            subject_slug: selectedSubject?.slug || null,
            subject_name: subjectName,
            subject_color: subjectColor,
            exam_board: examBoard || null,
          },
        })
        .select()
        .single();

      if (error) throw error;
      setCreatedGroup({ name: newGroup.name, invite_code: newGroup.invite_code });
      onSuccess();
    } catch (error) {
      console.error("Error creating group:", error);
      toast({ title: "Error", description: "Failed to create class", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-[820px] p-0 overflow-hidden gap-0 max-h-[90vh]" hideCloseButton>
        {createdGroup ? (
          /* SUCCESS SCREEN */
          <div className="flex flex-col items-center text-center px-6 py-10 gap-5">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: `${subjectColor}20`, color: subjectColor }}
            >
              <Check className="w-8 h-8" strokeWidth={3} />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-foreground">Class created!</h2>
              <p className="text-sm text-muted-foreground">Share this invite code with your students</p>
            </div>

            <div
              className="w-full max-w-xs rounded-xl border p-4 text-center"
              style={{ borderColor: `${subjectColor}40`, background: `${subjectColor}08` }}
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                Invite Code
              </div>
              <div
                className="font-mono text-2xl font-bold tracking-[0.15em]"
                style={{ color: subjectColor }}
              >
                {createdGroup.invite_code}
              </div>
            </div>

            <div className="flex gap-2 w-full max-w-xs">
              <button
                onClick={() => copyToClipboard(createdGroup.invite_code, "Code")}
                className="flex-1 px-3 py-2.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <Copy className="w-3.5 h-3.5" /> Copy code
              </button>
              <button
                onClick={() => copyToClipboard(`${window.location.origin}/join/${createdGroup.invite_code}`, "Link")}
                className="flex-1 px-3 py-2.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <Link2 className="w-3.5 h-3.5" /> Copy link
              </button>
            </div>

            <button
              onClick={handleClose}
              className="w-full max-w-xs px-3 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: subjectColor }}
            >
              Done
            </button>
          </div>
        ) : (
          /* CREATE FORM */
          <div className="flex flex-col sm:flex-row max-h-[90vh]">
            {/* LEFT — Form */}
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
              {/* Header */}
              <div className="px-6 pt-5 pb-4 border-b border-border flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Create a class</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Students join using an invite code you share with them
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex-1 px-6 py-5 space-y-4">
                {/* Class name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Class name *
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Year 11 Physics Set 1"
                    maxLength={60}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="text-[10px] text-muted-foreground mt-1 text-right">{groupName.length}/60</div>
                </div>

                {/* Subject + colour */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Subject *
                  </label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0 relative">
                      {showCustomInput ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            placeholder="Enter custom subject..."
                            value={customSubjectName}
                            onChange={(e) => setCustomSubjectName(e.target.value)}
                            autoFocus
                            className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <button
                            type="button"
                            onClick={handleClearSubject}
                            className="px-2 rounded-md hover:bg-muted text-muted-foreground"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : subjectName ? (
                        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: subjectColor }}
                          />
                          <span className="text-sm text-foreground flex-1 truncate">{subjectName}</span>
                          <button
                            type="button"
                            onClick={handleClearSubject}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <Popover open={subjectPopoverOpen} onOpenChange={setSubjectPopoverOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-left flex items-center justify-between text-muted-foreground"
                            >
                              Search subjects...
                              <ChevronDown className="w-4 h-4 opacity-50" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[var(--radix-popover-trigger-width)] p-0 max-h-[320px] overflow-hidden"
                            align="start"
                          >
                            <div className="p-2 border-b border-border/50">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                  ref={searchInputRef}
                                  placeholder="Type to search..."
                                  value={subjectSearch}
                                  onChange={(e) => setSubjectSearch(e.target.value)}
                                  className="w-full h-9 pl-8 pr-2 bg-muted/30 border border-border/50 rounded-md text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                              </div>
                            </div>
                            <div className="overflow-y-auto max-h-[240px] p-1">
                              {filteredGrouped.length === 0 ? (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                  <p>No subjects found</p>
                                  <button
                                    type="button"
                                    onClick={handleCustomSubject}
                                    className="mt-1 text-primary text-xs hover:underline inline-flex items-center gap-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Add Custom Subject
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {filteredGrouped.map((group) => (
                                    <div key={group.category}>
                                      <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        {group.label}
                                      </p>
                                      {group.subjects.map((subject) => (
                                        <button
                                          key={subject.id}
                                          type="button"
                                          onClick={() => handleSelectSubject(subject)}
                                          className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
                                        >
                                          <div
                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ background: getSubjectColor(subject.name) }}
                                          />
                                          {subject.name}
                                        </button>
                                      ))}
                                    </div>
                                  ))}
                                  <div className="border-t border-border/30 mt-1 pt-1">
                                    <button
                                      type="button"
                                      onClick={handleCustomSubject}
                                      className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-primary flex items-center gap-2"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> Add Custom Subject
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    {/* Colour picker */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowColorPicker((p) => !p)}
                        title="Choose class colour"
                        className="w-10 h-10 rounded-md border-2 border-border transition-transform hover:scale-105"
                        style={{ background: subjectColor }}
                      />
                      {showColorPicker && (
                        <div className="absolute right-0 top-12 z-50 p-2 bg-popover border border-border rounded-lg shadow-lg grid grid-cols-5 gap-1.5 w-[180px]">
                          {PRESET_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => {
                                setSubjectColor(color);
                                setShowColorPicker(false);
                              }}
                              className="w-7 h-7 rounded-md transition-transform hover:scale-110"
                              style={{
                                background: color,
                                border: subjectColor === color ? "2px solid hsl(var(--foreground))" : "2px solid transparent",
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Level + Exam Board */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Student level
                    </label>
                    <select
                      value={educationalLevel}
                      onChange={(e) => setEducationalLevel(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {EDUCATIONAL_LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label} ({l.ages})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Exam board
                    </label>
                    <select
                      value={examBoard}
                      onChange={(e) => setExamBoard(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select board...</option>
                      {EXAM_BOARDS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Description (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What will students learn? Any important info..."
                    maxLength={200}
                    rows={2}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="text-[10px] text-muted-foreground mt-1 text-right">{description.length}/200</div>
                </div>

                {/* Capacity */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Class size
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="Maximum students"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </form>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-border flex justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={!groupName.trim() || !subjectName || loading}
                  className="px-5 py-2 rounded-md text-sm font-semibold text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  style={{
                    background: groupName.trim() && subjectName && !loading ? subjectColor : "hsl(var(--muted))",
                    color: groupName.trim() && subjectName && !loading ? "white" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {loading ? "Creating..." : "Create Class"}
                </button>
              </div>
            </div>

            {/* RIGHT — Live Preview */}
            <div className="hidden sm:flex w-[260px] flex-shrink-0 bg-muted/30 border-l border-border flex-col p-5 gap-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Preview
              </div>

              {/* Live class card preview */}
              <div
                className="bg-card border border-border rounded-xl p-3.5 transition-all"
                style={{ borderLeft: `3px solid ${subjectColor}` }}
              >
                <div className="text-sm font-bold text-foreground mb-1 truncate">
                  {groupName || "Class name..."}
                </div>
                {subjectName && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: subjectColor }} />
                    <span className="text-[11px] text-muted-foreground truncate">
                      {subjectName}
                      {levelInfo && ` · ${levelInfo.short}`}
                    </span>
                  </div>
                )}
                {description && (
                  <div className="text-[11px] text-muted-foreground mb-2 leading-snug line-clamp-2">
                    {description}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <span className="text-[11px] text-muted-foreground">0 students</span>
                  {examBoard && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: `${subjectColor}18`, color: subjectColor }}
                    >
                      {examBoard}
                    </span>
                  )}
                </div>
              </div>

              {/* Invite code preview */}
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Invite code
                </div>
                <div
                  className="font-mono text-base font-bold tracking-[0.1em]"
                  style={{ color: subjectColor }}
                >
                  EXM-XXXXXX
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Generated when class is created
                </div>
              </div>

              {/* Colour indicator */}
              <div
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                style={{
                  background: `${subjectColor}10`,
                  border: `1px solid ${subjectColor}30`,
                }}
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: subjectColor }} />
                <span className="text-[11px] text-muted-foreground">Class colour applied</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
