# Visual review

Reviewed the actual Chromium screenshots produced by the frozen offline harness. All profiles and source excerpts are synthetic fixtures, not student records or a private upload.

- [Desktop light](screenshots/desktop-light-detailed-overview.png): smaller plain heading, no decorative header icon or eyebrow, unboxed counts, flat rows with separators, icon-only Add/Edit/Remove. The syllabus sidebar, search, tabs and footer remain clear.
- [Desktop dark](screenshots/desktop-dark-detailed-overview.png): the same hierarchy and controls remain readable with the project's dark theme.
- [Phone light](screenshots/phone-light-detailed-overview.png): full-width editor, wrapped title/metadata, group selector, scrolling topic list and visible save footer. Actions fit beside topic labels without horizontal overflow. Row controls keep 44-pixel targets.
- [iPad expanded](screenshots/ipad-light-detailed-expanded.png): group sidebar and expanded learning points fit the narrower dialog. The excerpt text is retained verbatim; PDF page captions are hidden. Keyboard focus is visibly marked.

The automated matrix additionally covers phone and iPad dark mode and legacy profiles in both themes, as well as edited, failed-save, saved and reloaded states. Every case checks geometry, icon names/tooltips, touch targets and data persistence. The full 84 screenshot hashes are recorded in `browser-results.json`; artifacts remain outside the checkout under `/tmp/profile-builder-style-cleanup`.

This is Chromium viewport/touch emulation. Physical Apple hardware, native Safari, live providers and full assistive-technology testing were not run. Browser screenshots establish the appearance of these controlled fixtures; provider quality and live deployment behavior are outside this check.
