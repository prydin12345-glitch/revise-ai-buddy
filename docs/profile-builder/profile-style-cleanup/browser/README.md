This offline harness verifies the simpler production AI profile design: a compact header, plain counts, flat topic rows with border dividers, icon-only Add/Edit/Remove controls and no PDF page captions in the topic pane. It renders the real `ExamProfileBuilder`, `AIProfileReview` and `ProfileSubtopicEditor`. Earlier harnesses and artifact directories are preserved. Reviewed screenshots are collected in [../screenshots/](../screenshots/).

The fixture entry point imports the previous `ai-profile-editor/browser/view.tsx` to keep its complete synthetic proposal, fake request/save API and real `prepareProfileSave` validation. The shared build excludes docs from application hashes, so this build additionally includes **every bundled docs input** in `fixtureInputs`, including the actual imported old view SHA and this new wrapper. It also pins the reused detailed-topic runtime. Strict hash verification runs before and after acceptance; application, server, configuration, fixture, dependency, font or bundle drift fails the result.

Build and run against a frozen source checkout. From the checkout root, using the installed tools and cached fonts:

```sh
export PROFILE_BUILDER_BROWSER_ARTIFACT_DIR=/tmp/profile-builder-style-cleanup
export PROFILE_BUILDER_CACHED_FONT_DIR=/tmp/profile-builder-full-paper-profiles/fonts
export CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
export PLAYWRIGHT_CORE_PATH=/opt/codex/runtimes/cua/lib/node_modules/playwright-core
node docs/profile-builder/profile-style-cleanup/browser/setup-fonts.cjs
node docs/profile-builder/profile-style-cleanup/browser/build.cjs
python3 docs/profile-builder/profile-style-cleanup/browser/verify-hashes.py
node docs/profile-builder/profile-style-cleanup/browser/browser.cjs
python3 docs/profile-builder/profile-style-cleanup/browser/verify-hashes.py
```

`setup-fonts.cjs --verify` only checks the prepared copy. `browser.cjs --preflight` checks fixture setup and opening the real builder without editing or saving. Normal acceptance writes `browser-results.json`. `PROFILE_BUILDER_BROWSER_CASE='^desktop-light-'` selects cases for diagnosis and records their count. Diagnostic builds should use a new artifact subdirectory. `--diagnostic` records source drift and continues collecting results but cannot pass acceptance. The final acceptance run must contain all 12 cases with frozen hashes.

The matrix keeps desktop 1440×1000, iPad 834×1194 and phone 390×844, each light/dark and detailed/legacy. iPad and phone enable touch/mobile emulation. All four synthetic source excerpts are checked literally. Both collapsed and expanded topic panes, search results, edited labels/notes and reloaded profiles must have no PDF page captions. The original evidence retains exact document IDs, physical pages 14/15/16/27, source text, document locations, checksum, fingerprint and proposal receipt. The source tab continues to show the original identity and warning data; expanding its assessment references must retain each original page and literal claim quote. Legacy profiles retain flat labels without invented evidence.

The browser records computed presentation and actual geometry: Add/Edit/Remove have empty visible text, their expected nonempty SVG icons, accessible names, titles and targets at least 44×44; counts have no background badge or shadow; the header has no decorative Sparkles; topic rows have flat border dividers without rounded card edges. Functional add/edit/remove flows, focus return and keyboard behavior remain covered. Fonts, colors and class strings are not unit tested. Review the actual generated desktop and phone screenshots for typography, spacing, hierarchy and readability; computed-style checks alone do not establish the visual result.

The existing acceptance flows remain intact: source/group/outcome/document/note search, group filters, tabs with zero API calls, rename, display aliases, private notes, child-dialog Escape/backdrop cancellation, bulk removal and keep-one protection, Undo, Restore full paper, settings values, discard/reset/close confirmation, save failure and identical retry, reopen/reload, added personal topic persistence and shared-snapshot note redaction. Every detailed case also requests one fake generated proposal and compares the entire saved/reloaded template and context, including identity, demand, resources, calculator, warnings, design decisions, sections, scored IDs/marks/canonical tags and evidence.

All data is synthetic. The injected API permits only fixture save and one explicit fake proposal, with production request-schema and save validation. Supabase is replaced by the shared offline guard. Unexpected HTTP and WebSocket requests are blocked and recorded. No paid AI, source-document fetch, account, database, install or deployment is involved. This verifies browser-to-save-to-reload transfer, not live database ownership, model quality, physical Apple hardware or complete assistive-technology support.
