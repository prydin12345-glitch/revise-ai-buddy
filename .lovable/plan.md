## Goal

Take the current dense "My Subjects" panel (one giant card per subject with topics, profiles, colour picker, board picker, mastery breakdown all inline) and split it into a **two-level Uplearn-style experience**:

1. **Index page** — clean, scannable list of subjects. Name + average score + a couple of glanceable stats. Nothing else.
2. **Detail page** — opens when a subject is clicked. This is where exam profiles, topics, board, colour and edits live.

Works identically on mobile, iPad and desktop.

---

## Level 1 — Subjects index (`/my-subjects`)

Replace `MySubjectsPanel` with a minimalist, Uplearn-inspired list.

Layout:
```text
┌─────────────────────────────────────────────────┐
│  My Subjects                       [+ Add]      │
│  Pick a subject to manage profiles & topics     │
├─────────────────────────────────────────────────┤
│ ● Mathematics            72%   ████████░░  ›   │
│ ● Biology                64%   ██████░░░░  ›   │
│ ● Physics                —     ░░░░░░░░░░  ›   │
└─────────────────────────────────────────────────┘
```

Per row (one component, `SubjectRow`):
- Coloured dot (subject colour)
- Subject name (bold)
- Average score % (from `useTopicPerformance` aggregated, or `—` if untested)
- Thin progress bar in the subject colour
- Tiny meta line under the name: "X profiles · Y topics" (single muted line, ~11px)
- Chevron right
- Entire row is a clickable `Link` to `/my-subjects/:subjectName`

Rules:
- One row per subject, full width, 1px divider between rows (matches the row-item design memory).
- No inline editing, no colour picker, no profile chips on this screen.
- Search box at top once there are >6 subjects.
- Empty state stays as it is today.
- Desktop: same single-column list, max-w-3xl, centered. iPad/mobile: identical (just full width). This guarantees consistency across breakpoints.

Header on the page becomes a real `PageHeader` with title + subtitle + "Add subject" button on the right.

## Level 2 — Subject detail page (`/my-subjects/:subjectName`)

New route + page (`src/pages/SubjectDetail.tsx`) wrapped in `DashboardLayout`. This is where everything currently crammed into `SubjectCard` moves to, but laid out as a proper page with sections.

Structure:

```text
← Back to subjects

● Mathematics                                [⋯ menu: rename colour, set board, delete]
Average score 72%  ·  12 topics  ·  3 profiles
[ Edexcel · A Level ]

──────────── Exam profiles ────────────              [+ New profile]
┌───────────────────────────────────────────────┐
│ Paper 1 Pure              25 Qs · 90 min  ✎ 🗑│
│ Paper 2 Stats             20 Qs · 75 min  ✎ 🗑│
│ Quick recap               10 Qs              ✎ 🗑│
└───────────────────────────────────────────────┘

──────────── Topics ──────────────────────────────
[chips + add topic input — same TopicSearchInput as today]

──────────── Mastery breakdown ───────────────────
Strong 5 · Developing 4 · Weak 2 · Untested 1
(reuse existing bar/legend from SubjectCard)
```

Behaviour:
- Profile rows reuse `ExamProfileModal` for create/edit (already wired in `MySubjectsPanel`).
- Colour, board and rename live in a single header "⋯" popover (reuses `ColourSwatchPicker`, board `Select`, `saveOrUpdateSubject`, `ColourConflictModal`).
- Topics section keeps `TopicSearchInput` + `SuggestedTopicsModal` flow.
- Average score and mastery counts come from `useTopicPerformance(subjectName)`.
- 404 / not-found if `:subjectName` doesn't match a row in `user_subjects`.

## Routing

Add to `src/App.tsx`:
- `/my-subjects/:subjectName` → lazy `SubjectDetail` page.

`MobileBottomNav` already maps `/my-subjects` paths to the "subjects" tab, so the detail page will keep the tab highlighted automatically.

## Files

New:
- `src/pages/SubjectDetail.tsx`
- `src/components/stats/SubjectsList.tsx` (the level-1 list container)
- `src/components/stats/SubjectRow.tsx` (single row)
- `src/components/stats/SubjectHeaderActions.tsx` (the ⋯ popover with colour/board/rename)
- `src/components/stats/SubjectProfilesSection.tsx` (profile list + add/edit/delete)
- `src/components/stats/SubjectTopicsSection.tsx` (topic chips + add)

Edited:
- `src/pages/MySubjects.tsx` — render `SubjectsList` instead of `MySubjectsPanel`. Header simplified.
- `src/components/stats/MySubjectsPanel.tsx` — kept only if still used by stats; if not, deleted in a follow-up.
- `src/App.tsx` — new lazy route.

Out of scope:
- No DB schema changes.
- No changes to `useUserSubjects` / `useSubjectProfiles` hooks (already expose everything needed).
- No changes to `ExamProfileModal` internals.
- No bottom-nav changes (already done).

## Technical notes

- Average score per subject: aggregate `getPerformance(topic)` across all topics for that subject inside a small `useSubjectAverage(subjectName)` helper (or compute inline in `SubjectRow`). If no graded attempts, render `—` and an empty bar.
- `:subjectName` in the URL is `encodeURIComponent(subject_name)`; resolve back via case-insensitive match (same pattern hooks already use).
- Keep all styling on semantic tokens; subject colour comes from the DB and is applied as an inline `style` only for the dot and progress bar fill.
- Animations: simple `framer-motion` row stagger on the index, no heavy entrances.
- Responsive: list rows reflow naturally; detail page uses `max-w-4xl mx-auto` with stacked sections on mobile and the same single column on desktop (Uplearn-style — no multi-column dashboards).
