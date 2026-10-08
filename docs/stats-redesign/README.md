# Stats dashboard

Stats uses a quieter analytics layout with subject performance, revision priorities,
score versus target, study activity, subject snapshots and the overall exam trend.
The desktop overview uses three balanced chart stacks. Accuracy, readiness, mastery
and tracked-topic coverage form a separate progress row underneath. Tablet layouts
use two columns and place subject snapshots alongside the overall trend; mobile
keeps its existing Overview, Topics and Performance views.

The desktop Overview / Weak Topics control sits at the far right of the heading,
with vertical overlap with “Your progress”. The subtitle remains directly underneath
the title, independent of the control's height. Both Recent exams and the At a glance
summary have been removed from Stats. Mobile's existing streak detail sheet remains
available through a secondary link in Performance, alongside study activity.

Dark Stats now inherits Examly's shared background, card, text, muted and border
colours. It no longer supplies a separate blue/slate surface palette. Charts retain
accessible theme-specific blue, amber, teal and pink accents. The light dashboard's
existing neutral composition remains.

## Statistics and controls

| Module | Existing data and controls |
| --- | --- |
| Subject performance | Average graded-exam scores and exam-count view; expanded comparison and data table |
| Revision priorities | Two lowest-scoring marked topics; View all retains the complete topic view |
| Score versus target | Selected subject's actual score history, saved revision percentage or existing target-grade boundary, and existing grade estimate; all date ranges and expanded comparison retained |
| Study activity | Recorded current-week Mon–Sun study hours, by subject, and their existing total |
| Subject snapshots | Two actual subject histories with previous/next access to every subject |
| Overall exam trend | Existing 12-week graded-exam average scores and change summary |
| Learning progress | Existing marked-topic accuracy and readiness estimate |
| Topic progress | Mastered share of marked topics and marked/attempted share of tracked topics; Explore retains topic details |
| Mobile detail views | Grade targets/settings, topic and performance views, readiness/accuracy/mastery/streak sheets and upcoming-exam schedule |

No query, filter, date-range, scoring, grade, goal or mastery formula changed.
Missing history stays missing and genuine zero scores remain zero. Readiness retains
its existing weighting: 60% exam average, 25% tracked-topic coverage and 15% streak
consistency. Grade estimates retain saved grade scales, tiers and boundaries.
No production component contains preview fixture data.

The removed summary and exam table components remain available in the repository;
their implementation and existing tests have not been changed. Removing their Stats
presentation does not change data hooks or the exam library/review destinations.
Existing hook order, effects, calculations, remaining event bindings and access rules
are unchanged. The only relocated mobile action reuses the existing streak sheet and
its state setter. No backend, authentication, database, exam generation, marking,
quota, payment, dependency or lockfile files changed. No migration or Edge Function
deployment is required.

## Verification

Starting point: latest remote `main` at
`362bf7305f64ca25e6ecaa4546d8e59cc402c1f6`, the squash merge of PR #15.
Its repository tree matched feature commit
`542e87c1c2354e39b31090c9ac04e98d00942300` before editing. The working tree
was clean. The baseline has 1,593 tests in 102 files. This refinement adds no new
application tests because the changes are presentational; existing meaningful Stats
behaviour tests and browser assertions verify the retained controls.

Node **24.19.0**, existing `package-lock.json`:

| Command | Result |
| --- | --- |
| `npm ci --cache /workspace/.npm-cache` | PASS; 863 packages installed |
| `npm run check` | PASS; typecheck, critical hook lint, 1,593 tests in 102 files, Edge Function identifier checks, 38 Edge Function bundles and production build |
| `npx vitest run src/test/stats-data.test.tsx src/test/stats-presentation.test.tsx src/test/stats-modular-dashboard.test.tsx src/test/stats-reference-dashboard.test.tsx` | PASS; 31 focused tests in 4 files |
| Final `npm run typecheck` | PASS |
| `git diff --check` | PASS |

Existing warnings: deprecated/stub packages during installation, an outdated
Browserslist database, production chunks over 500 kB, and React DOM nesting
warnings in unrelated test fixtures. No blocking errors were observed.

### Chromium and screenshots

The existing Stats page/components were served through Vite in a local, auth-free
Chromium harness outside the repository. The harness uses fixture data, actual
workspace content padding and a simplified dashboard frame. All Supabase browser
requests were blocked; no live account was logged into or data changed. Screenshots
are labelled **Local preview · fixture data**. These checks do not verify live
account data or the complete authenticated dashboard shell.

Before images are the verified screenshots from the newly merged PR #15. After
images show this refinement using the same fixtures. Checked widths **320, 390, 768,
834, 1024, 1194 and 1440 CSS pixels**, with a 1,000-pixel viewport height, in both
**light and dark** themes. No horizontal page overflow, JavaScript errors, console
errors, certificate/request failures or backend requests were observed. Fonts loaded
with normal certificate verification.

Browser assertions verify that At a glance and Recent exams are absent, Stats' dark
surface/text/border tokens equal the global Examly tokens, the desktop tabs align at
the right of the heading with vertical overlap with its title, and the title/subtitle
gap remains four pixels. Retained controls passed: tabs, revision/coverage links,
date ranges, score/count switching, subject selection, expanded charts, detail sheets,
Escape, close controls and focus restoration. Mobile's relocated streak action opens
the original sheet. Loading, empty and failed/retry states were checked at 390 and
1440 pixels in both themes.

Forty-four automated accessibility scans across overview, topics, performance,
detail dialogs, expanded charts and loading/empty/error states found **zero WCAG 2
A/AA and 2.1 A/AA violations**. This does not replace a complete manual audit.
Browser viewport emulation does not replace physical iOS/iPadOS testing. Real-device
onscreen keyboards and the complete authenticated shell remain unverified.

| Size/theme | Before | After |
| --- | --- | --- |
| Mobile, 390px, light | [Before](screenshots/before-mobile-light.png) | [After](screenshots/after-mobile-light.png) |
| Mobile, 390px, dark | [Before](screenshots/before-mobile-dark.png) | [After](screenshots/after-mobile-dark.png) |
| Tablet, 768px, light | [Before](screenshots/before-tablet-light.png) | [After](screenshots/after-tablet-light.png) |
| Tablet, 768px, dark | [Before](screenshots/before-tablet-dark.png) | [After](screenshots/after-tablet-dark.png) |
| Desktop, 1440px, light | [Before](screenshots/before-desktop-light.png) | [After](screenshots/after-desktop-light.png) |
| Desktop, 1440px, dark | [Before](screenshots/before-desktop-dark.png) | [After](screenshots/after-desktop-dark.png) |

## Existing limitations

- Study activity data covers only the current week. Historical controls retain their
  existing notice; historical fetching requires a separate functional task.
- Coverage describes tracked topics, not a complete specification inventory.
- Grade settings and exam schedules retain their existing local-storage behaviour.
- Underlying topic hooks do not expose every source's error separately. Main Stats
  reads and the accuracy chart retain their explicit error/retry states.

## Changed files

- `src/pages/Stats.tsx`
- `src/styles/stats.css`
- `src/components/stats/StatsPageStates.tsx`
- `src/components/stats/mobile/MobileStatsTelemetry.tsx`
- `src/components/stats/mobile/QuickStatsGrid.tsx`
- `docs/stats-redesign/README.md`
- Twelve before/after PNGs under `docs/stats-redesign/screenshots`, covering desktop,
  tablet and mobile in both themes.

The website stays unpublished. Review the draft PR and use **Squash and merge**
for this cohesive Stats presentation change if the result is approved.
