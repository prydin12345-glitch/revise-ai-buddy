import { useState } from "react";
import { Users, Copy, Eye, Megaphone, Trash2, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreateGroupModal } from "@/components/tutor/CreateGroupModal";
import { GroupMembersModal } from "@/components/tutor/GroupMembersModal";
import { AnnouncementModal } from "@/components/tutor/AnnouncementModal";
import { AnnouncementsHistory } from "@/components/tutor/AnnouncementsHistory";
import { useManageGroups } from "@/hooks/useManageGroups";
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

export default function ManageStudents() {
  const { toast } = useToast();
  const { groups, loading, deleteGroup, refetch } = useManageGroups();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

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
      ["Group Name", "Invite Code", "Members", "Subjects"],
      ...groups.map(g => [
        g.name,
        g.invite_code || "N/A",
        g.member_count?.toString() || "0",
        Array.isArray(g.subjects_covered) ? (g.subjects_covered as string[]).join("; ") : ""
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `group-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Analytics exported",
      description: "CSV file downloaded successfully",
    });
  };

  const handleViewMembers = (groupId: string) => {
    setSelectedGroupId(groupId);
    setMembersModalOpen(true);
  };

  const handlePostAnnouncement = (groupId: string) => {
    setSelectedGroupId(groupId);
    setAnnouncementModalOpen(true);
  };

  const handleDeleteClick = (groupId: string) => {
    setGroupToDelete(groupId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!groupToDelete) return;
    
    const success = await deleteGroup(groupToDelete);
    if (success) {
      toast({
        title: "Group deleted",
        description: "The group has been successfully deleted",
      });
      refetch();
    }
    setDeleteDialogOpen(false);
    setGroupToDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Student Groups</h1>
          <p className="text-muted-foreground mt-1">
            Manage your student groups, share invite codes, and post announcements
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
            Create Group
          </Button>
        </div>
      </div>

      {/* Groups List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Groups Yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first student group to get started
          </p>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Group
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => (
            <Card key={group.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Group Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold">{group.name}</h3>
                    {group.subjects_covered && Array.isArray(group.subjects_covered) && group.subjects_covered.length > 0 && (
                      <div className="flex gap-1">
                        {(group.subjects_covered as string[]).map((subject, idx) => (
                          <Badge key={idx} variant="secondary">
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Invite Code:</span>
                      <code className="px-2 py-1 bg-muted rounded font-mono text-xs">
                        {group.invite_code || "N/A"}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{group.member_count || 0} students</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyInviteCode(group.invite_code)}
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewMembers(group.id)}
                    className="gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Members
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePostAnnouncement(group.id)}
                    className="gap-2"
                  >
                    <Megaphone className="w-4 h-4" />
                    Announce
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(group.id)}
                    className="gap-2 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Announcements History */}
      {groups.length > 0 && (
        <AnnouncementsHistory />
      )}

      {/* Modals */}
      <CreateGroupModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={refetch}
      />

      {selectedGroupId && (
        <>
          <GroupMembersModal
            open={membersModalOpen}
            onOpenChange={setMembersModalOpen}
            groupId={selectedGroupId}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the group and remove all members. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}