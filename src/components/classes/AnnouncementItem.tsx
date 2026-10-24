import { useId, useState } from "react";
import { Paperclip, Megaphone, ChevronDown, ChevronUp } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import "@/styles/class-cards.css";

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
  const [expanded, setExpanded] = useState(false);
  const messageId = useId();
  const isLongMessage = announcement.message.length > 240 || announcement.message.split("\n").length > 3;

  return (
    <article className={`class-announcement${isUnread ? " class-announcement--unread" : ""}`}>
      <span className="class-announcement__icon"><Megaphone aria-hidden="true" /></span>
      <div className="class-announcement__body">
        <div className="class-announcement__metadata">
          {showGroupName && announcement.group_name && <span>{announcement.group_name}</span>}
          <time dateTime={announcement.created_at} title={format(new Date(announcement.created_at), "PPpp")}>
            {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
          </time>
          {isUnread && <span className="class-announcement__unread-label">Unread</span>}
        </div>
        <h3>{announcement.title}</h3>
        <p id={messageId} className={isLongMessage && !expanded ? "class-announcement__message--collapsed" : undefined}>
          {announcement.message}
        </p>
        {(isLongMessage || announcement.attachment_url) && (
          <div className="class-announcement__actions">
            {isLongMessage && (
              <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={messageId}>
                {expanded ? "Show less" : "Read announcement"}
                {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
              </button>
            )}
            {announcement.attachment_url && (
              <a href={announcement.attachment_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                <Paperclip aria-hidden="true" />Attachment<span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
