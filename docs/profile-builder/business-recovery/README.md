# Business profile-builder recovery

The public Edexcel A-level Business PDF now produces three canonical named assessments (`9BS0/01`, `9BS0/02`, `9BS0/03`). Discovery connects separate starred code lines and appendix lists to their named papers, completes wrapped titles and removes weighting-table numbers from presentation labels. Genuine title/code, qualification and edition disagreements remain unresolved. Existing confirmed manual references retain their existing user-reference authority unless independently evidenced by the source.

The index reads the assessment overviews and summary blocks, not just appendix codes. A focused summary may retrieve another block only with the same literal heading and code in the already scoped document. Paper 3's duration on physical page 15 survives a follow-up pointing to page 46. Explicit theme allocations retrieve the corresponding named headings; sibling paper blocks are excluded. Index version 7 invalidates earlier source-cache keys without modifying saved profiles.

The PDF layout adapter reorders only clearly anchored pairs of assessment columns. It preserves visible text strings, keeps quote matching unchanged, and bounds processing to 6,000 items, 40 heading anchors and eight bands. Missing/rotated geometry, mixed-size scientific fragments, raised/lowered glyph ambiguity, qualification boundaries and labelled/numeric tables retain the original parser stream. This conservative fallback can still require a clearer assessment page; it does not guess a reading order for every PDF.

Format validation accepts directly evidenced multipart data-response, source-based and case-study questions as short answers, and essay/extended open-response wording as long form. It checks the enclosing source clause and heading so cropped negation or teaching material cannot establish an assessment fact. Recovery uses only already cited active owner-supplied blocks; complete quotes over 200 characters are skipped instead of truncated.

The frontend and actual handler share intake normalization for blank/default course and version fields. Source identity selection uses the same normalized scope on both sides. Known catalogue identities resolve their own explicit tier facts; other A-level courses keep an unknown tier. Malformed and contradictory explicit tiers are preserved for validation rather than normalized away. Save/confirmation identities retain their strict schema. Owned canonical confirmation removes obsolete local ambiguity warnings, including after a failed read. Public validation details expose controlled schema labels and selected paper/pages, never rejected model JSON or private validation detail.

## Setup repair

Separate commit `d36076d5` fixes the stale npm lockfile from the starting revision. Only the root hmr-gate requirement and that package's locked version, registry URL and npm-provided integrity changed, to match the existing `package.json` requirement `^1.8.3` and resolve version `1.8.3`. No other locked package entries changed. `package.json`, `bun.lock` and `.env` are unchanged.

No npm version pin was found. Verification uses Node 24.19.0 (inside the project's `>=22 <25` engine), npm 11.9.0 and Deno 2.5.6. CI selects Node 22. Both requested commands pass:

```sh
npm ci --cache /tmp/examly-business-npm-cache
npm ls --depth=0 --cache /tmp/examly-business-npm-cache
```

## Public reference and verification

[Reference notes](../business-discovery-index-recovery.md) describe the sparse offline excerpts and physical pages. The downloaded 574,854-byte PDF remains outside the checkout, with SHA-256 `8d66018d0a9d826cdb9729c78012d73f5e7ab32bd8946f9eb9fd501827c9829f`. This public reference is not the user's private upload.

The reproducible comparison executes the pinned parser and actual discovery/index modules. It accepts only that public PDF checksum. The optional baseline argument reads source into a fresh temporary archive; it never changes the working checkout:

```sh
node docs/profile-builder/business-recovery/verify-reference.mjs /tmp/edexcel-alevel-business-official.pdf
node docs/profile-builder/business-recovery/verify-reference.mjs /tmp/edexcel-alevel-business-official.pdf de30799d3d9adc26454437e46bb343a1b0aa4289
```

[Baseline](reference-baseline.json) returns seven ambiguous choices. [Current](reference-current.json) returns three clean choices, with complete automatic and focused-summary retrieval for all three papers, retained 120-minute duration/100 marks, literal source snippets and no sibling codes.

Meaningful offline regressions include actual parser → index separation of an interleaved generated PDF; scientific/table/qualification fallbacks; real captured Business item streams; conflicting codes/editions; strict format evidence; actual frontend client → real bundled handler → owner-scoped in-memory RPC → confirm/draft/save/restore; and a controlled Paper 3 source job that retains page-15 facts across a page-46 follow-up, recovers formats and completes without inventing tier or calculator rules. Provider outputs are controlled fixtures, not paid model calls.

See [verification results](verification.json), [browser instructions and limits](browser/README.md), and the [deployment handoff](deployment.md). The dependency graph identifies ten affected functions through all 39 actual entry points. No migrations, profile regeneration, student-data access, deployment or website publication were performed. A live model build and physical iOS/iPadOS testing remain unverified.
