# Profile Builder: teaching dates and source recovery

Baseline: main `5a7ce0b05a32ef4593869b2109d29971af7e5bf2` (PR #49), reviewed 6 November 2026. Lovable reported that the frontend had updated while the deployed `profile-builder` still predated #49. This branch fixes the additional code defects; it does not deploy that function or claim to verify the live revision.

## Cause and resulting behaviour

The reported input was **“First teaching 2015, first exams 2017”** in the specification/cohort field. The server used that whole string as an exact issue identity. This disabled trusted aliases between `7408/1` and “Paper 1”, then rejected a genuinely cited version discovered later. A failed component match emptied the retrieved chunks; a second check incorrectly called this a reading failure even though the PDF had been read.

A shared deterministic helper now recognises complete teaching/first-examination date clauses as optional context. It retains the original text in the owned request, uses an unspecified effective version until source evidence supplies one, and marks the date notes as **user context, not source evidence** in extraction. Missing source years cannot be restored from those notes. The Advanced field explains that ordinary students can leave it blank.

Actual issue/version/edition/cohort constraints remain strict. Bare years, unknown descriptions and mixed version/date text are not silently discarded. Conservative typography equivalence accepts `v1.4-july-2026` and `Version 1.4 July 2026`, while preserving decimal, range, issue and cohort differences. A cited conflicting version produces a targeted `needs_details` response after one accounted call, without an automatic model repair attempting to change the source facts.

Simple numbered heading aliases are derived from an exact course, board, qualification, component and tier independently of the requested issue. That lets the reader reach the evidence that can establish a genuine version conflict. Named-title aliases keep their reviewed-version scope. Known legacy `(Paper 1)`/`aqa` inputs canonicalise deterministically; no fuzzy qualification inference is added.

When a readable document cannot supply the selected component, the server offers bounded literal assessments found in that source, scoped by qualification and course. The UI asks one selection question, keeps the upload, mode and version/date context, and requires an explicit **Read syllabus** click after correction. The repeat button is disabled while clarification is unresolved. Once processing has settled, keyboard focus and the dialog's own scroll area move to the clarification, keeping the question visible below the fixed header on phones. Genuine unreadable/scanned/protected files retain their separate reading diagnostics. Choices are advisory owner-scoped metadata, not approval or a trusted client override; source evidence must still be verified afterward.

## Qualification and option safeguards

Index version 3 keeps AS and A-level sections separate, including subject headings such as **AS Physics**. Literal uppercase AS is required, so chemical `As` and the ordinary word `as` do not become qualification boundaries. Flattened mixed rows/columns that cannot be separated fail closed with a qualification-specific request for the relevant assessment overview.

Two-letter section codes such as `7408/3BA` are recognised exactly. Astrophysics cannot silently become Medical physics. Exact section retrieval excludes generic parent-paper aliases; whole-paper retrieval with an explicitly selected option excludes code-labelled pages for unselected options. A page mixing selected and excluded section codes fails closed. All excerpts retain original literal spans and physical-page references. Canonical option labels map back to the correct UI option ID after confirmation.

These changes do **not** enable an optional-paper generation adapter. Existing unsupported-format/selection gates, proposal receipts, ownership checks, quotas, processing budgets, protected profile/generation context and Biology approval fingerprints remain authoritative. The source request actions and saved identity schema are unchanged. Optional recovery choices fit the existing private JSON job payload; no migration or generated-type edit is required.

## Verification and rollout

The [dependency graph](version-recovery/edge-function-dependencies.json) checks all 39 actual Edge Function entry points. **Only `profile-builder` requires deployment after merge.** No function, migration or website publication is performed here. Existing failed receipts are not rewritten or charged again automatically; start a fresh build after rollout, preserving/re-attaching the source as needed. Attachments retain #49's account-session memory boundary; full browser reload requires reattachment.

Browser evidence uses real components, the pinned PDF parser, shared service/validation code, deterministic providers and memory records, with all external network requests blocked. Synthetic PDFs are original fixtures with physical-page-90 assessment data; official PDFs and extracted text are kept outside the repository. The [official assessment-source record](assessment-choice-sources.md) remains the authority for metadata. Offline official-PDF indexing and synthetic provider tests do not establish live service activation, real AI extraction quality or optional-paper generation quality.

Final verification: [repository totals](version-recovery/verification.json) record Node 24.19.0, unchanged lockfile, successful `npm ci` and `npm run check`: **2,654 tests across 164 files**, typecheck, critical lint, all 39 Edge bundles and production build. Biology and approval-coverage audits each checked **52 entries**; 32 existing legacy layouts remain pending. Diff whitespace checks passed. Existing dependency deprecations, stale Browserslist/Zod/chunk-size warnings, legacy response-dialog nesting and parser-font diagnostics remain non-failing.

The final [Chromium report](version-recovery/browser/browser-results.json) passed **64 scenarios across 8 viewport/theme cases**, with 91 source/style hashes matching this implementation. The checks include the entire question and selector remaining visible below the header after asynchronous processing. The matrix uses 1440×1000, 834×1112, 390×844 and 320×780, each in light and dark mode, with no JavaScript/console errors or failed/external requests. Physical iOS/iPadOS and real provider output remain unverified.

[Offline indexing metrics](version-recovery/offline-index-results.json) cover the actual full 94-page official Physics specification with the reported date text, canonical and legacy component names, Paper 2, and explicit Astrophysics parent/section selections. All six official retrieval probes are complete and exclude the AS-only total. Original 96-page synthetic sources separately exercise matching, missing years, a Paper 2 clarification and AS-only rejection. [Physics/Chemistry paper metrics](version-recovery/official-six-paper-index-results.json) also record all six current A-level parent selections. These metrics measure deterministic retrieval, not AI generation quality.

Use the separate [post-merge Lovable handoff](version-recovery/deployment.md) to deploy only the affected function.
