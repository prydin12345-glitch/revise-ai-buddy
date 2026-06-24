
## Goal

Make the exam cards on `My Exams` cleaner, and turn the card click into a "front cover" summary page (modelled on the wizard's `ExamPaperCover`) where all per-exam actions live. No business logic changes.

---

## 1. `src/components/exam/ExamCard.tsx` — slim it down

- **Remove** the orange/green status ribbon (the "In progress" pill in the top-right of the paper). The progress bar + % already communicate state.
- **Remove** the bottom meta line ("Created 20 Jun 2026 · last opened …").
- **Remove** the whole action row under the paper (Favourite / Download / Edit / Delete / Start-Continue-Review). Those move to the new cover page.
- **Card click** → always navigate to `/exam/${exam.id}/cover` (no more branching to preview/in-progress/review from the card itself). Keep the "published & not archived" guard.
- Drop the now-unused props (`onEdit`, `onDelete`, `onToggleFavourite`, `onDownloadPDF`, `isFavourite`) from the component signature, and stop passing them from `MyExams.tsx`.
- Keep: spine, masthead, title block, Questions/Time strip, topics, progress bar with %.

Result: the card is a pure "paper face" tile — no chrome below it.

## 2. `src/pages/MyExams.tsx` — mobile resize + simpler card usage

- In the subject-row scroller (lines ~798-829), update card widths so mobile no longer cramps:
  - `w-[200px] sm:w-[220px] md:w-[240px] lg:w-[240px]` (slightly wider on phone since there's no action row competing for space, and the card itself owns less content now).
- Update the `<ExamCard …/>` call to drop the removed props.
- Edit / Delete / Favourite / Download dialogs and handlers stay on this page — they're now triggered from the cover page (which navigates back here and we re-use the same handlers via a small refactor: see §3).

## 3. New page: `src/pages/ExamCover.tsx` + route

New route in `src/App.tsx`:
```
<Route path="/exam/:examId/cover" element={<OnboardingGuard><ExamCover /></OnboardingGuard>} />
```

Layout (uses `DashboardLayout` for consistency):

```text
┌─ Back to My Exams ─────────────────────────────────────┐
│                                                        │
│  ┌──────────────────────────┐   ┌────────────────────┐ │
│  │                          │   │ Status chip        │ │
│  │   BIG PAPER COVER        │   │ Progress 42%       │ │
│  │   (reuses styling from   │   │ ──────────────     │ │
│  │   wizard/ExamPaperCover, │   │ Created 20 Jun 26  │ │
│  │   read-only — no pencil  │   │ Last opened today  │ │
│  │   edit buttons)          │   │ Questions · Time   │ │
│  │                          │   │ Board · Level      │ │
│  │                          │   │                    │ │
│  │                          │   │ [★ Favourite]      │ │
│  │                          │   │ [⬇ Download PDF]   │ │
│  │                          │   │ [✎ Edit]           │ │
│  │                          │   │ [🗑 Delete]         │ │
│  │                          │   │                    │ │
│  │                          │   │       ( → )        │ │
│  │                          │   │  circular Continue │ │
│  └──────────────────────────┘   └────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

Behaviour:
- **Back button** (top-left, `ChevronLeft` + "My Exams") → `navigate(-1)` with fallback to `/my-exams`.
- **Paper cover** on left: render a read-only variant of the `ExamPaperCover` look (don't import the wizard component directly because it depends on `useReviewEdit` and shows pencil buttons; instead extract the visual JSX into a new shared `src/components/exam/ExamPaperCoverStatic.tsx` and have both the wizard and this page consume it — the wizard wraps it with the pencil overlays). On mobile, paper stacks above the side panel and uses `max-w-sm mx-auto`.
- **Side panel** on right (desktop ≥ md): vertical stack of actions and meta. On mobile it sits below the paper and the action buttons become a horizontal row of icon buttons with the circular Continue button right-aligned.
- **Continue/Start/Review button**: circular `h-14 w-14 rounded-full` with only the arrow icon (`ChevronRight` for continue/start, `Eye` for review) — no text label visible; aria-label carries the verb. Routes:
  - `not-started` → `/exam/${id}/preview`
  - `in-progress` → `/exam/${id}/in-progress?mode=student`
  - `completed` → `/exam/${id}/review`
- **Edit / Delete / Favourite / Download**: open the same dialogs/handlers that already exist in `MyExams.tsx`. To avoid duplicating that logic, extract the four handlers + their dialog JSX (`editDialogOpen`, `deleteDialogOpen`, PDF modal, favourite toggle) into a small shared hook `src/hooks/useExamActions.ts` that both `MyExams.tsx` and `ExamCover.tsx` consume. The hook returns `{ openEdit, openDelete, toggleFavourite, openDownload, dialogs }` where `dialogs` is a JSX fragment to render once at the page root.

Data the page needs (loaded in a single `useEffect` from supabase):
- Exam row (`exams` table) — title, subject_id, created_at, exam_board, qualification_level, status, exam_topics.
- Progress (same shape `MyExams` builds for `examProgress`) — reuse the existing progress-derivation helper; if it's inline in `MyExams.tsx`, lift it to `src/lib/exam-progress.ts` and import from both.
- Favourite state.

No changes to exam generation, AI, or any other rendering.

## 4. Shared extraction summary

New / touched files:
- **new** `src/components/exam/ExamPaperCoverStatic.tsx` — pure visual paper cover (no editing affordances). Used by wizard + new page.
- **new** `src/pages/ExamCover.tsx` — the cover/summary page.
- **new** `src/hooks/useExamActions.ts` — favourite/edit/delete/PDF handlers + dialog JSX.
- **new** `src/lib/exam-progress.ts` — lifted progress helper (only if currently inline in `MyExams.tsx`).
- **edit** `src/components/exam/ExamCard.tsx` — strip ribbon, meta, action row; click → `/exam/:id/cover`.
- **edit** `src/pages/MyExams.tsx` — widen mobile card widths, drop removed props, consume the shared hook so existing edit/delete/etc still work.
- **edit** `src/components/wizard/ExamPaperCover.tsx` — internally render `ExamPaperCoverStatic` and overlay the pencil edit buttons (no visual change for the wizard).
- **edit** `src/App.tsx` — add the `/exam/:examId/cover` route.

## Non-goals

- No changes to exam generation, AI tutor, diagram renderers, or the in-progress / review pages themselves.
- No change to data model or any supabase queries beyond reading the same exam row on the new page.

## Open question

Currently the card click only fires when `exam.status === "published" && !isArchived`. Should the new cover page also be reachable for **draft** and **archived** exams (read-only, with Continue button hidden)? I'd suggest yes for archived (so users can still download/restore from there) and no for drafts (they belong in the wizard) — confirm if you'd prefer different.
