# Stats dashboard redesign

The dashboard now follows the user's agreed reference mapping, rather than
restyling the previous card layout. The desktop overview has three independent,
staggered columns. Charts and subject tiles have softly raised surfaces; gauges,
progress rings and the four headline figures sit directly on a cool neutral
canvas. The dark version uses readable slate surfaces and lighter chart accents.
Examly's branding and navy controls remain.

| Reference position | Examly module and actual data |
| --- | --- |
| Top-left bars | Subject performance: existing average exam scores; retained score/count control |
| Left semicircles | Marked-topic accuracy and the existing readiness estimate |
| Bottom-left area chart | Recorded Mon–Sun study hours, stacked by subject, with the actual weekly total |
| Two numbered centre strips | The two lowest-scoring marked topics; View all retains the complete topic view |
| Centre area chart | Selected subject's actual score history versus its saved revision target or existing target-grade boundary |
| Centre progress rings | Mastered share of marked topics and marked/attempted share of tracked topics, with separate denominators |
| Top-right figures | Average exam score, completed exams, current-week study hours and current streak; existing drilldowns |
| Two right-hand chart tiles | Actual subject histories; previous/next controls retain every subject |
| Bottom-right line chart | Existing 12-week overall graded-exam score trend |

The centre plot keeps missing periods as gaps and a genuine zero as zero. It
never draws an invented target or a future trajectory. Grade estimates reuse
`projectGrade`, saved scale/tier/boundaries and targets. Desktop does not assume
a grade scale if one has not been saved; mobile retains its existing profile
scale resolution. A saved revision percentage takes precedence over the grade
boundary for the selected subject. Expand retains the original all-subject bar
comparison, goals and data table.

Columns adapt to available content width, including the existing sidebar.
Tablet uses two columns where necessary; mobile stacks the modules while
retaining paired semicircles, rings and subject tiles. Mobile keeps Overview,
Topics and Performance, grade settings, readiness/accuracy/mastery/streak sheets,
and the upcoming-exam schedule. Its original detailed study breakdown remains
in Performance. Recent exams retain search, pagination and review destinations.

The inspiration supplies the composition and visual hierarchy. Its images,
example percentages, sample data and decorative forecast shapes are not used in
production. No application data or backend contract changed in this revision.

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
changed. Existing hooks, effects, read filters and calculation blocks remain
intact in this revision. Mobile reuses the existing 12-week chart and its read
query; no new query definition or backend endpoint was introduced. Production components contain no fixture data.

Supabase tables, selected columns, ownership filters, ordering and date ranges
are unchanged. Existing Stats and 12-week chart error/retry handling remains.
This revision changes no data-hook files.

Chart series use theme-specific blue, amber and teal colours, with subject
legends and accessible data tables. Small subject charts use the same actual,
range-filtered buckets as the main score chart: missing periods remain missing
and true zero scores remain zero. Labels distinguish overall subject averages
from range-filtered history. Subject-history and study-area charts share the same palette across desktop and mobile;
saved subject colours are unchanged. Gauges and rings reflect existing percentages,
with their denominators shown. The overview highlights two revision priorities;
the full Topics view remains available through View all. Status text accompanies colour. Detail
sheets use the existing Radix dialog for titles, close controls, keyboard focus
and focus restoration. Reduced-motion settings disable decorative animation.

## Verification

Starting point: latest remote `main` at
`67fca94a84168fb44436f94cd42eb4221a815ee8`, the squash merge of PR #14.
Its repository tree is identical to feature commit
`9ffc7695f0dbc1f87d9401177820e4c1d5a9c862`, which this revision started from.
That revision had 1,586 passing tests in 101 files. This follow-up adds seven
focused tests and changes no backend or dependency files. The earlier original
baseline was `cb5e241c26c9b56cf7d3bdfa7621acf687cde150` with 1,562 tests in
98 files.

Node **24.19.0**, existing `package-lock.json`:

| Command | Result |
| --- | --- |
| `npm ci --cache /workspace/.npm-cache` | PASS; 863 packages installed |
| `npm run check` | PASS; typecheck, critical hook lint, 1,593 tests in 102 files, Edge Function identifier checks, 38 Edge Function bundles and production build |
| `npx vitest run src/test/stats-data.test.tsx src/test/stats-presentation.test.tsx src/test/stats-modular-dashboard.test.tsx src/test/stats-reference-dashboard.test.tsx` | PASS; 31 focused tests in 4 files |
| Final `npm run typecheck` and the critical hook lint in `npm run check` | PASS |
| Standalone `npm run build` | PASS |
| `git diff --check` | PASS |

Focused tests cover unchanged score/time/streak/goal calculations, genuine zero
scores, zero-mark exclusion, range filters, read-error recovery, summary actions,
subject selection, exam search/pagination/review destinations, loading/error
states, chart tables and dialog focus restoration. Module tests cover the
shared readiness formula, pending-work exclusion, correct mastery and coverage
denominators, missing/zero history, priority ordering and gauge detail actions. Seven additional tests cover
subject-specific targets, saved grade boundaries, missing versus zero scores,
range callbacks and retained access/order across two desktop/mobile tiles.
Recharts receives fixed dimensions in jsdom tests; actual responsive rendering
is checked separately in Chromium.

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

Before images are the previous revision's verified Chromium screenshots,
retrieved from the current `main` commit. After images use the new components
and current Vite styles. Both show the same fixture data and workspace content
padding; they compare this follow-up with the Stats design already merged in
PR #14.

Checked **320, 390, 768, 834, 1024, 1194 and 1440 CSS pixels wide**, with a 1,000-pixel viewport
height, in **light and dark** themes. No horizontal page overflow, JavaScript
errors, console errors, certificate/request failures or backend requests were
observed. Google Fonts loaded through normal certificate verification.

Interaction checks passed for tabs, date ranges, previous/next subject controls,
score/count switching, selected-subject targets, chart expansion, result search/pagination, detail sheets, Escape, close controls
and focus restoration. Loading, empty and failed/retry states were checked at
390 and 1440 pixels in both themes. Forty-two automated accessibility scans across
overview, topics, performance, detail dialogs, expanded subject/score charts and these states found **zero
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

This follow-up changes 33 files relative to current `main`.

Added:

- `src/components/stats/ScoreTargetChart.tsx`
- `src/components/stats/SubjectScoresChart.tsx`
- `src/test/stats-reference-dashboard.test.tsx`

Changed:

- `docs/stats-redesign/README.md`
- `docs/stats-redesign/screenshots/after-desktop-dark.png`
- `docs/stats-redesign/screenshots/after-desktop-light.png`
- `docs/stats-redesign/screenshots/after-mobile-dark.png`
- `docs/stats-redesign/screenshots/after-mobile-light.png`
- `docs/stats-redesign/screenshots/after-tablet-dark.png`
- `docs/stats-redesign/screenshots/after-tablet-light.png`
- `docs/stats-redesign/screenshots/before-desktop-dark.png`
- `docs/stats-redesign/screenshots/before-desktop-light.png`
- `docs/stats-redesign/screenshots/before-mobile-dark.png`
- `docs/stats-redesign/screenshots/before-mobile-light.png`
- `docs/stats-redesign/screenshots/before-tablet-dark.png`
- `docs/stats-redesign/screenshots/before-tablet-light.png`
- `src/components/stats/AccuracyTrendChart.tsx`
- `src/components/stats/ChartDataTable.tsx`
- `src/components/stats/ExamResultsChart.tsx`
- `src/components/stats/LearningProgressPanel.tsx`
- `src/components/stats/RevisionPrioritiesCard.tsx`
- `src/components/stats/StatsGauge.tsx`
- `src/components/stats/StatsPageStates.tsx`
- `src/components/stats/SubjectHistoryBars.tsx`
- `src/components/stats/SubjectPerformanceChart.tsx`
- `src/components/stats/TopStatsCards.tsx`
- `src/components/stats/TopicProgressOverview.tsx`
- `src/components/stats/WeeklyStudyChart.tsx`
- `src/components/stats/mobile/MobileStatsTelemetry.tsx`
- `src/components/stats/mobile/QuickStatsGrid.tsx`
- `src/components/stats/mobile/SubjectGaugeCard.tsx`
- `src/pages/Stats.tsx`
- `src/styles/stats.css`
