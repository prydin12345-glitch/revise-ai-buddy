// src/components/dashboard/mobile/MobileSpeedDial.tsx
// Single round button that fans out three circular options on tap.
import { useState } from "react";
import { Plus, FileText, ListChecks, Sparkles, type LucideIcon } from "lucide-react";

interface MobileSpeedDialProps {
  onCreateExam?: () => void;
  onCreateQuiz?: () => void;
  onAskAI?: () => void;
  aiUnreadCount?: number;
}

interface Opt {
  key: string;
  dx: number;
  dy: number;
  className: string;
  icon: LucideIcon;
  label: string;
  action?: () => void;
  badge?: number;
}

export default function MobileSpeedDial({ onCreateExam, onCreateQuiz, onAskAI, aiUnreadCount }: MobileSpeedDialProps) {
  const [open, setOpen] = useState(false);

  const opts: Opt[] = [
    { key: "exam", dx: 4, dy: -130, className: "bg-primary", icon: FileText, label: "Create Exam", action: onCreateExam },
    { key: "quiz", dx: -76, dy: -100, className: "bg-success", icon: ListChecks, label: "Practice Quiz", action: onCreateQuiz },
    { key: "ai", dx: -118, dy: 0, className: "bg-[linear-gradient(135deg,#7c5cff,#a78bfa)]", icon: Sparkles, label: "Ask AI", action: onAskAI, badge: aiUnreadCount },
  ];

  const fire = (o: Opt) => { setOpen(false); o.action?.(); };

  return (
    <>
      {/* backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[54] bg-black/45 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div className="fixed bottom-[104px] right-[18px] z-[55] h-14 w-14 md:bottom-6">
        {opts.map((o, i) => {
          const Icon = o.icon;
          return (
            <button
              key={o.key}
              onClick={() => fire(o)}
              style={{
                opacity: open ? 1 : 0,
                transform: open ? `translate(${o.dx}px, ${o.dy}px) scale(1)` : "translate(0,0) scale(.4)",
                transitionDelay: `${open ? i * 45 : (opts.length - 1 - i) * 30}ms`,
                pointerEvents: open ? "auto" : "none",
              }}
              className={`absolute bottom-1 right-1 z-[2] grid h-12 w-12 place-items-center rounded-2xl text-white shadow-xl transition-[transform,opacity] duration-[380ms] ${o.className}`}
            >
              <span className="pointer-events-none absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-[10px] border border-border bg-[hsl(var(--popover)/0.96)] px-2.5 py-1.5 text-xs font-extrabold text-foreground shadow-lg">
                {o.label}
              </span>
              <Icon className="h-[21px] w-[21px]" />
              {o.badge && o.badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-background">
                  {o.badge > 9 ? '9+' : o.badge}
                </span>
              )}
            </button>
          );
        })}
        {/* main button */}
        <button
          onClick={() => setOpen((v) => !v)}
          className={`absolute bottom-0 right-0 z-[3] grid h-14 w-14 place-items-center rounded-[19px] bg-primary text-primary-foreground shadow-xl shadow-primary/40 transition-transform duration-300 ${
            open ? "rotate-45" : ""
          }`}
        >
          <Plus className="h-[26px] w-[26px]" />
        </button>
      </div>
    </>
  );
}
