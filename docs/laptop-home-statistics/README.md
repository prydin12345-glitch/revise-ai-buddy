# Laptop Home statistics refinement

Based on clean, fetched `origin/main` at `579581836bbfb681609db163d030589163f20d96` (PR #33). Branch: `codex/laptop-home-statistics-refinement`.

## Layout and interaction

- At widths of at least 1280px with a fine primary pointer, Statistics takes the wide main-column position previously used by Recent Activity. Recent Activity moves below Classes and Announcements in the right rail. The existing mobile and touch/iPad layout stays in place.
- The donut sits on the left; subject names, percentages and their existing share bars sit on the right. The legend uses two columns when the Statistics card has enough space, and one otherwise. Long labels wrap.
- Summary icons, numbers and labels scale to 106% over 180ms on hover, returning on mouse leave. Hit areas, dividers and neighbouring content stay stationary; there is no hover background. Reduced-motion users get no scaling or animated chart transitions.
- Explicitly remove strokes from normal and active pie sectors and suppress pointer-only SVG focus outlines. The labelled subject buttons remain keyboard accessible with visible focus and equivalent selection/highlighting.
- Keep the existing exam/quiz destinations, activity tabs, row limits, View all actions and summary drawers. Adapt the activity rows to the narrower rail.

## Statistics logic reviewed

- Previously, the widget selected topics by name from performance already combined across every subject. Two subjects sharing a name such as “Energy” could contaminate each other's averages. Scope exam and practice records using saved subject IDs/names **before** aggregation. Do not infer another course from its display name.
- Preserve the existing exam/practice 60/40 weighting, mastery thresholds, graded-submission rule and exclusion of failed/unmarked answers. Real scored zero remains zero. Untested profile topics remain untested and do not lower the profile average. Their bars no longer get a false 4% minimum.
- Preserve existing overview percentages and calculations. Study shares use the existing current-week study-activity aggregation. When it has no hours, the original fallback counts saved papers; the subtitle now calls this “Share of your papers”. The centre still shows the existing average exam score, not a study-share percentage.
- Profile topics show **subject-wide performance** for those topics, as the existing data supports. They do not claim to isolate attempts to that exact profile/component.
- Surface failed reads with Retry instead of silently displaying zeros/empty detail cards; use skeletons during reads. Ignore late performance responses from a previous owner/subject.
- Retain selected subject/profile, search and sort in the existing account-scoped memory store across navigation/remounts and laptop/tablet column changes. Reset on account change. Handle removed subjects/profiles explicitly.

## Files

Changed:

- `src/components/dashboard/ActivityPanel.tsx`
- `src/components/dashboard/DashboardShell.tsx`
- `src/components/dashboard/DashboardSkeleton.tsx`
- `src/components/dashboard/DashboardSummaryStrip.tsx`
- `src/components/dashboard/StudentDashboardContent.tsx`
- `src/components/dashboard/SubjectDonut.tsx`
- `src/components/dashboard/types.ts`
- `src/hooks/use-mobile.tsx`
- `src/hooks/useSubjectProfiles.ts`
- `src/hooks/useUnifiedTopicPerformance.ts`
- `src/styles/laptop-dashboard.css`

Added:

- `src/lib/subject-profile-topics.ts`
- `src/test/home-subject-performance.test.tsx`
- `src/test/home-subject-statistics.test.tsx`
- `src/test/subject-profiles-retry.test.tsx`
- This evidence directory (documentation, browser results and synthetic screenshots).

No dependencies, lockfile, schema, generated types, Edge Functions, marking rules, scores, authentication or permissions changed. No functions require deployment; no migration is needed.

## Checks

Node 24.19.0, unchanged `package-lock.json`.

| Check | Result |
| --- | --- |
| Saved environment install script, including `npm ci --cache /workspace/.npm-cache --prefer-offline --no-audit --no-fund` | PASS, 864 packages installed |
| `npm run typecheck` | PASS |
| `npm run lint:critical` | PASS, zero warnings |
| Relevant regression suites, `npm test -- --maxWorkers=2 …` | PASS, 224 tests / 16 files |
| Final targeted suites, `npm test -- --maxWorkers=1 src/test/home-subject-performance.test.tsx src/test/home-subject-statistics.test.tsx src/test/subject-profiles-retry.test.tsx` | PASS, 15 tests / 3 files |
| `npm test -- --maxWorkers=1 src/test/study-welcome-banner.test.tsx` | PASS, 9 tests / 1 file |
| Distinct tests across those runs | 234 tests / 18 files (14 targeted tests overlap the regression run) |
| `npm run build` | PASS |
| `git diff --check` | PASS |

Regression suites: `home-subject-performance`, `home-subject-statistics`, `laptop-dashboard`, `mobile-home`, `mobile-workspace-ux`, `stats-modular-dashboard`, `response-mastery`, `biology-visual-rendering`, `dashboard-stats-controls`, `dashboard-stats-hook`, `dashboard-score-panel`, `dashboard-stats-panels`, `dashboard-scores-data`, `dashboard-stats-data`, `stats-data`, and `profile-persistence`; the additional banner suite is `study-welcome-banner`.

The full repository `npm run check` chain was not rerun for this focused frontend change. Its relevant type, critical-lint, test and production-build stages were run explicitly; no Edge Function source changed.

Existing non-blocking warnings: deprecated dependency notices during installation, old Browserslist data, Rollup's Zod annotation warning, and production chunks exceeding 500kB. Expected error-path tests emit missing-column and permission-denied diagnostics. The initial plain `npm ci` attempt failed with `ENOENT: mkdir '/home/agent/.npm/_cacache'`; the saved environment script's writable cache resolved it without changing the lockfile or bypassing integrity checks.

## Browser verification and evidence

Chromium renders the actual Dashboard/components with an isolated in-memory Supabase replacement and synthetic **Alex Student** records. Fixture code is outside the product; production contains no demo data or preview route. Real Supabase traffic is blocked and counted during these checks. No real account login, writes, model calls or paid generations occur.

- Laptop: 1280 × 1000, 1440 × 1000, 1920 × 1000; light and dark.
- Narrow/mobile regression: 390 × 1000; light and dark.
- Tablet regression: 834 × 1112 and 1194 × 1000; light and dark.
- Wide touch/iPad emulation: 1366 × 900, coarse pointer; light and dark. It retains tablet navigation/layout rather than activating laptop styling.
- Loading, empty and failed-dashboard states at 1440px in both themes; detail loading and failed-topic retry; no horizontal page overflow.
- Pie click and labelled-button/keyboard selection, pointer stroke removal, profile/topic drill-down, weakest/recent/priority sorting, search/no-match state, Back controls, retained profile/search/sort across column changes, activity tabs, and the four original summary drawers.
- Hover scale/return, unchanged button background/hit-area geometry, and reduced-motion suppression.
- Google Fonts over normal verified HTTPS. Existing system-trusted proxy root imported into the local Chromium NSS trust database; no TLS bypass and no certificate committed.

Screenshots use synthetic values for visual checks, not claimed production student results. Before images use the same fixture against the fetched baseline sources. Included: before/after 1440px light/dark, before/after chart close-ups, plus representative mobile and wide-touch regression images. Machine-readable results are in `browser-results.json`. The repeated matrix recorded one cancelled Google font request (`net::ERR_ABORTED`), so its strict zero-failed-request assertion did not pass. There were no JavaScript, console or certificate errors, and the rendered fonts loaded over verified HTTPS with HTTP 200. Separate desktop interaction and wide-touch runs had zero failed requests. This diagnostic is recorded separately from the passing layout/interaction checks; it was not hidden by weakening TLS or product validation.

Real iOS/iPadOS hardware, a real student's account/data and live backend permissions were not exercised. No live data, migrations, deployments or publishing were performed. After visual review and green CI, use **Squash and merge** to keep this focused change as one commit.
