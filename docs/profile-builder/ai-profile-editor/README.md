# AI exam profile editor

AI-created profiles now open in a subtopic-focused editor. The wider desktop view has a syllabus-group sidebar; phones use a full-width view and group selector. Subtopic names are immediately visible, with search, source expansion, direct editing, additions, bulk removal, Undo, and source-scope restoration. Exam settings and source/assessment metadata have their own tabs. Save and Discard remain visible.

This changes the source-backed and unverified AI review routes. Catalogue/manual workflows retain their existing controls. Existing AI profiles with a saved template use their current stored data in the new layout; opening them makes no profile write or AI call. Flat legacy topic lists remain flat unless the source is explicitly read again. There is no automatic reconstruction of missing curriculum content.

## Data transfer and identity

- The editor holds the complete validated template. Switching tabs, expanding outcomes, filtering and searching do not reconstruct the draft or trigger provider calls.
- Topic names can have user display labels and private notes in optional `template.topicEdits`. Canonical topics and part-topic tags stay unchanged. Quiz selectors, exam profile badges and profile topic performance show the display label while keeping canonical selection values, scoring keys and navigation parameters.
- Source outcome text, page references, documents, checksums, identity, qualification, paper code, edition, tier, calculator, sections, part IDs, marks, response types, demands, resource types, warnings and design decisions survive the generation-to-review-to-save-to-reopen flow.
- Model-generated `topicEdits` and `addedTopics` are stripped before draft validation, including repair replies. User metadata cannot impersonate source evidence. Existing templates without the optional field retain their canonical representation.
- Private notes are kept in the owner profile and removed from shareable exam snapshots. Original source outcomes remain separate from personal labels and notes. Source evidence and its binding come from the owned server proposal.
- Topic removal affects the future profile scope; it does not rewrite historical scores. Affected part-topic assignments remain valid while part IDs, marks and other layout fields stay intact. Undo restores topic state while retaining subsequent timing and layout edits. Discard explicitly restores the entire opening draft.
- Full mock remains the default. Source-coverage or assessment-setting changes become custom when the full source requirements no longer match. Restoring a verified full configuration may recover full mode; unverified practice cannot be promoted. No new mode selector or blanket untiered assumption was introduced.
- A missing calculator rule remains `unknown` in new generic settings. Existing profiles that previously stored an `allowed` scalar remain readable; the saved template's actual rule takes precedence in the summary.

## Interaction safeguards

Failed saves keep the edited draft and allow retry. Closing with unsaved changes requires an explicit discard; confirming it closes the nested dialog before the editor, preventing a persistent pointer lock. Adding a personal subtopic also retains its notes after save/reload. Source attachment management, source re-reading, newer registered source comparison, duplication and deletion remain available through the source tab. A fresh source read does not begin a provider call until the user proceeds.

## Verification

`verification.json`, `browser-results.json`, `public-reference-results.json` and `edge-function-dependencies.json` record the actual checks and boundaries. The browser harness runs the actual components and real save preparation with controlled persistence. A separate regression runs the actual UI through the client, bundled backend handler and owned in-memory RPC store. No live provider or student data was used.

The three included screenshots show synthetic fixtures, not a private syllabus or a real student's profile. The public PDF remains outside the checkout. Browser tests use Chromium viewport/touch emulation; physical iOS/iPadOS testing and live provider reliability are not claimed. The existing university level alias `College (4-year)` can still require reselecting a level when starting a fresh source read.

No database migration or dependency update is required. Frontend and all affected functions must use the same merged revision; the ready-to-paste handoff is `lovable-prompt.md`.
