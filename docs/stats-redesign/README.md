# Stats dashboard redesign

The previous desktop page hid summary labels in tooltips and used a large,
single-subject gauge. Mobile used a different palette, small typography and
dense miniature charts. The new composition uses three staggered dashboard
columns instead of a row of KPI cards followed by large, uniform chart rows.
Score-history bars and paired semicircle gauges sit on the left; ranked revision
strips, the accuracy trend and topic-progress rings sit in the centre; compact
summary figures and small subject-history charts sit on the right. Tablet widths
use two columns. Mobile combines the same visual modules with the existing
grade-target, mastery and streak drilldowns, then shows revision priorities,
score history, study activity, subject charts and upcoming exams.

Examly's neutral surfaces and navy accent remain, with restrained elevation,
readable percentages and colours adjusted for both themes. The reference
informed the layout and visual hierarchy; none of its images or example
statistics are used in the product.

## Existing statistics retained

| View | Statistics and controls |
| --- | --- |
| Desktop/tablet overview | Average exam score, completed/published/remaining exams, current-week study hours, current/best streak and strongest subject; summary drilldowns |
| Desktop/tablet analysis | Score trends and existing 7-day/30-day/12-month ranges, subject averages/counts/history, current-week study activity, 12-week accuracy, readiness/topic-accuracy gauges, mastery/coverage rings, revision priorities and graded-exam search/pagination/review |
| Mobile overview | Existing readiness estimate, marked-topic accuracy, grade targets met, mastered/developing/review counts, streak, revision priorities, study activity, subject accuracy and upcoming exam schedule |
| Mobile detail views | Existing topic filters, tracked-topic coverage, subject/topic drilldowns, predicted/target grades, grade boundaries, trend range controls and local exam settings |
| Weak Topics | Existing subject/mastery filters, topic details and review actions |

The average exam score remains the existing mean of subject averages. The
existing mobile readiness estimate is also displayed on desktop, with the same
weighting: 60% exam average, 25% tracked-topic
coverage and 15% streak consistency. No scoring, grade, goal or mastery formula
changed. Production components contain no fixture data.

Supabase tables, selected columns, ownership filters, ordering and date ranges
are unchanged. The existing read queries in `useExamStats` now throw returned
errors into its existing catch path, and a retry clears the previous error.
The accuracy chart also shows a retry when its existing read fails. These client
error-handling changes prevent failures from looking like empty data.

Chart series use theme-specific blue, amber and teal colours, with subject
legends and accessible data tables. Small subject charts use the same actual,
range-filtered buckets as the main score chart: missing periods remain missing
and true zero scores remain zero. Labels distinguish overall subject averages
from range-filtered history. Subject-history and study-bar charts share the same palette across desktop and mobile;
saved subject colours are unchanged. Gauges and rings reflect existing percentages,
with their denominators shown. The overview highlights two revision priorities;
the full Topics view remains available through View all. Status text accompanies colour. Detail
sheets use the existing Radix dialog for titles, close controls, keyboard focus
and focus restoration. Reduced-motion settings disable decorative animation.

## Verification

Baseline: remote `main` at `cb5e241c26c9b56cf7d3bdfa7621acf687cde150`,
with 1,562 passing tests in 98 files before this task.

Node **24.19.0**, existing `package-lock.json`:

| Command | Result |
| --- | --- |
| `npm ci --cache /workspace/.npm-cache` | PASS; 863 packages installed |
| `npm run check` | PASS; typecheck, critical hook lint, 1,586 tests in 101 files, Edge Function identifier checks, 38 Edge Function bundles and production build |
| `npx vitest run src/test/stats-data.test.tsx src/test/stats-presentation.test.tsx src/test/stats-modular-dashboard.test.tsx` | PASS; 24 focused tests in 3 files |
| Additional `npm run typecheck` and `npm run lint:critical` after the final loading/semantic markup adjustments | PASS |
| Standalone `npm run build` | PASS |
| `git diff --check` | PASS |

Focused tests cover unchanged score/time/streak/goal calculations, genuine zero
scores, zero-mark exclusion, range filters, read-error recovery, summary actions,
subject selection, exam search/pagination/review destinations, loading/error
states, chart tables and dialog focus restoration. New module tests cover the
shared readiness formula, pending-work exclusion, correct mastery and coverage
denominators, missing/zero history, priority ordering and gauge detail actions.

Existing warnings: deprecated/stub packages during installation, an outdated
Browserslist database, production chunks over 500 kB, and React DOM nesting
warnings in unrelated test fixtures. No dependency, lockfile, backend, database,
exam-generation, marking or authentication files changed. No migration or Edge
Function deployment is required.

### Chromium review and screenshots

Vite served the existing Stats page/components in a local, auth-free browser
harness. Data hooks were stubbed with synthetic examples and a simplified local
dashboard frame with the actual workspace content padding; all Supabase browser requests were blocked. This harness is
outside the repository and is not a production route. Every screenshot is
labelled **Local preview · fixture data**.

Before captures use the original baseline JavaScript and CSS compiled from its
own source revision. After captures use the redesigned components and current
Vite styles. Both use the same fixture data and workspace content padding.

Checked **320, 390, 768, 834, 1024, 1194 and 1440 CSS pixels wide**, with a 1,000-pixel viewport
height, in **light and dark** themes. No horizontal page overflow, JavaScript
errors, console errors, certificate/request failures or backend requests were
observed. Google Fonts loaded through normal certificate verification.

Interaction checks passed for tabs, date ranges, previous/next subject controls,
chart expansion, result search/pagination, detail sheets, Escape, close controls
and focus restoration. Loading, empty and failed/retry states were checked at
390 and 1440 pixels in both themes. Thirty automated accessibility scans across
overview, topics, performance, detail dialogs and these states found **zero
WCAG 2 A/AA and 2.1 A/AA violations**; this does not replace a full manual audit.

| Size/theme | Before | After |
| --- | --- | --- |
| Mobile, 390px, light | [Before](screenshots/before-mobile-light.png) | [After](screenshots/after-mobile-light.png) |
| Mobile, 390px, dark | [Before](screenshots/before-mobile-dark.png) | [After](screenshots/after-mobile-dark.png) |
| Tablet, 768px, light | [Before](screenshots/before-tablet-light.png) | [After](screenshots/after-tablet-light.png) |
| Tablet, 768px, dark | [Before](screenshots/before-tablet-dark.png) | [After](screenshots/after-tablet-dark.png) |
| Desktop, 1440px, light | [Before](screenshots/before-desktop-light.png) | [After](screenshots/after-desktop-light.png) |
| Desktop, 1440px, dark | [Before](screenshots/before-desktop-dark.png) | [After](screenshots/after-desktop-dark.png) |

These are Chromium viewport checks, not physical iOS/iPadOS tests. Live
authenticated account data, the complete authenticated dashboard shell and
real-device onscreen keyboards remain unverified. No real account was logged
into, live records changed or paid paper generated.

## Current data limitations

- The study hook supplies only the current week. Existing historical-week
  controls remain, with a notice that the displayed data covers the current
  week. Historical fetching would require a separate functional task.
- Coverage describes **tracked topics**, not a complete specification inventory.
- Grade targets, boundaries and exam schedules retain their existing local
  storage and projection behaviour; account/device synchronisation was not added.
- Underlying topic hooks do not expose every source's error separately. Main
  Stats reads and the accuracy chart have explicit error/retry states.

The website stays unpublished. Review the draft PR, then use **Squash and merge**
for this cohesive frontend change if the result is approved.

## File inventory

Added:

- `src/components/stats/ChartDataTable.tsx`
- `src/components/stats/StatsPageStates.tsx`
- `src/components/stats/chart-palette.ts`
- `src/components/stats/LearningProgressPanel.tsx`
- `src/components/stats/RevisionPrioritiesCard.tsx`
- `src/components/stats/StatsGauge.tsx`
- `src/components/stats/SubjectHistoryBars.tsx`
- `src/components/stats/TopicProgressOverview.tsx`
- `src/styles/stats.css`
- `src/test/stats-data.test.tsx`
- `src/test/stats-presentation.test.tsx`
- `src/test/stats-modular-dashboard.test.tsx`
- This report and the 12 before/after PNGs linked above.

Changed:

- `src/pages/Stats.tsx`
- `src/hooks/useExamStats.ts`
- `src/components/stats/AccuracyTrendChart.tsx`
- `src/components/stats/ExamResultsChart.tsx`
- `src/components/stats/RecentExamsTable.tsx`
- `src/components/stats/SubjectPerformanceChart.tsx`
- `src/components/stats/TopStatsCards.tsx`
- `src/components/stats/WeakTopicsTab.tsx`
- `src/components/stats/WeeklyStudyChart.tsx`
- `src/components/stats/mobile/CountdownRings.tsx`
- `src/components/stats/mobile/CoveragePanel.tsx`
- `src/components/stats/mobile/ExamTargetHero.tsx`
- `src/components/stats/mobile/GradeTrendCard.tsx`
- `src/components/stats/mobile/MobileStatSheet.tsx`
- `src/components/stats/mobile/MobileStatsTelemetry.tsx`
- `src/components/stats/mobile/MobileWeakTopics.tsx`
- `src/components/stats/mobile/QuickStatsGrid.tsx`
- `src/components/stats/mobile/ScoreTrendCard.tsx`
- `src/components/stats/mobile/StudyLoadCard.tsx`
- `src/components/stats/mobile/SubjectGaugeCard.tsx`
- `src/components/stats/mobile/TopicTelemetryRow.tsx`
- `src/components/stats/mobile/tokens.ts`
