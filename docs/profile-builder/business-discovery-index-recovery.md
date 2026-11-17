Business discovery and evidence selection recovery
=================================================

The official Business specification now offers exactly these source identities:

| Label | Canonical component |
| --- | --- |
| Paper 1 — Marketing, people and global businesses | 9BS0/01 |
| Paper 2 — Business activities, decisions and strategy | 9BS0/02 |
| Paper 3 — Investigating business in a competitive environment | 9BS0/03 |

Separate `*Paper code:` lines and appendix code rows join their unique named
paper. Weighting rows remain literal citation aliases without adding numbers to
labels. The wrapped `environment .` line on physical page 52 completes Paper 3's
title. Bounded identity citations retain late appendix code evidence. Genuine
title, code, qualification and explicit source-edition disagreements remain
unresolved. A supplied name plus code resolves only when both match a single
source candidate; a user reference cannot supply a missing source code.

Focused summary selection retains another assessment block only when its literal
heading and code match the focused block in the already scoped document.
Explicitly allocated theme headings may also be retrieved. Topic allocation is
read from selected assessment blocks; incidental paper mentions in content
chapters do not create allocations. Sibling paper blocks remain excluded.

Public source and offline fixture
--------------------------------

- Source: [Pearson Edexcel Business specification, Issue 1, September 2014](https://qualifications.pearson.com/content/dam/pdf/A%20Level/Business%20Studies/2015/specification-and-sample-assessment-materials/9781446914694-gce2015-a-bus-web.pdf).
- Retrieved and independently checked against that URL on 2026-11-17.
- PDF: 574,854 bytes; 68 physical pages.
- SHA-256: `8d66018d0a9d826cdb9729c78012d73f5e7ab32bd8946f9eb9fd501827c9829f`.
- Extraction: installed `unpdf@1.8.1` / `getDocumentProxy`, through current
  `extractIndexedPdfPages` and `readablePdfText`, with the production extraction
  limits and eval/font rendering/worker fetch disabled. The Business sidebar
  has no proven pair of assessment-column anchors, so the layout adapter keeps
  the parser's original item order. Full extraction contains 77,077 characters.
- Fixture: `supabase/tests/fixtures/edexcel-alevel-business-official.json`,
  19,780 bytes. This contains complete assessment pages 14, 15, 45 and 46;
  relevant cover, theme-heading, weighting, wrapped-heading and appendix-code
  excerpts on physical pages 1, 17, 25, 31, 39, 48, 52 and 67; and short raw
  PDF.js geometry/item spans from pages 14 and 15. Every excerpt carries its
  original physical page number. Tests reconstruct omitted pages as blank.
- The PDF, complete extracted text, raw items, esbuild bundles and detailed
  comparison output remain in `/tmp`, outside the repository. No PDF binary or
  unrelated source chapters are included in the regression fixture.

Actual PDF comparison
---------------------

Both versions were run on the same actual 68-page production extraction.
Baseline discovery/index source was read with `git show de30799d:<path>` and
bundled in `/tmp` using esbuild; the current extraction adapter was shared so
this comparison isolates discovery/index changes. The production layout adapter
does not reorder this PDF. Selection used each candidate's canonical component
and source-derived aliases. “Focused” means physical page 45 for Papers 1/2
and physical page 46 for Paper 3.

| Check | de30799d | Current |
| --- | --- | --- |
| Discovery | 7 choices; ambiguous | 3 full-name coded choices; unambiguous |
| Paper 1, full / focused | Both blocked: missing topic sections | Both complete; duration on page 14 |
| Paper 2, full / focused | Both blocked: missing topic sections | Both complete; duration on page 14 |
| Paper 3, full | Complete; duration on page 15 | Complete; duration on page 15 |
| Paper 3, focused on page 46 | Blocked: missing topic sections | Complete; duration on page 15 |

All six current runs fit in one evidence chunk. Their retrieved text sizes are
6,459 / 1,705 characters for Paper 1, 6,498 / 1,470 for Paper 2 and
14,222 / 3,594 for Paper 3 (full / focused). All excerpts are literal substrings
of their original physical page; none contains another paper's component code.
Choice references include the proper overview pages 14/15, summary pages 45/46,
weighting page 48 and appendix page 67.

Session reproduction: `node /tmp/business-before-after.mjs`; detailed output is
`/tmp/business-before-after.json` and final full extracted pages are
`/tmp/business-full-pdf-final-pages.json`. These are temporary session artifacts,
not dependencies of the offline tests.

Validation and affected imports
-------------------------------

`npx vitest run supabase/tests/profile-business-discovery-index.test.ts
supabase/tests/profile-assessment-discovery.test.ts
supabase/tests/profile-document-index.test.ts` passed 151 tests across three
files, including 13 new regressions. `npm run typecheck` also passed.

The new tests cover actual captured geometry/extraction order; three clean
identities; appendix-only code linking and bounded citation retention; short and
long document selection; all three focused summaries including Paper 3's page-15
duration; source-less manual codes; correct and contradictory combined names and
codes; neighbouring-code leakage; genuine edition conflicts; conflicting
appendix codes; and cross-document ambiguity.

`DOCUMENT_INDEX_VERSION` increases from 6 to 7 because `profile-builder-jobs.ts`
includes it as `indexVersion` in the source-cache key. This invalidates cached
evidence from earlier extraction/index semantics. `ASSESSMENT_DISCOVERY_VERSION`
stays at 3: it is result metadata and is not used for cache lookup.

Production direct consumers of discovery are `profile-builder-jobs.ts`,
`src/components/profiles/ExamProfileBuilder.tsx` and
`src/lib/inspect-profile-attachments.ts` (runtime and type imports). Direct
consumers of the document index are discovery itself, `profile-builder-jobs.ts`,
`profile-document-io.ts` and `profile-topic-sections.ts`. No import paths or
exported function signatures changed. Manual verification status assignment
remains in the separately owned jobs module.

Application changes in this work are limited to
`supabase/functions/_shared/profile-assessment-discovery.ts` and
`supabase/functions/_shared/profile-document-index.ts`; related tests, public
fixture excerpts and these review notes accompany them. No paid calls, student
data or commits were used.
