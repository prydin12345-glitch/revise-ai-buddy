# Dashboard stats drill-downs

The shared drawer used by Home and the Stats page now has four connected sections:
Exams Taken, Score Breakdown, Study Hours and Day Streak. No schema, function,
provider or marking changes are required.

## Interaction

- Phones retain a full-screen sheet. Laptop/tablet sheets have more space (up to
  576px). The title and close control remain fixed while the section content scrolls.
  Four small pill selectors sit near the bottom, with no visible text labels.
  They fade after seven idle seconds and return on a deliberate horizontal swipe
  (including at a boundary), section navigation or keyboard focus. Their spoken
  names and current-section state remain available; keyboard focus keeps them
  visible. Bottom padding keeps the selectors clear of the last content row and
  device safe area. Previous/next controls remain compact on desktop; on mobile
  they are visually hidden until keyboard focus. No page count, subtitle or
  swipe-instruction row is displayed.
- On mobile, a deliberate horizontal finger swipe moves one section. As the
  founder requested, finger-left from Scores selects Exams; finger-right selects
  Hours. Ends do not wrap. Buttons offer the same destinations without gestures.
- Vertical scrolling, pinch zoom, browser-edge gestures, text selection, editable
  inputs and study date-picker dialogs/popovers do not trigger section changes.
  Swipes over chart bars/streak calendar cells are supported; their compatibility
  click is suppressed.
- Data loads for the selected section. Owner checks, abort signals and request
  keys prevent a late response from another section/month/account being shown.
  Reopening starts a fresh read. Errors show a retry action, not a zero chart.

## Mobile exam history

Mobile uses a compact search/sort toolbar, wrapping filter pills and separated
full-width exam rows. Each row contains an original decorative SVG study scene,
title, subject, date, result state and review chevron. The artwork uses theme
tokens and makes no image request. Subject names choose decoration only, never
qualification, tier or course identity. Real released zeros remain visible;
withheld scores remain hidden and failed marking is labelled incomplete. The
whole row uses the existing review route. Desktop retains its existing list.

## Day Streak

A Monday-first monthly calendar replaces the rolling 14-day list. Consecutive
active days have a joined highlight; today, active days, selected days and future
days have distinct states and accessible labels. Months can be browsed without
changing the current-week summary.

The calendar, weekly card and History remain. The separate current-streak/daily-
goal summary and Today’s Activity block have been removed. The header shows a
flat vector flame when the loaded streak is zero; an active streak replaces it
with the saved number. It shows a loading placeholder while fetching. The weekly
card uses the same vector flame with a flat backing. History retains the longest
streak, next milestone and last activity, with no icons on its labels.
There is no XP or daily-goal panel.

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

The four coloured category totals are simple vertical name/value rows. The month
button opens a year navigator and twelve-month grid. Custom range opens one
"Select date" dialog: a first tap sets the start, a second sets the end, and
Save applies the inclusive range. Earlier second taps are ordered automatically;
same-day ranges work. Month/year navigation retains the draft start. Cancel,
Escape and dismissal leave the active chart period unchanged. No activity fetch
is requested until Save. The installed calendar supplies keyboard navigation;
the day renderer preserves its focus/selection handlers and adds full spoken
dates. Future dates and ranges exceeding the existing 366-day limit stay blocked.

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
Check the seven-second selector fade, its return on a swipe/section change and
keyboard access, the illustrated exam rows, the month grid and a start/end range
saved or cancelled across a month/year boundary.
Confirm the last selected day's entries appear. The cloud browser available in
this task cannot reach the scratch dev server, and blocked local-file navigation
was not circumvented. Browser screenshots/device checks and real database reads
are not claimed. The reference screenshots were inspected directly.

No migrations, backend deployments, paid generation, live data writes or website
publication are needed or performed by this change.

### Initial rollout validation

On Node 24.19.0, with the existing lockfile:

- `npm ci --cache /workspace/.npm-cache --prefer-offline --no-audit --no-fund`: pass.
- `npm run check` with two Vitest workers: 2,046 tests / 125 files passed;
  frontend typecheck and critical hook lint passed; backend identifier check and
  all 39 function bundles passed; production build passed.
- The original three test files contained 57 checks; subsequent UI-polish results
  are recorded below.
- `node scripts/audit-biology.mjs`: all 52 existing template combinations checked.
- Date/data and hook tests also passed under `TZ=Europe/London` (37 checks).
- `git diff --check`: pass.

Existing non-blocking output includes package deprecations, npm's proxy-setting
warning, old Browserslist data, unrelated test DOM-nesting/PDF-font warnings and
large production chunks. No check was bypassed or weakened.

### Header and streak polish

Removed the visible section strip, subtitle, page indicator and swipe helper row.
Mobile opens with focus on the dialog so the hidden previous/next controls are
not revealed automatically; keyboard focus reveals those controls when needed.
The current-streak summary, daily-goal panel and Today's Activity section are no
longer displayed. Both flame treatments use a shared inline SVG; no generated
bitmap, image fetch or additional asset dependency is involved. Calendar/streak
data, study aggregation, backend logic and swipe gesture handling are unchanged.

Polish validation on Node 24.19.0: `npm run check` passed with 2,051 tests in
125 files, clean frontend type/hook checks, the identifier check, all 39 function
bundles and the production build. The updated drawer suite has 25 passing tests
covering swipe navigation after strip removal, dialog focus/close, loading and
zero/positive streak badges, calendar/history and existing study controls.
`git diff --check` passed. Browser/device visual review remains outstanding.

### Compact selectors, mobile exam history and date pickers

Validation on Node 24.19.0 with the unchanged lockfile: `npm ci` passed, then
`npm run check` passed with 2,068 tests in 126 files, clean frontend type/hook
checks, backend identifier checks, all 39 function bundles and the production
build. The two stats UI suites contain 42 checks, including selector timing,
keyboard focus, range saving/cancellation, future/oversized ranges, year changes,
touch isolation and protected exam results. `git diff --check` passed.

The initial two-worker full run timed out in an unchanged tutor-feedback test
and its following pagination case. Both passed in isolation; the complete run
then passed with one worker and the original 30-second test limits. No tests or
timeouts were relaxed. Existing non-blocking warnings remain as listed above;
the build also reports a dependency PURE-annotation warning from Zod.
Browser/device visual review and real-account round trips remain outstanding;
these are synthetic UI and data checks, not screenshots or live-backend tests.
