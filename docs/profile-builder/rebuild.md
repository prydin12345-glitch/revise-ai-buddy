# Profile Builder rebuild

Built from `main` at `d07b081a` on `codex/profile-builder-rebuild`. This document supersedes the original v1 UX/upload descriptions. The website remains unpublished. No migration, deployment, real account login, paid provider request or live-data change is performed by this work.

## Student flow

The subject page opens **Build profile for me** directly. The existing manual editor remains available. Saved subject, educational level, country/system and applicable board/course/paper/tier are reused. A school exam-board preference does not become a university institution.

Only unresolved human choices appear. A genuinely ambiguous course, including Edexcel Biology A/B, stays a selection. Technical codes and versions are optional Advanced details. Known supported untiered courses have no Foundation/Higher control.

After one confirmation, an exact approved preset displays its existing deterministic preview with no model call or AI quota reservation. Its server receipt is still required to save. Other reviewed courses create a source-backed AI draft without a gold star. An unfamiliar course can use a syllabus/assessment brief; explicit unverified practice stays a separate optional choice and cannot claim an authentic Full mock.

The completed profile is a summary with **Save profile**, **Edit profile** and **Cancel**. Ordinary edits and the detailed blueprint remain available without making every student complete another form. Changing assessment choices invalidates an older preview. Evidence readiness is checked before entering confirmation.

## Official evidence

[Source research](rebuild-sources.md) records the official AQA pages, current linked specifications, all eight reviewed paper covers, versions, physical page numbers and checksums. Separate GCSE Physics 8463 and Chemistry 8462 Papers 1/2, Foundation/Higher, now resolve technical identities and source packs automatically. Combined Science remains distinct. Existing Pearson evidence, approved contracts and approval fingerprints are preserved.

The source registry contains reviewed facts, not runtime open-web research. An unregistered official link does not silently invoke model knowledge. Shared specification URLs require an exact course/component/tier selection. New source packs do not approve an Examly layout or establish that every generated question matches its specification.

## Long documents and processing

New source preparation accepts up to three readable PDF/text documents: 3 MB each, 6 MB combined, 240 physical pages and 600,000 extracted characters per document. PDF parsing retains line breaks and physical pages, disables evaluation/external worker/font fetches, bounds extraction time and cleans up each page and document. Scanned/locked PDFs receive an actionable readable-file message; OCR is not claimed.

The index scans the whole document before selecting component overviews, topic headings, shared assessment rules and resolvable cross-references. It retains literal page-addressed excerpts, rather than taking the first 45,000 characters. Unmatched components, unresolved references or retrieval exceeding the bounded budget produce a missing-details state. It does not silently drop relevant selected material to fit.

The actual 96-page Pearson specification (870,460 bytes) produces 134,398 characters with preserved line breaks. The new index selects 8,055 literal characters across 24 physical pages in one bounded chunk, including Paper 1 topic headings and later mathematical rules. This is a local parser/index check, not an AI-generated profile or an Edge runtime benchmark. Retrieval coverage is not scientific completeness or a full subtopic validator.

Source analysis and profile drafting are separate resumable stages. Analysis can discover course/component/version from literal page references, while preserving known identity and raising conflicts. The student confirms the server-discovered assessment before drafting. Up to two extraction stages and any repair share the existing maximum of three model calls with drafting; active processing is bounded by 120 seconds and individual provider work by 45 seconds. Existing quota limits remain unchanged.

The owner-scoped source cache is keyed by processing version, requested identity and original file checksums. A cache hit avoids PDF parsing and AI re-extraction, while rechecking requirements for the requested mode. Public reviewed packs stay in the repository; private evidence never becomes a shared catalogue or question cache. Stored checkpoints retain bounded selected excerpts, not raw uploads or entire PDF text.

Closing the modal leaves an opaque account/subject-scoped pending receipt for up to 24 hours. Reopening can check status for free. Continuing unfinished source stages requires an explicit action. Completed results restore the preview. Existing synchronous proposals can also be retrieved from their owned receipts; a running legacy request offers only a free status check. It cannot replay its provider call. Cancel discards the browser reminder; it does not guarantee cancellation of a provider transport already in progress.

## Authority and compatibility

The existing authenticated `profile-builder` handler remains the only public entry. New source-job RPCs are service-only; raw checkpoints have no authenticated SELECT policy. Leases and compare-and-swap revisions prevent concurrent advances from starting the same call. Intent is recorded before transport, usage excludes provider payloads, and an uncertain expired call fails closed instead of being replayed. The global AI pause is rechecked before resumed transports.

Final proposals are written atomically into the existing owned request receipt. Saving still loads that proposal, validates edits, recalculates approval and writes the protected `profile_template`. Existing saved contexts and attempts are not rewritten. Generation, response storage, marking, release protection, cache isolation and mastery continue through the existing shared integrations.

The legacy single-file propose endpoint retains its original upload limits for compatibility. The new student upload flow uses indexed preparation. Existing supported adapters and the 50-scored-part limit remain; unsupported optional routes, diagrams/passages or other mandatory formats are surfaced rather than substituted.

## Unapplied database proposal

[20261104120000_profile_builder_jobs.sql](../pending-migrations/20261104120000_profile_builder_jobs.sql) is a proposal only. The existing request table requires `result` to be null while running, so it cannot represent durable intermediate checkpoints. The proposal adds one owner-bound job table and service-only RPCs, preserving the existing receipt, three-call accounting and quota functions. It changes no profile or saved-attempt data and does not alter applied migrations or generated Supabase types.

The table has a 2.6 MB checkpoint constraint, stage/revision/lease constraints, a foreign key cascading through the existing owned request, a 24-hour processing/cache expiry and RLS with no client read/write policy. Expiry prevents reuse; it is not an automatic physical-deletion service. Account deletion continues to cascade. A separate retention workflow would be needed to physically prune expired checkpoints.

Before rollout, review the connected schema, existing request/quota prerequisites and recovery mechanism. Apply the approved proposal through the managed migration workflow, then deploy only the affected functions listed in the dependency report. This repository change does not apply that SQL or activate the live service.

Rollback requires stopping new source builds, deciding retention for private checkpoints, dropping the nine new RPC/helper functions (dependent functions first), then dropping `profile_builder_jobs`. Retain existing receipts, provider accounting, saved profile envelopes and all existing builder functions. Existing approved profiles and completed proposals remain compatible. The proposal does not use `CASCADE` to remove unrelated objects.

## Verification

Final check totals, browser evidence and affected-function dependencies are recorded in the integrating PR and adjacent `rebuild/` evidence. Browser/provider/database fixtures are synthetic or local. Real authenticated rollout and paid model output quality remain unverified.
