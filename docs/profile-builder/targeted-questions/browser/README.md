# Combined specifications and focused follow-up browser verification

This harness bundles the real Profile Builder, catalogue resolver, pinned PDF parser, source-job service, validation and protected proposal/save construction. User preferences, Supabase transport, providers and persistence use deterministic fixtures in an owned in-memory workspace. All browser requests are intercepted; requests outside the local fixture origin are blocked. No real login, paid AI call, live backend request or live-data write is made.

`make-fixtures.py` generates original readable PDFs. The combined 96-page Physics fixture includes an AS course with 70 marks/90 minutes and an A-level course with an 85-mark/120-minute overview on physical page 90. A second fixture supplies Paper 2 when Paper 1 was requested. A third includes an inseparable comparison table plus a separately anchored A-level overview; a one-page fixture has only the inseparable table. These are software test documents, with no official question, answer, diagram, mark scheme or dataset copied.

The browser matrix uses 1440×1000, 834×1112, 390×844 and 320×780 Chromium viewports, each in light and dark mode. It verifies:

- The selected A-level course excludes AS-only facts from the actual extraction payload, then reaches an editable 85-mark/120-minute preview and memory save/reopen.
- A missing assessment renders only its source-backed choice, with the other choices locked and the file retained. `Change` and `Back to question` leave completed reading intact. Answering resumes the same job with one PDF parse.
- A controlled two-item owner-scoped response renders dependent questions one at a time, then resumes the real indexed source service. This isolates two-item presentation; real backend continuation is separately exercised by the assessment and page-selection scenarios.
- Choosing a clearly anchored overview page reuses the same parsed source and job, while an inseparable page still requests a separate overview. Student page selection does not establish assessment facts or manufacture a partition.
- Genuine specification-edition conflicts remain blocked, and the approved OCR A-level Biology A Paper 3 path retains its gold badge with no model call or quota reservation.
- Each dialog fits the viewport; the focused question input and Continue button remain visible between the fixed header and footer, including narrow phones.

`offline-index-results.json` records separate real-parser/index probes without model calls. The report and `source-hashes.json` bind the browser run to the application/server/style files used by the bundle. The temporary bundle, generated PDFs, CSS and fonts stay outside repository source; the generator and original harness source are retained for reproduction.

The scripts expect the repository at `/workspace/revise-ai-buddy`, installed Chromium, this environment's Playwright runtime, and local Manrope/Source Serif font copies and CSS in `fonts/`. Copy this directory to a temporary workspace and supply those local font files before running:

```sh
python3 make-fixtures.py
node offline-index.cjs
node build.cjs
node browser.cjs
```

This does not establish live deployment activation, physical iOS/iPadOS behavior, real provider extraction quality or scientific accuracy. Closing/reopening a saved preview uses protected memory persistence, rather than a live database. Attachments remain subject to the existing account-session boundary; a full browser reload requires reattachment. Standalone PDF parsing emits the pinned parser's existing standard-font-data warning.


Verified on **7 November 2026** with Chromium **151.0.7922.173**: **56 scenarios across eight viewport/theme combinations passed**. All **97 application/server/style SHA-256 fingerprints** match the final tree. The report records no JavaScript errors, console errors, failed requests or external requests. Both font families loaded in every fresh scenario. The separate laptop capture replays the same seven laptop/light scenarios against the same frozen source; its duplicate checks are not added to the 56-case matrix total.

Seven screenshots were inspected visually, including the desktop page-clarification view and phone/narrow-phone questions. The compact read-only summary leaves the focused input and Continue button visible; narrow-phone file details remain available by scrolling. The saved-and-reopened preview retains the existing inactive-local-file caption (“Not used for this build”); its protected saved evidence remains present. Processing and clarification views correctly show the retained source as Checked.
