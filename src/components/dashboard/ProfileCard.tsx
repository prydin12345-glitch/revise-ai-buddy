// src/components/dashboard/ProfileCard.tsx
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProfileStat, StudentProfile } from "./types";

interface ProfileCardProps {
  profile: StudentProfile;
  stats: ProfileStat[];
}

export default function ProfileCard({ profile, stats }: ProfileCardProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-col items-center text-center">
        <div className="relative grid h-14 w-14 place-items-center rounded-lg bg-secondary text-xl font-bold text-foreground">
          {profile.initials}
          <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-[3px] border-card bg-success" />
        </div>
        <div className="mt-3.5 text-lg font-extrabold tracking-tight">{profile.name}</div>
        <div className="mt-0.5 text-[12.5px] font-semibold text-muted-foreground">{profile.program}</div>
      </div>

      {/* icon + number, no container, hover for label */}
      <TooltipProvider delayDuration={120}>
        <div className="mt-5 grid w-full grid-cols-2 gap-2 border-t border-border pt-4">
          {stats.map((s) => {
            const Icon = s.icon;
            const Cmp: any = s.onClick ? "button" : "div";
            return (
              <Tooltip key={s.key}>
                <TooltipTrigger asChild>
                  <Cmp
                    onClick={s.onClick}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-md px-2 py-3 transition-colors hover:bg-panel-2 ${s.onClick ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <Icon className={`h-[22px] w-[22px] ${s.iconClass}`} />
                    <span className="text-xl font-bold tabular-nums tracking-tight">{s.value}</span>
                    <span className="text-xs leading-snug text-muted-foreground">{s.label}</span>
                  </Cmp>
                </TooltipTrigger>
                <TooltipContent className="font-bold">{s.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </section>
  );
}
