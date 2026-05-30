
## Why the dashboard feels slow

There are three separate causes stacked on top of each other. Each adds delay, and together they produce the "blank → spinner → flash → content" sequence you're seeing.

### 1. Every page navigation re-downloads code and re-fetches data
- `src/App.tsx` lazy-loads every route (`lazyWithReload(() => import(...))`). The first visit to `/dashboard` or `/my-exams` downloads a JS chunk — that's the brief blank/skeleton.
- `QueryClient` is created but nothing actually uses React Query. `StudentDashboardContent` and `useExamStats` use raw `useEffect` + `supabase.from(...)`, so the moment you navigate away and back, **everything is fetched from scratch**. There is no in-memory cache.

### 2. The dashboard fires a waterfall of ~15–40 sequential queries
In `src/components/dashboard/StudentDashboardContent.tsx` (lines 83–272), one `useEffect` runs in this order:
1. `auth.getUser()`
2. `user_profiles`
3. `user_preferences`
4. `user_streaks`
5. `exams` (own)
6. `exam_assignments`
7. **For each exam** → a separate `exam_submissions` query (N+1)
8. `practice_question_sets`
9. **For each practice set** → a separate `practice_set_progress` query (N+1)
10. `group_members`
11. **For each class** → a `group_members` count + a `user_profiles` tutor lookup (2× N+1)
12. `group_announcements`

In parallel, `useExamStats` runs another ~7 queries against `exams`, `exam_submissions`, `user_subjects`, `revision_tasks`, `revision_goals`, `user_streaks`. None of these share results with the component above, so the same tables get hit twice.

With 10 exams + 5 practice sets + 3 classes that's ~35 round-trips, mostly serial. On a 150 ms connection this is several seconds of latency for data that could load in one.

### 3. The UI renders empty state before data arrives, then "pops in"
- `StudentDashboardContent` renders the full layout immediately with `userName=""`, `allExams=[]`, `classes=[]`, etc.
- As each query resolves, individual sections appear → that's the visible "flash → fill".
- There is no skeleton matching the final layout, so the eye sees layout shifts.

There is also a duplicate-fetch bug worth noting: `useUserRole` re-fetches on every `SIGNED_IN` event (logs show it firing 2–3 times per load), and `StudentDashboardContent`'s effect depends on `getSubjectColor`, which is a new function reference on each `useUserSubjects` render — so the whole 35-query chain can re-run.

---

## The fix

Four focused changes. None touch business logic — only data-fetching and presentation.

### A. Collapse the dashboard fetch into one parallel batch
Rewrite the effect in `StudentDashboardContent.tsx` so the queries run as one `Promise.all`, and the N+1 loops become single `.in(...)` queries:

```text
Promise.all([
  user_profiles,
  user_preferences,
  user_streaks,
  exams.where(user_id).select(*),
  exam_assignments.select(exam_id, deadline, exams(*)),
  practice_question_sets.limit(10),
  group_members.select(group_id, student_groups(*)),
])
  ↓
Promise.all([
  exam_submissions.in('exam_id', allExamIds).eq('student_id', uid),
  practice_set_progress.in('set_id', setIds).eq('user_id', uid),
  group_members.in('group_id', groupIds)  // for counts, aggregated client-side
  user_profiles.in('id', tutorIds),
  group_announcements.in('group_id', groupIds).limit(3),
])
```

This drops ~35 round-trips to **2 parallel batches** (≈ 2× one network RTT instead of 35×).

Also fix the dependency array so the effect runs **once per uid**, not on every `getSubjectColor` reference change.

### B. Cache with React Query so navigation feels instant
The provider is already there (`QueryClientProvider` in `App.tsx`), it's just unused. Move the dashboard load into a `useQuery(['dashboard', uid], …)` with:
- `staleTime: 60_000` (don't refetch within a minute)
- `gcTime: 5 * 60_000` (keep cache when you leave the page)
- `refetchOnWindowFocus: false`

Result: leaving `/dashboard` for `/my-exams` and coming back shows the previous data **immediately**, then silently refreshes in the background. No spinner, no flash.

Do the same for `useExamStats` (key `['exam-stats', uid, timeRange]`) and `useUserRole` (key `['user-role', uid]`). The user-role hook will also stop refetching on every `SIGNED_IN` event.

### C. Add a layout-matching skeleton
Today the dashboard renders the real layout with empty data, so sections appear one by one. Replace the initial render with a skeleton that mirrors the final grid (banner, classes row, activity list, profile card, donut), using the existing `Skeleton` component (`src/components/ui/skeleton.tsx`). Show it only when there is no cached data; on subsequent visits the cache renders directly with no skeleton at all.

### D. Prefetch the dashboard data on login + hover
- In `prefetch-routes.ts`, also call `queryClient.prefetchQuery(['dashboard', uid], …)` from `prefetchCommonRoutes` so the data is warm before you arrive.
- On sidebar `onMouseEnter` (already wired for code chunks), trigger the same prefetch for the target page's primary query.

### What I will NOT change
- No DB schema changes, no edge functions, no auth, no business logic.
- No visual redesign — same components and layout, just faster and with a real loading state.

---

## Files to edit

- `src/components/dashboard/StudentDashboardContent.tsx` — collapse queries into 2 parallel batches, switch to `useQuery`, fix effect deps, render skeleton when no cached data.
- `src/hooks/useExamStats.ts` — wrap fetch in `useQuery`, parallelise the three independent week-range queries (already mostly parallel, just hoist into `Promise.all`).
- `src/hooks/useUserRole.ts` — wrap in `useQuery`, drop the manual re-fetch in `onAuthStateChange` (React Query handles it via key invalidation).
- `src/lib/prefetch-routes.ts` — add `prefetchQuery` calls alongside the existing code-chunk prefetch.
- New: `src/components/dashboard/DashboardSkeleton.tsx` — layout-shaped skeleton.

---

## Expected result

- First-ever dashboard load: ~1 network round-trip of data instead of ~35 — roughly 5–10× faster on a typical connection.
- Subsequent navigations to `/dashboard` from anywhere in the app: **instant** (renders from cache, refreshes silently).
- Switching to `/my-exams` etc.: the JS chunk is already prefetched on hover, so no blank flash; the page's own data will benefit from the same React Query pattern as it's converted.
