# Practice Library redesign

The student exam and quiz libraries now share the **Practice Library** navigation entry. The existing `/my-exams` and `/quizzes` routes remain the two views; old links, browser history and the account-scoped in-memory list/filter state continue to work. The shared destination restores the most recently visited library for the current workspace role. Student and tutor remembered destinations cannot be mixed by the sidebar.

## Presentation

- One header and compact Exams / Quizzes switcher; aligned search, board, subject, sort and status controls. Exam-only advanced filters, date inputs and existing Create actions remain available. The DOM and visual order of toolbar controls agree for keyboard users.
- Both lists use the same responsive, subject-grouped grid and compact paper-cover component. Covers have a fixed height, bounded titles, board/qualification details, real question/time/progress values and an independent favourite control. Quiz difficulty and estimated time use their existing calculations.
- Removed the repeated Examly/Practice paper/Modelled on masthead and topic lists from library covers. Full titles remain in accessible button names and title attributes. Detailed exam/quiz covers still contain their topics and candidate instructions. Search still uses the existing search fields, including exam topics.
- Desktop content width, 32px gutters and light/dark surfaces reuse Home's existing values. Tablet/phone layouts use responsive grids and existing safe-area/bottom-navigation spacing. Selection has a visible accent, controls retain 44px touch targets, and cover hover styling respects reduced motion.
- Skeletons match the cover grid. Existing loading, empty, failed-list, retry, pending-favourite and failed-favourite conditions are preserved; a failed favourite save remains visible within the fixed-size card.
- Student and tutor desktop sidebars, workspace menus and the legacy navigation drawer use one shared navigation definition. Tutor Exams/Quizzes switching is now visible on desktop as well as touch layouts so combining their sidebar entries does not remove access to practice sets. The existing five touch destinations are unchanged.

## Scope

No Supabase query, backend function, schema, access/release rule, exam generation or marking behaviour was changed. The PDF generator and detailed/printable assessment covers are unchanged. No dependency or lockfile changes. No migration or function deployment is needed.

All browser previews used synthetic, in-memory data and a Supabase replacement outside the repository. Real Supabase traffic was blocked and counted; no real account, record, exam generation or paid model call was used. These fixtures are verification data only and are not shipped in the application.

## Verification

- Node 24.19.0 with the existing installed dependencies and unchanged lockfile. No dependency installation was needed for this source-only change.
- `npm run check`: PASS — typecheck, critical hook lint, **2,151 tests in 135 files**, identifier checks and **39 Edge Function bundles**, and the production build. No functions were deployed. The 11 new focused library tests also passed separately after the final sidebar grouping adjustment.
- `git diff --check`: PASS.
- Existing build notices remain: 16-month-old Browserslist data, Zod's Rollup annotation notice and chunks larger than 500 kB. No dependency or warning-suppression changes were made.
- Chromium covered Exams and Quizzes in both themes at 320×844, 390×844, 768×1024, 834×1112, 1024×768, 1194×834 and 1366×1024 with a coarse pointer, and 1280×900, 1440×1000 and 1920×1080 with a mouse. All 40 view combinations had uniform card heights, no page/grid overflow and no clipped cover contents; touch layouts kept the last card clear of bottom navigation.
- Actual page controls were exercised with the offline fixture: search and clearing, board/subject and completion filters, switching libraries and retaining independent state, exam-filter dialog, optimistic favourite failure/rollback/retry in both libraries, and browser back/forward. Loading, empty and failed-list states were checked on phone and desktop.
- Additional final Chromium checks passed for visible keyboard focus, cover-to-list scroll restoration, a single workspace-menu library entry, restoring Quizzes from the desktop sidebar, matching Home/library gutters exactly, and successful retry after a simulated failed list request. Final successful pages had no JavaScript, console, certificate or unexpected request failures; font responses were HTTP 200 and no live Supabase request was made.
- Before/after screenshots cover desktop, tablet and mobile in both themes. They use synthetic data; they are not screenshots of a live account.
- No production account access, live persistence, real iOS/iPadOS hardware, native keyboard/edge gestures, assistive-technology audit or paid generation was performed. Tutor role navigation and library routes have unit coverage; tutor management pages were not fully browser-tested. Exam/PDF data access is protected by the unchanged application pipeline.

## Before and after

The screenshots use identical local fixture data. A long title is deliberately included to exercise bounded covers. Browser emulation does not constitute real iOS/iPadOS hardware testing.

| View | Before | After |
| --- | --- | --- |
| Desktop exams, light, 1440×1000 | [Before](before-my-exams-1440-light.png) | [After](after-my-exams-1440-light.png) |
| Desktop exams, dark, 1440×1000 | [Before](before-my-exams-1440-dark.png) | [After](after-my-exams-1440-dark.png) |
| Desktop quizzes, dark, 1440×1000 | [Before](before-quizzes-1440-dark.png) | [After](after-quizzes-1440-dark.png) |
| iPad-size exams, dark, 834×1112 | [Before](before-my-exams-834-dark.png) | [After](after-my-exams-834-dark.png) |
| Mobile exams, dark, 390×844 | [Before](before-my-exams-390-dark.png) | [After](after-my-exams-390-dark.png) |
| Mobile quizzes, light, 390×844 | [Before](before-quizzes-390-light.png) | [After](after-quizzes-390-light.png) |

Keep the website unpublished. Review the draft PR and use **Squash and merge** after CI and design review pass to keep this library redesign as one change.
