import { Bell, CheckCheck, Filter } from "lucide-react";
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
    // Handle different notification types
    switch (notification.type) {
      case "ai_suggestion":
      case "missed_task":
        // Navigate to revision plan
        navigate("/revision-plan");
        toast({
          title: "Opening Revision Plan",
          description: "View your suggested tasks in the inbox",
        });
        break;
      case "exam_reminder":
        navigate("/revision-plan");
        break;
      case "task_completion":
        // Just mark as read, no navigation needed
        break;
    }
  };

  const examReminders = notifications.filter((n) => n.type === "exam_reminder");
  const suggestions = notifications.filter((n) => n.type === "ai_suggestion");
  const missedTasks = notifications.filter((n) => n.type === "missed_task");
  const completions = notifications.filter((n) => n.type === "task_completion");

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
                value="suggestions"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                Suggestions
                {suggestions.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {suggestions.length}
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

              <TabsContent value="suggestions" className="m-0 space-y-0">
                {suggestions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No AI suggestions
                  </div>
                ) : (
                  suggestions.map((notification) => (
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

        <DropdownMenuSeparator className="m-0" />
        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-xs"
            onClick={() => navigate("/revision-plan")}
          >
            View Revision Plan
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
