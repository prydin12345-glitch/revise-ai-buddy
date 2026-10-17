# Blended Home banner and raised laptop sidebar

Based on remote main `f044e8fd` (merged PR #30). The working tree was clean.

Home's existing blue greeting area now joins the top bar and both page edges on
iPad and laptop, removing the detached rounded banner and dark outer gutter.
The rest of the dashboard retains its normal background, surfaces and content
width. The desktop navigation sidebar keeps its existing styling.

At 1280px and above, the greeting/artwork and create actions share the left grid
column. The right edge of the illustration aligns with the right edge of
**Create Practice Quiz** (within its one-pixel card border). The profile and
statistics cards begin higher alongside the greeting. Below 1280px, iPad retains
a wide header above the existing content columns. These are responsive layout
breakpoints, not device detection.

The mobile banner, four compact statistic segments and all three time-of-day
scenes are retained. No hooks, state, queries, handlers, values or destinations
changed. The presentational dashboard shell and loading skeleton use the same
grid. Styling is scoped to student Home.

## Before and after

All images use the actual dashboard with an offline fixture session, mocked
notifications and no real account or live Supabase requests. Before images come
from PR #30's verified screenshots. No screenshot contains real student records.

| View | Before | After |
| --- | --- | --- |
| Laptop, light, 1440px | [Before](before-laptop-light.png) | [After](after-laptop-light.png) |
| iPad portrait, dark, 834px | [Before](before-ipad-dark.png) | [After](after-ipad-dark.png) |

Additional views: [laptop dark](after-laptop-dark.png), [iPad light](after-ipad-light.png).

## Verification

Node 24.19.0 with existing dependencies and unchanged lockfile:

- `npm run typecheck`: passed.
- `npm run lint:critical`: passed.
- `npx vitest run src/test/study-welcome-banner.test.tsx src/test/mobile-home.test.tsx --maxWorkers=1`: **15 tests passed in 2 files**.
- `npm run build`: passed.
- `git diff --check`: passed.

Chromium checked **28 combinations**: evening at 320, 390, 600, 768, 834, 1024,
1194, 1280, 1440 and 1920px in both themes, plus morning and afternoon at 834
and 1440px in both themes. Assertions cover continuous top-bar/banner colour,
no inset at the top or page edges, zero banner corner radius on larger views,
contained artwork, separation from text, the raised laptop cards and precise
alignment with the quiz button. iPad retains the full-width header; mobile
retains four equal statistic segments and its 58px strip height. Long-name
overflow was checked at 320, 600 and 834px.

A further laptop check collapsed and restored the navigation sidebar: the header
remained flush with the 64px sidebar, and the statistics column retained its
88px sticky position while scrolling.

The final run recorded no JavaScript, console, certificate or failed-request
errors. Font responses were HTTP 200, with zero live backend requests. The
existing Start skill's verified managed proxy CA initialization was used with
normal TLS validation enabled.

Existing build warnings: outdated Browserslist data, a Zod/Rollup comment
annotation and chunks over 500kB. The full repository suite and Edge bundles
were not rerun for this presentation-only refinement. Viewport emulation does
not verify physical iOS/iPadOS hardware or real authenticated accounts.

No backend or database changes, migrations, function deployment, live-data
changes or website publication are required or performed. Use **Squash and
merge** after visual review and green CI.
