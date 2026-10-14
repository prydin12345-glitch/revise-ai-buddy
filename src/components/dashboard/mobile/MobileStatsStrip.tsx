import type { ProfileStat } from '../types';

export default function MobileStatsStrip({ stats }: { stats: ProfileStat[] }) {
  return <dl aria-label="Your study summary" className="grid grid-cols-4 divide-x divide-border rounded-2xl border border-border bg-card py-1">
    {stats.map(stat => {
      const Icon = stat.icon;
      const value = <><Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${stat.iconClass}`} /><span className="text-[17px] font-bold leading-none tabular-nums">{stat.value}</span></>;
      return <div key={stat.key} className="min-w-0">
        <dt className="sr-only">{stat.label}</dt>
        <dd>{stat.onClick
          ? <button type="button" onClick={stat.onClick} aria-label={`${stat.label}: ${stat.value}`} title={stat.label} className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-lg focus-visible:outline-offset-[-3px]">{value}</button>
          : <span className="flex min-h-12 items-center justify-center gap-1.5" title={stat.label}>{value}</span>}
        </dd>
      </div>;
    })}
  </dl>;
}
