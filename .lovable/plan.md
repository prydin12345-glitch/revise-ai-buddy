## Goal
Transform the mobile `/stats` page from a long, uneven scroll of differently-sized containers into a polished, app-like dashboard that feels intentional and professional on small screens — without changing the desktop layout.

## Current problems (mobile, <768px)
- `TopStatsCards` is a `flex-wrap` of variable-width chips → ragged rows.
- All chart cards stack full-width in one column with wildly different heights (WeeklyStudy ≠ ExamResults ≠ SubjectPerformance ≠ AccuracyTrend ≠ RecentExams) → endless scroll.
- Tabs (`Stats` / `Weak Topics`) scroll off the top, so users lose context.
- `RecentExamsTable` likely renders a wide table that overflows or shrinks awkwardly.
- No visual hierarchy: every card has equal weight, so the eye has nothing to anchor on.

## Proposed mobile redesign

### 1. Sticky compact header
- On mobile only, wrap the Tabs + page title in a `sticky top-0 z-20` bar with `bg-background/85 backdrop-blur` and a 1px bottom border.
- Tabs become equal-width segmented control (`grid-cols-2`, full width) instead of inline pills.

### 2. KPI grid (replaces wrapping chip row)
- Mobile: `grid grid-cols-2 gap-2` of 5 KPIs → 3 rows (last cell can span 2 or be the "Best Subject" hero).
- Each cell: fixed height (~84px), large value top-left, label bottom, accent left border kept.
- Removes the ragged wrap and gives a clean "scoreboard" feel.

### 3. Featured hero card: Average Score + sparkline
- Promote the most important metric (Avg Score) into a single full-width hero card above the KPI grid.
- Big number + 7-day mini sparkline pulled from `AccuracyTrendChart` data.
- Anchors the eye and sets professional tone.

### 4. Segmented chart switcher (collapses 4 charts into 1 viewport)
- On mobile, render `WeeklyStudyChart`, `ExamResultsChart`, `SubjectPerformanceChart`, `AccuracyTrendChart` inside one card with a segmented tab control at the top: `Activity · Results · Subjects · Accuracy`.
- One chart visible at a time, all at the same fixed height (~260px) → consistent, no layout jitter.
- Desktop is untouched — still a 12-col grid.

### 5. Recent Exams: card list, not table
- On mobile, render `RecentExamsTable` as a vertical list of compact rows (subject dot, exam name, score badge right-aligned, date below) instead of a horizontally-scrolling table.
- Show first 5, "View all" link to expand.

### 6. Consistent spacing & corners
- All mobile cards: `rounded-2xl`, `p-4`, `gap-3` between sections (currently `gap-4`).
- Reduce horizontal page padding from `px-4` to `px-3` on mobile to give charts more room.

## Layout (mobile)

```text
┌─────────────────────────────┐
│ Sticky: [Stats] [Weak (n)] │  ← segmented, full width
├─────────────────────────────┤
│  Avg Score   72%   ▁▃▅▆█▆▇  │  ← hero card
├──────────────┬──────────────┤
│ Exams   12   │ Hours  4.5h  │  ← KPI grid 2-col
├──────────────┼──────────────┤
│ Streak  6d   │ Best  Phys   │
├──────────────┴──────────────┤
│ [Activity|Results|Subj|Acc] │  ← segmented chart switcher
│                             │
│      (one chart, 260px)     │
│                             │
├─────────────────────────────┤
│ Recent Exams                │
│ • Maths Paper 1     78% ▸  │
│ • Physics Mock      65% ▸  │
│ ...                         │
└─────────────────────────────┘
```

## Files to change

- `src/pages/Stats.tsx` — add mobile branch using `useIsMobile`; wrap tabs in sticky header on mobile; render new mobile composition.
- `src/components/stats/TopStatsCards.tsx` — accept a `variant?: "wrap" | "grid"` prop; render `grid grid-cols-2` when `grid`.
- New `src/components/stats/MobileStatsHero.tsx` — hero avg-score card with sparkline (reuse data from `AccuracyTrendChart` hook).
- New `src/components/stats/MobileChartSwitcher.tsx` — segmented control wrapping the four chart components, fixed 260px chart area.
- `src/components/stats/RecentExamsTable.tsx` — add mobile card-list rendering branch (keep desktop table intact).

## Out of scope
- Desktop layout (unchanged).
- Weak Topics tab (already has its own structure; only the sticky tab header benefits it).
- Data/hook changes — purely presentational.
