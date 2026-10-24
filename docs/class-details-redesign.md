# Student Class Details redesign

The former Class Details page stacked assignment, completed-work, feedback and announcement cards alongside overlapping Progress and Class Stats summaries. The approved replacement uses a compact class identity header, three focused tabs and the existing class-deadline calendar.

## Implemented behavior

- Assignments, Announcements and Feedback tabs retain their state in the account-scoped, memory-only workspace store. Assignment status and calendar selections are also retained per class.
- One summary shows real to-do, completed/assigned and awaiting-tutor counts. It describes class assignment completion, not syllabus coverage or subject mastery. It replaces the repeated summary panels and the old duplicated per-subject class-completion rows.
- Compact assignment rows use filled Continue and outlined Start/Review buttons, with no arrows inside these actions. The existing shared assignment action logic controls routes, future releases, expired work and protected review access.
- Completed work retains actual released scores, including a genuine zero. Missing grades remain Submitted/Graded. No score is fabricated, and a future release does not expose a score or feedback state through the new row.
- Announcements retain every returned record, full expandable text and attachments. Feedback retains every returned thread and its full student question/tutor response; neither is capped by the former three/five-item presentation limits.
- Class information contains the existing leave action. It still opens the parent's confirmation before any membership change. The tutor's saved bio and subjects are available through a labelled, touch-accessible dialog.
- The shared calendar/deadline rail is scoped to the selected class and remains on every tab. Day/month selection and undated work use the same behavior as My Classes.
- Existing initial-load skeletons, refresh retention, error messages, Retry, back navigation, realtime updates and account isolation remain in MyClasses.

No new statistics, roster, chat, attendance or lesson timetable is invented. Current class assignment storage supports generated/uploaded Exams; this change does not pretend that personal Practice Quizzes are class assignments.

## Design and responsive treatment

The user approved the standalone proposal, then requested arrow-free action buttons before implementation. Manrope, existing Examly blue/periwinkle controls, theme surfaces, subject accents and dashboard gutters are retained. The global shell and other page designs are unchanged.

Laptop uses a wide work column with a 286px deadline rail. iPad uses a 252px rail where width allows, then a stacked arrangement for split views. Phone uses compact class information, single-line tabs, short work rows and stacked calendar/deadlines. Touch controls, visible focus and reduced-motion behavior are retained. Desktop-only calendar compactness does not change shared My Classes or touch calendar sizing.

Design references researched on 24 October 2026:

- [Linear Features](https://linear.app/features): restrained workspace hierarchy and focused work areas. Public page retrieved; blocked CDN assets were not used.
- [Google Classroom](https://edu.google.com/workspace-for-education/products/classroom/): class navigation and separation of work, updates and responses. Public product reference viewed; no product artwork copied.
- [Canvas LMS](https://www.instructure.com/en-gb/canvas): course workspace and assignment/feedback organization. Public product page retrieved; no assets copied.

## Data and deployment boundary

The existing protected `exam_submission_metadata` view and `classes-query.ts` remain unchanged. Rendering scopes the received assignment, announcement and feedback records to the selected class and consults submissions only by those assignment exam IDs. No query, backend, schema, policy, authentication, quota, marking, generation, dependency or lockfile change is included.

No migration or Edge Function deployment is required. The website remains unpublished. Browser checks use synthetic in-memory records and a mocked SDK; they do not log in, call model services, mutate a backend or open a paid exam.

## Files

- `src/components/classes/ClassDetailView.tsx`: focused student class workspace and dialogs.
- `src/components/classes/AssignmentRow.tsx`: additional detail presentation using existing access/action behavior.
- `src/pages/MyClasses.tsx`: passes the subject accent and removes the obsolete per-subject summary adapter.
- `src/styles/class-details.css`: new scoped responsive layout.
- `src/styles/class-assignment.css`: styles only for the new detail presentation.
- `src/test/class-detail-view.test.tsx`: new page behavior and isolation coverage.
- `src/test/class-assignment-actions.test.tsx`: detail actions, release locks and score/date regressions.
- This document and `docs/class-details-evidence/`: actual browser results and selected before/after screenshots.

## Verification

Node 24.19.0 and the unchanged package-lock.json were used.

| Check | Actual result |
| --- | --- |
| `npm ci --cache /workspace/.npm-class-details-cache` | Passed; 864 packages installed. The first plain install could not write the environment's default `/home/agent/.npm` cache; a writable cache resolved this without changing the lockfile. |
| `npm run typecheck` | Passed, including both full-check attempts. |
| `npm run lint:critical` | Passed, including both full-check attempts. |
| Initial `npm run check` | Not a clean pass: 144/145 files and 2,301/2,302 tests passed; an unmodified tutor reply-draft test failed to find its async textbox, and Vitest reported one `onTaskUpdate` worker communication timeout. |
| Full check with one worker | All 145 files and all 2,302 test assertions passed, including the tutor test, but Vitest still reported one `onTaskUpdate` timeout and exited nonzero. This is not reported as a passing `npm run check`. |
| Supported thread-pool retry | Stopped after failing to report any completed test files; not counted as a pass. No tests were changed, skipped, or weakened for these runner issues. |
| Final six focused class test files | Clean pass: 6 files, 81 tests, 53.82s; no unhandled worker errors. |
| `npm run check:edge` | Identifier check passed; 39 Edge Functions bundled. No function deployment is required by this frontend-only change. |
| `npm run build` | Passed in 57.70s. |
| `git diff --check` | Passed. |

The tutor reply-draft test also passed in an unchanged `origin/main` worktree. The default-worker and single-worker full-suite logs are separate results: the successful assertions do not erase the runner's nonzero exit. Keep the PR draft until CI or another supported execution environment provides a clean complete check.

Existing notices remain: stale Browserslist data, Zod/Rollup annotation handling and large output chunks. Existing exam-response DOM-nesting and PDF-parser fixture warnings appear in the broader suite outside these changed components.

### Browser evidence

Chromium 151.0.7922.173 used the actual application, fresh production CSS, a synthetic in-memory SDK and local font snapshots. All 10 size/theme combinations passed: 1440×1000 laptop, 1180×820 touch landscape, 834×1112 touch portrait, 390×844 phone and 320×780 narrow phone, each in light/dark mode. All 14 advanced scenario groups passed, covering keyboard/focus, retained views without extra reads, class-only deadlines, undated work, tutor/feedback dialogs, leave cancellation, release/deadline locks, missing and real zero scores, future-score non-disclosure, long titles and empty states. Source hashes remained unchanged throughout.

No unexpected JavaScript/console/request errors, horizontal overflow, external runtime requests or function/model calls occurred. An initial browser-harness assertion raced Radix's deferred keyboard focus; the final harness waits for the intended selected-tab state. No application code or validations were changed to satisfy that assertion.

See [combined verification record](class-details-evidence/verification-summary.json).

| View | Before | After |
| --- | --- | --- |
| Laptop | [Light](class-details-evidence/before-laptop-light.png) | [Light](class-details-evidence/after-laptop-light-viewport.png) · [Dark](class-details-evidence/after-laptop-dark-viewport.png) |
| iPad | — | [Portrait light](class-details-evidence/after-ipad-portrait-light-viewport.png) · [Landscape dark](class-details-evidence/after-ipad-landscape-dark-viewport.png) |
| Phone | [Light](class-details-evidence/before-phone-light.png) | [Light](class-details-evidence/after-phone-light-viewport.png) · [Dark](class-details-evidence/after-phone-dark-viewport.png) |

Real accounts, production backend/network/TLS health, Safari/iPad/iOS hardware and screen-reader behavior remain unverified. No real membership mutation or paid exam generation was performed.
