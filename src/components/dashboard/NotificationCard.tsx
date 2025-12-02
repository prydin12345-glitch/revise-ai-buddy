import { formatDistanceToNow } from "date-fns";
import { Bell, BookOpen, CheckCircle, AlertCircle, Pin, Clock, Trash2, Megaphone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

interface NotificationCardProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onPin: (id: string, isPinned: boolean) => void;
  onSnooze: (id: string) => void;
  onDelete: (id: string) => void;
  onAction?: (notification: Notification) => void;
}

const getNotificationIcon = (type: Notification["type"]) => {
  switch (type) {
    case "exam_reminder":
      return <BookOpen className="w-4 h-4 text-blue-400" />;
    case "ai_suggestion":
      return <Bell className="w-4 h-4 text-purple-400" />;
    case "task_completion":
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case "missed_task":
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    case "announcement":
      return <Megaphone className="w-4 h-4 text-orange-400" />;
    case "feedback_request":
    case "feedback_response":
      return <MessageCircle className="w-4 h-4 text-cyan-400" />;
    default:
      return <Bell className="w-4 h-4 text-muted-foreground" />;
  }
};

const getNotificationColor = (type: Notification["type"]) => {
  switch (type) {
    case "exam_reminder":
      return "border-l-blue-500";
    case "ai_suggestion":
      return "border-l-purple-500";
    case "task_completion":
      return "border-l-green-500";
    case "missed_task":
      return "border-l-red-500";
    case "announcement":
      return "border-l-orange-500";
    case "feedback_request":
    case "feedback_response":
      return "border-l-cyan-500";
    default:
      return "border-l-muted";
  }
};

export const NotificationCard = ({
  notification,
  onMarkAsRead,
  onPin,
  onSnooze,
  onDelete,
  onAction,
}: NotificationCardProps) => {
  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
    if (onAction) {
      onAction(notification);
    }
  };

  return (
    <div
      className={cn(
        "group relative border-l-4 bg-card hover:bg-accent/50 transition-colors p-4 cursor-pointer",
        getNotificationColor(notification.type),
        !notification.is_read && "bg-accent/20"
      )}
      onClick={handleClick}
    >
      {/* Pin indicator */}
      {notification.is_pinned && (
        <Pin className="absolute top-2 right-2 w-3 h-3 text-primary fill-primary" />
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div className="mt-1">{getNotificationIcon(notification.type)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={cn(
                "text-sm font-medium",
                !notification.is_read && "font-semibold"
              )}
            >
              {notification.title}
            </h4>
            {!notification.is_read && (
              <div className="w-2 h-2 rounded-full bg-primary mt-1 flex-shrink-0" />
            )}
          </div>
          {notification.body && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {notification.body}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
            })}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onPin(notification.id, !notification.is_pinned);
          }}
        >
          <Pin className="w-3 h-3 mr-1" />
          {notification.is_pinned ? "Unpin" : "Pin"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onSnooze(notification.id);
          }}
        >
          <Clock className="w-3 h-3 mr-1" />
          Snooze
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
};