# Evidence provenance and rejected-attempt browser fixture

This synthetic harness bundles the real Profile Builder, catalogue resolver, pinned PDF parser, source-job service, validation and protected proposal/save construction. Only user preferences, Supabase transport, providers and persistence are substituted with deterministic responses and an owned in-memory workspace. Every browser network request is intercepted; requests outside the local fixture origin are blocked.

`make-fixtures.py` creates two original readable 96-page PDFs whose assessment overview is on physical page 90. The Paper 1 specification has no statement that it is untiered, no instruction to answer all questions and no permission to use a calculator. It does include the reported assessment structure, totals and a mathematical sentence split across multiple lines. A separate original Paper 3 fixture explicitly contains an optional topic. No official question, mark scheme, diagram or dataset is copied. The institution text fixture contains a mathematical example using a calculator, rather than exam-level calculator permission.

The matrix covers 1440×1000, 834×1112, 390×844 and 320×780 Chromium viewports, each in light and dark mode. It checks reviewed catalogue-tier provenance; exact reviewed cover-instruction supplementation; null/unquoted tier and observed normative topics; complete line-wrapped quotes; strict rejected numeric/topic evidence; two-attempt source and draft diagnostics with private details withheld; unsupported calculator inference and optional-paper rejection; genuine version conflicts; and the existing approved OCR zero-AI path. Browser-memory save/reopen is not a live database persistence test.

Results are recorded only after the complete run succeeds in `browser-results.json`, together with source/style fingerprints and fixture metadata. The temporary JS bundle, CSS, fonts and generated PDFs are outside repository source. The PDF generator and original text fixtures allow reproduction without committing large binary files. The harness expects `/workspace/revise-ai-buddy`, installed Chromium, the environment's Playwright runtime and local Manrope/Source Serif font copies in `fonts/`.

This uses no real login, paid provider, live backend or live-data writes. It does not deploy functions, apply live migrations or publish the website. Controlled replies and Chromium viewport emulation do not establish live-service activation, physical iOS/iPadOS behavior, scientific completeness or real AI output quality. These fixtures reproduce reported failure shapes; the exact private live model outputs were not available to this harness.

Verified on **7 November 2026** with Chromium **151.0.7922.173**: all **64 scenarios across eight viewport/theme combinations passed**. No console errors, JavaScript errors, failed network requests or external requests were recorded. All **96 source/style SHA-256 fingerprints** matched the final source tree. The two 96-page files were separately parsed and indexed without model calls; both selected pages 1, 90 and 91 and retained the complete wrapped mathematical sentence. The pinned PDF parser emitted its existing Node standard-font-data warning during standalone parsing.

The five screenshots were inspected visually: mobile light confirmation and dark two-attempt diagnostics are readable, remain inside the dialog and leave footer actions available; desktop and iPad approved previews retain the gold badge and readable responsive layout. The laptop light screenshot is the saved-and-reopened preview. Its locally retained upload is labelled “Not used for this build” after reopening resets the source choice; the processing confirmation screenshot correctly labels the same file “Checked”. That existing saved-preview attachment label is not evidence of a failed extraction.

To reproduce in the recorded workspace, provide local Manrope and Source Serif font files/CSS in `fonts/` (not committed), then run:

```sh
python3 docs/profile-builder/evidence-provenance/browser/make-fixtures.py
node docs/profile-builder/evidence-provenance/browser/offline-parser.cjs
node docs/profile-builder/evidence-provenance/browser/offline-index.cjs
node docs/profile-builder/evidence-provenance/browser/build.cjs
node docs/profile-builder/evidence-provenance/browser/browser.cjs
```

The archived harness scripts use their own directory for generated artifacts. Repository imports retain `/workspace/revise-ai-buddy`, and Playwright/Chromium paths retain this cloud environment's installed runtime. Regeneration writes PDFs, bundles, CSS, screenshots and results into this directory; remove generated binaries/bundles after review.
