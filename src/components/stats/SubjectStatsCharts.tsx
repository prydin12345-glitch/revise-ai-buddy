import { useId, useMemo, useState, type ReactNode } from "react";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line,
  Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar,
  RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Maximize2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ChartDataTable } from "./ChartDataTable";
import { chartColour, chartDash } from "./chart-palette";
import type { UnifiedTopicScore, UnifiedMastery } from "@/hooks/useUnifiedTopicPerformance";
import type {
  StatsProfile, StatsTrendRow, StatsProfileTopics, StatsStudyDay,
} from "@/lib/subject-profile-stats";

type DataRow = Record<string, number | string | boolean | null>;
type Series = { key: string; label: string };
type TimeRange = "weekly" | "monthly" | "yearly";
const profilePalette = [0, 3, 2, 1, 4, 5];
export const statsProfileColour = (profiles: StatsProfile[], id: string) => {
  const index = Math.max(0, profiles.findIndex(profile => profile.id === id));
  return chartColour(profilePalette[index % profilePalette.length]);
};
const profilePattern = (profiles: StatsProfile[], id: string) =>
  chartDash(Math.max(0, profiles.findIndex(profile => profile.id === id)));
const validPct = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
const round = (value: number) => Math.round(value * 10) / 10;
const tooltipStyle = {
  background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
  borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))",
};
const tickStyle = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };

function ProfileLegend({ profiles, allProfiles }: { profiles: StatsProfile[]; allProfiles: StatsProfile[] }) {
  return <div className="subject-stats-legend" aria-label="Exam profile legend">
    {profiles.map(profile => <span key={profile.id}>
      <i aria-hidden="true" style={{ background: statsProfileColour(allProfiles, profile.id) }} />
      <span>{profile.name}</span>
    </span>)}
  </div>;
}

function ChartPanel({
  title, description, className, actions, visual, rows, series, footer, note,
  periodKey = "period", periodLabel = "Period", unit = "%", empty,
}: {
  title: string; description: string; className: string; actions?: ReactNode;
  visual: (height?: number) => ReactNode; rows: DataRow[]; series: Series[];
  footer?: ReactNode; note?: string; periodKey?: string; periodLabel?: string;
  unit?: string; empty?: ReactNode;
}) {
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  return <Dialog open={expanded} onOpenChange={setExpanded}>
    <section className={`subject-stats-panel ${className}`} aria-labelledby={titleId}>
      <header className="subject-stats-panel-heading">
        <div><h2 id={titleId}>{title}</h2><p>{description}</p></div>
        <div className="subject-stats-panel-actions">{actions}<DialogTrigger asChild>
          <button type="button" className="subject-stats-expand" aria-label={`View ${title.toLowerCase()} data`}>
            <Maximize2 size={14} aria-hidden="true" />
          </button>
        </DialogTrigger></div>
      </header>
      {empty ?? <div className="subject-stats-chart">{visual()}</div>}
      {footer && <div className="subject-stats-chart-footer">{footer}</div>}
      {note && <p className="subject-stats-caption">{note}</p>}
    </section>
    <DialogContent className="subject-stats-expanded stats-chart-dialog max-w-3xl max-h-[88dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {empty ?? visual(320)}
      {footer && <div className="subject-stats-chart-footer">{footer}</div>}
      <ChartDataTable caption={title} rows={rows} series={series} periodKey={periodKey} periodLabel={periodLabel} unit={unit} />
      {note && <p className="subject-stats-caption">{note}</p>}
    </DialogContent>
  </Dialog>;
}

function EmptyChart({ title, children }: { title: string; children: ReactNode }) {
  return <div className="subject-stats-empty" role="status"><h3>{title}</h3><p>{children}</p></div>;
}

export function ProfileTrendChart({ rows, profiles, timeRange, onTimeRangeChange }: {
  rows: StatsTrendRow[]; profiles: StatsProfile[]; timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}) {
  const active = profiles.filter(profile => rows.some(row => Object.prototype.hasOwnProperty.call(row, profile.id)));
  const data = rows.map(row => ({ ...row, ...Object.fromEntries(active.map(profile =>
    [profile.id, validPct(row[profile.id]) ? row[profile.id] : null])) }));
  const hasResults = data.some(row => active.some(profile => validPct(row[profile.id])));
  const chart = (height = 220) => <ResponsiveContainer width="100%" height={height}>
    <ComposedChart accessibilityLayer data={data} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
      <XAxis dataKey="period" tick={tickStyle} axisLine={false} tickLine={false} minTickGap={22} />
      <YAxis domain={[0, 100]} tick={tickStyle} axisLine={false} tickLine={false} width={42} tickFormatter={v => `${v}%`} />
      <Tooltip cursor={{ stroke: "hsl(var(--border))" }} contentStyle={tooltipStyle}
        formatter={(value: number, name: string) => [`${round(value)}%`, active.find(profile => profile.id === name)?.name ?? name]} />
      {active.map((profile, index) => index === 0 ? <Area key={profile.id}
        type="monotone" dataKey={profile.id} name={profile.id}
        fill={statsProfileColour(profiles, profile.id)} fillOpacity={0.08}
        stroke={statsProfileColour(profiles, profile.id)} strokeWidth={2.5}
        strokeDasharray={profilePattern(profiles, profile.id)} connectNulls={false}
        dot={{ r: 3, fill: "hsl(var(--card))", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} /> :
        <Line key={profile.id} type="monotone" dataKey={profile.id} name={profile.id}
          stroke={statsProfileColour(profiles, profile.id)} strokeWidth={2.5}
          strokeDasharray={profilePattern(profiles, profile.id)} connectNulls={false}
          dot={{ r: 3, fill: "hsl(var(--card))", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />)}
    </ComposedChart>
  </ResponsiveContainer>;
  return <ChartPanel title="Exam score trends" description="Each line follows one saved exam profile"
    className="subject-stats-trend" visual={chart} rows={data} series={active.map(p => ({ key: p.id, label: p.name }))}
    actions={<label className="subject-stats-range"><span className="sr-only">Exam trend date range</span>
      <select aria-label="Exam trend date range" value={timeRange} onChange={e => onTimeRangeChange(e.target.value as TimeRange)}>
        <option value="weekly">Last 7 days</option><option value="monthly">Last 30 days</option><option value="yearly">Last 12 months</option>
      </select></label>}
    footer={<ProfileLegend profiles={active} allProfiles={profiles} />}
    note="Curves join recorded averages; they aren’t extra results. The date range applies to this chart."
    empty={!hasResults ? <EmptyChart title="No marked exam results in this range">Choose a wider range, or complete an exam to see its marked results here.</EmptyChart> : undefined} />;
}

type MarkedStatus = Exclude<UnifiedMastery, "untested">;
const statuses: Array<{ key: MarkedStatus; label: string; colour: string }> = [
  { key: "strong", label: "Strong", colour: chartColour(2) },
  { key: "developing", label: "Developing", colour: chartColour(0) },
  { key: "weak", label: "Needs attention", colour: chartColour(1) },
];
const isMarked = (topic: UnifiedTopicScore) => topic.examScore !== null || topic.practiceScore !== null;

function DonutLabel({ cx, cy, midAngle, outerRadius, percent, fill }: {
  cx: number; cy: number; midAngle: number; outerRadius: number; percent: number; fill: string;
}) {
  if (percent <= 0) return null;
  const rad = -midAngle * Math.PI / 180;
  const x0 = cx + Math.cos(rad) * (outerRadius + 3), y0 = cy + Math.sin(rad) * (outerRadius + 3);
  const x1 = cx + Math.cos(rad) * (outerRadius + 13), y1 = cy + Math.sin(rad) * (outerRadius + 13);
  const right = x1 >= cx, x2 = x1 + (right ? 12 : -12);
  return <g><path d={`M${x0},${y0}L${x1},${y1}H${x2}`} stroke={fill} fill="none" strokeWidth={1.2} />
    <text x={x2 + (right ? 3 : -3)} y={y1} dy=".32em" textAnchor={right ? "start" : "end"}
      fill="hsl(var(--muted-foreground))" fontSize={10}>{Math.round(percent * 100)}%</text></g>;
}

export function TopicBreakdownChart({ topics, onStatusSelect }: {
  topics: UnifiedTopicScore[]; onStatusSelect?: (status: MarkedStatus) => void;
}) {
  const marked = topics.filter(topic => isMarked(topic) && validPct(topic.unifiedScore));
  const data = statuses.map(status => ({ ...status, count: marked.filter(topic => topic.mastery === status.key).length }));
  const chart = (height = 193) => <ResponsiveContainer width="100%" height={height}>
    <PieChart accessibilityLayer>
      <Pie data={data.filter(row => row.count > 0)} dataKey="count" nameKey="label" cx="50%" cy="50%"
        innerRadius={height > 200 ? 82 : 51} outerRadius={height > 200 ? 112 : 72}
        startAngle={90} endAngle={-270} paddingAngle={2} stroke="none"
        labelLine={false} label={props => <DonutLabel cx={Number(props.cx)} cy={Number(props.cy)}
          midAngle={Number(props.midAngle)} outerRadius={Number(props.outerRadius)} percent={Number(props.percent)} fill={String(props.fill)} />}
        isAnimationActive={false} activeIndex={-1}>
        {data.filter(row => row.count > 0).map(row => <Cell key={row.key} fill={row.colour} />)}
      </Pie>
      <text x="50%" y="49%" textAnchor="middle" dominantBaseline="central" fontSize={29} fontWeight={800} fill="hsl(var(--foreground))">{marked.length}</text>
      <text x="50%" y="61%" textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">marked topics</text>
      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value, "Topics"]} />
    </PieChart>
  </ResponsiveContainer>;
  const footer = <div className="subject-stats-status-legend" aria-label="Marked topic status">
    {data.map(row => <button key={row.key} type="button" onClick={() => onStatusSelect?.(row.key)} disabled={!onStatusSelect}
      aria-label={`${row.label}: ${row.count} topics`}><i style={{ background: row.colour }} aria-hidden="true" />
      {row.label}<strong>{row.count}</strong></button>)}
  </div>;
  return <ChartPanel title="Topic breakdown" description="Marked topics in this selection" className="subject-stats-breakdown"
    visual={chart} rows={data.map(row => ({ period: row.label, count: row.count }))} series={[{ key: "count", label: "Topics" }]}
    periodLabel="Status" unit="" footer={footer} note={`${marked.length} marked topics · not whole-syllabus coverage.`}
    empty={!marked.length ? <EmptyChart title="Marked topics will appear here">Complete an exam or quiz to start seeing your topic progress.</EmptyChart> : undefined} />;
}

/** Only genuine shared marked topics can define comparable radar axes. */
export function sharedRadarTopics(groups: StatsProfileTopics[]): string[] {
  if (!groups.length) return [];
  const normal = (name: string) => name.trim().toLowerCase();
  const maps = groups.map(group => new Map(group.topics.filter(topic => isMarked(topic) && validPct(topic.unifiedScore))
    .map(topic => [normal(topic.topic), topic.topic])));
  return [...maps[0]].filter(([key]) => maps.every(map => map.has(key))).map(([, name]) => name)
    .sort((a, b) => a.localeCompare(b)).slice(0, 5);
}

export function ProfileTopicRadar({ profiles, topicsByProfile }: {
  profiles: StatsProfile[]; topicsByProfile: StatsProfileTopics[];
}) {
  const axes = useMemo(() => sharedRadarTopics(topicsByProfile), [topicsByProfile]);
  const active = profiles.filter(profile => topicsByProfile.some(group => group.profileId === profile.id));
  const rows: DataRow[] = axes.map(topic => ({ period: topic, ...Object.fromEntries(topicsByProfile.map(group =>
    [group.profileId, group.topics.find(value => value.topic.trim().toLowerCase() === topic.trim().toLowerCase())?.unifiedScore ?? null])) }));
  const chart = (height = 230) => <ResponsiveContainer width="100%" height={height}>
    <RadarChart accessibilityLayer data={rows} outerRadius="63%" margin={{ top: 16, right: 34, bottom: 18, left: 34 }}>
      <PolarGrid stroke="hsl(var(--border))" />
      <PolarAngleAxis dataKey="period" tick={{ ...tickStyle, fontSize: 9 }} tickLine={false} />
      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
      {active.map(profile => <Radar key={profile.id} name={profile.name} dataKey={profile.id}
        stroke={statsProfileColour(profiles, profile.id)} strokeDasharray={profilePattern(profiles, profile.id)}
        fill={statsProfileColour(profiles, profile.id)} fillOpacity={0.12} strokeWidth={1.8} isAnimationActive={false} />)}
      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `${round(value)}%`} />
    </RadarChart>
  </ResponsiveContainer>;
  return <ChartPanel title="Topic spread" description="Compare shared marked topic areas by profile" className="subject-stats-radar"
    visual={chart} rows={rows} series={active.map(profile => ({ key: profile.id, label: profile.name }))}
    periodLabel="Topic" footer={<ProfileLegend profiles={active} allProfiles={profiles} />}
    note="Axes = marked topic scores · scale 0–100%. Unassessed areas are not zero."
    empty={axes.length < 3 ? <EmptyChart title="Not enough shared topic evidence">At least three marked topics must be shared by the selected profiles to draw a useful comparison.</EmptyChart> : undefined} />;
}

export function ProfileStudyChart({ days, profiles, totalHours, unassignedHours }: {
  days: StatsStudyDay[]; profiles: StatsProfile[]; totalHours: number; unassignedHours: number;
}) {
  const active = profiles.filter(profile => days.some(day => Object.prototype.hasOwnProperty.call(day.hoursByProfile, profile.id)));
  const rows: DataRow[] = days.map(day => ({ period: day.day, ...Object.fromEntries(active.map(profile =>
    [profile.id, Number.isFinite(day.hoursByProfile[profile.id]) && day.hoursByProfile[profile.id] >= 0 ? day.hoursByProfile[profile.id] : null])) }));
  const chart = (height = 176) => <ResponsiveContainer width="100%" height={height}>
    <BarChart accessibilityLayer data={rows} margin={{ top: 10, right: 7, left: 0, bottom: 0 }} barCategoryGap="24%" barGap={2}>
      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
      <XAxis dataKey="period" tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={value => value.slice(0, 1)} />
      <YAxis tick={{ ...tickStyle, fontSize: 9 }} axisLine={false} tickLine={false} width={33} tickFormatter={value => `${value}h`} />
      <Tooltip cursor={false} contentStyle={tooltipStyle}
        formatter={(value: number, name: string) => [`${round(value)}h`, active.find(profile => profile.id === name)?.name ?? name]} />
      {active.map(profile => <Bar key={profile.id} dataKey={profile.id} name={profile.id} maxBarSize={13}
        fill={statsProfileColour(profiles, profile.id)} radius={[2, 2, 0, 0]} isAnimationActive={false} />)}
    </BarChart>
  </ResponsiveContainer>;
  return <ChartPanel title="Study hours" description="This week · time linked to selected profiles" className="subject-stats-study"
    visual={height => <>{!height && <div className="subject-stats-study-summary"><strong>{round(totalHours)}<small>h</small></strong><span>recorded time</span></div>}{chart(height)}</>}
    rows={rows} series={active.map(profile => ({ key: profile.id, label: profile.name }))} unit="h" periodLabel="Day"
    footer={<ProfileLegend profiles={active} allProfiles={profiles} />}
    note={`Exam & quiz time. ${unassignedHours > 0 ? `${round(unassignedHours)}h of unassigned subject revision is separate.` : "Unassigned revision tasks are excluded."}`}
    empty={!active.length ? <EmptyChart title="No profile-linked study time yet">Completed exams and quizzes with recorded time will appear here. Unassigned revision stays separate.</EmptyChart> : undefined} />;
}

export function topicScoreBins(topics: UnifiedTopicScore[]) {
  const counts = Array<number>(10).fill(0);
  topics.filter(topic => isMarked(topic) && validPct(topic.unifiedScore)).forEach(topic => {
    counts[Math.min(9, Math.floor(topic.unifiedScore / 10))] += 1;
  });
  return counts.map((count, index) => ({ period: `${index * 10}–${index === 9 ? 100 : index * 10 + 9}%`, count }));
}

export function TopicScoreDistribution({ topics }: { topics: UnifiedTopicScore[] }) {
  const rows = topicScoreBins(topics);
  const hasResults = rows.some(row => row.count > 0);
  const chart = (height = 180) => <ResponsiveContainer width="100%" height={height}>
    <BarChart accessibilityLayer data={rows} margin={{ top: 12, right: 7, left: 0, bottom: 0 }} barCategoryGap="15%">
      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
      <XAxis dataKey="period" tick={{ ...tickStyle, fontSize: 9 }} axisLine={false} tickLine={false}
        interval={1} tickFormatter={value => `${String(value).split("–")[0]}%`} />
      <YAxis allowDecimals={false} tick={{ ...tickStyle, fontSize: 9 }} axisLine={false} tickLine={false} width={27} />
      <Tooltip cursor={false} contentStyle={tooltipStyle} formatter={(value: number) => [value, "Topics"]} />
      <Bar dataKey="count" name="Topics" fill={chartColour(0)} fillOpacity={0.82} radius={[3, 3, 0, 0]} maxBarSize={30} isAnimationActive={false} />
    </BarChart>
  </ResponsiveContainer>;
  return <ChartPanel title="Topic score distribution" description="Where your marked topic scores fall" className="subject-stats-distribution"
    visual={chart} rows={rows} series={[{ key: "count", label: "Topics" }]} periodLabel="Score band" unit=""
    note="Each topic is counted once in a ten-point score band within this selection."
    empty={!hasResults ? <EmptyChart title="No marked topic scores yet">A distribution appears once your work has been marked.</EmptyChart> : undefined} />;
}
