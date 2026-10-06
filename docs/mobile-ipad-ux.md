# Mobile and iPad workspace UX

This frontend change starts from `dc34d8a8f65ce98b20d27fb2cc6a35af6a0bedb8` on `codex/mobile-ipad-ux`. Generation, marking, answer projection, scores, authentication APIs, permissions, quotas, payments, PDFs and backend contracts are unchanged. No dependencies, database types, migrations, Edge Functions or deployment configuration changed.

## Navigation and actions

- Phones, split-screen widths and touch devices, including a wide iPad, have five primary controls: Home, Exams, Create, Quizzes (Students for tutors), Profile. Create opens existing actions and is never a selected destination.
- Other existing destinations remain in the workspace menu. Desktop retains its sidebar and quick actions.
- Bottom navigation reserves content space and accounts for safe-area insets. Visual viewport changes hide it when the onscreen keyboard would obstruct input; hardware keyboards leave it available.
- Create, workspace menu and exam filters use the existing Vaul drawer on phones and Radix dialog at wider widths. They retain accessible titles, X controls, Escape and focus restoration. Vaul handles downward dismissal and nested scrolling.
- Back controls use actual React Router history with explicit direct-entry fallbacks. No global swipe gestures were added.

## Lists, feedback and state

- Student dashboard, exam and quiz libraries, tutor exams and tutor groups support a visible Refresh fallback and downward pull from the top of suitable content. Existing content stays mounted while updating. Refresh requests are deduplicated.
- Custom pull handling is used only where CSS overscroll containment can suppress native refresh. Otherwise native behaviour and the visible button remain available. Inputs, horizontal carousels, nested scrollers, browser edges, setup forms and assessment screens do not participate.
- Predictable loading layouts use skeletons; load failures show a retry action. Lazy route loading has an immediate skeleton rather than a blank delay.
- Account-scoped memory retains list data, filters, sorting, selected tabs and vertical/horizontal scroll positions. Restoration waits for asynchronous layout, respects user interaction, and supports browser back/forward. Reselecting a primary destination scrolls to the top with reduced-motion support.
- Existing favourites update immediately, lock repeated taps, reconcile server fetches and roll back with a retry message on failure. Submissions, marking, payments and tutor reply sends remain server-confirmed actions.
- Tutor feedback retains its existing local numbered pagination and loaded content. Returning preserves the page; a smaller refreshed result set clamps to a valid page.
- Active libraries do not expose server pagination. No infinite feeds or notification systems were introduced; the unused legacy `AllExamsModal` was left unchanged.

## Drafts and direct links

- Student mock, practice and tutor mock setup text/settings use debounced, account/item-scoped session storage, with Saving/Saved/error, retry and explicit discard. Restoration validates version, shape, owner, item and a 24-hour age limit. Confirmation clears recovery and older saves cannot overwrite newer input.
- Setup storage excludes credentials, files, resource packs, model output and private feedback. Restored setups explicitly ask users to reattach files/resource packs. Closing the tab ends this recovery; cross-device setup persistence is not provided.
- Tutor reply text is retained only in account-scoped memory and scoped by thread. Closing or navigating preserves it while the session remains open. Failed sends retain the draft; confirmed sends or deliberate discard clear it. Reloading or signing out ends this recovery.
- Cross-device setup recovery would require an owner/item-scoped draft save/read API that does not start generation. Durable private reply recovery would require an owner/thread-scoped draft save/read API. Those backend additions are outside this change; no migration was proposed or created.
- Existing exam/structured-response saving is reused. Legacy practice text recovery is now scoped to user, set and question, protects newer edits from older acknowledgements, and cannot restore another account's draft. Timing, submission and marking rules are unchanged.
- Protected links preserve their exact path, query and fragment through login and onboarding using validated internal return paths. Notification links reject unsafe redirects.
- Existing class invitations now open the existing lookup/confirmation flow, without automatically looking up or joining a class. Student review links focus the authorised question; tutor feedback opens the authorised thread and its submission action uses the existing tutor review route with a valid back fallback.
- No notification, camera, photo or location permissions were introduced. Such permission requests are not applicable to new features in this change. Existing file selection and notification preferences remain unchanged.

## Verification

- Node 24 and the existing lock file: `npm ci` passed.
- `npm run check`: type check, critical hook lint, 1,230 tests in 84 files (40 new UX tests), all 38 Edge Function bundles, and production build passed.
- `node scripts/audit-biology.mjs`: 48 template combinations passed. `node scripts/audit-ocr-alevel-paper2.mjs`: four version/mode combinations passed. These are regression checks, not generated-paper quality ratings.
- `git diff --check` passed. Full `npm run lint` still has existing failures, beginning with `scripts/edge-runtime-globals.d.ts:5:37` (`@typescript-eslint/no-explicit-any`). Comparing all modified TypeScript files to the baseline and linting every new file found no added findings. Existing stale Browserslist data, large build chunks and legacy test DOM warnings remain.
- The actual application was exercised in Chromium with an offline backend fixture outside the checkout and live backend traffic blocked. Screenshots covered 320/390px phones, 768/820px portrait tablets, 1024/1180px layouts, 1366px coarse-pointer tablets and 1440px desktop. Populated, empty, loading, failed-list, dark-mode, setup, settings, invitation, feedback and review states were inspected.
- Browser checks passed for tab/filter and vertical/horizontal scroll restoration, reselect-to-top, back/forward, setup draft restoration, retained content after failed refresh and retry, refresh during an unfinished favourite write, X/focus restoration, pointer-drag drawer dismissal, tutor reply/setup recovery and tutor review direct-entry fallback. The real public Vite landing page also loaded without JavaScript errors. Deliberately failed requests emitted their expected error log; successful fixture pages had no unexpected JavaScript or console errors.
- Keyboard geometry, owner isolation, storage failures, unsafe redirects, optimistic rollback, draft failure recovery and local pagination restoration were tested automatically. Chromium emulation is not real iOS/iPadOS testing: Safari edge gestures, physical keyboard behaviour, actual notch/home-indicator insets and native touch pull-to-refresh still require hardware verification.

No real account login, exam generation, paid AI call, real record write, migration, function deployment or publication was performed. No migration or Edge Function deployment is required by this frontend change. A future PR merge should use **Squash and merge** to keep this UX task as one commit; the PR should remain a draft until reviewed.
