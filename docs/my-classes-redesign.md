# My Classes redesign

The former student page used tall paper-shaped cards and separated class work into several disconnected sections. The approved replacement puts tutor-set assignments first, compact subject-colour class cards next, and a deadline calendar alongside the main content where space permits.

## Implemented layout

- Overview, All assignments and Announcements tabs with actual record counts.
- Three current-work previews, prioritising available assignments before unreleased or expired work. Every assignment remains accessible in the full list.
- Class covers use existing subject colours and deterministic Lucide icons. Completion/to-do counts describe assignments, not subject mastery or unread notifications.
- A keyboard-accessible month calendar marks actual pending assignment deadlines. Selecting a day filters the adjoining list; undated work remains separately visible under No deadline.
- Subject-coloured deadline entries share the existing Start, Continue and Review routes and release/deadline restrictions.
- Announcements retain their full text and attachment links. Long messages have an explicit expand/collapse control.
- Search, selected tab, month and date use the existing account-scoped in-memory workspace store. Background refresh retains loaded content and offers Retry on failure.
- Detail pages keep tutor information, completed work, progress calculations, feedback, announcements, review and confirmed leave-class actions. Their assignment controls and phone layout share the new visual treatment.

## Data and access boundaries

`classes-query.ts` is unchanged. The page still reads active joined groups, published group-assigned exams, announcements and release-protected submission metadata. Missing scores remain Submitted/Graded rather than an invented zero; actual released zero scores remain valid.

Existing tutor writers store `subjects_covered` as names as well as object labels. `class-subjects.ts` adapts those shapes for presentation without changing the cached response, API contract or database. Legacy IDs resolve only against already-loaded user subjects; unresolved IDs are not exposed as subject names.

Practice Quizzes are not currently connected to class assignments. Generated and uploaded assigned exams are labelled Exam. No personal-library quizzes, fictional lesson timetable, new assignment backend, notification/read-state model or estimated progress percentage was added.

No backend, schema, generated Supabase types, dependency or lockfile changes are included. No Edge Function deployment or migration is required.

## Responsive treatment

| Available width | Presentation |
| --- | --- |
| Laptop / wide tablet | Main assignment/class column with calendar and deadlines at the right. Dashboard-compatible gutters and theme surfaces. |
| Tablet portrait / narrower split view | Cards use the full content width; calendar and deadlines sit side by side below classes while space allows. |
| Phone | Swipeable assignment previews, two class cards per row, followed by calendar, deadlines and announcements. Full assignment lists stack vertically. |

Colours retain accompanying subject/status text. Controls have visible focus and comfortable touch targets; motion respects reduced-motion preferences.

## Changed frontend areas

- `src/pages/MyClasses.tsx`
- `src/components/classes/ClassCard.tsx`
- `src/components/classes/AssignmentRow.tsx`
- `src/components/classes/ClassDeadlineCalendar.tsx` (new)
- `src/components/classes/AnnouncementItem.tsx`
- `src/components/classes/ClassDetailView.tsx`
- `src/components/classes/CompletedAssignmentCard.tsx`
- `src/components/dashboard/DashboardLayout.tsx` (scoped route styling class)
- `src/lib/class-subjects.ts` (new presentation adapter)
- `src/styles/classes-workspace.css`, `class-cards.css`, `class-assignment.css`, `class-deadlines.css` (new scoped styles)
- Four focused tests: assignment actions, calendar, class cards/announcements and page integration.

## Verification record

Node 24.19.0 and the unchanged lockfile were used.

| Check | Actual result |
| --- | --- |
| `npm ci` | Passed; 864 packages installed. |
| `npm run check` | Typecheck/lint passed and 2,259 assertions passed, but Vitest reported two `onTaskUpdate` worker communication timeouts. This invocation is not counted as a clean pass. |
| `npm test -- --maxWorkers=1 --minWorkers=1` | Clean pass: 143 files, 2,259 tests, no unhandled worker errors. |
| Final four My Classes test files | 41/41 passed, including the three final subject-shape regressions added after the full-suite run began. |
| Final `npm run typecheck` and `npm run lint:critical` | Passed after the subject-shape adapter. |
| `npm run check:edge` | Identifier check passed; 39 Edge Functions bundled successfully. |
| `npm run build` | Passed. |
| `git diff --check` | Passed. |

The full regression run and the final focused run are separate results, not an invented combined suite count. Existing notices remain: stale Browserslist data, Zod/Rollup annotation handling and large output chunks. Existing exam-response DOM-nesting warnings and the PDF-parser standard-font fixture warning also remain outside this change. The new focused tests had no new runtime warnings.

Chromium 151 verification used the real application with an in-memory synthetic SDK and locally fulfilled font files. It passed ten size/theme combinations: 1440×1000 laptop, 1180×820 touch landscape, 834×1112 touch portrait, 390×844 phone and 320×780 narrow view, each in light/dark mode. It also passed nine advanced scenario groups, two additional 1024×768 touch detail-layout checks and four mixed-subject-format checks. Keyboard calendar navigation, tabs, visible focus and Chromium's tabpanel accessibility tree were checked. No page overflow, unexpected JavaScript/console/request failures or function/model invocations occurred.

The final source was hashed and remained unchanged during the final browser run. See [browser summary](my-classes-evidence/browser-summary.json), [scenario results](my-classes-evidence/advanced-results.json), [focus checks](my-classes-evidence/focus-checks.json), [1024px checks](my-classes-evidence/detail-width-checks.json) and [real subject-format checks](my-classes-evidence/subject-shapes-checks.json).

All browser examples use synthetic records. They do not represent a user's account or a live backend test. Confirmed leave behavior is tested only through mocks; browser checks cancel the leave flow.

## Selected before/after screenshots

| View | Screenshot |
| --- | --- |
| Original laptop | [Before](my-classes-evidence/before-laptop-light.png) |
| Redesigned laptop | [Light](my-classes-evidence/after-laptop-light-viewport.png) · [Dark](my-classes-evidence/after-laptop-dark-viewport.png) |
| Tablet | [Landscape light](my-classes-evidence/after-ipad-landscape-light.png) · [Portrait dark](my-classes-evidence/after-ipad-portrait-dark.png) |
| Phone | [Light viewport](my-classes-evidence/after-phone-light-viewport.png) · [Dark viewport](my-classes-evidence/after-phone-dark-viewport.png) · [Full page](my-classes-evidence/after-phone-light.png) |
| Phone class detail | [Completed work and feedback](my-classes-evidence/after-class-detail-phone-dark.png) |

Browser emulation does not verify real iOS/iPadOS hardware, Safari/VoiceOver or production account/network latency. Existing font imports are fulfilled from local font snapshots in the fixture browser; external font/TLS health is outside that check.
