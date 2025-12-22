import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: "exam_reminder" | "ai_suggestion" | "task_completion" | "missed_task" | "feedback_request" | "feedback_response" | "announcement" | "grades_released" | "verification_approved" | "exam_assigned" | "deadline_changed" | "exam_submitted";
  is_read: boolean;
  is_pinned: boolean;
  snoozed_until: string | null;
  action_data: any;
  link_url: string | null;
  metadata: any;
  read_at: string | null;
  source_user_id: string | null;
  created_at: string;
  updated_at: string;
}

const POLLING_INTERVAL = 45000; // 45 seconds

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Call the edge function API
  const callApi = useCallback(async (action: string, method: string = "GET", body?: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notifications-api`;
    const url = `${baseUrl}?action=${action}`;

    const response = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "API request failed");
    }

    return response.json();
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await callApi("list");
      if (data) {
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [callApi]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await callApi("unread-count");
      if (data) {
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  }, [callApi]);

  // Initial fetch and setup
  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      
      userIdRef.current = user.id;
      await Promise.all([fetchNotifications(), fetchUnreadCount()]);
    };

    initialize();

    // Set up polling fallback
    pollingRef.current = setInterval(() => {
      fetchUnreadCount();
    }, POLLING_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchNotifications, fetchUnreadCount]);

  // Real-time subscription filtered by user
  useEffect(() => {
    if (!userIdRef.current) return;

    const channel = supabase
      .channel(`notifications-${userIdRef.current}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userIdRef.current}`,
        },
        (payload) => {
          console.log("[Notifications] Realtime event:", payload.eventType);
          
          if (payload.eventType === "INSERT") {
            const newNotification = payload.new as Notification;
            // Prepend new notification and update unread count
            setNotifications((prev) => [newNotification, ...prev]);
            if (!newNotification.is_read) {
              setUnreadCount((prev) => prev + 1);
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Notification;
            setNotifications((prev) =>
              prev.map((n) => (n.id === updated.id ? updated : n))
            );
            // Recalculate unread count
            fetchUnreadCount();
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            setNotifications((prev) => prev.filter((n) => n.id !== deleted.id));
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUnreadCount]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      await callApi("mark-read", "POST", { notificationIds: [notificationId] });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      // Revert on error
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [callApi, fetchNotifications, fetchUnreadCount]);

  const markAllAsRead = useCallback(async () => {
    try {
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
      setUnreadCount(0);

      await callApi("mark-read", "POST", { markAll: true });

      toast({
        title: "All notifications marked as read",
      });
    } catch (error) {
      console.error("Error marking all as read:", error);
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [callApi, toast, fetchNotifications, fetchUnreadCount]);

  const pinNotification = useCallback(async (notificationId: string, isPinned: boolean) => {
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_pinned: isPinned } : n))
      );

      await callApi("pin", "POST", { notificationId, isPinned });

      toast({
        title: isPinned ? "Notification pinned" : "Notification unpinned",
      });
    } catch (error) {
      console.error("Error pinning notification:", error);
      fetchNotifications();
    }
  }, [callApi, toast, fetchNotifications]);

  const snoozeNotification = useCallback(async (notificationId: string) => {
    try {
      // Optimistic update - remove from list
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      await callApi("snooze", "POST", { notificationId, hours: 24 });

      toast({
        title: "Notification snoozed for 24 hours",
      });
    } catch (error) {
      console.error("Error snoozing notification:", error);
      fetchNotifications();
    }
  }, [callApi, toast, fetchNotifications]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      // Optimistic update
      const wasUnread = notifications.find(n => n.id === notificationId && !n.is_read);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      await callApi("delete", "POST", { notificationId });

      toast({
        title: "Notification deleted",
      });
    } catch (error) {
      console.error("Error deleting notification:", error);
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [callApi, toast, fetchNotifications, fetchUnreadCount, notifications]);

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    pinNotification,
    snoozeNotification,
    deleteNotification,
    refetch: fetchNotifications,
  };
};
