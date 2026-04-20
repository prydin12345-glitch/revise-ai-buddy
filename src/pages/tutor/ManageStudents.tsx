import { useState } from "react";
import { Users, Plus, Download, GraduationCap, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreateGroupModal } from "@/components/tutor/CreateGroupModal";
import { ClassCard } from "@/components/tutor/ClassCard";
import { ClassDetailPanel } from "@/components/tutor/ClassDetailPanel";
import { AnnouncementModal } from "@/components/tutor/AnnouncementModal";
import { useManageGroups } from "@/hooks/useManageGroups";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ManageStudents() {
  const { toast } = useToast();
  const { groups, loading, deleteGroup, refetch } = useManageGroups();

  // Fetch subjects for UUID resolution
  const { data: allSubjects } = useQuery({
    queryKey: ['subjects-lookup'],
    queryFn: async () => {
      const { data } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('is_active', true);
      return data ?? [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const resolveSubjects = (group: typeof groups[0]): string[] => {
    // Try settings.subject_name first
    if (group.settings?.subject_name) return [group.settings.subject_name];
    
    return group.subjects_covered.map(s => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(s);
      if (isUuid) {
        return allSubjects?.find(sub => sub.id === s)?.name ?? s;
      }
      return s;
    });
  };
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  const handleCopyInviteCode = (code: string | null) => {
    if (!code) {
      toast({
        title: "Error",
        description: "No invite code available",
        variant: "destructive",
      });
      return;
    }

    const inviteLink = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(inviteLink);
    toast({
      title: "Copied!",
      description: "Invite link copied to clipboard",
    });
  };

  const handleExportAnalytics = () => {
    const csv = [
      ["Group Name", "Invite Code", "Members", "Active Assignments", "Subjects"],
      ...groups.map(g => [
        g.name,
        g.invite_code || "N/A",
        g.member_count?.toString() || "0",
        g.assignment_count?.toString() || "0",
        g.subjects_covered.join("; ")
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `class-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Analytics exported",
      description: "CSV file downloaded successfully",
    });
  };

  const handleViewClass = (groupId: string) => {
    setSelectedGroupId(groupId);
    setDetailPanelOpen(true);
  };

  const handlePostAnnouncement = (groupId: string) => {
    setSelectedGroupId(groupId);
    setAnnouncementModalOpen(true);
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroupId) return;
    
    const success = await deleteGroup(selectedGroupId);
    if (success) {
      toast({
        title: "Class archived",
        description: "The class has been successfully archived",
      });
      refetch();
    }
  };

  // Stats - only count active members (already filtered in useManageGroups)
  const totalStudents = groups.reduce((sum, g) => sum + g.member_count, 0);
  const totalAssignments = groups.reduce((sum, g) => sum + g.assignment_count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Classes</h1>
          <p className="text-muted-foreground mt-1">
            Manage your student classes, assignments, and announcements
          </p>
        </div>
        <div className="flex gap-2">
          {groups.length > 0 && (
            <Button variant="outline" onClick={handleExportAnalytics}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}
          <Button onClick={() => setCreateModalOpen(true)} className="shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            Create Class
          </Button>
        </div>
      </div>

      {/* Quick Stats - Icon + Number with Tooltips */}
      {groups.length > 0 && (
        <div className="flex items-center gap-6 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md p-1 -m-1"
                aria-label={`${groups.length} Classes`}
              >
                <GraduationCap className="w-5 h-5 text-primary" />
                <span className="text-xl font-bold tabular-nums">{groups.length}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Classes</TooltipContent>
          </Tooltip>
          
          <div className="w-px h-6 bg-border/50" />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md p-1 -m-1"
                aria-label={`${totalStudents} Students`}
              >
                <Users className="w-5 h-5 text-primary" />
                <span className="text-xl font-bold tabular-nums">{totalStudents}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Students</TooltipContent>
          </Tooltip>
          
          <div className="w-px h-6 bg-border/50" />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md p-1 -m-1"
                aria-label={`${totalAssignments} Active assignments`}
              >
                <ClipboardCheck className="w-5 h-5 text-primary" />
                <span className="text-xl font-bold tabular-nums">{totalAssignments}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Active assignments</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Classes Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card p-12 text-center">
          <div className="w-[52px] h-[52px] rounded-[14px] bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6 text-primary" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1.5">No classes yet</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-[280px] mx-auto leading-relaxed">
            Create your first class and share the invite code with your students
          </p>
          <Button onClick={() => setCreateModalOpen(true)} size="sm">
            Create your first class
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <ClassCard
              key={group.id}
              id={group.id}
              name={group.name}
              subjects={resolveSubjects(group)}
              studentCount={group.member_count}
              assignmentCount={group.assignment_count}
              inviteCode={group.invite_code}
              settings={group.settings as any}
              description={group.description}
              onViewClass={() => handleViewClass(group.id)}
              onCopyInvite={() => handleCopyInviteCode(group.invite_code)}
              onAnnounce={() => handlePostAnnouncement(group.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateGroupModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={refetch}
      />

      {selectedGroupId && (
        <>
          <ClassDetailPanel
            open={detailPanelOpen}
            onOpenChange={setDetailPanelOpen}
            groupId={selectedGroupId}
            groupName={selectedGroup?.name || ""}
            inviteCode={selectedGroup?.invite_code || null}
            subjectsTaught={selectedGroup?.subjects_covered || []}
            educationalLevel={selectedGroup?.settings?.educational_level}
            onGroupUpdated={refetch}
            onDeleteGroup={handleDeleteGroup}
          />
          <AnnouncementModal
            open={announcementModalOpen}
            onOpenChange={setAnnouncementModalOpen}
            groupId={selectedGroupId}
            onSuccess={() => {
              setAnnouncementModalOpen(false);
              toast({
                title: "Announcement posted",
                description: "Students will be notified",
              });
            }}
          />
        </>
      )}
    </div>
  );
}
