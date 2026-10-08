# Stats dashboard redesign

The previous desktop page hid summary labels in tooltips and used a large,
single-subject gauge. Mobile used a different palette, small typography and
dense miniature charts. This change uses Examly's existing neutral surfaces and
navy accent, visible summary labels, compact subject comparisons and readable
score charts. Revision priorities appear before the upcoming-exam section on
mobile. The supplied reference informed the modular layout; none of its images
or example statistics are used in the product.

## Existing statistics retained

| View | Statistics and controls |
| --- | --- |
| Desktop/tablet overview | Average exam score, completed/published/remaining exams, current-week study hours, current/best streak and strongest subject; summary drilldowns |
| Desktop/tablet analysis | Score trends and existing 7-day/30-day/12-month ranges, subject averages and counts, current-week study activity, 12-week accuracy, graded-exam search/pagination/review |
| Mobile overview | Existing readiness estimate, marked-topic accuracy, grade targets met, mastered/developing/review counts, streak, revision priorities, study activity, subject accuracy and upcoming exam schedule |
| Mobile detail views | Existing topic filters, tracked-topic coverage, subject/topic drilldowns, predicted/target grades, grade boundaries, trend range controls and local exam settings |
| Weak Topics | Existing subject/mastery filters, topic details and review actions |

The average exam score remains the existing mean of subject averages. Mobile
readiness retains its existing weighting: 60% exam average, 25% tracked-topic
coverage and 15% streak consistency. No scoring, grade, goal or mastery formula
changed. Production components contain no fixture data.

Supabase tables, selected columns, ownership filters, ordering and date ranges
are unchanged. The existing read queries in `useExamStats` now throw returned
errors into its existing catch path, and a retry clears the previous error.
The accuracy chart also shows a retry when its existing read fails. These client
error-handling changes prevent failures from looking like empty data.

Chart series use theme-specific blue, amber and teal colours, with line patterns,
legends and accessible data tables. Status text accompanies colour. Detail
sheets use the existing Radix dialog for titles, close controls, keyboard focus
and focus restoration. Reduced-motion settings disable decorative animation.

## Verification

Baseline: remote `main` at `cb5e241c26c9b56cf7d3bdfa7621acf687cde150`,
with 1,562 passing tests in 98 files before this task.

Node **24.19.0**, existing `package-lock.json`:

| Command | Result |
| --- | --- |
| `npm ci --cache /workspace/.npm-cache` | PASS; 863 packages installed |
| `npm run check` on the final source | PASS; typecheck, critical hook lint, 1,578 tests in 100 files, Edge Function identifier checks, 38 Edge Function bundles and production build (24.02 seconds) |
| `npx vitest run src/test/stats-data.test.tsx src/test/stats-presentation.test.tsx` | PASS; 16 focused tests in 2 files |
| Additional `npm run typecheck` and `npm run lint:critical` | PASS; also repeated in the final full check |
| Standalone `npm run build` | PASS; 18.87 seconds; repeated in the final full check |
| `git diff --check` | PASS |

Focused tests cover unchanged score/time/streak/goal calculations, genuine zero
scores, zero-mark exclusion, range filters, read-error recovery, summary actions,
subject selection, exam search/pagination/review destinations, loading/error
states, chart tables and dialog focus restoration.

Existing warnings: deprecated/stub packages during installation, an outdated
Browserslist database, production chunks over 500 kB, and React DOM nesting
warnings in unrelated test fixtures. No dependency, lockfile, backend, database,
exam-generation, marking or authentication files changed. No migration or Edge
Function deployment is required.

### Chromium review and screenshots

Vite served the existing Stats page/components in a local, auth-free browser
harness. Data hooks were stubbed with synthetic examples and a simplified local
dashboard frame; all Supabase browser requests were blocked. This harness is
outside the repository and is not a production route. Every screenshot is
labelled **Local preview · fixture data**.

Checked **390, 768, 1024 and 1440 CSS pixels wide**, with a 1,000-pixel viewport
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
- `src/styles/stats.css`
- `src/test/stats-data.test.tsx`
- `src/test/stats-presentation.test.tsx`
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
