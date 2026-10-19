# Practice Library shelves and item controls

This update keeps the shared Practice Library destination and refines both Exams and Quizzes.

- Each subject has one bounded horizontal shelf, with native horizontal scrolling, visible previous/next controls, keyboard focus and retained horizontal position. Cards remain the same size. Existing Home-aligned page gutters are unchanged.
- Hovering a card, including its border or controls, uses that subject's colour for the border. The subject dot/name inside a card is replaced by the paper title at the top.
- Card metadata is labelled **Exam board**, **Level** and **Number of marks**. Marks come from saved question metadata, not a planned/model estimate or an awarded score. Missing/incomplete totals show “—”. Metadata reads are bounded by item batches and paged past the default server row limit; only IDs and marks are selected, with no answers or private marking fields.
- No-timer exams display **Unlimited**. Existing quiz estimated-time and difficulty calculations remain intact.
- The footer contains an icon-only favourite, Delete and Archive/Restore. Controls retain accessible names, native tooltips, focus treatments and 44px minimum targets. Sort and filter are also icon-only, on the same row as All Boards.

## Persistence and protections

Delete/archive actions are only offered on owned library records. The shared action handler rechecks the signed-in owner and scopes writes by both `id` and `user_id`; it requires the changed row to be returned. A zero-row/RLS-denied response cannot be reported as success. Existing database RLS remains authoritative.

Deletion requires an explicit confirmation. Cancel makes no write. While deleting, confirmation is locked against repeated clicks and dismissal; errors retain the dialog and item with a retry action. No optimistic successful deletion is shown. Focus returns to the triggering control, or the library switcher if that control was removed. The existing detailed cover pages use the same delete path and confirmation.

One parent-row deletion uses the existing database foreign-key cascades for dependent questions/attempts. The implementation does not issue a series of partial child deletes, change RLS, or manually alter grades/mastery calculations. Archive is limited to published items and uses the existing `archived` status, with a visible Archive view and Restore action in both libraries. Archive/restore writes also match the current status, so a stale screen cannot promote an unfinished draft; saved answers and timing remain in place.

After a confirmed change, account-scoped retained lists, favourites and progress copies are updated, and the cached Home snapshot is cancelled and removed. List revisions reject older in-flight responses and reload, preventing a deleted item from reappearing. Filters, drafts and navigation state are retained. A different account cannot receive a late response/dialog/notification from the previous account's action.

No migration, storage-policy change, Edge Function change or deployment is required. No dependencies or lockfiles were changed. Generation, marking, quotas, release controls and PDF layouts were not edited.

## Verification

- Node 24.19.0 and the existing lockfile/dependencies. No installation or dependency update was needed.
- Chromium passed 40 layout combinations: Exams and Quizzes, light and dark, mouse at 1280×900 / 1440×1000 / 1920×1080 and touch emulation at 320×844 / 390×844 / 768×1024 / 834×1112 / 1024×768 / 1194×834 / 1366×1024.
- The shelves remain bounded, all subject cards share one row, normal card contents fit, hover borders use the subject colour, board/sort/filter controls share a row and the last subject clears bottom navigation.
- Additional checks passed for deleting from the actual Exam and Quiz detail pages on desktop and mobile, using their shared confirmation and returning to updated lists.
- Mouse and touch checks passed for delete cancellation/focus return, failure/retry, locked pending confirmation, deletion after reopening, rejected older list responses, inaccessible deleted cover links, archive/restore for both types and horizontal scroll restoration. The desktop test also populated and checked Home's real query cache before/after deletion.
- Final successful browser checks reported no JavaScript, console, certificate or unexpected request errors, with HTTP 200 font responses and zero live Supabase requests. An earlier combined run saw a transient resource HTTP 503, an aborted Google Fonts stylesheet request and a slow browser preview; those affected cases passed on retry with TLS verification unchanged.
- `npm run typecheck` and `npm run lint:critical` passed as part of `npm run check`.
- The initial `npm run check` encountered existing database setup-hook timeouts, an existing setup-draft timing assertion and worker RPC timeouts under concurrent load. A subsequent two-worker run passed all **2,171 tests in 136 files**, but exited unsuccessfully on an internal `onTaskUpdate` worker RPC timeout. The aggregate command is therefore **not reported as passing**.
- `npm test -- --pool=forks --maxWorkers=2` passed 2,162 tests with eight skipped after a database setup-hook timeout and one existing bundle-inspection test timing out. Both affected files then passed independently: `npm test -- supabase/tests/foundations.test.ts supabase/tests/biology-visual-context.test.ts --pool=forks --maxWorkers=1` (**13 passed**). No assertions, test timeouts, baselines or runner configuration were changed. All **31 library tests** passed in these runs. CI should complete a clean aggregate run before merge.
- `npm run check:edge` passed the identifier check and bundled **39 Edge Functions**. No Edge Function source was changed.
- `npm run build` passed (Vite 5.4.19, 52.78 seconds), and `git diff --check` passed. Existing build warnings remain: stale Browserslist data, an unrecognized annotation in Zod's dependency source and chunks larger than 500 kB. Dependencies and warning thresholds were left unchanged.

Browser checks use the actual frontend components with an external, isolated in-memory backend fixture; all live Supabase traffic is blocked. Fixture persistence across reloads and simulated mutation/refresh failures are test facilities outside production source. No real account was logged into, no live exam/quiz was changed or deleted, and no paid paper was generated. These checks cannot certify the deployed database's schema/RLS or real iOS/iPadOS hardware behaviour.


## Screenshots

All values and titles in these screenshots are synthetic test data. The previous grid design is recorded in [the preceding redesign](../practice-library-redesign/README.md).

| View | Current screenshot |
| --- | --- |
| Desktop Exams, light | [1440×1000](exams-1440-light.png) |
| Desktop Exams, dark | [1440×1000](exams-1440-dark.png) |
| Desktop Quizzes, dark | [1440×1000](quizzes-1440-dark.png) |
| iPad-size Exams, dark | [834×1112](exams-834-dark.png) |
| Mobile Exams, light | [390×844](exams-390-light.png) |
| Mobile Quizzes, dark | [390×844](quizzes-390-dark.png) |
| Complete mobile card | [Exam](card-exam-mobile.png), [Quiz](card-quiz-mobile.png) |
| Delete confirmation | [Desktop](confirm-exam-desktop.png), [Mobile](confirm-quiz-mobile.png) |

Keep the website unpublished. Review the draft PR and green CI, then use **Squash and merge** to retain this library improvement as one change. No Edge Function deployment is needed.
