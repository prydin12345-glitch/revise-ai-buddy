import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Megaphone } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface AnnouncementItemProps {
  announcement: {
    id: string;
    title: string;
    message: string;
    created_at: string;
    attachment_url?: string;
    group_name?: string;
  };
  isUnread?: boolean;
  showGroupName?: boolean;
}

export const AnnouncementItem = ({ announcement, isUnread = false, showGroupName = false }: AnnouncementItemProps) => {
  return (
    <Card className={`transition-all hover:shadow-sm ${isUnread ? "border-l-4 border-l-primary bg-primary/5" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUnread ? "bg-primary/20" : "bg-muted"}`}>
            <Megaphone className={`w-4 h-4 ${isUnread ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`font-medium text-foreground line-clamp-1 ${isUnread ? "font-semibold" : ""}`}>
                {announcement.title}
              </h4>
              {isUnread && (
                <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
              )}
            </div>
            
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {announcement.message}
            </p>
            
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span title={format(new Date(announcement.created_at), "PPpp")}>
                {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
              </span>
              
              {showGroupName && announcement.group_name && (
                <Badge variant="outline" className="text-xs">
                  {announcement.group_name}
                </Badge>
              )}
              
              {announcement.attachment_url && (
                <a 
                  href={announcement.attachment_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Paperclip className="w-3 h-3" />
                  Attachment
                </a>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
