# Profile Builder browser verification

The final frozen-source run passed **8 viewport/theme cases and 72 scenario checks** in Chromium **151.0.7922.173**. Viewports were **1440 × 1000**, **834 × 1112**, **390 × 844** and **320 × 780**, each in light and dark mode. Manrope and Source Serif 4 loaded from local copies of the production font files.

The standalone harness lives outside the repository at `/workspace/examly-builder-rebuild-verification`. It bundles the real `ExamProfileBuilder`, `ExamProfileModal`, catalogue resolution, profile validation, existing proposal service, document extraction/indexing and new source-job service. It replaces only preferences and the Supabase transport with synthetic account context and memory records; provider responses are deterministic fixtures. The direct-entry case launches the real parent modal with `initialBuilder`, matching the entry used by `SubjectDetail`; it does not sign in to the full application route.

Every browser request is intercepted. No live backend request, real login, paid provider call, exam generation, migration or live write occurred. Browser-memory save/reopen checks exercise the shared profile validation and protected-envelope construction, not production database persistence or RLS. SQL and authenticated handler checks are recorded separately in the repository verification.

Each size/theme case checked:

1. Direct builder entry bypasses the manual setup screens.
2. Saved GCSE Physics level is reused; students choose board, paper and tier without entering codes. The reviewed-source draft receives no gold star.
3. OCR A Level Biology A H420/03 Full mock previews 70 marks and 90 minutes with a gold star and zero synthetic model calls or quota reservations. Editing, approval removal/restoration, save and reopen work.
4. Changing the assessment invalidates the earlier preview.
5. Edexcel Biology A/B requires an explicit choice; Biology B has no Foundation/Higher control.
6. A readable 96-page original synthetic PDF, containing **175,856 extracted characters**, is parsed in full. Cited assessment details on physical page 90 identify the course/version/tier before confirmation. The source-backed result can be edited, saved and reopened without a gold star.
7. Closing during source analysis preserves the same request. Resume retrieves status without automatically making a model call.
8. A running registered-source receipt has `canAdvance: false`: Check progress only reads its status and retrieves its completed preview without another proposal or source-stage call.
9. Explicit unverified practice has the same safe receipt recovery and no gold star.

All cases passed dialog/page overflow and visible-footer checks. No JavaScript errors, console errors, failed requests or attempted external/backend requests occurred. An earlier run found a real 320-pixel confirmation-footer overflow; the final run includes the corrected flexible footer in both themes. The final phone preview also places Edit profile below the full-width heading and hides an identical assessment subtitle, avoiding the earlier cramped title layout. A malformed synthetic PDF used during harness preparation was corrected before the final run.

The [machine-readable report](results.json) contains exact results, synthetic-document metadata and SHA-256 fingerprints for the 13 source/style files used by the final build. This is Chromium emulation, not physical iOS/iPadOS testing. Controlled replies do not establish real provider output quality, scientific correctness or syllabus completeness.

| View | Screenshot |
| --- | --- |
| Laptop, light, missing choices | [Physics choices](laptop-light-physics-choices.png) |
| Laptop, dark, confirmation | [Physics confirmation](laptop-dark-physics-confirmation.png) |
| iPad, light, approved preview | [Approved preset](ipad-light-approved-summary.png) |
| Phone, dark, approved preview | [Approved preset](phone-dark-approved-summary.png) |
| Phone, light, identified source | [Source confirmation](phone-light-source-confirmation.png) |
| Laptop, dark, source-backed preview | [Source-backed profile](laptop-dark-source-summary.png) |
| Phone, light, optional edit | [Edit profile](phone-light-edit-profile.png) |
| Phone, dark, recovery | [Resume request](phone-dark-resume.png) |
