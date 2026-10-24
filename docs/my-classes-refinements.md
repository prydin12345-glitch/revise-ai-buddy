# My Classes empty states and announcements

Follow-up to the merged redesign in PR #41, based on `main` at `ca2c8688`.

## Changes

- Assignment empty states use an unboxed checkmark between thin dividers, with distinct copy for no work assigned and all work submitted. Existing loading/error/completion conditions are unchanged.
- Removed the assignment overview's View all shortcut. All assignments remains available through the existing primary tab.
- Fixed the native scrollbar/corner beside the primary tabs. The shared tab primitive allowed overflow, and a negative bottom margin made the content one pixel taller than its scroll area. The scoped tab styles now remove that overflow and keep a visible inset focus outline; global page scrollbars are unchanged.
- Announcements use dated timeline rows with subtle vertical separators. All and per-class filters use actual joined class names and IDs, including classes with no recent updates. The selected class is retained in the existing account-scoped memory store and shared between the overview and full announcements tab.
- Full announcement text, expansion controls and attachments remain accessible. Class details retain their existing card presentation.

The existing query still returns the twenty most recent announcements across joined classes. Filters operate on those loaded records without extra requests; empty copy therefore says “No recent announcements”. No historical totals, unread state, news/activity categories, additional permissions or notification systems were added.

## Verification

- Node 24.19.0; no dependency or lockfile changes.
- Five relevant test files: **52 tests passed**, including eleven new cases for filters, identity, account isolation, expansion/attachments and empty states.
- Final typecheck, critical lint, production build and `git diff --check` passed.
- Existing Browserslist, Zod/Rollup annotation and output chunk-size warnings remain.
- Chromium 151 passed ten size/theme combinations: 1440×1000 laptop, 1180×820 touch landscape, 834×1112 touch portrait, 390×844 phone and 320×780 narrow view, each in light and dark mode. Tests use actual application code with synthetic in-memory data and local font snapshots, without real login, backend writes or model calls.
- Two baseline comparisons confirmed the tab strip changed from `clientHeight:43 / scrollHeight:44` to `44 / 44`. Two long-class filter-rail checks and two primary-tab keyboard/focus checks also passed. No page overflow, unexpected JavaScript/console/request errors or additional announcement reads occurred. Final production source hashes remained unchanged during the run.

See [browser results](my-classes-refinement-evidence/browser-summary.json) and [keyboard/focus results](my-classes-refinement-evidence/focus-checks.json).

| Design | Before | After |
| --- | --- | --- |
| Assignment empty state | [Laptop](my-classes-refinement-evidence/before-empty-laptop-light.png) | [Laptop](my-classes-refinement-evidence/after-empty-laptop-light.png) · [iPad](my-classes-refinement-evidence/after-empty-ipad-portrait-dark.png) · [Phone](my-classes-refinement-evidence/after-empty-phone-dark.png) |
| Announcement timeline | [Laptop](my-classes-refinement-evidence/before-announcements-laptop-light.png) | [Laptop](my-classes-refinement-evidence/after-announcements-laptop-light.png) · [Phone](my-classes-refinement-evidence/after-announcements-phone-dark.png) |
| Long class-filter row | — | [Phone](my-classes-refinement-evidence/after-many-class-filters-phone-dark.png) |

Browser emulation does not establish real iOS/iPadOS or Safari/VoiceOver behavior. Live account authorization and external font/TLS health were not tested. No backend, migration, Edge Function, generation, marking, authentication or live-data changes are included; no function deployment is required.
