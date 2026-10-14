# Dashboard stats drill-downs

The shared drawer used by Home and the Stats page now has four connected sections:
Exams Taken, Score Breakdown, Study Hours and Day Streak. No schema, function,
provider or marking changes are required.

## Interaction

- Phones retain a full-screen sheet. Laptop/tablet sheets have more space (up to
  576px). The header, section buttons, close control and previous/next controls
  remain fixed while the section content scrolls.
- On mobile, a deliberate horizontal finger swipe moves one section. As the
  founder requested, finger-left from Scores selects Exams; finger-right selects
  Hours. Ends do not wrap. Buttons offer the same destinations without gestures.
- Vertical scrolling, pinch zoom, browser-edge gestures, text selection, editable
  inputs and native date controls do not trigger section changes. Swipes over
  chart bars/date cells are supported; their compatibility click is suppressed.
- Data loads for the selected section. Owner checks, abort signals and request
  keys prevent a late response from another section/month/account being shown.
  Reopening starts a fresh read. Errors show a retry action, not a zero chart.

## Day Streak

A Monday-first monthly calendar replaces the rolling 14-day list. Consecutive
active days have a joined highlight; today, active days, selected days and future
days have distinct states and accessible labels. Months can be browsed without
changing the current-week summary.

The daily goal is **one completed activity**: submit an exam, finish a quiz or
complete a revision task. There is no XP and no invented target. The weekly card
shows actual active days out of seven. History retains the longest streak, next
milestone and last activity; Today's Activity retains the completed categories.

The current and longest streak values still come from `user_streaks`; this patch
does not rewrite the backend's streak calculations. Calendar events come from
submitted exam metadata, completed practice sets and completed revision tasks.
A task has no dedicated completion timestamp, so its last `updated_at` is the
available proxy for its completion day; later task edits can move that calendar
entry. It is not a complete immutable activity ledger. No attempt is made to
infer activities in months that were not fetched. Browsing an old month loads it
and the current week separately, not every month in between.

## Study Hours

One rounded stacked chart and its colour key replace the separate category list
plus fixed-current-week Daily Breakdown. Every chart total and category total is
derived from the same date-filtered sessions. Week/month navigation uses local
calendar boundaries, with inclusive end-of-day timestamps. Month selection and
custom ranges are supported. Future month/week navigation is disabled; custom
ranges are validated and limited to 366 days. Longer custom views group days into
at most 31 labelled buckets without dropping time. Week and month views show
every day, including genuine empty days.

- Exams: `time_taken_seconds` from submitted exam metadata.
- Practice: `time_spent_seconds` from completed practice sets.
- Revision: the duration on completed revision tasks, assigned to their scheduled
  date. This is an existing task-duration measure, not a new focus timer.
- Feedback: retained in the key, currently zero/untracked. A tutor reply's
  `responded_at` is not proof the student read it or spent five minutes reviewing;
  the old invented five-minute estimate was removed. A real review timer would
  need a separate implementation.

Session dates retain their year and timestamp. Sub-minute times are retained.
Queries page through PostgREST results (500 rows/page, at most 20,000 rows); an
excessively large range fails visibly instead of silently truncating totals.
Revision queries use timestamp bounds too, so work scheduled late on the last
selected day is not excluded. Study chart colours are semantic, with a scoped
purple practice colour so the dark theme's blue info token does not merge the
exam/practice categories. Names, values and bar labels accompany the colours.

Score data uses the existing protected `exam_submission_metadata` view. Only
valid, released, graded scores contribute to the average; an unmarked, failed or
withheld mark is not treated as a scored zero. Genuine graded zeros remain valid.

## Verification

Synthetic component and hook tests cover section navigation, realistic touch
lists and the Radix scroll lock, gesture cancellation, accessible controls,
calendar months, daily/weekly progress, month/custom ranges, year and leap-day
boundaries, duration totals, protected scores, paging, errors, account isolation
and late response suppression. They do not establish real device touch behaviour
or a live database round trip.

Before merge/release, inspect the actual preview at 320/390px, tablet and laptop
widths in light and dark mode. Check horizontal swipes (including bars/date
cells), normal vertical scrolling, close/escape/focus return, historical months,
custom date validation, empty/loading/error states and a user with real activity.
Confirm the last selected day's entries appear. The cloud browser available in
this task cannot reach the scratch dev server, and blocked local-file navigation
was not circumvented. Browser screenshots/device checks and real database reads
are not claimed. The reference screenshots were inspected directly.

No migrations, backend deployments, paid generation, live data writes or website
publication are needed or performed by this change.

### Recorded automated results for this change

On Node 24.19.0, with the existing lockfile:

- `npm ci --cache /workspace/.npm-cache --prefer-offline --no-audit --no-fund`: pass.
- `npm run check` with two Vitest workers: 2,046 tests / 125 files passed;
  frontend typecheck and critical hook lint passed; backend identifier check and
  all 39 function bundles passed; production build passed.
- The three new test files contain 57 checks.
- `node scripts/audit-biology.mjs`: all 52 existing template combinations checked.
- Date/data and hook tests also passed under `TZ=Europe/London` (37 checks).
- `git diff --check`: pass.

Existing non-blocking output includes package deprecations, npm's proxy-setting
warning, old Browserslist data, unrelated test DOM-nesting/PDF-font warnings and
large production chunks. No check was bypassed or weakened.
