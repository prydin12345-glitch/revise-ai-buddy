# Profile Builder: assessment choices and retained files

Reviewed against main `65b1c73c8948d6f6c876d11f0d7569fcfac295fa` on 6 November 2026. This is a usability and source-selection fix, not a new qualification-generation adapter.

## What failed and what changes

The visible assessment name and Advanced component code previously edited the same identity field. Unsupported courses exposed unchecked free text, and the details screen hid an assessment after it was filled in. File state was cleared before validating a replacement and when choosing another source. The cookie banner could cover the mobile dialog. These were application-state problems rather than mistakes by the student.

The normal assessment control now stays visible and uses concise catalogue choices. Its human name/selection and technical code have separate state. Invalid code overrides produce a targeted conflict without replacing the selected assessment or starting a build. Course, board, level and tier changes re-resolve the matching choices. Paper 3 options, where required by the catalogue, are explicit choices rather than guesses. Confirmation names the selected assessment.

AQA A-level Physics and Chemistry have reviewed assessment-identity metadata, separate from AS and GCSE. [Official sources, titles, versions, checksums and component identities](assessment-choice-sources.md) are recorded separately. This metadata grants neither a gold star nor a source-backed drafting entitlement. Physics Paper 3 still passes through the existing optional-routing/adapter restrictions; a dropdown is not evidence that the generic builder can reproduce every optional paper.

For other courses, readable attachments are inspected locally to offer literal Paper, Unit, Component and named-assessment headings. This reads the whole bounded document using the existing pinned parser, and makes no model or builder-service call. A clearly marked manual-name fallback remains available when headings cannot be resolved. The existing secure source workflow must still verify identity, rules and evidence before drafting; local headings confer no trust or approval. Conflicting codes/qualification sections remain separate or fail closed.

Files have persistent cards showing filename, size, status and an explicit remove action. Cancelled, oversized, invalid or unreadable replacement selections preserve existing files. Switching source, URL, mode or preset leaves the cards visible; files that are not being used say so. Changed assessment details mark them for checking again. Removing local bytes from a completed preview does not invalidate its server-held proposal receipt.

The file-picker trigger says “Choose files” or “Replace files”; retained cards are the displayed attachment state, avoiding a native “No file chosen” message after the input is reset to handle cancelled selections safely.

Attachment bytes are retained **only in the authenticated account's in-memory workspace**, separately by subject. Closing/reopening or remounting the builder retains them within that workspace. Selected details/source choice can reset on reopening, so a retained file may need selecting as the active source again. A full browser reload requires reattachment. Files are not serialized into local storage or a shared anonymous store, and account changes cannot reuse another account's bytes. Existing private server jobs and ownership protections remain authoritative.

The cookie banner/preferences defer while another modal is open and return afterward. Consent is not automatically accepted or changed. “Start again” requires confirmation, and cancelling it keeps the builder and pending receipt open. Board casing and saved-level wording are corrected.

## Source retrieval and compatibility

The server derives trusted human heading aliases from exact catalogue identity, not from client-supplied aliases. This allows a selected code such as `7408/1` to retrieve a specification headed “Paper 1”. Index version 2 includes the trusted selection in the cache key and separates explicit AS/A-level sections, including sections on the same physical page. Retrieved excerpts remain literal spans with original physical-page references. Combined totals that cannot be separated fail closed.

[Official-PDF index metrics](assessment-fixes/official-pdf-index-results.json) record offline parsing/indexing of the complete 94-page Physics and 96-page Chemistry specifications for their six A-level paper selections. All six met deterministic retrieval coverage. This measures retrieval only; it is not a claim about paid-model extraction, scientific quality or support for optional-paper generation.

The request actions, identity schema, proposal/save receipts, approval registry, generation context, marking/mastery integration, quotas and call budgets retain their existing contracts. Existing Biology fingerprints are unchanged. This change does not edit the already applied jobs migration, generated database types, authentication storage or unrelated UI work.

## Browser evidence and deployment

[Browser results and source hashes](assessment-fixes/browser/browser-results.json) describe Chromium verification with real components, production Tailwind styling, local fonts, the actual PDF parser, shared service logic, synthetic providers and memory persistence. All nonlocal network requests are blocked. No live login, real model request, paid paper or live-data write is used. The checked viewports are 1440, 834, 390 and 320 pixels, in light and dark modes; physical iOS/iPadOS behavior and live service activation remain unverified.

The browser harness and original synthetic fixtures are included beside the results; the temporary bundle, dependencies, fonts, downloaded official PDFs and extracted official text are not committed. The harness uses `/workspace/revise-ai-buddy`, `/workspace/examly-builder-assessment-fixes-verification`, installed Chromium and the session's Playwright runtime. Its build reads local font files in that temporary fixture directory. Screenshot evidence is synthetic and contains no account data.

The final frozen-source Chromium 151.0.7922.173 run passed **8 viewport/theme cases and 64 scenario checks**, with 90 source/style hashes matching the working tree. Each case checked cookie deferral and explicit consent; concise A-level Physics papers and separate code validation; WJEC Unit labels; retained/rejected/cancelled uploads and remounts; local Unit/named Component discovery without a service call; a late assessment on page 90 of a real parsed 96-page synthetic PDF; confirmation/edit/save/reopen; cancelled restart/free resume; and the approved OCR H420/03 preview with zero synthetic model calls/quota reservations. Dialog/page overflow and footer hit-testing passed. There were no JavaScript errors, console errors, failed requests or attempted external/backend requests.

[The actual dependency graph](assessment-fixes/edge-function-dependencies.json) checks all 39 Edge Function entry points. **Only `profile-builder` requires deployment after merge.** This task makes no API-action or schema change and requires no new migration. No function is deployed here, and the website remains unpublished. Updating the frontend alone does not install the new server-side heading aliases/index behavior.

After merge, deploy only that affected function with the existing authentication and quota configuration. First verify an approved preset without AI. A separately authorised source-backed build is still needed to assess real provider output; automated tests and synthetic browser results do not prove real-model quality.

## Repository verification

[Verification totals](assessment-fixes/verification.json): Node 24.19.0 (supported by the repository), npm 11.9.0, unchanged `package-lock.json`; `npm ci` passed; `npm run check` passed **2,559 tests across 162 files**, typechecking, critical lint, all 39 Edge bundles and the production build. The Biology audit checked **52 templates**, the profile coverage audit passed **52 entries** with **32 legacy layouts still pending**, and both working/staged diff whitespace checks passed.

Non-failing diagnostics remain for unchanged dependency deprecations, stale Browserslist data, the Zod annotation, production chunk sizes, existing response-dialog nesting and pinned-parser standard fonts. Existing negative-path tests also emit their expected failure diagnostics. These are separate from the clean synthetic browser console.
