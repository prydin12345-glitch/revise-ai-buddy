import { useId } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Megaphone, Users } from "lucide-react";
import { useRetainedState } from "@/hooks/use-workspace-session";
import type { Announcement, ClassItem } from "./types";

function useCardSelection<T extends { id: string }>(key: string, items: T[]) {
  const [selectedId, setSelectedId] = useRetainedState<string | null>(key, null);
  const index = Math.max(0, items.findIndex(item => item.id === selectedId));
  return {
    current: items[index], index,
    move: (step: number) => {
      if (items.length > 1) setSelectedId(items[(index + step + items.length) % items.length].id);
    },
  };
}

function Pager({ label, index, count, onMove }: { label: string; index: number; count: number; onMove: (step: number) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="mr-1 text-xs tabular-nums text-muted-foreground" aria-label={`${label} ${count ? index + 1 : 0} of ${count}`}>
        {count ? index + 1 : 0}/{count}
      </span>
      <button type="button" className="laptop-card-arrow" aria-label={`Previous ${label}`} disabled={count < 2} onClick={() => onMove(-1)}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
      <button type="button" className="laptop-card-arrow" aria-label={`Next ${label}`} disabled={count < 2} onClick={() => onMove(1)}><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
    </div>
  );
}

interface Props {
  classes: ClassItem[];
  announcements: Announcement[];
  onContinue?: (id: string) => void;
  onOpenAnnouncement?: (id: string) => void;
  onViewClasses?: () => void;
  onJoinClass?: () => void;
}

export default function DashboardContextCards({ classes, announcements, onContinue, onOpenAnnouncement, onViewClasses, onJoinClass }: Props) {
  const classTitle = useId();
  const announcementTitle = useId();
  const classSlide = useCardSelection("dashboard:laptop-class", classes);
  const announcementSlide = useCardSelection("dashboard:laptop-announcement", announcements);
  const item = classSlide.current;
  const announcement = announcementSlide.current;
  return (
    <div className="laptop-home-context">
      <section className="laptop-context-card" aria-labelledby={classTitle} aria-roledescription="carousel">
        <div className="laptop-context-heading">
          <h2 id={classTitle}>My Classes</h2>
          <Pager label="class" index={classSlide.index} count={classes.length} onMove={classSlide.move} />
        </div>
        <div className="laptop-context-body" aria-live="polite" aria-atomic="true">
          {item ? <>
            {/* Membership/profile fields are real. The legacy progress/next placeholders stay out of this card. */}
            <p className="text-xs font-semibold text-primary">{item.subjectTag}</p>
            <h3 className="mt-2 break-words text-lg font-semibold leading-snug">{item.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.teacher} · {item.students} {item.students === 1 ? "student" : "students"}</p>
            <button type="button" className="laptop-context-action" onClick={() => onContinue?.(item.id)}>Continue <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
          </> : <>
            <Users className="mb-3 h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-base font-semibold">Your classes, together</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">You haven't joined any classes yet.</p>
            <button type="button" className="laptop-context-action" onClick={onJoinClass}>Join a class <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
          </>}
        </div>
        <button type="button" className="laptop-context-link" onClick={onViewClasses}>View all classes <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
      </section>

      <section className="laptop-context-card" aria-labelledby={announcementTitle} aria-roledescription="carousel">
        <div className="laptop-context-heading">
          <h2 id={announcementTitle}>Announcements</h2>
          <Pager label="announcement" index={announcementSlide.index} count={announcements.length} onMove={announcementSlide.move} />
        </div>
        <div className="laptop-context-body" aria-live="polite" aria-atomic="true">
          {announcement ? <>
            <p className="text-xs font-semibold text-primary">{announcement.from}</p>
            <h3 className="mt-2 break-words text-lg font-semibold leading-snug">{announcement.title}</h3>
            <p className="mt-3 text-xs text-muted-foreground">{announcement.when}</p>
            <button type="button" className="laptop-context-action" onClick={() => onOpenAnnouncement?.(announcement.id)}>Open class <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
          </> : <>
            <Megaphone className="mb-3 h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-base font-semibold">You're up to date</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Class announcements will appear here.</p>
          </>}
        </div>
        <button type="button" className="laptop-context-link" onClick={onViewClasses}>View all classes <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
      </section>
    </div>
  );
}
