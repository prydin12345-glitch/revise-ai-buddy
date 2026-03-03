import { useState, useEffect, useMemo, useRef } from "react";
import { X, Users, ClipboardList, Megaphone, Settings, Search, Download, UserMinus, Trash2, ExternalLink, RefreshCw, Copy, Calendar, Clock, Eye, CalendarX, MoreHorizontal, Archive, ArrowUpDown, CheckCircle2, BookOpen, ChevronDown, GraduationCap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, isPast } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditDeadlineModal } from "./EditDeadlineModal";
import { ExamResultsModal } from "./ExamResultsModal";
import { DestructiveConfirmationModal } from "./DestructiveConfirmationModal";
import { getDeadlineStatus } from "@/lib/deadline-utils";
import { ClassSubtopicsTab } from "./ClassSubtopicsTab";

interface GroupMember {
  id: string;
  student_id: string;
  joined_at: string;
  display_name: string | null;
  student_code: string | null;
  last_activity?: string | null;
}

interface GroupAssignment {
  id: string;
  exam_id: string;
  exam_title: string;
  deadline: string | null;
  created_at: string;
  is_active: boolean;
  is_grades_released: boolean;
  completion_count: number;
  total_students: number;
}

interface GroupAnnouncement {
  id: string;
  title: string;
  message: string;
  attachment_url: string | null;
  created_at: string;
}

interface ClassDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  inviteCode: string | null;
  subjectsTaught?: string[];
  educationalLevel?: string;
  onGroupUpdated: () => void;
  onDeleteGroup: () => void;
}

export const ClassDetailPanel = ({
  open,
  onOpenChange,
  groupId,
  groupName,
  inviteCode,
  subjectsTaught = [],
  educationalLevel,
  onGroupUpdated,
  onDeleteGroup,
}: ClassDetailPanelProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("students");
  
  // Students state
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc" | "joined">("name-asc");
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  
  // Assignments state
  const [assignments, setAssignments] = useState<GroupAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentFilter, setAssignmentFilter] = useState<"active" | "past">("active");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentSort, setAssignmentSort] = useState<"due-soonest" | "due-latest" | "completion">("due-soonest");
  
  // Assignment actions state
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<GroupAssignment | null>(null);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [unassignModalOpen, setUnassignModalOpen] = useState(false);
  const [assignmentToUnassign, setAssignmentToUnassign] = useState<GroupAssignment | null>(null);
  
  // Announcements state
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState("");
  const [newAnnouncementMessage, setNewAnnouncementMessage] = useState("");
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<string | null>(null);
  const [announcementSearch, setAnnouncementSearch] = useState("");
  
  // Settings state
  const [editName, setEditName] = useState(groupName);
  const [savingSettings, setSavingSettings] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);

  // Subject & Level editing state
  const [editSubject, setEditSubject] = useState(subjectsTaught[0] || "");
  const [editLevel, setEditLevel] = useState(educationalLevel || "sixth_form");
  const [subjectChangeWarningOpen, setSubjectChangeWarningOpen] = useState(false);
  const [pendingSubject, setPendingSubject] = useState<{ id: string | null; name: string; slug: string | null } | null>(null);
  const [subjectSearchOpen, setSubjectSearchOpen] = useState(false);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState("");
  const [subjectOptions, setSubjectOptions] = useState<Array<{ id: string; name: string; category: string; slug: string }>>([]);
  const subjectSearchRef = useRef<HTMLInputElement>(null);

  const EDUCATIONAL_LEVELS = [
    { value: "secondary", label: "High School / Secondary", shortLabel: "Level 1 — High School", tier: "Level 1" },
    { value: "sixth_form", label: "College / Sixth Form", shortLabel: "Level 2 — College", tier: "Level 2" },
    { value: "university", label: "University / Undergraduate", shortLabel: "Level 3 — University", tier: "Level 3" },
  ];

  const CATEGORY_ORDER = ["maths", "sciences", "humanities", "languages", "other"];
  const CATEGORY_LABELS: Record<string, string> = {
    maths: "Mathematics",
    sciences: "Sciences & Engineering",
    humanities: "Humanities & Social Sciences",
    languages: "Languages",
    other: "Creative & Applied",
  };

  // Fetch members
  const fetchMembers = async () => {
    setMembersLoading(true);
    try {
      const { data, error } = await supabase
        .from("group_members")
        .select(`
          id,
          student_id,
          joined_at,
          user_profiles!group_members_student_id_fkey(display_name, student_code)
        `)
        .eq("group_id", groupId)
        .eq("is_active", true)
        .order("joined_at", { ascending: false });

      if (error) throw error;

      const formattedMembers = (data || []).map(member => ({
        id: member.id,
        student_id: member.student_id,
        joined_at: member.joined_at,
        display_name: (member.user_profiles as any)?.display_name || null,
        student_code: (member.user_profiles as any)?.student_code || null,
      }));

      setMembers(formattedMembers);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setMembersLoading(false);
    }
  };

  // Fetch assignments with CORRECT completion counts
  // Must match the same dataset used in ExamResultsModal
  const fetchAssignments = async () => {
    setAssignmentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("exam_assignments")
        .select(`
          id,
          exam_id,
          deadline,
          created_at,
          is_active,
          is_grades_released,
          exams!exam_assignments_exam_id_fkey(title)
        `)
        .eq("target_id", groupId)
        .eq("assignment_type", "group")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get active member IDs for this group - this is the assigned student list
      const activeMemberIds = members.map(m => m.student_id);
      
      // Get completion counts - ONLY count submissions from active group members
      const assignmentsWithCounts = await Promise.all(
        (data || []).map(async (assignment) => {
          if (activeMemberIds.length === 0) {
            return {
              id: assignment.id,
              exam_id: assignment.exam_id,
              exam_title: (assignment.exams as any)?.title || "Untitled",
              deadline: assignment.deadline,
              created_at: assignment.created_at,
              is_active: assignment.is_active,
              is_grades_released: assignment.is_grades_released ?? false,
              completion_count: 0,
              total_students: 0,
            };
          }

          // Count submissions from ONLY active group members with status submitted or graded
          const { data: submissions } = await supabase
            .from("exam_submissions")
            .select("student_id, status")
            .eq("exam_id", assignment.exam_id)
            .in("student_id", activeMemberIds)
            .in("status", ["submitted", "graded"]);

          const completedCount = submissions?.length || 0;

          return {
            id: assignment.id,
            exam_id: assignment.exam_id,
            exam_title: (assignment.exams as any)?.title || "Untitled",
            deadline: assignment.deadline,
            created_at: assignment.created_at,
            is_active: assignment.is_active,
            is_grades_released: assignment.is_grades_released ?? false,
            completion_count: completedCount,
            total_students: activeMemberIds.length,
          };
        })
      );

      setAssignments(assignmentsWithCounts);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  // Fetch announcements
  const fetchAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const { data, error } = await supabase
        .from("group_announcements")
        .select("id, title, message, attachment_url, created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error("Error fetching announcements:", error);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  // Load subject options for Settings editor
  useEffect(() => {
    const loadSubjects = async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, category, slug")
        .eq("is_active", true)
        .order("name");
      if (!error && data) setSubjectOptions(data);
    };
    loadSubjects();
  }, []);

  useEffect(() => {
    if (subjectSearchOpen && subjectSearchRef.current) {
      setTimeout(() => subjectSearchRef.current?.focus(), 100);
    }
  }, [subjectSearchOpen]);

  const filteredSubjectOptions = useMemo(() => {
    const query = subjectSearchQuery.toLowerCase().trim();
    const filtered = query
      ? subjectOptions.filter(s => s.name.toLowerCase().includes(query))
      : subjectOptions;

    const grouped: Record<string, typeof subjectOptions> = {};
    for (const s of filtered) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }

    return CATEGORY_ORDER
      .filter(cat => grouped[cat]?.length)
      .map(cat => ({ category: cat, label: CATEGORY_LABELS[cat] || cat, subjects: grouped[cat] }));
  }, [subjectOptions, subjectSearchQuery]);

  useEffect(() => {
    if (open) {
      fetchMembers();
      fetchAnnouncements();
      setEditName(groupName);
      setEditSubject(subjectsTaught[0] || "");
      setEditLevel(educationalLevel || "sixth_form");
      setSearchQuery("");
      setAssignmentSearch("");
      setAnnouncementSearch("");
      setSettingsDirty(false);
    }
  }, [open, groupId, groupName]);

  useEffect(() => {
    if (open && members.length >= 0) {
      fetchAssignments();
    }
  }, [open, members.length]);

  // Track settings dirty state
  useEffect(() => {
    const nameChanged = editName !== groupName;
    const subjectChanged = editSubject !== (subjectsTaught[0] || "");
    const levelChanged = editLevel !== (educationalLevel || "sixth_form");
    setSettingsDirty(nameChanged || subjectChanged || levelChanged);
  }, [editName, groupName, editSubject, subjectsTaught, editLevel, educationalLevel]);

  // Filter and sort members
  const filteredMembers = members
    .filter(member => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        member.display_name?.toLowerCase().includes(query) ||
        member.student_code?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (sortBy === "name-asc") {
        return (a.display_name || "").localeCompare(b.display_name || "");
      }
      if (sortBy === "name-desc") {
        return (b.display_name || "").localeCompare(a.display_name || "");
      }
      return new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime();
    });

  // Filter and sort assignments
  const filteredAssignments = assignments
    .filter(a => {
      // Filter by status
      if (assignmentFilter === "active" && !a.is_active) return false;
      if (assignmentFilter === "past" && (a.is_active && (!a.deadline || !isPast(new Date(a.deadline))))) return false;
      // Filter by search
      if (assignmentSearch && !a.exam_title.toLowerCase().includes(assignmentSearch.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (assignmentSort === "due-soonest") {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (assignmentSort === "due-latest") {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
      }
      // completion ratio
      const ratioA = a.total_students > 0 ? a.completion_count / a.total_students : 0;
      const ratioB = b.total_students > 0 ? b.completion_count / b.total_students : 0;
      return ratioB - ratioA;
    });

  // Filter announcements
  const filteredAnnouncements = announcements.filter(a => {
    if (!announcementSearch) return true;
    const q = announcementSearch.toLowerCase();
    return a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q);
  });

  // Handlers
  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      const { error } = await supabase
        .from("group_members")
        .update({ is_active: false })
        .eq("id", memberToRemove.id);

      if (error) throw error;

      toast({ title: "Student removed", description: `${memberToRemove.display_name || "Student"} has been removed` });
      fetchMembers();
      onGroupUpdated();
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove student", variant: "destructive" });
    } finally {
      setRemoveDialogOpen(false);
      setMemberToRemove(null);
    }
  };

  const handlePostAnnouncement = async () => {
    if (!newAnnouncementTitle.trim() || !newAnnouncementMessage.trim()) {
      toast({ title: "Error", description: "Please fill in title and message", variant: "destructive" });
      return;
    }

    setPostingAnnouncement(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("group_announcements")
        .insert({
          group_id: groupId,
          tutor_id: user.id,
          title: newAnnouncementTitle.trim(),
          message: newAnnouncementMessage.trim(),
        });

      if (error) throw error;

      // Send notifications using secure RPC
      await supabase.rpc("create_group_announcement_notifications", {
        p_group_id: groupId,
        p_type: "announcement",
        p_title: newAnnouncementTitle.trim(),
        p_body: newAnnouncementMessage.trim(),
        p_action_data: null,
      });

      toast({ title: "Announcement posted" });
      setNewAnnouncementTitle("");
      setNewAnnouncementMessage("");
      fetchAnnouncements();
    } catch (error) {
      toast({ title: "Error", description: "Failed to post announcement", variant: "destructive" });
    } finally {
      setPostingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!announcementToDelete) return;
    try {
      const { error } = await supabase
        .from("group_announcements")
        .delete()
        .eq("id", announcementToDelete);

      if (error) throw error;
      toast({ title: "Announcement deleted" });
      fetchAnnouncements();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    } finally {
      setAnnouncementToDelete(null);
    }
  };

  const handleSaveSettings = async () => {
    if (!editName.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }

    setSavingSettings(true);
    try {
      const levelInfo = EDUCATIONAL_LEVELS.find(l => l.value === editLevel);

      const { error } = await supabase
        .from("student_groups")
        .update({
          name: editName.trim(),
          subjects_covered: editSubject ? [editSubject] : [],
          settings: {
            educational_level: editLevel,
            educational_tier: levelInfo?.tier || "Level 2",
          },
        })
        .eq("id", groupId);

      if (error) throw error;
      toast({ title: "Settings saved" });
      onGroupUpdated();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSubjectSelection = (subject: { id: string; name: string; slug: string }) => {
    if (editSubject && editSubject.toLowerCase() !== subject.name.toLowerCase()) {
      // Subject is changing — show warning
      setPendingSubject(subject);
      setSubjectChangeWarningOpen(true);
    } else {
      setEditSubject(subject.name);
    }
    setSubjectSearchOpen(false);
    setSubjectSearchQuery("");
  };

  const confirmSubjectChange = async () => {
    if (!pendingSubject) return;
    setEditSubject(pendingSubject.name);
    setSubjectChangeWarningOpen(false);
    setPendingSubject(null);

    // Clear existing master topics and profiles for old subject
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const oldSubject = subjectsTaught[0];
      if (oldSubject) {
        await Promise.all([
          supabase
            .from("subject_master_topics")
            .delete()
            .eq("user_id", user.id)
            .eq("subject_name", oldSubject),
          supabase
            .from("subject_exam_profiles")
            .delete()
            .eq("user_id", user.id)
            .eq("subject_name", oldSubject),
        ]);
      }

      toast({ title: "Subject changed", description: "Previous topics and profiles have been cleared" });
    } catch (err) {
      console.error("Error clearing old subject data:", err);
    }
  };

  const handleRegenerateCode = async () => {
    setRegeneratingCode(true);
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const newCode = `EXM-${code}`;

      const { error } = await supabase
        .from("student_groups")
        .update({ invite_code: newCode })
        .eq("id", groupId);

      if (error) throw error;
      toast({ title: "Invite code regenerated", description: `New code: ${newCode}` });
      onGroupUpdated();
    } catch (error) {
      toast({ title: "Error", description: "Failed to regenerate code", variant: "destructive" });
    } finally {
      setRegeneratingCode(false);
    }
  };

  const handleCopyInvite = () => {
    if (!inviteCode) return;
    const link = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Copied!", description: "Invite link copied" });
  };

  const handleExportMembers = () => {
    const csv = [
      ["Name", "Student ID", "Joined Date"],
      ...members.map(m => [
        m.display_name || "Unknown",
        m.student_code || "N/A",
        format(new Date(m.joined_at), "yyyy-MM-dd")
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${groupName}-members.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Member list downloaded" });
  };

  // Assignment action handlers
  const handleViewResults = (assignment: GroupAssignment) => {
    setSelectedAssignment(assignment);
    setResultsModalOpen(true);
  };

  const handleExtendDeadline = (assignment: GroupAssignment) => {
    setSelectedAssignment(assignment);
    setDeadlineModalOpen(true);
  };

  const handleDeadlineUpdated = () => {
    fetchAssignments();
    toast({ title: "Deadline updated", description: "Students will be notified of the change" });
  };

  const handleUnassignClick = (assignment: GroupAssignment) => {
    setAssignmentToUnassign(assignment);
    setUnassignModalOpen(true);
  };

  const handleUnassign = async () => {
    if (!assignmentToUnassign) return;

    // Optimistic update
    const previousAssignments = [...assignments];
    setAssignments(prev => prev.filter(a => a.id !== assignmentToUnassign.id));

    try {
      const { error } = await supabase
        .from("exam_assignments")
        .update({ is_active: false })
        .eq("id", assignmentToUnassign.id);

      if (error) throw error;

      toast({ title: "Unassigned", description: `"${assignmentToUnassign.exam_title}" has been unassigned from this class` });
      setAssignmentToUnassign(null);
      
      // Background re-fetch for consistency
      fetchAssignments();
    } catch (error) {
      // Rollback on error
      setAssignments(previousAssignments);
      toast({ title: "Error", description: "Failed to unassign exam", variant: "destructive" });
      throw error;
    }
  };

  const handleArchiveClass = async () => {
    onDeleteGroup();
  };

  // Calculate stats for header
  const activeAssignmentsCount = assignments.filter(a => a.is_active).length;
  const subjectDisplay = subjectsTaught.length > 0 ? subjectsTaught[0] : "General";
  const levelLabels: Record<string, string> = {
    secondary: "Level 1 — High School",
    sixth_form: "Level 2 — College",
    university: "Level 3 — University",
  };
  const levelDisplay = educationalLevel ? levelLabels[educationalLevel] || educationalLevel : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="p-0 gap-0 overflow-hidden rounded-2xl border-white/10 bg-card shadow-2xl backdrop-blur-sm grid grid-rows-[88px_56px_1fr]"
          style={{ 
            width: 'min(980px, 100vw)', 
            height: 'min(720px, 86vh)',
            maxWidth: '100vw',
            maxHeight: 'none'
          }}
          hideCloseButton
        >
          {/* Fixed Header - 88px */}
          <div className="flex items-center justify-between px-6 border-b border-border/50 bg-card h-full">
            <div className="space-y-1.5">
              <DialogTitle className="text-xl font-semibold tracking-tight">{groupName}</DialogTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="font-normal">{subjectDisplay}</Badge>
                {levelDisplay && (
                  <Badge variant="outline" className="font-normal text-xs">{levelDisplay}</Badge>
                )}
                <span className="text-muted-foreground/60">•</span>
                <span>{members.length} student{members.length !== 1 ? "s" : ""}</span>
                <span className="text-muted-foreground/60">•</span>
                <span>{activeAssignmentsCount} active assignment{activeAssignmentsCount !== 1 ? "s" : ""}</span>
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)}
              className="rounded-full hover:bg-muted/50"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Fixed Tabs Bar - 56px */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="contents">
            <div className="relative border-b border-border/30 bg-card/50 h-full">
              <div className="px-6 flex items-end h-full overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
                <TabsList className="bg-transparent p-0 h-auto gap-1 flex-nowrap whitespace-nowrap">
                  <TabsTrigger 
                    value="students" 
                    className="gap-2 px-4 py-2.5 data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary shrink-0"
                  >
                    <Users className="w-4 h-4" />
                    Students
                  </TabsTrigger>
                  <TabsTrigger 
                    value="assignments" 
                    className="gap-2 px-4 py-2.5 data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary shrink-0"
                  >
                    <ClipboardList className="w-4 h-4" />
                    Tasks
                  </TabsTrigger>
                  <TabsTrigger 
                    value="subtopics" 
                    className="gap-2 px-4 py-2.5 data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary shrink-0"
                  >
                    <BookOpen className="w-4 h-4" />
                    Sub-topics
                  </TabsTrigger>
                  <TabsTrigger 
                    value="announcements" 
                    className="gap-2 px-4 py-2.5 data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary shrink-0"
                  >
                    <Megaphone className="w-4 h-4" />
                    News
                  </TabsTrigger>
                  <TabsTrigger 
                    value="settings" 
                    className="gap-2 px-4 py-2.5 data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary shrink-0"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </TabsTrigger>
                </TabsList>
              </div>
              {/* Fade indicator for mobile scroll */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card/90 to-transparent pointer-events-none md:hidden" />
            </div>

            {/* Scrollable Content Body - 1fr */}
            <div className="overflow-y-auto overflow-x-hidden">
              {/* STUDENTS TAB */}
              <TabsContent value="students" className="m-0 p-5 space-y-4 data-[state=inactive]:hidden">
                {/* Controls Row */}
                <div className="flex gap-2 flex-wrap sm:flex-nowrap overflow-x-auto scrollbar-none">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search students..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-muted/30 border-border/50"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger className="w-[140px] bg-muted/30 border-border/50">
                      <ArrowUpDown className="w-3.5 h-3.5 mr-2 opacity-50" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name-asc">Name A–Z</SelectItem>
                      <SelectItem value="name-desc">Name Z–A</SelectItem>
                      <SelectItem value="joined">Recently Joined</SelectItem>
                    </SelectContent>
                  </Select>
                  {members.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handleExportMembers} className="border-border/50">
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Export to CSV</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Student List */}
                {membersLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-muted/50" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-32 bg-muted/50 rounded" />
                          <div className="h-3 w-24 bg-muted/40 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{searchQuery ? "No students match your search" : "No students yet"}</p>
                    {!searchQuery && inviteCode && (
                      <p className="text-sm mt-1">Share your invite code <span className="font-mono text-primary">{inviteCode}</span> to add students</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 min-h-[48px] rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors border border-border/30 group"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-border/50">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                              {member.display_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || "S"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm flex items-center gap-2">
                              {member.display_name || "Student"}
                              {member.student_code && (
                                <span className="text-muted-foreground font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded">
                                  {member.student_code}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Joined {format(new Date(member.joined_at), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View profile</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setMemberToRemove(member); setRemoveDialogOpen(true); }}
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <UserMinus className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remove from class</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ASSIGNMENTS TAB */}
              <TabsContent value="assignments" className="m-0 p-5 space-y-4 data-[state=inactive]:hidden">
                {/* Controls */}
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search assignments..."
                      value={assignmentSearch}
                      onChange={(e) => setAssignmentSearch(e.target.value)}
                      className="pl-9 bg-muted/30 border-border/50"
                    />
                  </div>
                  <div className="flex bg-muted/30 rounded-lg p-1 border border-border/50">
                    <button
                      onClick={() => setAssignmentFilter("active")}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        assignmentFilter === "active" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => setAssignmentFilter("past")}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        assignmentFilter === "past" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Past
                    </button>
                  </div>
                  <Select value={assignmentSort} onValueChange={(v: any) => setAssignmentSort(v)}>
                    <SelectTrigger className="w-[150px] bg-muted/30 border-border/50">
                      <ArrowUpDown className="w-3.5 h-3.5 mr-2 opacity-50" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="due-soonest">Due soonest</SelectItem>
                      <SelectItem value="due-latest">Due latest</SelectItem>
                      <SelectItem value="completion">Most completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Assignment List */}
                {assignmentsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="p-4 rounded-xl bg-muted/20 animate-pulse">
                        <div className="h-4 w-48 bg-muted/50 rounded mb-3" />
                        <div className="flex gap-3">
                          <div className="h-5 w-20 bg-muted/40 rounded" />
                          <div className="h-5 w-32 bg-muted/40 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredAssignments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No {assignmentFilter} assignments</p>
                    <p className="text-sm mt-1">Assign exams from the Exams page</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAssignments.map((assignment) => {
                      const deadlineStatus = getDeadlineStatus(assignment.deadline);
                      const completionPercent = assignment.total_students > 0 
                        ? Math.round((assignment.completion_count / assignment.total_students) * 100) 
                        : 0;
                      
                      // Determine badge display: Results released takes priority over overdue
                      const showResultsReleased = assignment.is_grades_released;
                      const badgeConfig = showResultsReleased
                        ? {
                            text: "Results released",
                            className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
                            icon: <CheckCircle2 className="w-3 h-3 mr-1" />
                          }
                        : {
                            text: deadlineStatus.text,
                            className: deadlineStatus.className,
                            icon: <Clock className="w-3 h-3 mr-1" />
                          };
                      
                      return (
                        <div
                          key={assignment.id}
                          className="p-4 min-h-[48px] rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors border border-border/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{assignment.exam_title}</h4>
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs font-normal ${badgeConfig.className}`}
                                >
                                  {badgeConfig.icon}
                                  {badgeConfig.text}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {assignment.completion_count}/{assignment.total_students} completed ({completionPercent}%)
                                </span>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 hover:bg-muted/60">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-[60]">
                                <DropdownMenuItem onClick={() => handleViewResults(assignment)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Results
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExtendDeadline(assignment)}>
                                  <Calendar className="w-4 h-4 mr-2" />
                                  Extend Deadline
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleUnassignClick(assignment)}
                                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                  <CalendarX className="w-4 h-4 mr-2" />
                                  Unassign
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* SUB-TOPICS TAB */}
              <TabsContent value="subtopics" className="m-0 p-5 data-[state=inactive]:hidden">
                <ClassSubtopicsTab groupId={groupId} subjectsTaught={subjectsTaught} />
              </TabsContent>

              {/* ANNOUNCEMENTS TAB */}
              <TabsContent value="announcements" className="m-0 p-5 space-y-4 data-[state=inactive]:hidden">
                {/* Composer */}
                <div className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border/30">
                  <Input
                    placeholder="Announcement title..."
                    value={newAnnouncementTitle}
                    onChange={(e) => setNewAnnouncementTitle(e.target.value)}
                    className="bg-background/50 border-border/50"
                  />
                  <Textarea
                    placeholder="Write your message..."
                    value={newAnnouncementMessage}
                    onChange={(e) => setNewAnnouncementMessage(e.target.value)}
                    rows={3}
                    className="resize-none bg-background/50 border-border/50"
                  />
                  <Button 
                    onClick={handlePostAnnouncement} 
                    disabled={postingAnnouncement || !newAnnouncementTitle.trim() || !newAnnouncementMessage.trim()}
                    className="w-full"
                  >
                    {postingAnnouncement ? "Posting..." : "Post Announcement"}
                  </Button>
                </div>

                {/* Search for announcements */}
                {announcements.length > 3 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search announcements..."
                      value={announcementSearch}
                      onChange={(e) => setAnnouncementSearch(e.target.value)}
                      className="pl-9 bg-muted/30 border-border/50"
                    />
                  </div>
                )}

                {/* Announcement List */}
                {announcementsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map(i => (
                      <div key={i} className="p-4 rounded-xl bg-muted/20 animate-pulse">
                        <div className="flex justify-between mb-2">
                          <div className="h-4 w-40 bg-muted/50 rounded" />
                          <div className="h-6 w-6 bg-muted/40 rounded" />
                        </div>
                        <div className="h-3 w-24 bg-muted/40 rounded mb-3" />
                        <div className="space-y-2">
                          <div className="h-3 w-full bg-muted/30 rounded" />
                          <div className="h-3 w-3/4 bg-muted/30 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredAnnouncements.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{announcementSearch ? "No announcements match your search" : "No announcements yet"}</p>
                    <p className="text-sm mt-1">Post your first announcement above</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAnnouncements.map((announcement) => (
                      <div
                        key={announcement.id}
                        className="p-4 rounded-xl bg-muted/20 border border-border/30"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <h4 className="font-medium text-sm">{announcement.title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(announcement.created_at), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                onClick={() => setAnnouncementToDelete(announcement.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete announcement</TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-sm text-muted-foreground">{announcement.message}</p>
                        {announcement.attachment_url && (
                          <a
                            href={announcement.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline mt-3 inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Attachment
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* SETTINGS TAB */}
              <TabsContent value="settings" className="m-0 p-5 space-y-6 data-[state=inactive]:hidden">
                {/* Save button at top */}
                <div className="flex items-center justify-end">
                  <Button 
                    onClick={handleSaveSettings} 
                    disabled={savingSettings || !settingsDirty} 
                    size="sm"
                    className={!settingsDirty ? "opacity-50" : ""}
                  >
                    {savingSettings ? "Saving..." : "Save Changes"}
                  </Button>
                </div>

                {/* Class Name */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Class Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter class name"
                    className="bg-muted/30 border-border/50"
                  />
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Subject</Label>
                  <Popover open={subjectSearchOpen} onOpenChange={setSubjectSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between font-normal"
                      >
                        {editSubject || "Select subject..."}
                        <ChevronDown className="w-4 h-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 max-h-[320px] overflow-hidden" align="start">
                      <div className="p-2 border-b border-border/50">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            ref={subjectSearchRef}
                            placeholder="Type to search..."
                            value={subjectSearchQuery}
                            onChange={(e) => setSubjectSearchQuery(e.target.value)}
                            className="pl-8 h-9 bg-muted/30 border-border/50"
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto max-h-[240px] p-1">
                        {filteredSubjectOptions.length === 0 ? (
                          <div className="py-6 text-center text-sm text-muted-foreground">No subjects found</div>
                        ) : (
                          filteredSubjectOptions.map((group) => (
                            <div key={group.category}>
                              <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</p>
                              {group.subjects.map((subject) => (
                                <button
                                  key={subject.id}
                                  type="button"
                                  onClick={() => handleSubjectSelection(subject)}
                                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                                >
                                  {subject.name}
                                </button>
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Educational Level */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Educational Level</Label>
                  <Select value={editLevel} onValueChange={setEditLevel}>
                    <SelectTrigger className="bg-muted/30 border-border/50">
                      <GraduationCap className="w-4 h-4 mr-2 opacity-50" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EDUCATIONAL_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          <span className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">{level.tier}</span>
                            {level.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Changing the level adjusts difficulty metadata for future AI assignments.
                  </p>
                </div>

                <Separator className="bg-border/30" />

                <Separator className="bg-border/30" />

                {/* Invite Code Section */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Invite Code</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 px-4 py-2.5 bg-muted/30 rounded-lg font-mono text-sm border border-border/50 flex items-center">
                      {inviteCode || "N/A"}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handleCopyInvite} className="border-border/50">
                          <Copy className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy invite link</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handleRegenerateCode} disabled={regeneratingCode} className="border-border/50">
                          <RefreshCw className={`w-4 h-4 ${regeneratingCode ? "animate-spin" : ""}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Regenerate code</TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Regenerating will invalidate the old code. Existing members will not be affected.
                  </p>
                </div>

                {/* Spacer to push danger zone to bottom */}
                <div className="flex-1" />

                <Separator className="bg-border/30" />

                {/* Danger Zone - High contrast styling for readability */}
                <div className="p-4 rounded-xl border-2 border-[hsl(0_65%_55%)] bg-[hsl(0_50%_15%)] space-y-3">
                  <div className="flex items-center gap-2">
                    <Archive className="w-4 h-4 text-[hsl(0_75%_70%)]" />
                    <span className="text-sm font-semibold text-[hsl(0_70%_80%)]">Danger Zone</span>
                  </div>
                  <p className="text-sm text-[hsl(0_15%_80%)]">
                    Archiving hides this class. Members lose access but data is preserved.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="bg-[hsl(0_75%_55%)] hover:bg-[hsl(0_70%_48%)] text-white border border-[hsl(0_70%_50%)] shadow-[0_0_8px_hsl(0_75%_55%/0.4)]"
                    onClick={() => setArchiveModalOpen(true)}
                  >
                    Archive Class
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {memberToRemove?.display_name || "this student"} from the class?
              They can rejoin using the invite code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Announcement Dialog */}
      <AlertDialog open={!!announcementToDelete} onOpenChange={() => setAnnouncementToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This announcement will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAnnouncement} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unassign Exam Confirmation Modal */}
      <DestructiveConfirmationModal
        open={unassignModalOpen}
        onOpenChange={setUnassignModalOpen}
        title="Unassign Exam"
        description={`Remove "${assignmentToUnassign?.exam_title}" from ${groupName}?`}
        impactItems={[
          "Students will lose access to this exam",
          "In-progress attempts will be preserved",
          "Completed submissions are not affected"
        ]}
        confirmText={assignmentToUnassign?.exam_title || ""}
        confirmPlaceholder="Type exam title to confirm"
        onConfirm={handleUnassign}
        actionLabel="Unassign"
      />

      {/* Archive Class Confirmation Modal */}
      <DestructiveConfirmationModal
        open={archiveModalOpen}
        onOpenChange={setArchiveModalOpen}
        title="Archive Class"
        description={`Archive "${groupName}"? This action hides the class from all members.`}
        impactItems={[
          "All students will lose access",
          "Assignments remain but are hidden",
          "Data is preserved and can be restored"
        ]}
        confirmText={groupName}
        confirmPlaceholder="Type class name to confirm"
        onConfirm={handleArchiveClass}
        actionLabel="Archive Class"
      />

      {/* Edit Deadline Modal */}
      {selectedAssignment && (
        <EditDeadlineModal
          open={deadlineModalOpen}
          onOpenChange={(open) => {
            setDeadlineModalOpen(open);
            if (!open) setSelectedAssignment(null);
          }}
          examId={selectedAssignment.exam_id}
          examTitle={selectedAssignment.exam_title}
          currentDeadline={selectedAssignment.deadline}
          onUpdated={handleDeadlineUpdated}
        />
      )}

      {/* Exam Results Modal */}
      {selectedAssignment && (
        <ExamResultsModal
          open={resultsModalOpen}
          onOpenChange={(open) => {
            setResultsModalOpen(open);
            if (!open) setSelectedAssignment(null);
          }}
          examId={selectedAssignment.exam_id}
          examTitle={selectedAssignment.exam_title}
          groupId={groupId}
          groupName={groupName}
        />
      )}

      {/* Subject Change Warning Modal */}
      <AlertDialog open={subjectChangeWarningOpen} onOpenChange={setSubjectChangeWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Change Subject?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Changing the subject from <strong>{subjectsTaught[0]}</strong> to <strong>{pendingSubject?.name}</strong> will permanently delete all existing Sub-topics and Exam Profiles for this class. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSubject(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubjectChange} className="bg-destructive hover:bg-destructive/90">
              Change Subject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
