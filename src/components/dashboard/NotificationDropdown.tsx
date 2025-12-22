import { Bell, CheckCheck, Filter, MessageCircle, Megaphone, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationCard } from "./NotificationCard";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export const NotificationDropdown = () => {
  const {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    pinNotification,
    snoozeNotification,
    deleteNotification,
  } = useNotifications();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleNotificationAction = async (notification: any) => {
    // Use link_url if available (new format), otherwise fall back to type-based routing
    if (notification.link_url) {
      navigate(notification.link_url);
      return;
    }

    // Legacy fallback for old notifications without link_url
    const metadata = notification.metadata || notification.action_data || {};
    
    switch (notification.type) {
      case "ai_suggestion":
      case "missed_task":
        navigate("/dashboard");
        break;
      case "exam_reminder":
      case "exam_assigned":
        if (metadata.examId || metadata.exam_id) {
          navigate(`/exam/${metadata.examId || metadata.exam_id}/in-progress`);
        } else {
          navigate("/dashboard");
        }
        break;
      case "announcement":
        navigate("/my-classes");
        break;
      case "feedback_request":
        if (metadata.threadId) {
          navigate(`/tutor/feedback?thread=${metadata.threadId}`);
        } else if (metadata.examId) {
          navigate(`/tutor/feedback`);
        }
        break;
      case "feedback_response":
        if (metadata.examId) {
          const questionParam = metadata.questionNumber ? `?q=${metadata.questionNumber}` : '';
          navigate(`/exam/${metadata.examId}/review${questionParam}`);
        }
        break;
      case "grades_released":
        if (metadata.examId || metadata.exam_id) {
          navigate(`/exam/${metadata.examId || metadata.exam_id}/review`);
        }
        break;
      case "task_completion":
      case "verification_approved":
        break;
      default:
        console.log("Unknown notification type:", notification.type);
    }
  };

  const handleExportNotifications = () => {
    const csv = [
      ["Type", "Title", "Body", "Created At", "Status"],
      ...notifications.map(n => [
        n.type,
        n.title,
        n.body || "",
        new Date(n.created_at).toLocaleString(),
        n.is_read ? "Read" : "Unread"
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notifications-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Notifications exported",
      description: "CSV file downloaded successfully",
    });
  };

  const examReminders = notifications.filter((n) => n.type === "exam_reminder" || n.type === "grades_released");
  const suggestions = notifications.filter((n) => n.type === "ai_suggestion");
  const announcements = notifications.filter((n) => n.type === "announcement");
  const feedback = notifications.filter((n) => 
    n.type === "feedback_request" || n.type === "feedback_response"
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[400px] p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          <div className="flex gap-1">
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={handleExportNotifications}
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            )}
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={markAllAsRead}
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full rounded-none border-b bg-transparent p-0">
              <TabsTrigger
                value="all"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                All
                {notifications.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {notifications.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="exams"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                Exams
                {examReminders.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {examReminders.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="announcements"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                Classes
                {announcements.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {announcements.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="feedback"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                Feedback
                {feedback.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {feedback.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[500px]">
              <TabsContent value="all" className="m-0 space-y-0">
                {notifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onPin={pinNotification}
                    onSnooze={snoozeNotification}
                    onDelete={deleteNotification}
                    onAction={handleNotificationAction}
                  />
                ))}
              </TabsContent>

              <TabsContent value="exams" className="m-0 space-y-0">
                {examReminders.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No exam reminders
                  </div>
                ) : (
                  examReminders.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={markAsRead}
                      onPin={pinNotification}
                      onSnooze={snoozeNotification}
                      onDelete={deleteNotification}
                      onAction={handleNotificationAction}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="announcements" className="m-0 space-y-0">
                {announcements.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No class announcements
                  </div>
                ) : (
                  announcements.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={markAsRead}
                      onPin={pinNotification}
                      onSnooze={snoozeNotification}
                      onDelete={deleteNotification}
                      onAction={handleNotificationAction}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="feedback" className="m-0 space-y-0">
                {feedback.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No feedback notifications
                  </div>
                ) : (
                  feedback.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={markAsRead}
                      onPin={pinNotification}
                      onSnooze={snoozeNotification}
                      onDelete={deleteNotification}
                      onAction={handleNotificationAction}
                    />
                  ))
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}

      </DropdownMenuContent>
    </DropdownMenu>
  );
};