import type { ProfileStat } from "./types";

/** Uses the same values and drill-down callbacks as the existing profile card. */
export default function DashboardSummaryStrip({ stats }: { stats: ProfileStat[] }) {
  return (
    <section className="laptop-home-summary" aria-label="Your study summary">
      {stats.map(({ key, icon: Icon, value, label, iconClass, onClick }) => {
        const Component = onClick ? "button" : "div";
        return (
          <Component key={key} type={onClick ? "button" : undefined} onClick={onClick}
            className="laptop-home-stat" aria-label={`${label}: ${value}`}>
            <span className="laptop-home-stat-content">
              <Icon className={`h-6 w-6 shrink-0 ${iconClass}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-2xl font-bold tracking-tight tabular-nums">{value}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
              </span>
            </span>
          </Component>
        );
      })}
    </section>
  );
}
