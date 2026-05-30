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
    <section className="rounded-[20px] border border-border bg-card p-5 pt-6 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div className="relative grid h-[78px] w-[78px] place-items-center rounded-full bg-primary text-[28px] font-extrabold text-primary-foreground shadow-xl shadow-primary/30">
          {profile.initials}
          <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-[3px] border-card bg-success" />
        </div>
        <div className="mt-3.5 text-lg font-extrabold tracking-tight">{profile.name}</div>
        <div className="mt-0.5 text-[12.5px] font-semibold text-muted-foreground">{profile.program}</div>
      </div>

      {/* icon + number, no container, hover for label */}
      <TooltipProvider delayDuration={120}>
        <div className="mt-5 flex w-full justify-between gap-1.5">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Tooltip key={s.key}>
                <TooltipTrigger asChild>
                  <div className="flex flex-1 cursor-default flex-col items-center gap-2.5 rounded-xl px-1 py-2.5 transition-colors hover:bg-panel-2">
                    <Icon className={`h-[22px] w-[22px] ${s.iconClass}`} />
                    <span className="text-[19px] font-extrabold tabular-nums tracking-tight">{s.value}</span>
                  </div>
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
