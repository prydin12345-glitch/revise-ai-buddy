import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { UserMinus, User, Search, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
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

interface GroupMember {
  id: string;
  student_id: string;
  joined_at: string;
  display_name: string | null;
  student_code: string | null;
}

interface GroupMembersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
}

export const GroupMembersModal = ({ open, onOpenChange, groupId }: GroupMembersModalProps) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchMembers = async () => {
    setLoading(true);
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
      toast({
        title: "Error",
        description: "Failed to load group members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMembers();
      setSearchQuery("");
    }
  }, [open, groupId]);

  const handleRemoveClick = (member: GroupMember) => {
    setMemberToRemove(member);
    setRemoveDialogOpen(true);
  };

  const confirmRemove = async () => {
    if (!memberToRemove) return;

    try {
      const { error } = await supabase
        .from("group_members")
        .update({ is_active: false })
        .eq("id", memberToRemove.id);

      if (error) throw error;

      toast({
        title: "Member removed",
        description: `${memberToRemove.display_name || "Student"} has been removed from the group`,
      });

      fetchMembers();
    } catch (error) {
      console.error("Error removing member:", error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    } finally {
      setRemoveDialogOpen(false);
      setMemberToRemove(null);
    }
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
    a.download = `group-members-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: "Member list downloaded as CSV",
    });
  };

  // Filter members by search query (name or student code)
  const filteredMembers = members.filter(member => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      member.display_name?.toLowerCase().includes(query) ||
      member.student_code?.toLowerCase().includes(query)
    );
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Group Members ({members.length})</DialogTitle>
          </DialogHeader>

          {/* Search and Export */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or student ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {members.length > 0 && (
              <Button variant="outline" size="icon" onClick={handleExportMembers}>
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="mt-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No students in this group yet</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No students match your search</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {member.display_name?.[0]?.toUpperCase() || "S"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {member.display_name || "Student"}
                          {member.student_code && (
                            <span className="text-muted-foreground ml-2 font-mono text-sm">
                              ({member.student_code})
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
                      onClick={() => handleRemoveClick(member)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.display_name || "this student"} 
              {memberToRemove?.student_code && ` (${memberToRemove.student_code})`} from the group?
              They can rejoin later using the invite code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
