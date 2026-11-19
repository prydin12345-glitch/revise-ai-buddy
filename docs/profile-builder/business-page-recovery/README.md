# Business page clarification and recovery

Paper 1's content pages 18 and 40 do not repeat its assessment heading. On the PR #60 baseline, focused retrieval removed these pages despite the specification explicitly assigning Themes 1 and 4 to Paper 1. A mixed list could report complete coverage while skipping both content pages. That local scope check did not establish that the user supplied incorrect pages or that the AI knew another correct answer.

The index now follows explicit topic ownership across continuation pages, retains bounded literal subtopic headings for automatic retrieval, and restores only the selected paper's allocation and parent headings when reading focused content. Sibling papers, unallocated topics, course/qualification changes and ambiguous sections still stop ownership. Raw pages remain unchanged; every supplied passage is literal and the existing two-chunk/18,000-character limits remain. Index version 9 invalidates old cache keys for new requests. Suggestions for a topic question now come from the paper's scoped content pages, including 18 and 40 for this reference.

Unknown tier evidence remains `null`. An unreferenced model guess cannot replace an unknown selection, and a null model identity does not erase the selected tier. A genuinely quote-verified tier can supply the corresponding identity without a duplicate model claim. Concrete conflicting tiers and unsupported tier facts remain blocked. No Business catalogue entry or blanket untiered rule was added.

When source evidence cannot verify a selected tier or a full mock's tier, the user can explicitly choose short practice with an unverified tier. This changes the current job locally, preserves its source facts and references, and makes no provider call. A generated practice template retains a warning. Full mocks still require verified tier and structure; the clarification cannot override a known tier claim, conflict, different pending question or stale revision.

Blocked builds expose Change details or documents, Start new build, and status-only progress checks where appropriate. The restart dialog preserves files and choices and clears the selected request only after confirmation; Read syllabus is a separate explicit action. Opening the details form alone keeps the receipt. Restoring a failed job binds its identity after asynchronous attachment discovery instead of leaving the paper dropdown in manual mode. Page diagnostics explain inability to link safely and distinguish selection for reading from verified assessment facts.

## Verification

[Verification](verification.json), [baseline PDF results](reference-baseline.json), [current PDF results](reference-current.json), [browser results](browser-results.json) and the [actual Edge import graph](edge-function-dependencies.json) record the run.

- `npm run check`: 213 files / 3,644 tests, frontend and Physics types, critical lint, all 39 Edge bundles and production build passed.
- Deno 2.5.6 checked both affected entrypoints with their existing equivalent import maps.
- The full public Pearson reference passed all 19 automatic/focused/negative cases; the baseline passed 7. Its checksum is `8d66018d0a9d826cdb9729c78012d73f5e7ab32bd8946f9eb9fd501827c9829f`, 574,854 bytes and 68 physical pages. The PDF stays outside the repo. The new continuation fixture matches those extracted public pages exactly.
- A controlled same-job build accepted the reported `13,14,17,18,39,40,45` list, preserved the first read's marks/time, and completed Paper 1 with an unknown tier: one parse, one reservation, three provider stubs. The real production client/bundled-handler regression also confirms and saves the explicit unknown-tier practice alternative with two provider stubs and no invented tier fact.
- Eighteen offline browser cases passed laptop/iPad/phone light/dark checks for page answers, tier clarification and restart. All recorded input/output hashes match; browser errors and unexpected requests are empty. The API is controlled; the actual UI, local discovery and page indexing run. Chromium emulation does not certify physical iOS/iPadOS or complete accessibility coverage.

```sh
npm ls --depth=0 --cache /tmp/examly-business-npm-cache
npm run check
DENO_TLS_CA_STORE=system DENO_DIR=/tmp/examly-business-deno-cache /tmp/examly-business-tools/node_modules/.bin/deno check --no-lock --config supabase/functions/profile-builder/deno.json supabase/functions/profile-builder/index.ts supabase/functions/extract-exam-questions/index.ts
node docs/profile-builder/business-page-recovery/verify-pages.mjs /tmp/edexcel-alevel-business-official.pdf
node docs/profile-builder/business-page-recovery/verify-pages.mjs /tmp/edexcel-alevel-business-official.pdf 06661f92cda1c8a46dfc5283a43d8e71ed6054b6
node docs/profile-builder/business-page-recovery/dependency-graph.mjs
export PROFILE_BUILDER_BROWSER_ARTIFACT_DIR=/tmp/profile-builder-business-page-recovery
export PLAYWRIGHT_CORE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/site-packages/playwright/driver/package
node docs/profile-builder/business-page-recovery/browser/setup-fonts.cjs
node docs/profile-builder/business-page-recovery/browser/build.cjs
node docs/profile-builder/business-page-recovery/browser/browser.cjs
```

The local reference is the public Pearson specification at https://qualifications.pearson.com/content/dam/pdf/A%20Level/Business%20Studies/2015/specification-and-sample-assessment-materials/9781446914694-gce2015-a-bus-web.pdf. It does not prove access to a private upload. Providers and persistence were controlled; no live paid AI build, student-data access or production profile write occurred. The earlier offline snapshots remain untouched. Package versions, lockfiles and `.env` are unchanged. Existing build warnings are recorded without changing dependencies.

See the [Lovable handoff](lovable-prompt.md). No merge, deployment, website publication or migration was performed.
