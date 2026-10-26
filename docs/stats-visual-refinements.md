# Stats visual refinements

This follows the merged subject/profile Stats redesign in PR #45 (its CI check passed). It simplifies the presentation while preserving its data model, scoring, targets and protected review flow.

## Changes

- Removed the heading subtitle, repeated scope explanation, long chart captions and instructional paragraphs from the main cards. Expanded chart dialogs retain their data tables and concise context. The approved first-result design remains.
- Replaced the icon-bearing subject buttons with connected tabs. The active tab and underline use the subject's actual saved colour; inactive tabs use a light tint. Foreground selection uses relative luminance, with a safe fallback for invalid colours. Controls remain horizontally scrollable on narrow screens.
- Changed topic status colours to vivid teal, violet and coral. Pointer and keyboard activation of a doughnut segment or its legend updates the topic list **inside the same card**, with real scores, a back control and an honest empty-category state. Long lists scroll within the card. Changing subject/profile resets this local view; it does not navigate to Weak Topics.
- Unified card heading sizes/weights and increased supporting label sizes. The study metric has a clear hours value and a separate “This week” label.
- Redesigned the grade card around a large current estimate, compact starting-grade/target panels, an actual-position target marker and one edit action. Browser persistence, saved boundaries, tier caps and the distinction between baseline and earned estimate remain unchanged. The browser-storage/indicative-boundary detail is available in the optional boundary editor.
- Fixed dark review text locally: MathRenderer's `.prose` colours now follow the dialog's theme tokens, including headings, paragraphs, tables and structured mark schemes. Shared response renderers and the fresh release check are unchanged.
- Removed repeated Weak Topics guidance and widened its topic list. Essential errors, pending-result state, marked evidence and action labels remain.

No query, hook, schema, policy, backend, dependency, lockfile or existing contract-fingerprint change is included. No migration or Edge Function deployment is needed. The website remains unpublished; no live account/data or paid model service was used.

## Verification

Node 24.19.0 and the existing unchanged lockfile were used. Browser records use the actual application source, frozen production CSS, local fonts and a synthetic in-memory SDK. They do not establish production-backend, Safari/iPad hardware or screen-reader behavior.

| Check | Actual result |
| --- | --- |
| Frozen focused verification | 9 files / 112 tests passed in 59.06s, including both SQL setup files affected by the earlier overloaded run. No unhandled errors. |
| Final typecheck | Passed. |
| Final critical lint | Passed. |
| Edge checks | Identifier check passed; 39 functions bundled. No deployment required. |
| Frozen production build | Passed in 3m 9s. |
| Chromium layout matrix | All 10 size/theme combinations passed: 1440×1000, 1180×820 touch, 834×1112 touch, 390×844 and 320×780, each light/dark. |
| Chromium detail cases | All five layout/interaction/contrast combinations plus percentage-only and long-topic-list cases passed. |
| `git diff --check` | Passed. |
| Complete repository gate | Fresh-checkout GitHub Actions `npm ci` / `npm run check` on supported Node 22; see the PR check status. |

An earlier local full run was discarded: editing the keyboard return behavior while it was running left a cached earlier chart transform in that process, and simultaneous work caused database setup timeouts. That run was interrupted, not reported as passing. The frozen rerun includes the chart, page, goal, release, navigation and both affected database files; no tests were skipped or weakened. The complete fresh-checkout CI run is the repository-wide gate.

Browser checks verify saved subject colours and readable foregrounds, consistent card-heading typography, segment/legend activation, staying in Overview, stable card height, keyboard access, scope reset, goal saving/boundary placement, reviewed-answer contrast and close behavior, long-list scrolling, and percentage grades on narrow phones. There were no unexpected console/JavaScript/request errors, page overflow or live/model calls. Contrast measurements cover selected subject tabs and reviewed question/answer text, not a full accessibility audit.

Existing production warnings remain stale Browserslist data, Zod/Rollup comment annotations and large output chunks.

The shared Stats stylesheet was also formatted into readable rules while updating the typography and responsive controls.

See the [combined verification record](stats-visual-refinements-evidence/verification-summary.json) and detailed JSON beside it. All screenshots show synthetic records.

| View | Before | After |
| --- | --- | --- |
| Laptop | [Light](stats-visual-refinements-evidence/before-laptop-light.png) | [Light](stats-visual-refinements-evidence/after-laptop-light-viewport.png) · [Dark](stats-visual-refinements-evidence/after-laptop-dark-viewport.png) |
| iPad | — | [Portrait light](stats-visual-refinements-evidence/after-ipad-portrait-light-viewport.png) · [Landscape dark](stats-visual-refinements-evidence/after-ipad-landscape-dark-viewport.png) |
| Phone | [Light](stats-visual-refinements-evidence/before-phone-light.png) | [Full page](stats-visual-refinements-evidence/after-phone-light.png) · [Dark](stats-visual-refinements-evidence/after-phone-dark-viewport.png) |
| Grade goal | — | [Laptop](stats-visual-refinements-evidence/grade-goal-1440-light.png) · [320px](stats-visual-refinements-evidence/grade-goal-320-dark.png) · [Percentage grade](stats-visual-refinements-evidence/state-percentage-320-dark.png) |
| In-card topics | — | [Laptop](stats-visual-refinements-evidence/topics-inline-1440-light.png) · [Phone](stats-visual-refinements-evidence/topics-inline-320-dark.png) · [Long list](stats-visual-refinements-evidence/many-topics-320-dark.png) |
| Question review | — | [Dark](stats-visual-refinements-evidence/review-1440-dark.png) · [Phone](stats-visual-refinements-evidence/review-390-light.png) |
