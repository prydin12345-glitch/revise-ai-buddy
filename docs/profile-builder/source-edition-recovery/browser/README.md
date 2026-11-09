# Source edition and page recovery browser verification

This offline harness bundles the actual Profile Builder, approved-preset resolver, pinned PDF parser, source-job service, validation and protected proposal/save construction. Supabase transport, providers and persistence use deterministic fixtures in an owned in-memory workspace. All requests are intercepted; external network requests are blocked. There is no real login, backend request, paid AI call or live-data write.

`make-fixtures.py` generates original readable PDFs, with no official questions, answers, diagrams, mark schemes or datasets. The main 96-page combined Physics fixture has a literal `Version 1.3 1 June 2017` cover, an AS-only 70-mark/90-minute overview, six numbered topic headings and an A-level Paper 1 85-mark/120-minute overview on physical page 90. Its specification omits calculator and compulsory-question rules, so those facts must come from the separately reviewed official covers. A current-edition fixture instead declares 1.4 July 2026.

The genuine follow-up fixture omits question formats from the initial extraction. Its later Paper 1 questions page supplies them; selecting pages 90–92 must use pages 90–91 and report that the Paper 2 page 92 was skipped. The saved partial evidence, single parsed document, receipt and call budget remain intact. The providers are controlled software responses, so this verifies orchestration and evidence gates rather than real extraction quality.

The matrix covers laptop (1440×1000), iPad (834×1112), phone (390×844) and narrow phone (320×780), each in light and dark mode. It checks automatic versus explicit edition intent, 2017 and current source editions, scoped page and assessment answers, retained uploads, reviewed instruction rules, source-backed topics, editable memory save/reopen, strict optional Paper 3 handling and the approved OCR Biology A Paper 3 zero-AI path. Computed styles, production fonts, dialog geometry and focused-question control visibility are checked, alongside JavaScript, console and network errors.

The report binds the run to SHA-256 fingerprints of bundled source, all Tailwind content files, CSS dependencies, configuration and package manifests. The browser checks every fingerprint before and after the matrix. Temporary bundles, generated PDFs, CSS and font binaries remain outside the repository. Run from the repository root with installed dependencies, Chromium at `/usr/lib/chromium/chromium`, and this environment's Playwright runtime. `PROFILE_BUILDER_BROWSER_ARTIFACT_DIR` defaults to `/workspace/examly-source-edition-verification`; its `fonts/` folder must contain the existing local Manrope/Source Serif CSS and TTF snapshots. `PLAYWRIGHT_CORE_PATH` can point to another installed Playwright Core runtime. To reproduce using the prepared font snapshots:

```sh
python3 docs/profile-builder/source-edition-recovery/browser/make-fixtures.py
node docs/profile-builder/source-edition-recovery/browser/build.cjs
node docs/profile-builder/source-edition-recovery/browser/browser.cjs
```

This does not verify live deployment activation, physical iOS/iPadOS behaviour, real AI extraction quality or scientific accuracy. Attachments keep the existing account-session boundary; starting a new read after a full browser reload requires reattachment.
