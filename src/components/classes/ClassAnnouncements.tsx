import { Megaphone } from "lucide-react";
import { AnnouncementItem } from "@/components/classes/AnnouncementItem";
import type { GroupAnnouncement, StudentGroup } from "@/pages/MyClasses";
import "@/styles/class-announcements.css";

interface ClassAnnouncementsProps {
  announcements: GroupAnnouncement[];
  groups: StudentGroup[];
  selectedClass: string;
  onClassChange: (id: string) => void;
  limit?: number;
}

/** Filters the already-authorized class announcements; no additional data reads. */
export function ClassAnnouncements({ announcements, groups, selectedClass, onClassChange, limit }: ClassAnnouncementsProps) {
  const selectedGroup = groups.find(group => group.id === selectedClass);
  const effectiveClass = selectedGroup?.id || "all";
  const filtered = announcements.filter(announcement => effectiveClass === "all" || announcement.group_id === effectiveClass);
  const visible = limit === undefined ? filtered : filtered.slice(0, Math.max(0, limit));

  return <div className="class-announcements">
    <div className="class-announcements__filters" role="group" aria-label="Filter announcements by class">
      <button type="button" aria-label="All classes" aria-pressed={effectiveClass === "all"} onClick={() => onClassChange("all")}>All</button>
      {groups.map(group => <button key={group.id} type="button" title={group.name} aria-pressed={effectiveClass === group.id} onClick={() => onClassChange(group.id)}>
        <span>{group.name}</span>
      </button>)}
    </div>
    <p className="sr-only" role="status">Showing {visible.length} of {filtered.length} announcements{selectedGroup ? " from " + selectedGroup.name : " from all classes"}.</p>
    {visible.length > 0 ? <ol className="class-announcements__timeline">
      {visible.map(announcement => <li key={announcement.id}><AnnouncementItem announcement={announcement} showGroupName presentation="timeline" /></li>)}
    </ol> : <div className="class-announcements__empty">
      <Megaphone aria-hidden="true" />
      <h3>No recent announcements</h3>
      <p>{selectedGroup ? "There are no recent updates from " + selectedGroup.name + "." : "Updates from your teacher or tutor will appear here."}</p>
    </div>}
  </div>;
}
