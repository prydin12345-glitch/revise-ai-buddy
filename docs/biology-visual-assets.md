# Biology Visual Assessment Asset Foundation

## Delivery boundary

Started from clean, fetched `origin/main` **d87be5ff**, which already contains completed OCR H420/02 and H420/03. Branch: `codex/biology-visual-assets-ocr-alevel-paper3`. Node **24.19.0**, existing lockfile. Before editing, `npm ci` and `npm run check` passed **1,342 tests / 90 files**, TypeScript, critical hook lint, 38 Edge bundles and the production build. Biology inventory: **50 templates**. Their plan, definition and prompt fingerprints were captured before editing in a new additive provenance fixture; earlier hash fixtures are unchanged.

This implementation proves an opt-in, asset-first visual variant of the existing Paper 3 template. It does **not** approve scientific assets. The production manifest and internal asset ledger are intentionally empty. Four original deterministic SVG fixtures exercise the architecture; synthetic reviewer records exist only in tests and never enter the application bundle. The settings control is disabled until production files exist; the backend additionally requires every compatible asset to pass both reviews and byte integrity checks. Ordinary Paper 3 generation remains available unchanged.

No deployment, migration, storage bucket, RLS policy, live record change, login, paid generation or website publication is part of this delivery. No original OCR image, diagram, data or question is copied. No separately uploaded past-paper attachment was available in this task; official OCR documents below supply the structural reference.

## Official OCR evidence

These authoritative materials were inspected for the completed Paper 3 implementation on 6 October 2026 and rechecked against its current contract for this task. Page numbers are PDF pages. The detailed research record remains [OCR Paper 3 documentation](ocr-alevel-biology-paper3.md#official-research).

| Source | Evidence and facts used |
| --- | --- |
| [H420 specification v4.1, April 2026](https://www.ocr.org.uk/Images/687834-download-a-level-specification.pdf) | pp11,58–59: **H420/03 Unified biology**, untiered, **70 marks**, **90 minutes**, compulsory, **Modules 1–6**, 26% weighting. Structured, practical, calculation, problem-solving and extended responses; no prescribed Paper 1/2 Section A/B or fifteen-MCQ opening. pp12–14 and mathematical appendix: written practical assessment, graphing/data/statistics; the 10% mathematical minimum applies across the qualification, not a fixed Paper 3 quota. |
| [H420/03 SAM v3.0, February 2026](https://www.ocr.org.uk/Images/171739-unit-h420-03-unified-biology-sample-assessment-materials.pdf) | pp1–3,27,31: version and 90-minute compulsory written paper; task-linked resources, method credit and levels of response. Science selects the level; communication selects the mark within the level. |
| [2024 question paper](https://www.ocr.org.uk/Images/726692-question-paper-unified-biology.pdf), [mark scheme](https://www.ocr.org.uk/Images/726819-mark-scheme-unified-biology.pdf), [examiner report](https://www.ocr.org.uk/Images/726425-examiners-report-unified-biology.pdf) | QP p1 confirms 70/90/compulsory; p18 includes plotting. Marking rows show six parents in this sitting, capped task-specific points, method marks and six-mark levels. ER pp4–5 and practical/data commentary support evidence-based conclusions and unfamiliar contexts. Historical count is not a specification mandate. |
| [2025 question paper](https://www.ocr.org.uk/Images/752366-question-paper-unified-biology.pdf), [mark scheme](https://www.ocr.org.uk/Images/752493-mark-scheme-unified-biology.pdf), [examiner report](https://www.ocr.org.uk/Images/752104-examiners-report-unified-biology.pdf) | QP p1 confirms the same component; supplied visual/data resources support structured and extended tasks. Marking rows show seven parents, not a fixed six; LoR guidance p5. ER p5 and experimental/graph/calculation commentary support synoptic reasoning, precision and justification from supplied evidence. |

Official requirements remain **70 marks / 90 minutes / all six modules / untiered / all compulsory**. The preserved Examly full template is **6 parents / 24 scored parts**; short practice is **2 parents / 6 parts / 20 marks / 26 minutes**, explicitly an **Examly development template**. Parent/part counts and the visual slots below are Examly choices, not OCR requirements. Custom preserves manually saved topics, counts, formats, resource choices and time, with explicit protected H420/03 identity. Visual policy is accepted only for guided full/short H420/03, never inferred from a display name or applied to Custom/other papers.

## Global library and review workflow

`biology-visual-types.ts` defines opaque immutable asset ID/version/SHA-256, type, concepts, organisms/structures, educational levels, permissible roles, original/source URLs, creator, individual licence/version/URL/commercial/modification rights, attribution, retrieval date, modifications, separate reviewer records, state/replacement, dimensions/media/print suitability and evidence ID. No board or paper lives in an asset. Board/qualification/level-specific assessment configurations reference that global identity. A reviewed asset may support GCSE, A Level, AP, IB, university and international configurations independently of its original consumer.

Separate representations prevent accidental disclosure:

- **Server** `biology-visual-library.ts`: review/evidence records and a private scientific-annotation loader. Empty production ledger; never imported into frontend code. Because the GitHub repository is public, future committed ledger entries must omit accepted answers, feature anchors, specimen-identifying structure/organism tags and evidence rubrics. Those come only from the server-only `BIOLOGY_VISUAL_MARKING_ANNOTATIONS` setting. A scientifically reviewed `annotationsChecksum` binds them to the exact asset/version/image checksum; mismatches stop before generation. `recordAssetReview` requires complete named, dated evidence-backed checks and cannot revive rejected/deprecated versions or ordinary-approve share-alike material.
- **Public** `biology-visual-public.ts`: exact immutable media, neutral descriptions and required attribution only. No scientific identity tags, accepted labels, rubric or reviewer evidence. No external image URL can be supplied by a model. SVG geometry uses a constrained shape vocabulary, with no text, script or network references.
- **Assessment binding**: normalized coordinates, neutral target IDs, permitted letters, arrows/leader lines or blank targets. Private accepted structures/rubric are separately stored through the existing response contract. Existing server release projection, not a public flag alone, determines whether the browser receives the key.

Licence checks cover provenance, creator, proof, commercial use, modification and attribution. Scientific checks cover biological identity, orientation, magnification (or explicitly not applicable for a schematic), label and scale accuracy, intended level, misleading artefacts, answer safety, accessibility and print legibility. Record the evidence and reviewer for every check, including meaningful not-applicable explanations. AI suggestions do not constitute approval. AI-generated scientific raster imagery cannot pass `assetReady`.

Promotion is a reviewed code change: preserve original evidence; confirm actual creator and individual rights; inspect the actual bytes; decide scientifically permissible roles and levels; remove prohibited identifying labels/metadata only if modification is permitted; give any derivative a **new version and checksum** and describe modifications; record **both** human approvals; add matching public file/credit and non-answer-bearing review ledger entries. Real structure/organism identities, feature anchors, accepted answers and evidence guidance must be held in private server configuration, not committed to this public repository. Public source URLs, creator names, descriptions and filenames must also pass answer-safety review. Do not omit legally required attribution to hide an answer: use another asset or another assessed role. Do not commit real assessment keys to publicly downloadable asset files. A withdrawn version is deprecated and keeps its immutable reference; it is not silently substituted. Future storage/registry scaling requires its own access and retention review.

Automated checks establish software gating and integrity only. They do not establish legal compliance or scientific correctness.

## Deterministic Commons ingestion

Run explicitly with Node 24, from the checkout, using a quarantine directory **outside** it:

```sh
node scripts/ingest-biology-visual.mjs --page-id 138367940 --out /workspace/biology-quarantine-new
```

Each run requests the official structured Commons API for one file. It preserves raw evidence before any download, rejects unknown origins/examination material/identified AI raster, and uses ordinary HTTPS verification. Under the managed proxy it uses supported Node 24 `--use-env-proxy --use-system-ca`, never insecure verification. Originals are fetched only after a permitted queue decision, without redirects/hotlinking, with PNG/JPEG signature and 20 MB limits. Source bytes get SHA-256; the result stays quarantined. Runtime generation has no Commons/web search capability. Ordinary tests use fixtures and do not contact external APIs.

| Individual licence evidence | Initial decision |
| --- | --- |
| Public Domain with supported mark/evidence; CC0 1.0; CC BY 4.0 | Review queue only. Both human reviews still required. |
| CC BY-SA 4.0 | Manual legal review; no original downloaded or production eligibility by default. No ordinary approval can override policy. |
| NC, ND, educational-only, unclear commercial/modification rights, unknown/ambiguous metadata, all rights reserved or unsupported versions | Rejected; fail closed. |

Required live discovery domains are **commons.wikimedia.org** and **upload.wikimedia.org**. Both worked with verified HTTPS in this task. No scraping or examination-paper ingestion is enabled. Hosting on Commons is not blanket permission.

### Candidate evidence ledger

Only the machine-readable metadata/evidence JSON below is committed. Original images are external quarantined research files, not assessment assets or committed image downloads.

| Candidate | Evidence and current status |
| --- | --- |
| [Flax section, file page 138367940](https://commons.wikimedia.org/wiki/File:Flax_stem_cross-section_showing_bast_fibers_(modified_from_image_by_Ryan_R._McKenzie).png) | Creator reported as Ryan R. McKenzie, CC0 1.0 metadata; [raw evidence](biology-visual-assets/evidence/commons_138367940.json), source/original URLs and download SHA-256 `648c02ae6fa429632eede7f7c0d45555316d7315e30204958e06b12941b85c31`. 1300×1030 PNG, 2,689,624 bytes downloaded into external quarantine. Licence **pending**, science **pending**. Existing labels disclose structures, so this original is **unsuitable for unlabelled identification**. Provenance/derivative rights and a separately reviewed answer-safe version would be needed; no approval is assumed. |
| [Ruscus vascular bundle, file page 128982224](https://commons.wikimedia.org/wiki/File:Ruscus_hypophyllum_-_stem_cross_section_-_vascular_bundle_detail.jpg) | Creator reported as TCdeOLiveira, CC BY-SA 4.0; [raw evidence](biology-visual-assets/evidence/commons_128982224.json). **Manual legal review**, science **pending**. No original downloaded. Not production eligible. |

### Real library candidate/review plan

This is a discovery plan, not a completed or approved inventory. Use structured Commons file/category queries, then run individual-file ingestion. Do not promote search results automatically.

| Area / candidate query | Intended roles and review emphasis |
| --- | --- |
| Plant/animal cell ultrastructure | Original schematics or verified microscopy; organelle identity, scale, labels, cell type; label/observe by level. |
| Tissues and organs | Histological sections; orientation, stain, diagnostic evidence, normal/pathological status; compare/observe. |
| Microscopy | Light/electron micrographs with verifiable calibration; optics, resolution, artefacts and usable scale; observe/measurement only after calibration review. |
| Mitosis/meiosis | Stage sequences; chromosome counts, ploidy, organism and stage accuracy, no stage labels; compare/sequence. |
| Roots/stems/leaves | Longitudinal/transverse sections; species/monocot-dicot identity, tissue boundaries and scale; label/compare. |
| Nervous system | Original neuron/cord/nerve diagrams or sections; orientation, supported structures and educational level; label/observe. |
| Muscle types | Skeletal/cardiac/smooth histology; striations, branching, nuclei and preparation artefacts; multi-panel compare. |
| Blood/circulation | Blood smears, vessels, original circulation diagrams; species, stain, cell identity, topology and scale; label/compare/observe. |
| Microorganisms/pathogens | Verified bacteria/fungi/protists; species, staining, magnification, diagnostic limits; compare/observe without unsupported disease inference. |
| Ecological sampling | Original quadrat/transect layouts and individually licensed habitat photographs; measurement/grid accuracy and no hidden sampling data; observe/practical evidence. |
| Inheritance/genetic crosses | Original deterministic allelic/chromosome schematics and blank cross layouts; symbols, linkage/ploidy and incomplete student targets; no completed Punnett squares or predicted offspring answers. |

## Paper 3 asset-first consumer

Policy `ocr_h420_03_visual_v1` is explicit in the owned profile's existing `paper_blueprint` JSON. The server resolves approved compatible assets before a model request, checks image bytes and the reviewed private-annotation checksum, and freezes assignments in protected `generation_context.visual_assets`. The browser cannot choose URLs/versions or override the saved component. Retries reuse these exact references after profile edits. Cache identity includes mode and all IDs/versions/checksums.

The additive plan binding leaves old raw plans, definition hashes and prompts intact. Full visual slots: **2(a)** labelled plant-transport section (2 marks), **4(d)** three-panel biotechnology comparison (three independently marked identifications plus evidence, 4 marks), **5(a)** gas-exchange observation/evidence (2 marks). Short slots: **1(a)** plant-transport labels (2 marks) and **2(a)** disease-context observation/evidence (2 marks). All other practical, mathematical, statistical, plotting and extended slots remain intact. Actual assets must support those concepts and unfamiliar synoptic context; the test schematics simulate software compatibility only and are not scientifically suitable endorsements for those roles.

Visual tasks are server-authored deterministic instructions around the selected reviewed annotations. Models receive only neutral public visual sibling metadata and must produce the remaining self-contained parts. They cannot invent a visual question's identity, features, overlay, resource or private key. Controlled text and exact resource/definition/key equality are checked again before atomic publication. Missing approved assets stop with `missing-approved-asset` **before any model call**. There is no decorative-image fallback or automatic unreviewed SVG substitution.

The three patterns reuse `examly_response_v1` labelled fields, existing response envelopes, draft persistence, independent private scoring units, rubric marking and one capped mastery result per scored question. Identification and justification are separately tracked; extended prose, calculations/working and plotting elsewhere are not forced into visual fields. A failed evidence-marking call remains ungraded. Screen, zoom, review and public PDF use the same immutable version. Private answers are rendered only after authorized server release. The assessment PDF function accepts public geometry/resources only, never a marking key.

## Attribution, accessibility and database boundary

Public `/image-credits` is generated from the approved manifest and supports `#assetId-vN` lookups, creator/source/licence links, modification descriptions and a sourcing/review FAQ. Per-question credit links are optional assessment metadata, while printed credit text remains visible. It currently truthfully reports zero approved assets. For Terms, the documented insertion point is **Section 8, Intellectual property**: add a link to `/image-credits` and an individually licensed third-party-content carve-out after legal review. This task does not change contractual terms or the Privacy Policy.

Screen rendering uses neutral alt text and normalized overlays; an accessible dialog enlarges exactly the same stimulus with Escape/close/focus return. Panels stack on mobile and share a row at wider widths; white scientific canvases retain contrast in both themes. Print uses vector SVG primitives or approved embedded PNG/JPEG and includes source/licence/creator/modification text without private labels. Required attribution can disclose identity, so legal and answer-safety compatibility must be reviewed together rather than suppressing credit.

The private annotation setting is intentionally **not configured or modified** in this task: there are no reviewed live assets. Its version-1 JSON envelope contains `assets` records with `assetId`, `version`, image `checksum`, private `structures`/`organisms`, `features` (`id`, normalized `x`/`y`, `accepted`), `identityAnswers` and `evidenceGuidance`. A trusted operator must prepare it from human-reviewed material after promotion, without a `VITE_` prefix, logging values, committing the JSON, or exposing it to the browser. Compute each metadata `annotationsChecksum` over `JSON.stringify(privateAnnotationRecord(asset))` using SHA-256 and retain the approved evidence privately. The loader rejects inline live annotations, malformed/duplicate/changed references, and missing settings. Existing question response keys are still stored privately in the existing normalized contract tables; this is a source-of-review configuration, not a parallel answer system.

No migration is proposed or required. The existing profile JSON, protected context, `question_response_contracts`, draft response contracts and atomic result/mastery infrastructure are reused. Their existing deployed migrations/guards remain a prerequisite for interactive formats; deployment readiness on the live backend was not inspected by logging in or modifying data. Scaling to private review UI or storage would require a separately approved schema/storage/RLS proposal; none is created/applied here.

## Verification and rollout

See the delivery record below for final exact counts, changed-file inventory, affected functions and browser results. Run offline:

```sh
npm ci
npm run check
node scripts/audit-biology.mjs
node scripts/audit-ocr-alevel-paper3.mjs
node scripts/audit-biology-visual-assets.mjs
git diff --check
```

Do not enable live visual generation until compatible real assets have completed both human reviews, matching immutable entries are promoted, and the private annotation setting has been configured by a trusted operator. After review/merge and operator deployment, first test **one short H420/03** assessment: inspect resources, every label/evidence field, private release/marking, one capped mastery result per question and student PDF. Then test **one full H420/03**: 70 marks/90 minutes, cross-module coherence, exact assets throughout, practical/maths/statistical demand, full PDF pagination and attribution. Ordinary nonvisual H420/03 can be tested independently while the library is pending. Paid generation and external Gemini review are later operator/user actions; no automated result is a legal/scientific certificate or proof of a 10/10 paper.

## Delivery record — 7 October 2026

All verification used Node **24.19.0** and the unchanged lockfile. Exact results:

| Check | Result |
| --- | --- |
| `npm ci` | PASS; 863 packages installed. No dependencies or lockfiles changed. |
| `npm run check` | PASS: **1,398 tests / 94 files / zero failures**; TypeScript, critical hook lint, Edge identifier checks, **38** function bundles and production build pass. Baseline: 1,342 / 90. |
| `node scripts/audit-biology.mjs` | PASS: **50 templates**, no paid generation. |
| `node scripts/audit-ocr-alevel-paper3.mjs` | PASS: full 70/90 and short 20/26; synoptic/module/practical/maths/resource plans checked offline. |
| `node scripts/audit-biology-visual-assets.mjs` | PASS: **4 synthetic fixtures**, **0 production-approved assets**, all three response patterns; full visual consumer has 3 asset-first parts, short has 2, using simulated approvals only. |
| Existing fingerprints | All **50** plan/definition/prompt hashes match the captured starting point. Existing contract and fingerprint files remain unchanged. |
| `git diff --check` | PASS. |

The focused tests cover individual licence policy/ambiguity, separate approvals, scientific/attribution/evidence completeness, deprecated/rejected/AI states, content and private-annotation hashes, immutable references and duplicate stimuli, board-independent/level-specific compatibility, public-schema non-disclosure, labelled/comparison/evidence envelopes and marking, failed marking, capped mastery counts, frozen profile context/retries/cache identity, actual extraction/batching/truncation/publication handlers with fake providers and database, asset-first missing-approval failure before AI calls, frontend bundle exclusion of internal records, profile persistence/removal and screen/zoom/review/PDF output. Synthetic approval records are injected only into isolated test runtimes.

Chromium used Vite, normal certificate verification and the existing managed-proxy trust configuration. Settings checks exercised the **real modal** with local in-memory profiles, not a real account: Papers 1/2/3 exposed, H420/03 full/short save/reopen, 70/90 and 20/26 summaries, untiered controls, disabled unreviewed visual option, unchanged H420/01 v1 and H420/02 v1/v2. Widths: **390, 768, 1024, 1440 px**. Google Fonts loaded. Visual fixtures were inspected at the same widths, in both themes; zoom/close/Escape/focus restoration, independent response fields, public overlays/credits and locally simulated authorized release passed. The real public credits route correctly reports zero approved assets. Backend requests were blocked and numbered **zero**; no login or real profile save occurred.

Axe WCAG 2/2.1 A/AA checks detected **zero violations** on the visual fixture and credits page. Small accessible-presentational fixes hide the decorative dialog-close icon and keep the existing cookie privacy link underlined. No consent behaviour, legal text or Privacy Policy changed. No JavaScript, console, certificate or failed-request errors were detected. These browser checks are emulation, not physical iOS/iPadOS testing or accessibility certification.

A browser-triggered jsPDF assessment download and Chromium print PDF were produced from synthetic fixtures. The four-page jsPDF was visually inspected, including labelled targets and three-panel comparison, and its attribution/blank answer spaces were readable. Text extraction from **both** PDFs confirmed immutable fixture IDs and attribution, with no private identities/accepted answers/rubrics. Real licensed-image print quality, real user release authorization, live saved profiles, real marking/model calls and a genuine full assessment PDF remain unverified.

Existing non-blocking warnings: five deprecated package notices from installation, stale Browserslist data, large production chunks, npm update notices and expected diagnostics from negative fixtures. No blocking check errors remain. No migration/storage/RLS proposal is required; no existing environment variable, database types, migration, dependencies, historical grades, contract outcome pool, score logic or payment/quota protections were changed.

### Functions requiring operator deployment after merge

Static bundle dependency analysis identifies these **14** affected functions. None was deployed in this task:

```text
extract-exam-questions
generate-practice-questions
generate-student-pdf
get-exam-questions
get-practice-questions
grade-practice-question
publish-exam
question-response
save-exam-format
save-exam-progress
save-exam-timer
submit-exam
submit-student-answer
upload-exam
```

After code review, **Squash and merge** is appropriate for this focused branch. It is safe to merge the gated foundation once reviewed; it is **not** approval to enable unreviewed live images. Ask Lovable to deploy all 14 functions from the merged commit together, preserving their current authentication settings. Frontend publication alone does not update them. Deploying functions is a later operator action; this task keeps the website unpublished.

With visuals disabled, test one ordinary **short H420/03**, inspect results/resources/review/PDF, then one **full 70-mark/90-minute H420/03**. To test the visual variant, first complete compatible asset licence/science reviews, promote exact immutable public versions and configure their private annotation setting securely; then repeat **short first, full second**, checking answer safety, independent fields, marking caps/mastery, release, pagination and attribution. Paid tests/external Gemini review remain the user's later quality audit. Automated results do not certify legality/science or predict a 10/10 rating.

### Exact changed-file inventory

Modified (17):

```text
src/App.tsx
src/components/CookieConsent.tsx
src/components/responses/ResponseResources.tsx
src/components/responses/ResponseReview.tsx
src/components/stats/ExamProfileModal.tsx
src/components/ui/dialog.tsx
src/lib/response-pdf.ts
src/test/ocr-alevel-paper3-profile.test.tsx
supabase/functions/_shared/biology-practice.ts
supabase/functions/_shared/course-selection.ts
supabase/functions/_shared/exam-access.ts
supabase/functions/_shared/ocr-alevel-biology-paper3-validation.ts
supabase/functions/_shared/profile-context.ts
supabase/functions/_shared/response-generation.ts
supabase/functions/_shared/response-resources.ts
supabase/functions/extract-exam-questions/index.ts
supabase/tests/aqa-alevel-runtime.ts
```

Added (20):

```text
docs/biology-visual-assets.md
docs/biology-visual-assets/evidence/commons_128982224.json
docs/biology-visual-assets/evidence/commons_138367940.json
scripts/audit-biology-visual-assets.mjs
scripts/ingest-biology-visual.mjs
src/components/biology/BiologyVisual.tsx
src/lib/biology-visual-pdf.ts
src/pages/ImageCredits.tsx
src/test/biology-visual-rendering.test.tsx
supabase/functions/_shared/biology-visual-assessment.ts
supabase/functions/_shared/biology-visual-ingestion.ts
supabase/functions/_shared/biology-visual-library.ts
supabase/functions/_shared/biology-visual-plan.ts
supabase/functions/_shared/biology-visual-public.ts
supabase/functions/_shared/biology-visual-types.ts
supabase/tests/biology-visual-assets.test.ts
supabase/tests/biology-visual-context.test.ts
supabase/tests/biology-visual-fixtures.ts
supabase/tests/biology-visual-pipeline.test.ts
supabase/tests/fixtures/biology-pre-visual-assets-baseline.json
```
