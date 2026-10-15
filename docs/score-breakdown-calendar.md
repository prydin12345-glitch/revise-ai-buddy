# Score Breakdown calendar and subject panels

This change replaces the Score Breakdown drawer's old date/All Subjects filters
and exam list with a calendar, one subject selector and two panels. The main
`/stats` layout is not redesigned. Its existing shared drawer receives the new
props, as does Home. Exams Taken retains the review/history list.

## Calendar and gestures

- Today selects the current local day and displays its Monday–Sunday week.
  Tapping a date selects that day's results. The menu label shows the selected
  date when browsing history; choosing Today returns to the real current date.
- Month and Year change the strip to seven months or years around the selection.
  They select an entire calendar month/year, not the next 30/365 rolling days.
- Mode and subject controls use styled native selects, including the phone's
  own picker and normal keyboard controls, without a second popup focus layer.
- Day-strip arrows/swipes page one week, preserving the weekday where possible.
  Month/year arrows/swipes move one month/year. Future selection is disabled;
  advancing from an earlier week clamps to today if its weekday is still ahead.
- On phones, finger-left/up moves back and finger-right/down moves forward.
  All-axis paging belongs only to the date strip (`touch-action: pinch-zoom`).
  Scrolling outside it remains vertical, and horizontal body swipes retain the
  existing stats-section navigation. Desktop retains date buttons/arrows and
  normal vertical scrolling; date swipes are not captured there.
- Short/diagonal gestures, multi-touch/pinch and browser-edge gestures are
  ignored. Committed date swipes suppress a following compatibility click and
  reveal the timed section selectors without switching sections.

## Two panels for one subject

The average gauge shows marks out of 100, plus separate exam and quiz averages.
Each valid released exam and fully marked completed quiz contributes one
percentage to the overall arithmetic mean. Within a quiz, the percentage uses
earned/available marks, not binary correct-question counters. This view does not
change Home's existing exam-average metric or the topic-mastery calculations.

The profile chart groups by saved profile ID and compares exams with quizzes.
It shows four profiles per page, with a matching accessible table and full
profile names. Same-named profiles are not merged. Missing values are dashes;
real graded zeros remain zero. Unprofiled attempts form a No profile group.
Names come only from owned profiles. An unavailable or subject-mismatched
profile is conservatively labelled Saved profile rather than exposing a tutor's
private profile or inventing its name.

Mobile stacks the panels; the existing wider drawer can place them side by
side. Theme tokens, scoped quiz colour and the existing typeface are reused.
No generated image or external asset is used for the charts.

## Data and access

`useStatsDrilldown` loads the selected local year through
`loadDashboardScores`. Day/month/subject switching within that year is local;
changing year starts a new owner-scoped, abortable request. The result key
includes owner, section and year. Late responses and prior-owner data cannot
replace the current selection. Reopening refreshes the read.

Reads use:

- `exam_submission_metadata`, filtered to the authenticated student and year,
  joined only to public exam metadata (subject, title, release flag, profile ID).
- Completed `practice_set_progress` joined to that same user's practice sets.
- `subject_exam_profiles` and `user_subjects`, filtered to that user.
- Quiz question IDs/marks and that user's answer scores/submission timestamps,
  limited to the owned completed set IDs. No answer text, solutions, feedback or
  answer keys are selected. Question columns already have the required grants.

Paging uses the existing 500-row/20,000-row guard. Set IDs are queried in batches
of 100 to bound URL length; combined quiz-question and answer reads are also
capped at 20,000 rows per year. Excess history or any failed source query raises
an error instead of presenting a truncated or exam-only average. Very large
years will need server-side aggregation in a future change.

Unreleased/unmarked/failed exams are excluded. A completed quiz is included
only when every current question has a finite valid submitted mark, and a known
generated-question count matches the metadata. Partial or failed quiz marking
is excluded as a whole. Duplicate records are deduplicated; current saved quiz
answers are used, not a new immutable retake ledger. Pending counts use the same
subject and day/month/year interval as both panels. No data means a dash, not a
false zero. Saved profile-name edits do not rewrite historical grades.

No migration, new grant, backend function change, deployment, paid generation,
live data write or website publication is required by this frontend change.

## Verification and preview checklist

Verified on Node 24.19.0 with the existing lockfile: `npm ci` and
`npm run check` pass, including 2,103 tests across 128 files, frontend type
checking, critical hook checks, backend identifiers, all 39 Edge Function
bundles and the production build. Tests ran with one worker to avoid resource
contention. `git diff --check` passes. No dependency or lockfile changed.
Existing non-blocking deprecation/Browserslist, test DOM-nesting/PDF-font,
bundler annotation and large-chunk warnings remain.

Automated checks use synthetic metadata and DOM events. Component tests assert
data/DOM transitions; drawer integration tests cover gesture isolation and timed
selectors. They do not establish pixel layout, real-device gestures or a live
Supabase round trip. The available cloud browser cannot reach this scratch
development server; blocked local-file navigation is not circumvented.

Before release, check the actual preview at 320/390px, tablet and laptop widths
in both themes:

1. Today displays the current week. Tap a prior date and return through Today.
2. Change to Month/Year; browse a historical year and confirm the loading state.
3. Swipe the date strip left/right/up/down. Only dates change. Swipe below it;
   the stats section changes. Verify vertical scrolling and pinch zoom outside
   and within the strip, and no accidental date tap after a swipe.
4. Switch subjects. Only the chosen subject's gauge, bars and exclusions appear.
5. Compare a released exam and a fully marked completed quiz with saved marks.
   Verify true zero, pending/failed marking, withheld results and empty dates.
6. Check long profile names, more than four profiles, keyboard menus, future-date
   limits, screen-reader labels/table, light/dark colours and the bottom selector.
7. Switch accounts/years quickly and close/reopen. No prior user's data or stale
   year should flash. The main Stats page and other three drawers still work.
