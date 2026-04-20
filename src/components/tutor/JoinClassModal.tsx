import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Users, ArrowLeft } from "lucide-react";
import { getSubjectColor } from "@/utils/subjectColors";

interface JoinClassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ClassPreview {
  id: string;
  name: string;
  description: string | null;
  subjectName: string;
  subjectColor: string;
  level: string | null;
  examBoard: string | null;
  memberCount: number;
  capacity: number | null;
  tutorName: string;
}

const LEVEL_LABELS: Record<string, string> = {
  secondary: "GCSE",
  sixth_form: "A-Level",
  university: "University",
};

export const JoinClassModal = ({ open, onOpenChange, onSuccess }: JoinClassModalProps) => {
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ClassPreview | null>(null);

  const resetState = () => {
    setInviteCode("");
    setPreview(null);
    setLoading(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const handleLookup = async () => {
    if (!inviteCode.trim()) {
      toast.error("Please enter an invite code");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const code = inviteCode.trim().toUpperCase();

      const { data: group, error: groupError } = await supabase
        .from("student_groups")
        .select("id, name, description, settings, subjects_covered, capacity, tutor_id, is_active")
        .eq("invite_code", code)
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

      // Member count
      const { count } = await supabase
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", group.id)
        .eq("is_active", true);

      // Tutor name
      const { data: tutorProfile } = await supabase
        .from("user_profiles")
        .select("display_name, first_name, last_name")
        .eq("id", group.tutor_id)
        .maybeSingle();

      const tutorName =
        tutorProfile?.display_name ||
        [tutorProfile?.first_name, tutorProfile?.last_name].filter(Boolean).join(" ") ||
        "Your tutor";

      const settings = (group.settings as any) || {};
      const subjectName = settings.subject_name || group.subjects_covered?.[0] || "";

      setPreview({
        id: group.id,
        name: group.name,
        description: group.description,
        subjectName,
        subjectColor: getSubjectColor(subjectName, settings.subject_color),
        level: settings.educational_level || null,
        examBoard: settings.exam_board || null,
        memberCount: count || 0,
        capacity: group.capacity,
        tutorName,
      });
    } catch (error: any) {
      console.error("Error looking up class:", error);
      toast.error(error.message || "Failed to find class");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmJoin = async () => {
    if (!preview) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Verify profile exists
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        toast.error("Please complete your profile setup. Try logging out and back in.");
        return;
      }

      // Capacity check
      if (preview.capacity && preview.memberCount >= preview.capacity) {
        toast.error("This class is full");
        return;
      }

      const { error: insertError } = await supabase
        .from("group_members")
        .insert({
          group_id: preview.id,
          student_id: user.id,
          is_active: true,
          role: "member",
        });

      if (insertError) throw insertError;

      toast.success(`Successfully joined ${preview.name}!`);
      onSuccess();
      handleClose(false);
    } catch (error: any) {
      console.error("Error joining class:", error);
      if (error.message?.includes("violates foreign key constraint")) {
        toast.error("Profile setup incomplete. Please log out and back in.");
      } else {
        toast.error(error.message || "Failed to join class");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        {preview ? (
          /* PREVIEW STATE */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Confirm joining
              </DialogTitle>
              <DialogDescription>
                Does this look right? Confirm to join the class.
              </DialogDescription>
            </DialogHeader>

            <div
              className="rounded-xl border p-4 space-y-3"
              style={{
                borderLeft: `4px solid ${preview.subjectColor}`,
                background: `${preview.subjectColor}06`,
              }}
            >
              <div>
                <h3 className="text-base font-semibold text-foreground">{preview.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">by {preview.tutorName}</p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {preview.subjectName && (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded"
                    style={{
                      background: `${preview.subjectColor}18`,
                      color: preview.subjectColor,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: preview.subjectColor }}
                    />
                    {preview.subjectName}
                  </span>
                )}
                {preview.level && LEVEL_LABELS[preview.level] && (
                  <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground">
                    {LEVEL_LABELS[preview.level]}
                  </span>
                )}
                {preview.examBoard && (
                  <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground">
                    {preview.examBoard}
                  </span>
                )}
              </div>

              {preview.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {preview.description}
                </p>
              )}

              <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                {preview.memberCount} student{preview.memberCount !== 1 ? "s" : ""} already joined
                {preview.capacity && ` · ${preview.capacity - preview.memberCount} spaces left`}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPreview(null)} disabled={loading}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Go back
              </Button>
              <Button
                onClick={handleConfirmJoin}
                disabled={loading}
                style={{ background: preview.subjectColor, color: "white" }}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Join {preview.name}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* CODE INPUT STATE */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Join a Class
              </DialogTitle>
              <DialogDescription>
                Enter the invite code provided by your tutor to view the class details.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="inviteCode">Invite Code</Label>
                <Input
                  id="inviteCode"
                  placeholder="e.g., EXM-ABC123"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && !loading && handleLookup()}
                  disabled={loading}
                  className="font-mono"
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleLookup} disabled={loading || !inviteCode.trim()}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Find Class
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
