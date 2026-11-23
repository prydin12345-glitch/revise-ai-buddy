This offline harness renders the production `ExamProfileBuilder`, `AIProfileReview` and `ProfileSubtopicEditor`. The injected API permits only fixture save and one explicit fixture proposal. It parses requests with the production schema and calls the real `prepareProfileSave` against the original owned proposal; request evidence is never trusted. LocalStorage persistence is limited to synthetic fixtures. This proves browser-to-save-to-reload behavior, not live database ownership enforcement or model/extraction quality.

Only this new directory is owned by this harness. Existing application, tests, helpers and prior artifacts are left intact. It reuses the detailed-topic runtime and the underlying shared assessment-identity build, font verification and hash helpers. Output defaults to `/tmp/profile-builder-ai-profile-editor`; diagnostic runs should select a new subdirectory. No packages, browsers, fonts or source documents are downloaded.

Run from the checkout root with the repository's installed Node dependencies, Python 3, Chromium and Playwright Core:

```sh
export PROFILE_BUILDER_BROWSER_ARTIFACT_DIR=/tmp/profile-builder-ai-profile-editor
export PROFILE_BUILDER_CACHED_FONT_DIR=/tmp/profile-builder-full-paper-profiles/fonts
export CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
export PLAYWRIGHT_CORE_PATH=/opt/codex/runtimes/cua/lib/node_modules/playwright-core
node docs/profile-builder/ai-profile-editor/browser/setup-fonts.cjs
node docs/profile-builder/ai-profile-editor/browser/build.cjs
python3 docs/profile-builder/ai-profile-editor/browser/verify-hashes.py
node docs/profile-builder/ai-profile-editor/browser/browser.cjs
python3 docs/profile-builder/ai-profile-editor/browser/verify-hashes.py
```

`setup-fonts.cjs --verify` only verifies the prepared local copy. `browser.cjs --preflight` checks fixture setup and actual builder opening without editing or saving; it writes `preflight-results.json`. Normal acceptance runs write `browser-results.json`. `PROFILE_BUILDER_BROWSER_CASE='^desktop-light-'` selects cases for diagnosis; the report records the selected count. `--diagnostic` continues collecting browser results after source-hash drift, but the overall report still fails and records `sourceDrift`; it cannot establish frozen-build acceptance. A final full matrix must run after all collaborating application changes are frozen. Every recorded app/server/dependency/fixture/font/bundle hash is checked before and after the run; concurrent source drift invalidates it.

The 12-case matrix covers desktop 1440×1000, iPad 834×1194 and phone 390×844, light/dark, detailed/legacy. Tablet and phone enable touch/mobile emulation. Detailed fixtures contain three exact canonical leaves under two themes, four literal synthetic excerpts on physical PDF pages 14/15/16/27, all identity fields, two stable scored parts, different demands/resources, calculator, warning and design metadata. Legacy fixtures contain two flat labels and no detailed source graph. The fixture deliberately makes no public-source extraction claim.

Detailed cases cover default Subtopics, source expansion using keyboard/pointer, literal quotations/pages, search by topic/group/outcome/document/notes, group filters and tabs with zero API calls, profile rename, display aliases and personal notes separated from original text, bulk removal with keep-one protection, Undo and Restore full paper, exact canonical tags/layout/IDs/marks after save, discard/reset and close confirmation, save failure retaining the draft, retry, reopening and full reload. A separate new personal subtopic with notes must retain its canonical identity and notes after Save/reload, have no borrowed source text, and leave scored parts unchanged. The production `snapshotTemplate` must strip notes from both aliased source topics and added topics while keeping the alias and redacted evidence binding. Each detailed case then opens a fresh builder, requests one injected source-backed proposal, saves without edits, and compares the entire resulting template and saved context to the original. Identity, demand, resources, calculator, warnings, design choices, sections, evidence, physical pages, checksum, fingerprint and proposal receipt must survive exactly. Edits cannot trigger another proposal; the API rejects regeneration.

Legacy cases cover flat labels without invented themes/outcomes, search, safe reread confirmation, Escape cancellation, source choices with zero API calls, and fresh reload still showing legacy data. Layout measurements verify a 1040px desktop review, full-width phone review, dialog/viewport containment, overflow, and 44px row controls. Native closed details and inactive tabs are excluded from visible layout checks. Screenshots need human visual review; Chromium emulation does not establish physical iOS/iPadOS or full assistive-technology behavior.

Unexpected HTTP/WebSocket traffic is blocked and recorded. The bundle replaces Supabase with the shared offline guard. No student data, account connection, external source read, model/provider request, backend endpoint or paid request is involved.
