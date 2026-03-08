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
      <div style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
        padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120,
      }}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (announcements.length === 0) {
    return null;
  }

  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <Bell style={{ width: 16, height: 16, color: '#f97316' }} />
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Recent Announcements</h2>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {announcements.map((announcement) => (
          <div
            key={announcement.id}
            style={{
              borderLeft: '4px solid #f97316',
              padding: '16px 20px',
              borderRadius: '0 8px 8px 0',
              background: 'rgba(249,115,22,0.04)',
              transition: 'background 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <p style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9', margin: 0 }}>
                {announcement.title}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                background: '#1e3a5f',
                color: '#93c5fd',
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 99,
                fontWeight: 500,
              }}>
                {announcement.student_groups?.name}
              </span>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {new Date(announcement.created_at).toLocaleString()}
              </span>
            </div>
            <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
              {announcement.message}
            </p>
            {announcement.attachment_url && (
              <a
                href={announcement.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12, color: '#3b82f6', marginTop: 8,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  textDecoration: 'none',
                }}
              >
                <ExternalLink style={{ width: 12, height: 12 }} />
                View Attachment
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};