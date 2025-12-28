import { useState, useEffect } from "react";
import { X, Users, ClipboardList, Megaphone, Settings, Search, Download, UserMinus, Trash2, ExternalLink, RefreshCw, Copy, Calendar, Clock, Eye, CalendarX, MoreHorizontal, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, differenceInDays } from "date-fns";
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
  onGroupUpdated: () => void;
  onDeleteGroup: () => void;
}

export const ClassDetailPanel = ({
  open,
  onOpenChange,
  groupId,
  groupName,
  inviteCode,
  onGroupUpdated,
  onDeleteGroup,
}: ClassDetailPanelProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("students");
  
  // Students state
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "joined" | "activity">("name");
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  
  // Assignments state
  const [assignments, setAssignments] = useState<GroupAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentFilter, setAssignmentFilter] = useState<"active" | "past">("active");
  
  // Announcements state
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState("");
  const [newAnnouncementMessage, setNewAnnouncementMessage] = useState("");
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<string | null>(null);
  
  // Settings state
  const [editName, setEditName] = useState(groupName);
  const [savingSettings, setSavingSettings] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  // Fetch assignments
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
          exams!exam_assignments_exam_id_fkey(title)
        `)
        .eq("target_id", groupId)
        .eq("assignment_type", "group")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get completion counts
      const assignmentsWithCounts = await Promise.all(
        (data || []).map(async (assignment) => {
          const { count } = await supabase
            .from("exam_submissions")
            .select("*", { count: "exact", head: true })
            .eq("exam_id", assignment.exam_id)
            .eq("status", "completed");

          return {
            id: assignment.id,
            exam_id: assignment.exam_id,
            exam_title: (assignment.exams as any)?.title || "Untitled",
            deadline: assignment.deadline,
            created_at: assignment.created_at,
            is_active: assignment.is_active,
            completion_count: count || 0,
            total_students: members.length,
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

  useEffect(() => {
    if (open) {
      fetchMembers();
      fetchAnnouncements();
      setEditName(groupName);
      setSearchQuery("");
    }
  }, [open, groupId, groupName]);

  useEffect(() => {
    if (open && members.length >= 0) {
      fetchAssignments();
    }
  }, [open, members.length]);

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
      if (sortBy === "name") {
        return (a.display_name || "").localeCompare(b.display_name || "");
      }
      return new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime();
    });

  // Filter assignments
  const filteredAssignments = assignments.filter(a => {
    if (assignmentFilter === "active") return a.is_active;
    return !a.is_active || (a.deadline && isPast(new Date(a.deadline)));
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

      // Send notifications
      const { data: groupMembers } = await supabase
        .from("group_members")
        .select("student_id")
        .eq("group_id", groupId)
        .eq("is_active", true);

      if (groupMembers && groupMembers.length > 0) {
        await supabase.from("notifications").insert(
          groupMembers.map(m => ({
            user_id: m.student_id,
            type: "announcement",
            title: newAnnouncementTitle.trim(),
            body: newAnnouncementMessage.trim(),
          }))
        );
      }

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
      const { error } = await supabase
        .from("student_groups")
        .update({ name: editName.trim() })
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

  const getDeadlineStatus = (deadline: string | null) => {
    if (!deadline) return { text: "No deadline", color: "text-muted-foreground" };
    const days = differenceInDays(new Date(deadline), new Date());
    if (days < 0) return { text: "Overdue", color: "text-destructive" };
    if (days === 0) return { text: "Due today", color: "text-warning" };
    if (days <= 3) return { text: `Due in ${days}d`, color: "text-warning" };
    return { text: format(new Date(deadline), "MMM d"), color: "text-muted-foreground" };
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl">{groupName}</SheetTitle>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-4 mx-4 mt-4">
              <TabsTrigger value="students" className="gap-1.5">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Students</span>
              </TabsTrigger>
              <TabsTrigger value="assignments" className="gap-1.5">
                <ClipboardList className="w-4 h-4" />
                <span className="hidden sm:inline">Tasks</span>
              </TabsTrigger>
              <TabsTrigger value="announcements" className="gap-1.5">
                <Megaphone className="w-4 h-4" />
                <span className="hidden sm:inline">News</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            {/* STUDENTS TAB */}
            <TabsContent value="students" className="flex-1 flex flex-col mt-0 px-4 pb-4">
              <div className="flex gap-2 my-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">By Name</SelectItem>
                    <SelectItem value="joined">By Joined</SelectItem>
                  </SelectContent>
                </Select>
                {members.length > 0 && (
                  <Button variant="outline" size="icon" onClick={handleExportMembers}>
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1">
                {membersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>{searchQuery ? "No students match your search" : "No students yet"}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {member.display_name?.[0]?.toUpperCase() || "S"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {member.display_name || "Student"}
                              {member.student_code && (
                                <span className="text-muted-foreground ml-1.5 font-mono text-xs">
                                  {member.student_code}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Joined {format(new Date(member.joined_at), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setMemberToRemove(member); setRemoveDialogOpen(true); }}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* ASSIGNMENTS TAB */}
            <TabsContent value="assignments" className="flex-1 flex flex-col mt-0 px-4 pb-4">
              <div className="flex gap-2 my-4">
                <div className="flex bg-muted rounded-lg p-1 flex-1">
                  <button
                    onClick={() => setAssignmentFilter("active")}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                      assignmentFilter === "active" ? "bg-background shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setAssignmentFilter("past")}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                      assignmentFilter === "past" ? "bg-background shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    Past
                  </button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                {assignmentsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : filteredAssignments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No {assignmentFilter} assignments</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAssignments.map((assignment) => {
                      const deadlineStatus = getDeadlineStatus(assignment.deadline);
                      return (
                        <div
                          key={assignment.id}
                          className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm">{assignment.exam_title}</h4>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Results
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Calendar className="w-4 h-4 mr-2" />
                                  Extend Deadline
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">
                                  <CalendarX className="w-4 h-4 mr-2" />
                                  Unassign
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className={deadlineStatus.color}>
                              <Clock className="w-3 h-3 inline mr-1" />
                              {deadlineStatus.text}
                            </span>
                            <span>
                              {assignment.completion_count}/{assignment.total_students} completed
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* ANNOUNCEMENTS TAB */}
            <TabsContent value="announcements" className="flex-1 flex flex-col mt-0 px-4 pb-4">
              <div className="my-4 space-y-3">
                <Input
                  placeholder="Announcement title..."
                  value={newAnnouncementTitle}
                  onChange={(e) => setNewAnnouncementTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Write your message..."
                  value={newAnnouncementMessage}
                  onChange={(e) => setNewAnnouncementMessage(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <Button 
                  onClick={handlePostAnnouncement} 
                  disabled={postingAnnouncement || !newAnnouncementTitle.trim() || !newAnnouncementMessage.trim()}
                  className="w-full"
                >
                  {postingAnnouncement ? "Posting..." : "Post Announcement"}
                </Button>
              </div>

              <Separator className="my-2" />

              <ScrollArea className="flex-1">
                {announcementsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : announcements.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Megaphone className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No announcements yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 py-2">
                    {announcements.map((announcement) => (
                      <div
                        key={announcement.id}
                        className="p-3 rounded-lg bg-muted/30"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="font-medium text-sm">{announcement.title}</h4>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setAnnouncementToDelete(announcement.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {format(new Date(announcement.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        <p className="text-sm text-muted-foreground">{announcement.message}</p>
                        {announcement.attachment_url && (
                          <a
                            href={announcement.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Attachment
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* SETTINGS TAB */}
            <TabsContent value="settings" className="flex-1 flex flex-col mt-0 px-4 pb-4">
              <div className="space-y-6 py-4">
                {/* Rename */}
                <div className="space-y-2">
                  <Label>Class Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter class name"
                  />
                  <Button onClick={handleSaveSettings} disabled={savingSettings} className="w-full mt-2">
                    {savingSettings ? "Saving..." : "Save Changes"}
                  </Button>
                </div>

                <Separator />

                {/* Invite Code */}
                <div className="space-y-2">
                  <Label>Invite Code</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm">
                      {inviteCode || "N/A"}
                    </div>
                    <Button variant="outline" size="icon" onClick={handleCopyInvite}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleRegenerateCode} disabled={regeneratingCode}>
                      <RefreshCw className={`w-4 h-4 ${regeneratingCode ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Regenerating will invalidate the old code. Existing members will not be affected.
                  </p>
                </div>

                <Separator />

                {/* Danger Zone */}
                <div className="space-y-2">
                  <Label className="text-destructive">Danger Zone</Label>
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:bg-destructive/10 border-destructive/30"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Archive Class
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Archiving will hide this class. Members will lose access but data is preserved.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

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

      {/* Delete Class Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Class?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive "{groupName}" and remove access for all members.
              The data will be preserved and can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onDeleteGroup(); setDeleteDialogOpen(false); onOpenChange(false); }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
