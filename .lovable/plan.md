# My Classes — Visual & Layout Redesign Plan

## Current problems (audit)

**Visual language drifts from the rest of the app**
- Exams and Quizzes pages use a *portrait "paper" card* grouped by subject in horizontal snap rows. Classes uses square 260px cards with a colored top bar — a different vocabulary that breaks flow.
- Cards expose secondary metadata (joined date, "tasks", bell count, badges) on the card face. Exams/Quizzes pages deliberately moved metadata off the face onto a Cover page. Classes still feels noisy by comparison.
- Settings/Dashboard use `SettingsTabHeader` / `PageHeader` patterns with icon + title + sub-line. `MyClasses` only renders a bare `text-2xl` H1 — no icon, no description.
- No `SettingsCard`/elevated-surface treatment on the right-hand panels; the page reads "flat list on flat bg".

**Layout issues per breakpoint**

Laptop (≥1024px)
- Outer wrapper is `p-6` with no `max-width` — content stretches edge-to-edge on wide screens while Dashboard caps at a comfortable container width.
- 2/3 + 1/3 split for Assignments + Progress is fine, but the horizontal class scroller above it spans full width creating visual imbalance (long row, then narrow column underneath).
- Search input sits inline-left with the tab strip; on wide screens it leaves a large dead zone between search and tabs.

iPad (≈768–1024px)
- The two-panel grid collapses to single column at `lg:` only, so on iPad portrait everything stacks; the horizontal class scroller becomes the dominant element while the Progress panel falls all the way to the bottom.
- Tab strip wraps awkwardly under the search box (sm:flex-row triggers at 640px but tabs can overflow at 768–820px).
- Month dropdown + Plus button compete with the H1 in the same row with no breathing room.

Mobile (<640px)
- `p-6` gives 24px gutters — Dashboard mobile uses 16px. Content feels cramped.
- Class cards are fixed `min-w-[260px]` — too wide; one full card barely fits, second one peeks weirdly.
- The round `+` join button is only 36px (`w-9 h-9`); below recommended 44px tap target.
- Search bar is full-width then tabs scroll horizontally with no fade affordance.
- Empty states use a huge 64px icon + py-16 — eats most of the viewport.
- Sticky header from `DashboardLayout` already provides a notification bell; the page H1 isn't sticky and the Month dropdown scrolls away with content.

**Component-level issues**
- `ClassCard` uses ad-hoc `subjectColors` map instead of the shared `subject-colours.ts` palette used by Exams/Quizzes.
- `AssignmentRow` and `ProgressItem` styling don't share the row vocabulary of `dashboard/row-item-design-standards` (1px dividers, 8px subject dot, `bg-muted` progress track).
- `ClassDetailView` has its own back/leave header that doesn't match the new ExamCover/QuizCover two-column "paper + side panel" pattern.

---

## Proposed redesign

### 1. Page chrome (shared shell)
- Wrap content in a `PageContainer` with `max-w-7xl mx-auto` + responsive padding (`px-4 sm:px-6 lg:px-8`).
- Replace bare H1 with a `PageHeader`: `Users` icon chip + title "My Classes" + sub-line "Classes you've joined, assignments from your tutors, and announcements".
- Move `+ Join a Class` into the header as a primary pill button (icon + label on ≥sm, icon-only at 44×44 on mobile).
- Move `MonthFilter` from the header into the *Upcoming Assignments* panel header where it actually scopes data — it currently looks global but only filters one section.

### 2. Tab strip
- Adopt the pill-style `TabsList` used in Settings, with a right-edge gradient fade on mobile to signal more tabs.
- Drop the inline search beside the tabs; surface a search field *inside* the My Classes tab (it only filters classes), aligned right under the tab strip on its own row.

### 3. Class cards → "Subject paper" cards
- Replace `ClassCard` with the same A4 portrait card vocabulary used by `ExamCard`/`PracticeSetCard`:
  - 1 : 1.414 portrait paper face.
  - Subject color stripe at top (mapped via shared `subject-colours.ts`).
  - Center: class name (serif display), tutor name below as small caps.
  - Bottom of paper: tiny pill row with `{n} tasks` and `{n} new` (announcement) dot — no joined-date, no badges.
  - Actions row *under* the paper: Open, Announcements bell (with count), Leave (kebab menu).
- Group cards by subject (primary subject of class) into horizontal snap-x rows, identical to Exams/Quizzes: subject header (colored dot + name + count) followed by a scroller, card widths 210–240px responsive.
- Clicking a card routes to `/my-classes/:id` (own URL) instead of toggling local state, mirroring the ExamCover / QuizCover pattern. This also fixes mobile back-button behaviour.

### 4. Class detail view → "Cover" layout
- Refactor `ClassDetailView` into a two-column layout matching `ExamCover`/`QuizCover`:
  - Left (≥lg): a large "class cover" card (subject color masthead, class name in serif, tutor name, subjects badges, joined date).
  - Right: stacked `SettingsCard` panels — *Tutor*, *Upcoming Assignments*, *Recent Announcements*, *Feedback*, *Progress*, *Leave class* (destructive style at bottom).
- Below `md`, single column with cover on top, panels stacked.

### 5. Right-side Progress + Upcoming panels (when staying on hub)
- Wrap each in a `SettingsCard`-style surface with icon chip header (Calendar for Upcoming, TrendingUp for Progress).
- Replace `AssignmentRow`/`ProgressItem` styling with the dashboard row standard: 1px divider, 8px subject dot, `bg-muted` progress track, right-aligned secondary text.
- On iPad portrait, change `lg:grid-cols-3` to `md:grid-cols-3` so the two-panel layout activates earlier; clamp the Progress column to a min/max width so it doesn't shrink too narrow.

### 6. Empty states
- Compress: 40px icon + `py-10`, single-line title, two-line body, primary CTA. Reuse Lucide icons already imported.

### 7. Responsive specifics
- Mobile (<640px): outer padding `px-4`, single column, tap targets ≥44px, snap-x card rows of 200px cards, subject headers stay sticky-left during horizontal scroll.
- iPad (640–1023px): 2-column for class card groups stacked vertically; Assignments + Progress side-by-side at `md:`.
- Laptop (≥1024px): `max-w-7xl` container, 2/3 + 1/3 panel split, 5 cards visible per scroller.

### 8. Tokens & consistency
- Replace local `subjectColors` map in `ClassCard` with `getSubjectColor()` from `src/lib/subject-colours.ts`.
- Use semantic tokens only — no hard-coded hex; respect light theme rules from project memory.
- Reuse `SettingsCard`, `PageHeader`, `MyWorkTabBar` (or equivalent pill tabs) so the page visually rhymes with Settings/Dashboard/Exams/Quizzes.

---

## Files to touch

- `src/pages/MyClasses.tsx` — restructure header, tabs, container, subject-grouped scrollers, route to detail page.
- `src/components/classes/ClassCard.tsx` — rewrite as portrait paper card; strip metadata; actions below; shared subject colors.
- `src/components/classes/ClassDetailView.tsx` — refactor to two-column cover + side panels using `SettingsCard`.
- `src/components/classes/AssignmentRow.tsx`, `ProgressItem.tsx` — restyle to dashboard row standard.
- `src/App.tsx` — add `/my-classes/:groupId` route for the new detail page (or repurpose existing state-based detail).
- Optionally extract a new `ClassPaperCoverStatic.tsx` for the cover face, mirroring `ExamPaperCoverStatic` / `QuizPaperCoverStatic`.

## Out of scope
- Data model, queries, real-time subscriptions, leave/join logic — no changes.
- Tutor-side `ClassCard` (`src/components/tutor/ClassCard.tsx`).
- Announcement/Feedback content components beyond container styling.

## Acceptance
- Visual language matches Exams + Quizzes (portrait cards, subject-grouped horizontal scrollers, cover-page detail).
- Page chrome matches Settings/Dashboard (`PageHeader`, `SettingsCard`).
- Layout holds at 390 / 820 / 1366 widths without overflow, awkward gaps, or tap targets <44px on mobile.
- All colors come from shared subject palette + semantic tokens.
