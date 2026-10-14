// src/components/dashboard/mobile/ClassCarousel.tsx
import { Clock, ArrowRight, TrendingUp, ListChecks, Target, type LucideIcon } from "lucide-react";
import type { ClassItem } from "../types";

interface Props {
  classes: ClassItem[];
  onContinue?: (id: string) => void;
  onViewAll?: () => void;
}

// fallback glyphs if ClassItem.glyph isn't set
const GLYPHS: Record<number, LucideIcon> = { 0: TrendingUp, 1: ListChecks, 2: Target };

function thumbStyle(motif: ClassItem["motif"], accent: string): React.CSSProperties {
  const base = `linear-gradient(135deg, ${accent}33, ${accent}0d)`;
  if (motif === "grid")
    return { background: `${base}, repeating-linear-gradient(0deg, ${accent}1a 0 1px, transparent 1px 20px), repeating-linear-gradient(90deg, ${accent}1a 0 1px, transparent 1px 20px), hsl(var(--surface-panel-2))` };
  if (motif === "dots")
    return { background: `${base}, radial-gradient(${accent}40 1.5px, transparent 1.6px) 0 0 / 15px 15px, hsl(var(--surface-panel-2))` };
  return { background: `${base}, hsl(var(--surface-panel-2))` };
}

export default function ClassCarousel({ classes, onContinue, onViewAll }: Props) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-bold tracking-tight">My classes</h2>
        <button type="button" onClick={onViewAll} className="min-h-11 text-xs font-semibold text-primary">View all <span aria-hidden="true">↗</span></button>
      </div>

      <div className="no-scrollbar -mx-5 flex snap-x snap-proximity gap-3 overflow-x-auto px-5 pb-1" data-scroll-restoration="home-classes" aria-label="Your classes">
        {classes.map((c, idx) => {
          const Glyph = c.glyph ?? GLYPHS[idx] ?? Target;
          return (
            <article key={c.id} className="w-[224px] flex-none snap-start overflow-hidden rounded-2xl border border-border bg-card">
              <div className="class-thumbnail relative grid h-[44px] place-items-center" style={thumbStyle(c.motif, c.accentColor)}>
                <span className="absolute left-[11px] top-2.5 flex items-center gap-1.5 rounded-md class-subject-label bg-card border border-border px-2 py-[3px] text-xs font-extrabold " style={{ color: c.accentColor }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.accentColor }} />
                  {c.subjectTag}
                </span>
                <Glyph aria-hidden="true" className="ml-auto mr-3 h-5 w-5 opacity-50" style={{ color: c.accentColor }} strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-2.5 px-3.5 pb-[15px] pt-3.5">
                <div>
                  <div className="break-words text-base font-extrabold tracking-tight">{c.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    {c.teacher}<span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />{c.students} {c.students === 1 ? 'student' : 'students'}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                    <span>Progress</span><span className="tabular-nums" style={{ color: c.accentColor }}>{c.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track">
                    <div className="h-full rounded-full" style={{ width: `${c.progress}%`, background: c.accentColor }} />
                  </div>
                </div>
                <button type="button" onClick={() => onContinue?.(c.id)} className="mt-0.5 flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-panel-2 py-2.5 text-xs font-semibold transition-colors active:bg-accent">
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
