# Biology Paper 2 resource repair

Prepared against GitHub main `67670ad5b57ca62e97725c783c81d2f6237deb4b`.
The investigation started at `5fe22b62d24c566354f9b8b67b3b1e4cc30fa414`;
newer landing-page and MCP integration work was brought forward unchanged.

## What failed

Assessment pages inferred Biology figures from prose. The inferred genetics
configuration could substitute two heterozygotes, while its renderer displayed
a completed cross and phenotype ratio. The combined Figure/Data component
initially selected the figure tab, obscuring required numerical data. Food
diagrams also supplied default organisms and feeding relationships. A relay
neurone mentioned in prose could acquire an unrelated anatomical illustration.

The fixtures reconstruct the reported Bb × bb, relay-neurone and freshwater
food-chain cases. Biomass measurements are synthetic. The original saved exam
record and the latest screenshots were not available for this repair.

## Behaviour after this change

- Assessment and review pages use explicit saved Biology configurations.
  Mentions of a cross, food chain or neurone do not invent a figure.
- Required chart/table data stays visible. A separate saved figure appears
  alongside it, without a Figure/Data tab hiding the measurements.
- Assessment Punnett squares show parental inputs and an empty response grid.
  Worked offspring and ratios appear only when the caller releases solutions.
  Zoom preserves that same decision; a model-supplied mode cannot override it.
- Monohybrid complete-dominance results come from the actual parents.
  Bb × bb gives 50% dominant and 50% recessive, with a 1:1 ratio.
- Food chains render the saved feeding order; food webs require explicit links
  from food to consumer. There are no assessment defaults for organisms.
- Neurone resources must declare their variant and match an explicitly named
  subtype. A prose question can remain prose when it needs no figure.
- Narrow deterministic checks tie percentage calculations to saved parental
  or biomass inputs and their private answer keys. Explicit food-chain context
  in the same group also constrains biomass row identities.
- Initial generation and group repair use those checks. A repair must provide
  a consistent resource and key together. Existing quotas, generation batches,
  call/time budgets, syllabus rules and final readiness gates remain in place.
- PDF export uses the same saved inputs, prints tables, renders Biology figures
  in assessment mode, bounds figure height, and reports a failed Biology capture.
  Requesting a separate answer-key section does not solve the question figure.
- Public exam payloads project genetic/calculation inputs without completed
  offspring, ratios or arbitrary result fields.
- Paper 2 practice uses a new resource cache version; old cached entries are not
  selected for new attempts. Existing attempts and historical grades are not edited.
- Tutor chat retains explicit, labelled food-chain/web teaching examples and
  may show worked crosses. Assessment pages do not use that teaching catalogue.

## Boundaries and limitations

The genetic renderer supports a single autosomal locus with complete dominance.
It rejects unspecified parents and unsupported crosses instead of guessing.
Advanced inheritance diagrams and quantitative ecological pyramids need their
own validated renderer; they are not certified by this patch.

The calculation checks are deliberately narrow, not a complete scientific
validator. New input contracts are required for recognised GCSE Biology tasks;
other qualifications are not forced into the new GCSE contract. A final
percentage must agree within 0.05 percentage points. Standard answer prose and
working are accepted; the prompt recommends a private `Final answer: N%` label.

Already saved missing or wrong data is not retrospectively regenerated.
Refreshing the UI removes inferred figures, but an inconsistent saved resource
can still require a new paper. Do not change a historical answer key or regrade
a completed attempt as part of installation.

## Verification

At the supplied code on Node 24.19.0:

- `npm ci --no-audit --no-fund` succeeded with the current upstream lockfile.
- `npm run check`: frontend types, critical hook checks and missing-identifier
  check passed; 397 tests in 31 files passed; 37 Edge Function bundles and the
  production build passed.
- 48 new tests cover cross calculations, resource/key disagreements, group
  context, initial generation and repair persistence at both tiers, DOM/zoom
  disclosure, always-visible data and PDF routing/failure handling.
- `node scripts/audit-biology.mjs` retained all 12 offline template combinations,
  including existing AQA Paper 1 and OCR Gateway plans and baseline fingerprints.
- The actual SVG components were rasterised and inspected for the blank cross,
  the worked Bb × bb cross and the freshwater food chain.

The PDF tests exercise real PDF text/layout and React SVG rendering, with browser
canvas capture replaced by a test adapter. A local Chromium download failed, so
actual html2canvas output, mobile preview interaction and a downloaded browser
PDF still need Lovable preview verification. No paid model run, live database
test, deployment or website publication was performed here.

The latest upstream MCP function added Deno `npm:` imports, which the Node-based
bundle checker did not recognise. The checker now leaves those runtime imports
external, as it already did with URL imports. Local imports and the identifier
gate are still checked. Bundling does not validate remote package availability
or Deno runtime behaviour. Deno documents these specifiers at
https://docs.deno.com/examples/npm/.

Existing build warnings about bundle size, old browser metadata and ambiguous
Tailwind timing classes are not disabled by this patch.

## Deployment dependency list

Shared imports require updating these eight preview functions:

1. extract-exam-questions
2. generate-practice-questions
3. get-practice-questions
4. publish-exam
5. get-exam-questions
6. save-exam-progress
7. submit-exam
8. submit-student-answer

The first four use the generation/resource validators; the last four use
`exam-access.ts`. Recompute this list if newer code changes the dependency graph.
No migration, generated database types, dependency/lockfile edit, or historical
grade change is required. The MCP function itself is unchanged by this repair.
Updating `publish-exam` does not publish the website.

## Preview acceptance checks

Use temporary local fixtures or preserve existing saved settings. Do not
generate a paid paper automatically.

1. A prose-only relay-neurone question has no inferred motor-neurone illustration.
2. A Bb × bb assessment has only given inputs and a blank scaffold. Check the
   ordinary view, zoom, light/dark themes, mobile width and downloaded PDF.
3. The matching released review shows the worked 1:1 result. Hidden/unreleased
   work does not reveal it.
4. A biomass calculation displays its source/recipient measurements and units
   immediately. An optional saved freshwater chain uses the same organisms.
5. PDF data appears once and remains legible; exporting an inconsistent Biology
   figure reports an error. A separate answer key does not alter question figures.
6. AQA Paper 1 and OCR profiles still open. Keep existing marks, topic scopes,
   tiers and generation settings; do not alter template baseline hashes.

After those checks and all eight deployments pass, the owner can generate one
fresh Paper 2 Higher full mock and then a Foundation paper. Check the actual
resources and keys in those new outputs; the automated results are not an
external Gemini rating or an official exam-board certification.
