import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AnnouncementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onSuccess: () => void;
}

export const AnnouncementModal = ({ open, onOpenChange, groupId, onSuccess }: AnnouncementModalProps) => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !message.trim()) {
      toast({
        title: "Error",
        description: "Please fill in title and message",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create announcement
      const { error: announcementError } = await supabase
        .from("group_announcements")
        .insert({
          group_id: groupId,
          tutor_id: user.id,
          title: title.trim(),
          message: message.trim(),
          attachment_url: attachmentUrl.trim() || null,
        });

      if (announcementError) throw announcementError;

      // Get all active group members
      const { data: members, error: membersError } = await supabase
        .from("group_members")
        .select("student_id")
        .eq("group_id", groupId)
        .eq("is_active", true);

      if (membersError) throw membersError;

      // Create notifications for all members
      if (members && members.length > 0) {
        const notifications = members.map(member => ({
          user_id: member.student_id,
          type: "announcement",
          title: title.trim(),
          body: message.trim(),
          action_data: {
            group_id: groupId,
            announcement_url: attachmentUrl.trim() || null,
          },
        }));

        const { error: notificationError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (notificationError) throw notificationError;
      }

      // Reset form
      setTitle("");
      setMessage("");
      setAttachmentUrl("");
      
      onSuccess();
    } catch (error) {
      console.error("Error posting announcement:", error);
      toast({
        title: "Error",
        description: "Failed to post announcement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Post Announcement</DialogTitle>
          <DialogDescription>
            Share an update with all students in this group
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Homework Reminder"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={100}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              placeholder="Write your announcement..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={5}
              className="resize-none"
            />
          </div>

          {/* Optional Attachment URL */}
          <div className="space-y-2">
            <Label htmlFor="attachment">Attachment URL (optional)</Label>
            <Input
              id="attachment"
              type="url"
              placeholder="https://example.com/file.pdf"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Link to a PDF, image, or external resource
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Posting..." : "Post Announcement"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
