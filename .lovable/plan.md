The plan is approved! Before executing, please incorporate these 4 crucial technical guardrails into the implementation:

1. Safe Fallback Math:

- In `QuickStatsGrid.tsx`, prevent NaN/Infinity errors. If total answered questions is 0, display '--' for Avg Time/Question. 

- If `examResultsData.length < 2`, display 'Building...' for Mastery Velocity rather than calculating a slope.

2. Radar Chart Sizing & Truncation:

- In `SkillRadarCard.tsx`, set `outerRadius="65%"` on the Radar Chart to prevent subject text from clipping off the screen edges on 375px mobile viewports. Truncate subject labels longer than 12 characters with '...'.

3. Touch Ergonomics:

- In `RangeChips.tsx`, enforce a minimum touch height `min-h-[44px]`) for the 7D / 30D / All pill buttons so they are easily tappable without accidentally triggering chart tooltips.

4. SVG Radius Clamping:

- In `ReadinessRing.tsx`, strictly clamp all score values between 0 and 100 before computing `strokeDashoffset` to prevent rendering artifacts in iOS Safari.

Please proceed with building all files under `src/components/stats/mobile/` and wiring up `<MobileStatsTelemetry />` in `Stats.tsx`.

&nbsp;

&nbsp;

# Mobile Stats Redesign — Telemetry Dashboard

Scope: mobile branch of `src/pages/Stats.tsx` only (`isMobile === true`). Desktop layout, data hooks (`useExamStats`, `useUnifiedTopicPerformance`), and drilldown drawer are untouched. Weak Topics tab is preserved.

## Visual System

Scoped to the mobile stats surface via a wrapper class (`.stats-telemetry`) so tokens don't leak into the rest of the light-theme app.

- Surface: `hsl(220 10% 6%)` page bg, `hsl(220 10% 9%)` card, `hsl(220 8% 14%)` card border/hairlines
- Text: `hsl(0 0% 98%)` primary, `hsl(220 8% 62%)` muted
- Accents: lime `hsl(88 92% 58%)` (strong), cyan `hsl(190 95% 60%)` (steady), magenta `hsl(320 90% 62%)` (review), amber `hsl(38 95% 60%)` (developing)
- Radii: `rounded-2xl` cards, `rounded-full` pills, inner glows via `shadow-[0_0_24px_-8px_hsl(var(--accent)/0.6)]`
- Typography: existing font stack; hero number `text-5xl font-bold tracking-tight tabular-nums`

## Component Structure

New folder: `src/components/stats/mobile/`

```text
mobile/
  MobileStatsTelemetry.tsx    // Orchestrator: wraps sections, applies dark scope
  ReadinessRing.tsx           // Concentric SVG rings + centre score
  QuickStatsGrid.tsx          // 2x2 sparkline card grid
  SparklineCard.tsx           // Single metric card (icon, value, delta, sparkline)
  ScoreTrendCard.tsx          // Smooth spline area chart + range chips
  TopicTelemetryList.tsx      // Micro-row list of topics
  TopicTelemetryRow.tsx       // Single row (pill, mini bar, %/attempts)
  SkillRadarCard.tsx          // Radar/spider chart
  RangeChips.tsx              // 7D / 30D / All shared segmented control
  tokens.ts                   // Accent + mastery-to-colour helpers
```

`Stats.tsx` mobile branch replaces `MobileStatsHero + TopStatsCards + MobileChartSwitcher + RecentExamsTable` with a single `<MobileStatsTelemetry />`. The old mobile components stay in the repo (still imported by nothing) for one release, then can be deleted in a follow-up.

## Section Implementations

1. **ReadinessRing** — Three concentric SVG arcs (r=88/70/52) using `stroke-dasharray` animated via Framer Motion `animate` on mount. Rings: outer = overall mastery (`avgScore`), middle = topic coverage (`tested / total topics` from `useUnifiedTopicPerformance`), inner = quiz consistency (derived from `currentStreak / max(longestStreak, 7)`). Centre: big % + "Exam Readiness" caption + tiny legend chips below.
2. **QuickStatsGrid** — 2x2 grid, `grid-cols-2 gap-3`. Metrics:
  - Accuracy % (from `subjectPerformanceData` weighted mean)
  - Study Streak (`currentStreak`, delta vs `longestStreak`)
  - Avg Time / Question (compute from `studyActivityData` hours ÷ answered questions; if unavailable, show hours/day)
  - Mastery Velocity (weekly slope of `examResultsData`)
   Each card: 20px Lucide icon in accent-tinted square, value `text-2xl font-semibold`, 1-line delta, inline `<svg>` sparkline (path built from last 7 datapoints, `stroke-linecap="round"`, subtle gradient fill).
3. **ScoreTrendCard** — Recharts `AreaChart` with `type="monotone"`, single series from `examResultsData`. Neon lime stroke, gradient `<defs>` fill fading to transparent, custom dot only on final point (`activeDot` with a glow ring). `RangeChips` (7D/30D/All) wired to existing `timeRange` / `setTimeRange`.
4. **TopicTelemetryList** — Map `topics` from `useUnifiedTopicPerformance`. Row layout: `flex items-center gap-3 py-2.5 border-b border-white/5`. Left: 6px coloured dot (mastery colour) + topic name + subject pill (`text-[10px] uppercase tracking-wide`). Centre: 60px mini bar (`div` with gradient fill). Right: `text-sm tabular-nums` % and `text-[11px] muted` attempts. Cap at 8 rows with "View all" → routes to Weak Topics tab.
5. **SkillRadarCard** — Recharts `RadarChart` over top 6 subjects (or subtopics if a single subject dominates). Grid `stroke="hsl(220 8% 20%)"`, radar `stroke` lime, `fill` lime at 20% opacity. Axis labels `fill="hsl(220 8% 62%)" fontSize={10}`.
6. **Motion** — Framer Motion `motion.div` with staggered `initial={{opacity:0, y:8}} animate={{opacity:1, y:0}}` per section (delay 0/0.05/0.1/…). Ring arcs animate via `motion.circle` `strokeDashoffset`.

## Libraries

- Recharts (already used) — Area, Radar, Pie
- Framer Motion (already in project) — section stagger + ring draw-on
- Lucide icons — Flame, Target, Timer, TrendingUp, Radar, Activity
- No new dependencies

## Data & Hooks

All values derived from existing hooks — no schema or edge-function changes:

- `useExamStats` → totals, streaks, `examResultsData`, `studyActivityData`, `subjectPerformanceData`, `timeRange`
- `useUnifiedTopicPerformance` → topics list, mastery counts
- Derived helpers live in `mobile/tokens.ts` (pure functions, unit-testable)

## File Change Summary

- **Add:** 9 files under `src/components/stats/mobile/`
- **Edit:** `src/pages/Stats.tsx` — mobile branch only; swap 4 components for `<MobileStatsTelemetry />`; keep loading, tabs, drawer, weak-topics tab, and entire desktop branch unchanged
- **No changes:** hooks, desktop components, routes, backend

## Out of Scope

- Desktop redesign (untouched)
- Global dark mode toggle — telemetry palette is scoped to this surface only
- New data sources (Mastery Velocity uses derived slope, not a new column)
- Deleting legacy mobile components (kept for one release)