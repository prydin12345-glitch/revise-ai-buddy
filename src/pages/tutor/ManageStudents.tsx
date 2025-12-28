import { useState } from "react";
import { Users, Plus, Download, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreateGroupModal } from "@/components/tutor/CreateGroupModal";
import { ClassCard } from "@/components/tutor/ClassCard";
import { ClassDetailPanel } from "@/components/tutor/ClassDetailPanel";
import { AnnouncementModal } from "@/components/tutor/AnnouncementModal";
import { useManageGroups } from "@/hooks/useManageGroups";

export default function ManageStudents() {
  const { toast } = useToast();
  const { groups, loading, deleteGroup, refetch } = useManageGroups();
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

  // Stats
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

      {/* Quick Stats */}
      {groups.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card rounded-lg border border-border/50 p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <GraduationCap className="w-4 h-4" />
              <span className="text-xs font-medium">Classes</span>
            </div>
            <p className="text-2xl font-bold">{groups.length}</p>
          </div>
          <div className="bg-card rounded-lg border border-border/50 p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">Students</span>
            </div>
            <p className="text-2xl font-bold">{totalStudents}</p>
          </div>
          <div className="bg-card rounded-lg border border-border/50 p-4 col-span-2 sm:col-span-2">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <span className="text-xs font-medium">Active Assignments</span>
            </div>
            <p className="text-2xl font-bold">{totalAssignments}</p>
          </div>
        </div>
      )}

      {/* Classes Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-12 text-center">
          <Users className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Classes Yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Create your first class to start managing students, assignments, and announcements
          </p>
          <Button onClick={() => setCreateModalOpen(true)} size="lg">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Class
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <ClassCard
              key={group.id}
              id={group.id}
              name={group.name}
              subjects={group.subjects_covered}
              studentCount={group.member_count}
              assignmentCount={group.assignment_count}
              inviteCode={group.invite_code}
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
