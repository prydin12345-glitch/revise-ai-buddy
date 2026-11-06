# Version context and source-recovery browser fixture

This synthetic fixture uses the real Profile Builder component, catalogue resolver, pinned PDF parser, shared source-job service and protected proposal/save construction. Only preferences, Supabase transport, providers and persistence are substituted with an owned in-memory workspace and deterministic responses. Every network request is intercepted; anything outside the local fixture origin is blocked.

`make-fixtures.py` produces four original readable 96-page PDFs, with assessment rules on physical page 90. They include a matching A-level Paper 1, an A-level Paper 2 mismatch, a source with missing cover years, and an AS-only source. No official question, mark scheme, diagram or dataset is copied. The short named-option text is also original synthetic fixture material.

The script matrix uses 1440×1000, 834×1112, 390×844 and 320×780 Chromium viewports, each in light and dark mode. Final counts are recorded only when the complete run succeeds in `browser-results.json`; screenshots alone are not a pass record. Source/style fingerprints bind the frozen application bundle used by that run. Physical iOS/iPadOS and real provider quality are not established by viewport emulation.

`offline-index.cjs` additionally scans the already reviewed public 94-page official AQA Physics specification and the original synthetic files without a provider. It records retrieval metrics only, never extracted official text. The reviewed official file is kept under `/tmp/examly-assessment-options/physics.pdf`, outside the repository.

The harness expects `/workspace/revise-ai-buddy`, installed Chromium, the environment's Playwright runtime and local copies of the production Manrope/Source Serif font files in `fonts/`. The temporary JS bundle, CSS, font binaries and official PDF are intentionally separate from repository source. No real login, paid call, live write, migration, deployment or publication is performed.
