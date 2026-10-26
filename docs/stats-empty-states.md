# Stats empty states and control polish

This follows merged PR #46 on `de55a8ad`. It changes presentation only; the Stats data loader, scoring, release checks, saved goals, ownership and cache identity are unchanged.

- Unselected subject tabs use the same neutral theme background and border, including hover. Only the selected tab uses its saved subject colour.
- Trend series and keys require a valid score in the selected date range. A real zero is valid; null, non-finite and unattempted profiles do not create keys.
- Topic spread compares only profiles with marked topic evidence. An unused saved profile no longer prevents a valid comparison. An empty/insufficient comparison displays the icon/message without profile keys.
- Weekly study requires positive finite recorded profile time. A zero-only week displays a clock and “0 Hours studied this week”, with no graph, axes or profile keys. Unassigned revision remains separate in the expanded details.
- Empty score distributions and other empty chart dialogs omit unused keys and zero-filled data tables.
- The goal header no longer includes its target icon. The target marker and grade calculations are preserved. Goal number fields use the active light/dark scheme and omit native grey/white spinners; numeric validation and keyboard stepping remain.
- Tooltip labels and item values explicitly use the theme foreground, overriding Recharts' slice-coloured text in dark mode.

No backend, schema, migration, dependency or lockfile change is included. No Edge Function deployment is required. Nothing was published, deployed, merged or changed in live data, and no paid model calls were used.

## Verification

Node 24.19.0 and the unchanged lockfile were used.

| Check | Actual result |
| --- | --- |
| Focused tests | 7 files / 87 tests passed in 96.47s; no unhandled errors. |
| Typecheck and critical lint | Passed. |
| Production build | Passed in 1m 4s. |
| Chromium | All 10 empty-layout size/theme combinations and eight detailed cases passed. |
| Diff check | Passed. |
| Full repository gate | Fresh-checkout CI `npm ci` / `npm run check` on Node 22; see the PR check status. |

The tests cover missing/null/non-finite values, genuine zero scores, mixed keys, inactive radar profiles, zero-only weeks and empty expanded dialogs. Browser checks also confirm actual tooltip text contrast, numeric keyboard stepping, and the absence of the target icon. Existing Browserslist, Rollup annotation and large-chunk build notices remain.

Browser verification uses the actual application with synthetic in-memory records, frozen production CSS and local fonts. It covers empty charts, unused profiles alongside real results, neutral/selected tabs, tooltip text contrast, goal number-field theme and keyboard stepping, and empty expanded dialogs. Real accounts, physical iPad/Safari and screen readers remain unverified.

See [verification records](stats-empty-states-evidence/verification-summary.json). Screenshots contain synthetic data only.

- Empty cards and neutral tabs: [laptop light](stats-empty-states-evidence/after-laptop-light-viewport.png), [laptop dark](stats-empty-states-evidence/after-laptop-dark-viewport.png), [iPad](stats-empty-states-evidence/after-ipad-portrait-light-viewport.png), [phone](stats-empty-states-evidence/after-phone-dark.png).
- [Dark tooltip](stats-empty-states-evidence/tooltip-1440-dark.png).
- Percentage fields: [light](stats-empty-states-evidence/percentage-input-light.png), [dark](stats-empty-states-evidence/percentage-input-dark.png).
