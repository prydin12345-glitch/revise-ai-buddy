import { useId, useState } from "react";
import { Paperclip, Megaphone, ChevronDown, ChevronUp } from "lucide-react";
import { format, formatDistanceToNow, isToday, isValid, isYesterday } from "date-fns";
import "@/styles/class-cards.css";
import "@/styles/class-announcements.css";

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
  presentation?: "card" | "timeline";
}

export const AnnouncementItem = ({ announcement, isUnread = false, showGroupName = false, presentation = "card" }: AnnouncementItemProps) => {
  const [expanded, setExpanded] = useState(false);
  const messageId = useId();
  const isLongMessage = announcement.message.length > 240 || announcement.message.split("\n").length > 3;
  const createdAt = new Date(announcement.created_at);
  const hasDate = isValid(createdAt);
  const recentDate = hasDate && (isToday(createdAt) || isYesterday(createdAt));
  const dateLabel = !hasDate ? "Date unavailable" : isToday(createdAt) ? "Today" : isYesterday(createdAt) ? "Yesterday" : format(createdAt, "d MMM");

  return (
    <article className={`class-announcement${presentation === "timeline" ? " class-announcement--timeline" : ""}${isUnread ? " class-announcement--unread" : ""}`}>
      {presentation === "timeline" ? (
        <time className="class-announcement__timeline-date" dateTime={hasDate ? announcement.created_at : undefined} title={hasDate ? format(createdAt, "PPpp") : undefined}>
          <span>{dateLabel}</span>
          {hasDate && <span>{format(createdAt, recentDate ? "HH:mm" : "yyyy")}</span>}
        </time>
      ) : <span className="class-announcement__icon"><Megaphone aria-hidden="true" /></span>}
      <div className="class-announcement__body">
        <div className="class-announcement__metadata">
          {showGroupName && announcement.group_name && <span>{announcement.group_name}</span>}
          {presentation !== "timeline" && <time dateTime={hasDate ? announcement.created_at : undefined} title={hasDate ? format(createdAt, "PPpp") : undefined}>
            {hasDate ? formatDistanceToNow(createdAt, { addSuffix: true }) : "Date unavailable"}
          </time>}
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
