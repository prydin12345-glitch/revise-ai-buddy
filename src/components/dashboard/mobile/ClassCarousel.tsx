// src/components/dashboard/mobile/ClassCarousel.tsx
import { Clock, ArrowRight, TrendingUp, ListChecks, Target, type LucideIcon } from "lucide-react";
import type { ClassItem } from "../types";

interface Props {
  classes: ClassItem[];
  onContinue?: (id: string) => void;
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

export default function ClassCarousel({ classes, onContinue }: Props) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-[18px]">
        <h2 className="text-[17px] font-extrabold tracking-tight">My Classes</h2>
        <button className="flex items-center gap-0.5 text-[13px] font-bold text-primary">All ›</button>
      </div>

      <div className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-[18px] pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {classes.map((c, idx) => {
          const Glyph = c.glyph ?? GLYPHS[idx] ?? Target;
          return (
            <article key={c.id} className="w-[230px] flex-none snap-start overflow-hidden rounded-[18px] border border-border bg-card">
              <div className="relative grid h-[72px] place-items-center" style={thumbStyle(c.motif, c.accentColor)}>
                <span className="absolute left-[11px] top-2.5 flex items-center gap-1.5 rounded-md bg-black/40 px-2 py-[3px] text-[10px] font-extrabold backdrop-blur" style={{ color: c.accentColor }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.accentColor }} />
                  {c.subjectTag}
                </span>
                <Glyph className="h-[34px] w-[34px] opacity-35" style={{ color: c.accentColor }} strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-2.5 px-3.5 pb-[15px] pt-3.5">
                <div>
                  <div className="truncate text-[15px] font-extrabold tracking-tight">{c.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
                    {c.teacher}<span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />{c.students} students
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                    <span>Progress</span><span className="tabular-nums" style={{ color: c.accentColor }}>{c.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full" style={{ width: `${c.progress}%`, background: c.accentColor }} />
                  </div>
                </div>
                <button onClick={() => onContinue?.(c.id)} className="mt-0.5 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-panel-2 py-2.5 text-[12.5px] font-extrabold transition-colors active:bg-primary active:text-primary-foreground">
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
