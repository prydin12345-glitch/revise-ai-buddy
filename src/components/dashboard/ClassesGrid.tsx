// src/components/dashboard/ClassesGrid.tsx
import { Clock, ArrowRight, ChevronRight } from "lucide-react";
import type { ClassItem } from "./types";

interface ClassesGridProps {
  classes: ClassItem[];
  onContinue?: (classId: string) => void;
}

export default function ClassesGrid({ classes, onContinue }: ClassesGridProps) {
  return (
    <section>
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-base font-bold">My Classes</h2>
        <button className="flex items-center gap-1 text-[13px] font-semibold text-primary">
          View all <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {classes.map((c) => (
          <div key={c.id} className="w-[340px] flex-none snap-start sm:w-[380px]">
            <ClassCard item={c} onContinue={onContinue} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Subtle, accent-tinted thumbnail. Accent is subject (content) colour → inline style. */
function thumbStyle(motif: ClassItem["motif"], accent: string): React.CSSProperties {
  const base = `linear-gradient(135deg, ${accent}33, ${accent}0d)`;
  if (motif === "grid")
    return {
      background: `${base}, repeating-linear-gradient(0deg, ${accent}1a 0 1px, transparent 1px 22px), repeating-linear-gradient(90deg, ${accent}1a 0 1px, transparent 1px 22px), hsl(var(--surface-panel-2))`,
    };
  if (motif === "dots")
    return {
      background: `${base}, radial-gradient(${accent}40 1.5px, transparent 1.6px) 0 0 / 16px 16px, hsl(var(--surface-panel-2))`,
    };
  return { background: `${base}, hsl(var(--surface-panel-2))` };
}

function ClassCard({ item, onContinue }: { item: ClassItem; onContinue?: (id: string) => void }) {
  const Glyph = item.glyph;
  return (
    <article className="flex overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-border-strong">
      {/* thumb */}
      <div
        className="class-thumbnail relative grid w-[88px] flex-none place-items-center sm:w-[96px]"
        style={thumbStyle(item.motif, item.accentColor)}
      >
        <span
          className="absolute left-3 top-3 z-[2] flex items-center gap-1.5 rounded-[7px] class-subject-label bg-card border border-border px-2.5 py-1 text-xs font-bold "
          style={{ color: item.accentColor }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.accentColor }} />
          {item.subjectTag}
        </span>
        <Glyph className="z-[1] h-10 w-10 opacity-35" style={{ color: item.accentColor }} strokeWidth={1.5} />
      </div>

      {/* body */}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
        <div>
          <div className="break-words text-base font-bold tracking-tight">{item.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
            {item.teacher}
            <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
            {item.students} students
          </div>
        </div>

        <div className="flex max-w-full items-center gap-1.5 self-start truncate rounded-lg border border-border bg-panel-2 px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground">
          <Clock className="h-3 w-3 flex-none" />
          <span className="truncate">{item.next}</span>
        </div>

        <div className="mt-auto">
          <div className="flex items-center justify-between text-[11.5px] font-semibold text-muted-foreground">
            <span>Course progress</span>
            <span className="font-extrabold tabular-nums" style={{ color: item.accentColor }}>
              {item.progress}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full" style={{ width: `${item.progress}%`, background: item.accentColor }} />
          </div>
        </div>

        <button
          onClick={() => onContinue?.(item.id)}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-border bg-panel-2 min-h-11 py-2 text-sm font-bold transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
        >
          Continue <ArrowRight className="h-[15px] w-[15px]" />
        </button>
      </div>
    </article>
  );
}
