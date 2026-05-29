## Scope

Visual/layout overhaul of the **student dashboard only** (`src/components/dashboard/StudentDashboardContent.tsx`). No changes to data fetching, routing, auth, tutor/teacher dashboards, sidebar, or any other page. Theme stays as-is (current light brand tokens). Reference image is used strictly for **arrangement and hierarchy**, not colors.

## New layout (desktop ≥1024px)

```text
┌─────────────────────────────────────────────────┬──────────────────┐
│ Greeting + level chip      [+ Create exam ▾]    │  Student Profile │
│                                                  │  avatar, name    │
│ My stats                                         │  level · streak  │
│ ┌────────┬────────┬────────┬────────┐           │  ┌────┬────┬───┐ │
│ │ Exams  │ Avg %  │ Hours  │ Streak │           │  │Rank│Avg │Cnt│ │
│ └────────┴────────┴────────┴────────┘           │  └────┴────┴───┘ │
│                                                  │                  │
│ Career / weak-topic nudge strip  [Go to weak →] │  Subject stats   │
│                                                  │  ┌────────────┐  │
│ My Classes                          View all →  │  │  Donut     │  │
│ ┌──────────────────┐  ┌──────────────────┐      │  │  by        │  │
│ │ class card 1     │  │ class card 2     │      │  │  subject   │  │
│ │ subject · tutor  │  │ subject · tutor  │      │  │  (hover %) │  │
│ │ progress bar     │  │ progress bar     │      │  └────────────┘  │
│ │ [Continue]       │  │ [Continue]       │      │  legend rows     │
│ └──────────────────┘  └──────────────────┘      │                  │
│                                                  │                  │
│ Recent activity (in-progress exams + practice)  │                  │
│ ─ row · row · row · row                          │                  │
└─────────────────────────────────────────────────┴──────────────────┘
```

Mobile/tablet collapses to a single column; right rail (profile + donut) drops below the main column. No changes to the existing mobile swipe screens behavior — the new structure renders in its place on the same breakpoints already used.

## Component changes (all inside `src/components/dashboard/`)

1. **`StudentDashboardContent.tsx`** — rewrite the JSX layout only. Keep every hook, state, fetch, and handler exactly as-is. Re-bind existing data to the new grid.

2. **New `DashboardHeaderBar.tsx`** — greeting + level chip on the left, primary CTA on the right: `Create` split button with menu items "Create exam" → `/upload-exam` and "Create practice questions" → `/create-practice-questions` (routes already exist). Uses `Plus` Lucide icon.

3. **New `ClassesGrid.tsx`** — replaces the current "Mock Exams" + "Practice Quizzes" panels. Renders the existing `classes` state as 2-up cards (subject color dot, class name, tutor name, student count, a thin progress bar derived from `completedExamsCount / total assigned`, and a `Continue` button → `/my-classes`). Section title: **My Classes**. "View all" → `/my-classes`. Empty state: existing `JoinClassModal` trigger.

4. **New `SubjectDonut.tsx`** — Recharts `PieChart` with `Pie` + `Cell` per subject, broken down by **average score per subject** computed from `allExams` (graded only). 
   - Colors from `getSubjectColor(subject_id)` (already in scope).
   - Center label: overall average % (reuse existing `averageScore`).
   - Hover: Recharts `Tooltip` showing `subjectName — XX% (n exams)`. Percentage is "subject avg out of 100", per the request.
   - Below chart: legend rows (color dot · subject name · % on the right), click row → `drilldown.open('scores', { subjectId })` (existing drilldown supports this filter shape; if not, falls back to `drilldown.open('scores')`).
   - Empty state: "Complete an exam to see your subject breakdown."

5. **`StudentDashboardContent.tsx` removals from current JSX** (logic stays):
   - Mock Exams panel block
   - Practice Quizzes panel block
   - Old progress carousel placement (moved into Recent activity row, or removed if duplicative — confirm during build)
   - Emoji characters in the stats array (`📝 🏆 ⏱ 🔥`) replaced with Lucide: `FileText`, `Trophy`, `Clock`, `Flame` (already imported).

6. **Header CTA wiring** — uses `useNavigate`; no new routes.

## Things explicitly NOT changing

- `DashboardLayout.tsx`, sidebar, `AiTutorChat`, notifications, theme tokens, `index.css`, `tailwind.config.ts`.
- All Supabase queries inside `loadStudentData`.
- `useExamStats`, `useStatsDrilldown`, `useUserSubjects`, `useUnifiedTopicPerformance`.
- Tutor and teacher dashboards.
- Mobile FAB and `ProgressCarousel` internals.
- Edge functions, RLS, migrations.

## Technical notes

- Donut data shape: `subjects.map(s => ({ name: s.subject_name, value: avgScoreForSubject(s.id), color: getSubjectColor(s.id), count: examCountForSubject(s.id) }))`, filtering `value === null`. Computed in a `useMemo` over `allExams` + `subjects`.
- The "My Classes" progress bar reuses `classes[i].studentCount` only for the meta row; the bar itself uses count of completed assigned exams per class if available, otherwise hidden — no new queries.
- All new components use existing semantic tokens (`bg-card`, `text-foreground`, `border-border`, `text-muted-foreground`, `bg-primary`). No raw hex, no `bg-black`/`text-white`.
- Lucide icons only. No emoji in any new JSX.

## Open question before I build

Confirm theme reading **B** (keep current light theme) is what you want. If you want the dashboard to actually go dark like the reference, say so and I'll scope a dark surface to `/dashboard` only — this is a meaningful extra step and conflicts with the project's brand memory.
