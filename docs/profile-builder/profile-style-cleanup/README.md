# AI profile visual cleanup

The AI exam profile editor now uses smaller sans-serif headings, plain counts and flat subtopic rows with light dividers. The decorative header icon and eyebrow are removed. Add, Edit, Remove and bulk Remove use icons with accessible names, native tooltips and 44-pixel touch targets. Search, group filters, source learning points, personal notes, Undo and Save remain available.

PDF document/page captions are hidden in the subtopic pane, including expanded learning points. Literal source excerpts are unchanged. Original document IDs, pages, checksums and evidence remain in the owned saved context; source details stay available in Syllabus & source. No source data is deleted or reconstructed.

This changes presentation in the AI review route only. The complete validated template, original proposal receipt, canonical topic IDs and all save/validation callbacks are unchanged. Existing AI profiles use their saved data. Broad legacy topics remain broad; opening a profile cannot invent missing detail or start a model call. Catalogue and manual editing keep their existing layout.

The offline browser harness in `browser/` exercises the production components with synthetic profiles and controlled persistence. The existing UI-to-client-to-handler regression also verifies owned save/reopen. Condensed results, screenshot review and the frontend-only Lovable handoff are recorded alongside this file. The complete raw browser report remains in the external artifact directory, with its SHA-256 recorded in the condensed report. Device checks use Chromium viewport/touch emulation, not physical iOS/iPadOS hardware.

There are no dependency, environment, database or backend changes. The dependency graph checks all real Edge entry points without executing handlers. Earlier offline harnesses and their artifact directories are preserved.
