# Mobile Home, Practice and Subjects

Base: `cb2f530a` (Activated Profile Builder). Branch: `codex/mobile-home-practice-subjects`.

## Behaviour

Student bottom navigation is **Home · Practice · Create · Subjects · Profile**. Practice contains the existing Exams and Quizzes libraries, with a shared switcher. Switching away remembers the chosen library, its query parameters, filters and retained scroll position. Re-tapping Practice scrolls the active library to the top without switching Quizzes to Exams. Active assessment routes highlight Practice, but the navigation never stores an in-progress exam as the library destination.

Tutors retain their Students destination; their Practice destination groups Manage Exams and Practice Sets. Both libraries expose the same switcher on mobile/tablet widths. Desktop sidebar destinations remain available.

Mobile Home uses the existing dashboard data and callbacks. A quiet study-corner SVG, greeting, four inline icon/value statistics, two quick-start actions, a saved-subject rail, compact class cards and recent practice replace the larger stacked layout. Statistics retain accessible full labels and open the existing drill-down. Empty states never invent activity or progress. Recent exam rows show `In progress` instead of a provisional zero, without changing score calculation or marking.

## Scrolling and refresh

- No permanent Refresh button or empty toolbar. A status indicator appears only during a downward pull, an active refresh or a refresh error.
- A pull is accepted only at the top of an opted-in list. It must reach 144 CSS pixels of finger travel (72 after resistance) before release. Short pulls, cancelled gestures, upward scrolling, multitouch, browser edges, editable fields, independent scrollers and horizontal rails do not trigger refresh. Existing content remains mounted and concurrent requests are deduplicated.
- Supported browsers use overscroll containment to avoid firing both native and custom refresh. Other browsers retain native behaviour. The browser's manual page reload remains available.
- My Subjects refreshes its subjects and profile lists together. Its search field has an accessible name and the mobile page no longer inherits a second large horizontal inset.
- Structural `overflow-x: hidden` is replaced by `clip` so it does not create unintended vertical scroll containers. The document owns scrolling and route restoration. Mobile workspace scrollbars are hidden visually; scrolling itself is retained. Desktop scrollbars are unchanged.
- `ResponsiveActionSheet` keeps the Radix overlay scroll lock and its cleanup, but disables Vaul's additional `body: fixed` styles. In the installed Vaul version, that additional iOS positioning can remain behind when routing unmounts an open drawer. There is no broad body-style reset, modal bypass or global swipe handler.

## Verification

Node 24.19.0 with the existing lockfile: `npm ci` passed. The complete `npm run check` passed with `VITEST_MAX_FORKS=2 VITEST_MIN_FORKS=1 VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1`: 1,989 tests across 122 files, frontend typecheck, critical hook lint, Edge identifiers, all 39 Edge Function bundles and the production build. The initial unbounded test run exited before reporting results; limiting test concurrency allowed the same full suite to complete without changing configuration or dropping tests. The focused mobile suites passed all 56 cases. `node scripts/audit-biology.mjs` checked all 52 template combinations; `git diff --check` passed. Existing non-blocking dependency/Browserslist, test DOM nesting, Zod annotation and build-chunk warnings remain.

Automated coverage includes the five controls, both libraries, retained selection, subjects routing, ordinary upward scrolling, pull threshold/cancellation/nested scrollers, duplicate refresh protection, failed refresh and retry, iOS-identified open-drawer route unmount, accessible statistics and dashboard actions.

Browser verification was attempted but **not completed** in this workspace: the cloud browser cannot reach the local Vite server (`ERR_CONNECTION_REFUSED`), and its security policy refuses local HTML files. No screenshot or physical iPhone/iPad interaction is claimed. The temporary fixture harness is outside the repository and is not part of the app or build.

Before merging, preview at 320/390px, tablet widths and desktop in light/dark mode. On iPhone/iPad, open the workspace menu and choose My Subjects, then drag up/down starting on a subject card. Repeat via the bottom tab and after dismissing a drawer. Confirm the background stays locked while a drawer is open and scrolls after it closes. Check a sufficiently long downward pull at the top, a short pull, pulls within rails, browser reload, bottom-nav clearance and re-tapping the current tab.

This is a frontend change. No migration, generated-type update, Edge Function deployment, paid generation, live-data modification or website publication is required or performed. Recommend Squash and merge **after** the mobile visual/device checks pass.
