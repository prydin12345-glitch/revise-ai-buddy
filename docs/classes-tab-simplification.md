# Classes tab simplification

Overview is now labelled Your classes and contains the class cards/search only. Assignments and announcements remain in their existing tabs. The calendar and Upcoming deadlines remain available on all three tabs, retaining the existing responsive placement.

The empty Assignments message is centred in its main column, with the divider widened from 330px to 370px where space permits. Narrow screens retain a fluid maximum width. No queries, backend contracts, submission logic, dependencies or access rules changed.

Verification: 52 focused tests passed across five suites. Final typecheck, critical lint, production build and whitespace checks passed. Chromium checked 1440×1000, 834×1112 and 390×844 in light/dark themes using synthetic in-memory records and local font snapshots. All tabs retained the schedule, the class tab had no assignment/announcement previews, the empty message was centred, and no horizontal page overflow or unexpected browser errors occurred. Real iOS/Safari and live accounts were not tested. Existing Browserslist, Zod/Rollup and bundle-size warnings remain.

- [Your classes](classes-tab-evidence/your-classes.png)
- [Empty assignments on laptop](classes-tab-evidence/empty-assignments-laptop.png)
- [Empty assignments on phone](classes-tab-evidence/empty-assignments-phone.png)
- [Browser measurements](classes-tab-evidence/browser-results.json)

The website remains unpublished. No function deployment or migration is required.
