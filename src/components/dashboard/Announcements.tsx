// src/components/dashboard/Announcements.tsx
import { Megaphone, ChevronRight } from "lucide-react";
import type { Announcement } from "./types";

interface AnnouncementsProps {
  items: Announcement[];
  onOpen?: (id: string) => void;
}

export default function Announcements({ items, onOpen }: AnnouncementsProps) {
  return (
    <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-base font-bold">Announcements</h2>
        <button className="flex items-center gap-1 text-[13px] font-semibold text-primary">
          View all <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {items.map((a) => (
          <button
            key={a.id}
            onClick={() => onOpen?.(a.id)}
            className="group flex items-center gap-3 rounded-xl border border-border bg-panel-2 p-3 text-left transition-colors hover:border-border/0 hover:bg-surface-hover"
          >
            <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] bg-primary/15 text-primary">
              <Megaphone className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-bold">{a.title}</span>
              <span className="block text-[11.5px] font-semibold text-muted-foreground">
                {a.from} · {a.when}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
          </button>
        ))}
      </div>
    </section>
  );
}
