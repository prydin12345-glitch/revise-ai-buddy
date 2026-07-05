## What's actually happening

Your Geography subject is fine. Both profiles are saved correctly on the account (`GP1` and `GP2`, both under `subject_name = "Geography"`), and they are linked to the subject by name — not by any preset id. So there is no clash between a "preset Geography" and your Geography.

The real bug is in the exam-creation screens. When you pick a subject, the code decides whether to open the "Use your custom curriculum?" picker with this check:

```ts
const topics = getTopicsForSubject(newSubject);
if (topics.length > 1) setShowProfilePrompt(true);
```

It only opens the picker when the subject has more than one manually-added master topic. For Geography you have **0 master topics** but **2 exam profiles**, so the picker never opens and the exam form falls back to the default flow — which is why it looks like the profiles were ignored.

The same check exists in three places:

- `src/pages/CreateExam.tsx` (`handleSubjectChange`)
- `src/pages/CreatePracticeQuestions.tsx` (`handleSubjectChange`)
- `src/pages/tutor/CreateTutorExam.tsx` (`handleSubjectChange`)

The picker component (`CurriculumPromptModal`) already accepts `profiles` and knows how to render them — the modal itself is fine.

## The fix

**1. Open the picker whenever the subject has saved profiles, not just when it has master topics.**

In each of the three files above, change the trigger inside `handleSubjectChange` to:

```ts
const topics = getTopicsForSubject(newSubject);
const profiles = getProfilesForSubject(newSubject);
if (profiles.length > 0 || topics.length > 1) {
  setShowProfilePrompt(true);
}
```

This makes the picker appear as soon as you pick a subject that has any saved exam profile (like your Geography), so `GP1` and `GP2` become selectable.

**2. Small polish to `CurriculumPromptModal`** so it still reads well when the user has profiles but no master topics (the "Practice All Saved Topics" section should be hidden when `masterTopics.length === 0`, leaving only the profile list and a "Start from scratch" option). No behaviour change beyond hiding an option that would do nothing.

**3. Verify no other regressions.**

- Confirm the deep-link path (`/create-exam?subject=Geography&profileId=…`) still auto-selects a profile — it already uses `getProfilesForSubject` directly and does not depend on the trigger, so it is unaffected.
- Confirm `UploadExam.tsx` — it renders its own profile list inline via `getProfilesForSubject` and does not use the prompt trigger, so it already works and will not be touched.

## Files changed

- `src/pages/CreateExam.tsx` — widen the prompt trigger
- `src/pages/CreatePracticeQuestions.tsx` — widen the prompt trigger
- `src/pages/tutor/CreateTutorExam.tsx` — widen the prompt trigger
- `src/components/exam/CurriculumPromptModal.tsx` — hide the "Practice All Saved Topics" block when there are no master topics

## What is *not* the cause (so we don't chase it)

- There is no "preset Geography vs custom Geography" clash. Profiles are keyed by `subject_name` (case-insensitive), and your row in `user_subjects` and both `subject_exam_profiles` rows all use `"Geography"`.
- RLS and the data itself are fine — I read both profiles back from the database against your user id.

After the change, choosing Geography on the Create Exam screen will immediately show the picker with `GP1` and `GP2`, and selecting one will apply its topics, question count, timing and structure to the exam as designed.