import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Search, ChevronDown, Plus, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  { value: "secondary", label: "High School / Secondary", ages: "Ages 14–16", tier: "Level 1" },
  { value: "sixth_form", label: "College / Sixth Form", ages: "Ages 16–18", tier: "Level 2" },
  { value: "university", label: "University / Undergraduate", ages: "Ages 18+", tier: "Level 3" },
];

const CATEGORY_ORDER = ["maths", "sciences", "humanities", "languages", "other"];
const CATEGORY_LABELS: Record<string, string> = {
  maths: "Mathematics",
  sciences: "Sciences & Engineering",
  humanities: "Humanities & Social Sciences",
  languages: "Languages",
  other: "Creative & Applied",
};

const generateInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
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
  const [capacity, setCapacity] = useState("30");
  const [loading, setLoading] = useState(false);

  // Subject search
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectPopoverOpen, setSubjectPopoverOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      loadSubjects();
    }
  }, [open]);

  useEffect(() => {
    if (subjectPopoverOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [subjectPopoverOpen]);

  const loadSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, name, category, slug")
      .eq("is_active", true)
      .order("name");
    if (!error && data) {
      setSubjects(data);
    }
  };

  const filteredGrouped = useMemo(() => {
    const query = subjectSearch.toLowerCase().trim();
    const filtered = query
      ? subjects.filter(s => s.name.toLowerCase().includes(query))
      : subjects;

    const grouped: Record<string, SubjectOption[]> = {};
    for (const s of filtered) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }

    return CATEGORY_ORDER
      .filter(cat => grouped[cat]?.length)
      .map(cat => ({ category: cat, label: CATEGORY_LABELS[cat] || cat, subjects: grouped[cat] }));
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

  const getSubjectDisplayName = () => {
    if (selectedSubject) return selectedSubject.name;
    if (customSubjectName.trim()) return customSubjectName.trim();
    return null;
  };

  const getLevelLabel = () => {
    const level = EDUCATIONAL_LEVELS.find(l => l.value === educationalLevel);
    return level ? `[${level.label.split(" / ")[0]}]` : "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const subjectName = getSubjectDisplayName();
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
      const levelInfo = EDUCATIONAL_LEVELS.find(l => l.value === educationalLevel);

      const { error } = await supabase
        .from("student_groups")
        .insert({
          tutor_id: user.id,
          name: groupName.trim(),
          subjects_covered: [subjectName],
          invite_code: inviteCode,
          capacity: parseInt(capacity) || 30,
          is_active: true,
          settings: {
            educational_level: educationalLevel,
            educational_tier: levelInfo?.tier || "Level 2",
            subject_id: selectedSubject?.id || null,
            subject_slug: selectedSubject?.slug || null,
          },
        });

      if (error) throw error;

      toast({ title: "Class created!", description: `Invite code: ${inviteCode}` });

      // Reset
      setGroupName("");
      setSelectedSubject(null);
      setCustomSubjectName("");
      setShowCustomInput(false);
      setEducationalLevel("sixth_form");
      setCapacity("30");

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating group:", error);
      toast({ title: "Error", description: "Failed to create class", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const subjectName = getSubjectDisplayName();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Class</DialogTitle>
          <DialogDescription>
            Set up a new class with a subject and level. Students join via the generated invite code.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Class Name */}
          <div className="space-y-2">
            <Label htmlFor="groupName">Class Name *</Label>
            <Input
              id="groupName"
              placeholder="e.g., Year 11 Biology"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
          </div>

          {/* Subject Selection */}
          <div className="space-y-2">
            <Label>Subject *</Label>
            {subjectName && !showCustomInput ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="py-2 px-4 text-sm gap-2">
                  {subjectName} {getLevelLabel()}
                  <button type="button" onClick={handleClearSubject} className="hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </Badge>
              </div>
            ) : showCustomInput ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter custom subject name..."
                  value={customSubjectName}
                  onChange={(e) => setCustomSubjectName(e.target.value)}
                  autoFocus
                />
                <Button type="button" variant="ghost" size="icon" onClick={handleClearSubject}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Popover open={subjectPopoverOpen} onOpenChange={setSubjectPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between font-normal text-muted-foreground"
                  >
                    Search subjects...
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 max-h-[320px] overflow-hidden" align="start">
                  <div className="p-2 border-b border-border/50">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        placeholder="Type to search..."
                        value={subjectSearch}
                        onChange={(e) => setSubjectSearch(e.target.value)}
                        className="pl-8 h-9 bg-muted/30 border-border/50"
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-[240px] p-1">
                    {filteredGrouped.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        <p>No subjects found</p>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="mt-1"
                          onClick={handleCustomSubject}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Add Custom Subject
                        </Button>
                      </div>
                    ) : (
                      <>
                        {filteredGrouped.map((group) => (
                          <div key={group.category}>
                            <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              {group.label}
                            </p>
                            {group.subjects.map((subject) => (
                              <button
                                key={subject.id}
                                type="button"
                                onClick={() => handleSelectSubject(subject)}
                                className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                              >
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
                            <Plus className="w-3.5 h-3.5" />
                            Add Custom Subject
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Educational Level */}
          <div className="space-y-2">
            <Label>Educational Level *</Label>
            <Select value={educationalLevel} onValueChange={setEducationalLevel}>
              <SelectTrigger>
                <GraduationCap className="w-4 h-4 mr-2 opacity-50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDUCATIONAL_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">{level.tier}</span>
                      {level.label}
                      <span className="text-xs text-muted-foreground">({level.ages})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Capacity */}
          <div className="space-y-2">
            <Label htmlFor="capacity">Maximum Students</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              max="100"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>

          {/* Info */}
          <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
            A unique invite code will be generated automatically. Students use this code to join your class.
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !subjectName}>
              {loading ? "Creating..." : "Create Class"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
