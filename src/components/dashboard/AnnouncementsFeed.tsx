import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Bell, ExternalLink, Megaphone } from "lucide-react";
import { toast } from "sonner";

interface Announcement {
  id: string;
  title: string;
  message: string;
  attachment_url: string | null;
  created_at: string;
  group_id: string;
  student_groups: {
    name: string;
  };
}

export const AnnouncementsFeed = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnnouncements();

    // Real-time subscription for new announcements
    const channel = supabase
      .channel('announcements-feed')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'group_announcements' }, 
        (payload) => {
          const newAnnouncement = payload.new as any;
          toast.success(`New announcement: ${newAnnouncement.title}`);
          loadAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadAnnouncements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get groups the student is a member of
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("student_id", user.id)
        .eq("is_active", true);

      if (!memberships || memberships.length === 0) {
        setLoading(false);
        return;
      }

      const groupIds = memberships.map(m => m.group_id);

      // Fetch recent announcements from those groups
      const { data, error } = await supabase
        .from("group_announcements")
        .select(`
          id,
          title,
          message,
          attachment_url,
          created_at,
          group_id,
          student_groups (
            name
          )
        `)
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setAnnouncements((data as any) || []);
    } catch (error) {
      console.error("Error loading announcements:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-lg rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (announcements.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-lg rounded-2xl">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2 text-xl font-bold">
          <Megaphone className="w-5 h-5 text-primary" />
          Recent Announcements
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className="p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Bell className="w-4 h-4 text-primary" />
                    <p className="font-semibold">{announcement.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {announcement.student_groups?.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(announcement.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {announcement.message}
              </p>
              {announcement.attachment_url && (
                <a
                  href={announcement.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline mt-2 inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  View Attachment
                </a>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
