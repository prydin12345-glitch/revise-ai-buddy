import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";

interface JoinClassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const JoinClassModal = ({ open, onOpenChange, onSuccess }: JoinClassModalProps) => {
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoinClass = async () => {
    if (!inviteCode.trim()) {
      toast.error("Please enter an invite code");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Verify user has a profile (required for foreign key constraint)
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        toast.error("Please complete your profile setup before joining a class. Try logging out and back in.");
        return;
      }

      // Find the group by invite code
      const { data: group, error: groupError } = await supabase
        .from("student_groups")
        .select("id, name, tutor_id, capacity")
        .eq("invite_code", inviteCode.trim())
        .eq("is_active", true)
        .maybeSingle();

      if (groupError) throw groupError;
      if (!group) {
        toast.error("Invalid invite code");
        return;
      }

      // Check if already a member
      const { data: existingMembership } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", group.id)
        .eq("student_id", user.id)
        .maybeSingle();

      if (existingMembership) {
        toast.error("You're already a member of this class");
        return;
      }

      // Check capacity
      const { count } = await supabase
        .from("group_members")
        .select("*", { count: 'exact', head: true })
        .eq("group_id", group.id)
        .eq("is_active", true);

      if (count && group.capacity && count >= group.capacity) {
        toast.error("This class is full");
        return;
      }

      // Join the group
      const { error: insertError } = await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          student_id: user.id,
          is_active: true,
          role: "member"
        });

      if (insertError) throw insertError;

      toast.success(`Successfully joined ${group.name}!`);
      setInviteCode("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error joining class:", error);
      if (error.message?.includes("violates foreign key constraint")) {
        toast.error("Profile setup incomplete. Please log out and back in to complete setup.");
      } else {
        toast.error(error.message || "Failed to join class");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Join a Class
          </DialogTitle>
          <DialogDescription>
            Enter the invite code provided by your tutor to join their class.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="inviteCode">Invite Code</Label>
            <Input
              id="inviteCode"
              placeholder="e.g., ABC123"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              disabled={loading}
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleJoinClass} disabled={loading || !inviteCode.trim()}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Join Class
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
