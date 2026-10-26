import { useEffect, useId, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line,
  Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar,
  RadarChart, ResponsiveContainer, Sector, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowLeft, BarChart3, Clock3, Maximize2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ChartDataTable } from "./ChartDataTable";
import { chartColour, chartDash } from "./chart-palette";
import type { UnifiedTopicScore, UnifiedMastery } from "@/hooks/useUnifiedTopicPerformance";
import type {
  StatsProfile, StatsTrendRow, StatsProfileTopics, StatsStudyDay,
} from "@/lib/subject-profile-stats";
import "@/styles/stats-topic-breakdown.css";

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
const tooltipTextStyle = { color: "hsl(var(--foreground))" };
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
  title, description, className, actions, visual, rows, series, footer, details,
  periodKey = "period", periodLabel = "Period", unit = "%", empty,
}: {
  title: string; description: string; className: string; actions?: ReactNode;
  visual: (height?: number) => ReactNode; rows: DataRow[]; series: Series[];
  footer?: ReactNode; details?: ReactNode; periodKey?: string; periodLabel?: string;
  unit?: string; empty?: ReactNode;
}) {
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  return <Dialog open={expanded} onOpenChange={setExpanded}>
    <section className={`subject-stats-panel ${className}`} aria-labelledby={titleId}>
      <header className="subject-stats-panel-heading">
        <div><h2 id={titleId}>{title}</h2></div>
        <div className="subject-stats-panel-actions">{actions}<DialogTrigger asChild>
          <button type="button" className="subject-stats-expand" aria-label={`View ${title.toLowerCase()} data`}>
            <Maximize2 size={14} aria-hidden="true" />
          </button>
        </DialogTrigger></div>
      </header>
      {empty ?? <div className="subject-stats-chart">{visual()}</div>}
      {!empty && footer && <div className="subject-stats-chart-footer">{footer}</div>}
    </section>
    <DialogContent className="subject-stats-expanded stats-chart-dialog max-w-3xl max-h-[88dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {empty ?? visual(320)}
      {!empty && footer && <div className="subject-stats-chart-footer">{footer}</div>}
      {!empty && <ChartDataTable caption={title} rows={rows} series={series} periodKey={periodKey} periodLabel={periodLabel} unit={unit} />}
      {details}
    </DialogContent>
  </Dialog>;
}

function EmptyChart({ title, icon = <BarChart3 aria-hidden="true"/> }: { title: string; icon?: ReactNode }) {
  return <div className="subject-stats-empty subject-stats-chart-empty" role="status">{icon}<h3>{title}</h3></div>;
}

export function ProfileTrendChart({ rows, profiles, timeRange, onTimeRangeChange }: {
  rows: StatsTrendRow[]; profiles: StatsProfile[]; timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}) {
  const active = profiles.filter(profile => rows.some(row => validPct(row[profile.id])));
  const data = rows.map(row => ({ ...row, ...Object.fromEntries(active.map(profile =>
    [profile.id, validPct(row[profile.id]) ? row[profile.id] : null])) }));
  const hasResults = data.some(row => active.some(profile => validPct(row[profile.id])));
  const chart = (height = 220) => <ResponsiveContainer width="100%" height={height}>
    <ComposedChart accessibilityLayer data={data} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
      <XAxis dataKey="period" tick={tickStyle} axisLine={false} tickLine={false} minTickGap={22} />
      <YAxis domain={[0, 100]} tick={tickStyle} axisLine={false} tickLine={false} width={42} tickFormatter={v => `${v}%`} />
      <Tooltip cursor={{ stroke: "hsl(var(--border))" }} contentStyle={tooltipStyle} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle}
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
  return <ChartPanel title="Exam score trends" description="Exam scores by profile"
    className="subject-stats-trend" visual={chart} rows={data} series={active.map(p => ({ key: p.id, label: p.name }))}
    actions={<label className="subject-stats-range"><span className="sr-only">Exam trend date range</span>
      <select aria-label="Exam trend date range" value={timeRange} onChange={e => onTimeRangeChange(e.target.value as TimeRange)}>
        <option value="weekly">Last 7 days</option><option value="monthly">Last 30 days</option><option value="yearly">Last 12 months</option>
      </select></label>}
    footer={<ProfileLegend profiles={active} allProfiles={profiles} />}
    empty={!hasResults ? <EmptyChart title="No marked exam results"/> : undefined} />;
}

type MarkedStatus = Exclude<UnifiedMastery, "untested">;
const statuses: Array<{ key: MarkedStatus; label: string; colour: string }> = [
  { key: "strong", label: "Strong", colour: "var(--stats-topic-strong)" },
  { key: "developing", label: "Developing", colour: "var(--stats-topic-developing)" },
  { key: "weak", label: "Needs attention", colour: "var(--stats-topic-weak)" },
];
const isMarked = (topic: UnifiedTopicScore) => topic.examScore !== null || topic.practiceScore !== null;

function TopicCategory({ category, topics, height, onBack }: {
  category: typeof statuses[number] & { count: number };
  topics: UnifiedTopicScore[];
  height?: number;
  onBack: () => void;
}) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => { back.current?.focus({ preventScroll: true }); }, [category.key]);
  return <div className="stats-topic-drill" style={{ "--topic-accent": category.colour, height: height ?? 204 } as CSSProperties}>
    <div className="stats-topic-drill-heading">
      <button ref={back} type="button" className="stats-topic-back" onClick={onBack} aria-label="Back to topic breakdown chart"><ArrowLeft aria-hidden="true"/><span>Back to chart</span></button>
      <span className="stats-topic-category" aria-live="polite" aria-atomic="true"><i aria-hidden="true"/>{category.label}<strong>{category.count}</strong></span>
    </div>
    <div className="stats-topic-drill-list" role="region" aria-label={`${category.label} topics`} tabIndex={0} style={{ maxHeight: height ? height - 52 : 172 }}>
      {topics.length ? <ul>{topics.map(topic => <li key={`${topic.subjectId}:${topic.topic}`}>
        <div><span>{topic.topic}</span><strong>{Math.round(topic.unifiedScore)}<small>%</small></strong></div>
        <span className="stats-topic-score-track" aria-hidden="true"><span style={{ width: `${topic.unifiedScore}%` }}/></span>
      </li>)}</ul> : <p className="stats-topic-category-empty">No topics in this group yet</p>}
    </div>
  </div>;
}

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

export function TopicBreakdownChart({ topics }: { topics: UnifiedTopicScore[] }) {
  const [selected, setSelected] = useState<MarkedStatus | null>(null);
  const marked = topics.filter(topic => isMarked(topic) && validPct(topic.unifiedScore));
  const data = statuses.map(status => ({ ...status, count: marked.filter(topic => topic.mastery === status.key).length }));
  const category = data.find(status => status.key === selected);
  const selectedTopics = selected ? marked.filter(topic => topic.mastery === selected)
    .sort((a, b) => a.unifiedScore - b.unifiedScore || a.topic.localeCompare(b.topic)) : [];
  const showChart = () => {
    const container = document.activeElement?.closest('.subject-stats-panel, [role="dialog"]');
    const categoryButton = container?.querySelector<HTMLButtonElement>(`button[data-topic-category="${selected}"]`);
    setSelected(null);
    categoryButton?.focus();
  };
  const sector = (raw: unknown) => {
    const shape = raw as ComponentProps<typeof Sector> & { name?: string };
    const status = data.find(row => row.label === shape.name);
    if (!status) return <Sector {...shape}/>;
    return <g role="button" className="stats-topic-sector" tabIndex={0} aria-label={`Show ${status.label.toLowerCase()} topics`}
      onClick={event => { event.stopPropagation(); setSelected(status.key); }} onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setSelected(status.key); }
      }}><Sector {...shape} aria-hidden="true" tabIndex={-1}/></g>;
  };
  const chart = (height = 204) => <ResponsiveContainer width="100%" height={height}>
    <PieChart accessibilityLayer>
      <Pie data={data.filter(row => row.count > 0)} dataKey="count" nameKey="label" cx="50%" cy="50%"
        innerRadius={height > 250 ? 82 : 56} outerRadius={height > 250 ? 112 : 78}
        startAngle={90} endAngle={-270} paddingAngle={2} stroke="none"
        labelLine={false} label={props => <DonutLabel cx={Number(props.cx)} cy={Number(props.cy)}
          midAngle={Number(props.midAngle)} outerRadius={Number(props.outerRadius)} percent={Number(props.percent)} fill={String(props.fill)} />}
        inactiveShape={sector} isAnimationActive={false} activeIndex={-1}>
        {data.filter(row => row.count > 0).map(row => <Cell key={row.key} fill={row.colour}/>)}
      </Pie>
      <text x="50%" y="49%" textAnchor="middle" dominantBaseline="central" fontSize={29} fontWeight={800} fill="hsl(var(--foreground))">{marked.length}</text>
      <text x="50%" y="60%" textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">topics</text>
      <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle} formatter={(value: number) => [value, "Topics"]} />
    </PieChart>
  </ResponsiveContainer>;
  const visual = (height?: number) => category ? <TopicCategory category={category} topics={selectedTopics} height={height} onBack={showChart}/> : chart(height);
  const footer = <div className="subject-stats-status-legend" aria-label="Marked topic status">
    {data.map(row => <button key={row.key} type="button" data-topic-category={row.key} onClick={() => setSelected(row.key)} aria-pressed={selected === row.key}
      aria-label={`${row.label}: ${row.count} topics`}><i style={{ background: row.colour }} aria-hidden="true" />
      {row.label}<strong>{row.count}</strong></button>)}
  </div>;
  return <ChartPanel title="Topic breakdown" description="Marked topic scores" className="subject-stats-breakdown"
    visual={visual} rows={data.map(row => ({ period: row.label, count: row.count }))} series={[{ key: "count", label: "Topics" }]}
    periodLabel="Status" unit="" footer={footer}
    empty={!marked.length && !category ? <EmptyChart title="No marked topics yet"/> : undefined} />;
}

/** Only genuine shared marked topics can define comparable radar axes. */
export function sharedRadarTopics(groups: StatsProfileTopics[]): string[] {
  if (!groups.length) return [];
  const normal = (name: string) => name.trim().toLowerCase();
  const maps = groups.map(group => new Map(group.topics.filter(topic => isMarked(topic) && validPct(topic.unifiedScore))
    .map(topic => [normal(topic.topic), topic.topic]))).filter(topics => topics.size > 0);
  if (!maps.length) return [];
  return [...maps[0]].filter(([key]) => maps.every(map => map.has(key))).map(([, name]) => name)
    .sort((a, b) => a.localeCompare(b)).slice(0, 5);
}

export function ProfileTopicRadar({ profiles, topicsByProfile }: {
  profiles: StatsProfile[]; topicsByProfile: StatsProfileTopics[];
}) {
  const eligible = useMemo(() => topicsByProfile.filter(group => profiles.some(profile => profile.id === group.profileId) &&
    group.topics.some(topic => isMarked(topic) && validPct(topic.unifiedScore))), [profiles, topicsByProfile]);
  const axes = useMemo(() => sharedRadarTopics(eligible), [eligible]);
  const active = profiles.filter(profile => eligible.some(group => group.profileId === profile.id));
  const rows: DataRow[] = axes.map(topic => ({ period: topic, ...Object.fromEntries(eligible.map(group =>
    [group.profileId, group.topics.find(value => value.topic.trim().toLowerCase() === topic.trim().toLowerCase())?.unifiedScore ?? null])) }));
  const chart = (height = 230) => <ResponsiveContainer width="100%" height={height}>
    <RadarChart accessibilityLayer data={rows} outerRadius="63%" margin={{ top: 16, right: 34, bottom: 18, left: 34 }}>
      <PolarGrid stroke="hsl(var(--border))" />
      <PolarAngleAxis dataKey="period" tick={{ ...tickStyle, fontSize: 9 }} tickLine={false} />
      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
      {active.map(profile => <Radar key={profile.id} name={profile.name} dataKey={profile.id}
        stroke={statsProfileColour(profiles, profile.id)} strokeDasharray={profilePattern(profiles, profile.id)}
        fill={statsProfileColour(profiles, profile.id)} fillOpacity={0.12} strokeWidth={1.8} isAnimationActive={false} />)}
      <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle} formatter={(value: number) => `${round(value)}%`} />
    </RadarChart>
  </ResponsiveContainer>;
  return <ChartPanel title="Topic spread" description="Shared topic scores by profile" className="subject-stats-radar"
    visual={chart} rows={rows} series={active.map(profile => ({ key: profile.id, label: profile.name }))}
    periodLabel="Topic" footer={<ProfileLegend profiles={active} allProfiles={profiles} />}
    empty={axes.length < 3 ? <EmptyChart title="Not enough shared topic data"/> : undefined} />;
}

export function ProfileStudyChart({ days, profiles, totalHours, unassignedHours }: {
  days: StatsStudyDay[]; profiles: StatsProfile[]; totalHours: number; unassignedHours: number;
}) {
  const active = profiles.filter(profile => days.some(day => Number.isFinite(day.hoursByProfile[profile.id]) && day.hoursByProfile[profile.id] > 0));
  const rows: DataRow[] = days.map(day => ({ period: day.day, ...Object.fromEntries(active.map(profile =>
    [profile.id, Number.isFinite(day.hoursByProfile[profile.id]) && day.hoursByProfile[profile.id] >= 0 ? day.hoursByProfile[profile.id] : null])) }));
  const chart = (height = 176) => <ResponsiveContainer width="100%" height={height}>
    <BarChart accessibilityLayer data={rows} margin={{ top: 10, right: 7, left: 0, bottom: 0 }} barCategoryGap="24%" barGap={2}>
      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
      <XAxis dataKey="period" tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={value => value.slice(0, 1)} />
      <YAxis tick={{ ...tickStyle, fontSize: 9 }} axisLine={false} tickLine={false} width={33} tickFormatter={value => `${value}h`} />
      <Tooltip cursor={false} contentStyle={tooltipStyle} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle}
        formatter={(value: number, name: string) => [`${round(value)}h`, active.find(profile => profile.id === name)?.name ?? name]} />
      {active.map(profile => <Bar key={profile.id} dataKey={profile.id} name={profile.id} maxBarSize={13}
        fill={statsProfileColour(profiles, profile.id)} radius={[2, 2, 0, 0]} isAnimationActive={false} />)}
    </BarChart>
  </ResponsiveContainer>;
  return <ChartPanel title="Study hours" description="Recorded study time this week" className="subject-stats-study"
    visual={height => <>{!height && <div className="subject-stats-study-summary stats-study-metric"><strong>{round(totalHours)}<small>h</small></strong><span>This week</span></div>}{chart(height)}</>}
    rows={rows} series={active.map(profile => ({ key: profile.id, label: profile.name }))} unit="h" periodLabel="Day"
    footer={<ProfileLegend profiles={active} allProfiles={profiles} />}
    details={unassignedHours > 0 ? <p className="stats-chart-detail">Unlinked revision: {round(unassignedHours)}h</p> : undefined}
    empty={!active.length ? <EmptyChart title="0 Hours studied this week" icon={<Clock3 aria-hidden="true"/>}/> : undefined} />;
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
  const chart = (height = 230) => <ResponsiveContainer width="100%" height={height}>
    <BarChart accessibilityLayer data={rows} margin={{ top: 12, right: 7, left: 0, bottom: 0 }} barCategoryGap="15%">
      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
      <XAxis dataKey="period" tick={{ ...tickStyle, fontSize: 9 }} axisLine={false} tickLine={false}
        interval={1} tickFormatter={value => `${String(value).split("–")[0]}%`} />
      <YAxis allowDecimals={false} tick={{ ...tickStyle, fontSize: 9 }} axisLine={false} tickLine={false} width={27} />
      <Tooltip cursor={false} contentStyle={tooltipStyle} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle} formatter={(value: number) => [value, "Topics"]} />
      <Bar dataKey="count" name="Topics" fill={chartColour(0)} fillOpacity={0.82} radius={[3, 3, 0, 0]} maxBarSize={30} isAnimationActive={false} />
    </BarChart>
  </ResponsiveContainer>;
  return <ChartPanel title="Topic score distribution" description="Marked topics by score band" className="subject-stats-distribution"
    visual={chart} rows={rows} series={[{ key: "count", label: "Topics" }]} periodLabel="Score band" unit=""
    empty={!hasResults ? <EmptyChart title="No marked topic scores yet"/> : undefined} />;
}
