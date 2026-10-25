# Subject and exam-profile statistics

The approved redesign replaces the mixed-subject Stats page with one subject at a time and a page-wide exam-profile selector. The existing Examly surfaces, typefaces and dashboard gutters carry through laptop, tablet and phone layouts in both themes. “Your first result starts here” remains the first-attempt design.

## Implemented behavior

- Subject and profile selection scopes every results card, Weak Topics and question review. Subject/profile/tab/date-range selections survive navigation within the account-scoped workspace session. Historical work retains its saved profile ID; deleted profiles are labelled Saved profile, and genuinely unlinked work is No profile.
- Curved exam-score lines compare profiles with stable colours and line patterns. The selectable date range applies to this chart. Missing results are gaps; genuine zero scores remain zero. Curves connect period averages and are not additional attempts.
- Topic breakdown uses a doughnut with outside percentage labels. Its categories open the corresponding topic filter. These percentages describe marked topics, not whole-syllabus coverage.
- Topic spread compares up to five actual shared marked topics. It requires at least three shared axes and never invents skill dimensions or substitutes zero for unassessed areas. Profile colours match the trend and study charts.
- Study hours uses grouped daily bars for recorded exam/quiz time this week. Completed subject revision tasks without profile identity are reported separately and never assigned to a profile by guesswork.
- Topic score distribution, expanded chart/data-table dialogs and a searchable Weak Topics view expose the underlying evidence. Existing exam-question averaging, marks-weighted practice and the 60:40 exam/practice topic blend remain; topic states use the existing 50/75 thresholds.
- Grade goals separate a user-set starting baseline, a changing marked-exam estimate and a saved target marker at its boundary. The estimate can rise or fall. Course scale and Foundation/Higher limits are respected. Boundaries are explicitly indicative and editable. Quizzes do not inflate the exam-grade estimate.
- Starting grade and goal are optional when adding a subject. Goals are saved by account and stable subject ID **on this browser**, with session fallback and a visible notice if browser storage fails. Existing unowned browser grade settings require an explicit import. Signup is unchanged; cross-device goal storage is not introduced.
- Questions to revisit includes zero and partial-credit exam answers. The popup shows the saved question, its resources and released expected answer using the existing protected review endpoint. The full review remains accessible. Closing the popup or changing account/subject/profile clears its solution state.
- First-attempt, no-subject, practice-only, pending-marking/release, unavailable-history and retry states are distinct. Pending/unreleased marks never become zero scores or weak topics.

## Data and release protection

The metadata loader verifies the active workspace owner, pages large histories, uses bounded requests and shares its cache with route preparation. Switching subject/profile or chart range filters the loaded metadata without refetching private assessment content. The previous Stats route-preload queries have been replaced so navigation warms the cache the new page actually uses.

Exam score eligibility follows the existing `exam_submission_metadata` security-barrier view and its user-specific release decision. It does not infer permission from the paper-wide `grade_released` flag. Latest submissions are selected before eligibility, so an older successful marking is not reused after a newer failed/pending submission. Latest valid answer evidence is used; non-finite, future and invalid marks are excluded. Topic aliases are scoped by subject, with explicit global aliases as fallback.

Stats metadata queries never select question text, correct answers or structured private keys. Opening a question calls the existing `get-exam-questions` endpoint and freshly checks its released, graded response for the exact requested question. Solution data stays in the dialog's local state, outside the query cache. Saved insert resources are requested only after that authorization; an unavailable insert does not discard an otherwise authorized question review.

Existing read policies can expose submission/question metadata while hiding related raw exam/topic records. This frontend-only change does not alter those policies. Missing exam identity produces a retryable history notice rather than guessing its subject. When topic rows are unavailable, safe question-ID/marks metadata preserves released question review and topic-dependent charts show an availability notice, rather than suggesting complete/zero topic performance.

No migration, generated type, backend, dependency or lockfile change is included. No Edge Function deployment is required. The website remains unpublished; no live data, account login, model call or paid exam was used for verification.

## Files

- `src/pages/Stats.tsx`: responsive subject/profile workspace and page states.
- `src/components/stats/SubjectStatsCharts.tsx`: trends, doughnut, shared-topic radar, study bars and distribution.
- `src/components/stats/ScopedWeakTopics.tsx`, `StatsFirstResult.tsx`: topic evidence/detail/practice actions and first-result design.
- `src/components/stats/GradeGoalCard.tsx`, `src/hooks/useSubjectGradeGoals.ts`, `src/lib/subject-grade-goals.ts`: starting baseline, target editing, boundaries and browser-local persistence.
- `src/components/stats/AddSubjectModal.tsx`: optional goal setup after a successful subject insert.
- `src/components/stats/QuestionsToRevisit.tsx`, `QuestionRevisitContent.tsx`, `src/lib/revisit-question.ts`: metadata list and lazy protected review.
- `src/lib/subject-profile-stats.ts`, `subject-profile-stats-query.ts`, `src/hooks/useSubjectProfileStats.ts`: scoped aggregation and safe paginated reads.
- `src/components/WorkspacePageReady.tsx`, `src/components/dashboard/DashboardLayout.tsx`: correct metadata preloading and scoped route styling.
- `src/styles/subject-stats.css`: all three responsive layouts and light/dark treatment.
- Eight new Stats/goal/review test files and updated `src/test/workspace-route-transitions.test.tsx`.
- This document and `stats-subject-profile-evidence/`: synthetic browser verification and screenshots.

## Verification

Node 24.19.0 and the unchanged `package-lock.json` were used.

| Check | Actual result |
| --- | --- |
| `npm ci --cache /tmp/examly-npm-cache` | Passed; 864 packages installed. A writable cache avoided the environment’s default-cache permission error without changing the lockfile. |
| Unchanged-main baseline `npm run check` | All 145 files / 2,302 assertions passed, but one Vitest `onTaskUpdate` RPC timeout caused a nonzero exit. Not a clean full-check pass. |
| Latest `npm run check` with one worker | 152/153 files and 2,384/2,385 assertions passed; the unmodified tutor reply-draft test failed to find its async textbox, and Vitest reported one `onTaskUpdate` timeout. Exit 1. |
| Final focused Stats/navigation tests | Clean pass: 9 files, 99 tests, 58.78s, no unhandled errors. Includes the final completed-task guard. |
| Final `npm run typecheck` | Passed. |
| Final `npm run lint:critical` | Passed. |
| `npm run check:edge` | Passed identifier checks and bundled 39 functions. No deployment required. |
| Final `npm run build` | Passed in 1m 28s. |
| `git diff --check` | Passed. |

The full check stops at its failing test stage, so edge checks and the production build were also run separately. An earlier implementation-wide check likewise failed only the unmodified tutor reply-draft test (2,379/2,380 assertions, 152/153 files) plus two RPC timeouts. No failing test was skipped or weakened.

The tutor textbox failure and RPC timeout are already documented in [the merged Class Details verification](class-details-redesign.md). An isolated rerun of that tutor file in a clean unchanged-main worktree passed both tests; it is not reported as reproducing the failure there. Keep this PR draft until CI or another supported environment provides a clean complete check.

Existing broader-suite warnings include response DOM nesting and PDF-parser fixture notices. Production notices remain stale Browserslist data, Zod/Rollup comment annotations and large output chunks. Dependencies, the lockfile and existing Biology contract fingerprints were not changed. A separate read-only review found no actionable high/medium issues in the new data aggregation and released-question review path.

### Browser verification

Chromium uses the actual application with synthetic in-memory SDK records, production CSS and local font snapshots. No real service is invoked. The matrix covers 1440×1000 laptop, 1180×820 touch landscape, 834×1112 touch portrait, 390×844 phone and 320×780 narrow phone, each in light/dark mode. Additional checks cover subject/profile scoping, stable colours, no metadata reads for filter/range changes, curved paths, expanded tables, goal persistence/boundary placement, released question review/revocation/retry, weak-topic detail, empty/pending/practice-only/error/history/zero/missing-radar/topic-unavailable states, compact dialogs and reduced motion.

All 10 size/theme combinations, all 14 advanced scenario groups and the three additional touch-dialog layouts passed. No unexpected console/JavaScript/request errors, horizontal overflow or external runtime requests occurred. The mocked review endpoint was called only after opening a question; no live service or model was invoked. A discarded harness run overlapped a build that replaced its CSS directory; the final run uses a frozen production-CSS snapshot and passed.

See the [combined verification record](stats-subject-profile-evidence/verification-summary.json) and its companion detailed result files. The screenshots contain synthetic records only.

| View | Before | After |
| --- | --- | --- |
| Laptop | [Light](stats-subject-profile-evidence/before-laptop-light.png) | [Light](stats-subject-profile-evidence/after-laptop-light-viewport.png) · [Dark](stats-subject-profile-evidence/after-laptop-dark-viewport.png) |
| iPad | — | [Portrait light](stats-subject-profile-evidence/after-ipad-portrait-light-viewport.png) · [Landscape dark](stats-subject-profile-evidence/after-ipad-landscape-dark-viewport.png) |
| Phone | [Light](stats-subject-profile-evidence/before-phone-light.png) | [Light](stats-subject-profile-evidence/after-phone-light-viewport.png) · [Dark](stats-subject-profile-evidence/after-phone-dark-viewport.png) |
| States | — | [First result](stats-subject-profile-evidence/state-empty-phone-dark.png) · [Weak topics](stats-subject-profile-evidence/weak-topics-390-light.png) · [Question review](stats-subject-profile-evidence/question-dialog-390-light.png) |

Real accounts, production backend/network/TLS behavior, Safari/iPad/iOS hardware, cross-device goal synchronization and screen-reader behavior remain unverified. Automated checks and synthetic rendering do not establish the quality of real generated exams.
