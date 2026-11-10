# Physics practice generation parity

Reviewed against `0147a2a4521c4e61eb822581a63bfbe5f34a5f0d` (PR #55 plus Lovable's validator compiler fix). Deployment was correctly held: an updated preview and passing bundle checks did not establish compatible backend behavior.

## Confirmed issue and correction

`get-practice-questions` is another generation endpoint. Its older copied generator accepted new Physics snapshots without the canonical Physics prompts, numerical checks or versioned cache policy. PR #55 updated the other writer and missed this duplicate.

Both URLs now import `generateQuestionsInBackground` from `_shared/practice-generation.ts`. That module contains the existing canonical generator, moved without changing its body. Both original HTTP handlers are preserved, including authentication, ownership, shared quota, request flags and interactive-attempt guards. There is one budget reservation and one background dispatch per request; neither handler delegates through another HTTP endpoint. Historical snapshots keep their original policy.

The new regression suite exercises both real bundled entrypoints with synthetic Supabase/provider responses: saved figures and private numerical envelopes, versioned and invalid cache entries, repair limits, postprocessing corruption, legacy snapshots, JWT/ownership/quota rejection and interactive retries. No live provider or database is used. Three selected tests fail against the previous `get-practice-questions` implementation, confirming the tests detect the missing contract and cache/validation behavior.

## Compiler checks

Lovable's validator fix is retained unchanged. The previous edge check verified identifiers and bundling; it did not perform a full type check. `npm run check` now also runs `typecheck:physics`, using a separate strict TypeScript configuration for the seven shared Physics modules and their local import closure. This reproduces all eight original union-indexing diagnostics when the pre-fix validator is substituted, and passes with the merged fix.

Actual Deno 2.5.6 checking of all eight activation entrypoints found two additional optional-subject type errors in `extract-exam-questions`. Explicit null fallbacks fix those without changing Physics validation rules. All eight entrypoints now pass Deno checking. The repository strict check has a bounded shared-module scope; it does not claim to type-check every Edge Function.

## Verification

- `npm run check`: **3,316 tests in 201 files**, app and strict Physics types, critical lint, 39 function identifier/bundle checks and production build pass.
- Both practice entrypoints: **52** Physics generation and HTTP-boundary tests pass, including old-snapshot behavior. Existing Biology/response suites pass in the full run.
- After the two extraction null fixes: **16** actual extraction/publication pipeline tests pass; the eight-function Deno check passes.
- The [portable browser/PDF harness](browser/README.md) records its own source fingerprints, runtime prerequisites and synthetic-browser limitations. Its new evidence is separate from the historical PR #55 results.
- The relocated run passes **80 saved renders and 58 scenario groups across eight viewport/theme cases**, plus two actual PDF exports. Frozen checks match **852 application/config files, 189 server/config files and 2,555 installed dependency inputs**. See [the recorded results](browser/results/browser-results.json).

For the Deno check, install Deno 2.5.6 outside the project, then run from the checkout:

```sh
deno check --no-lock --config supabase/functions/generate-practice-questions/deno.json \
  supabase/functions/extract-exam-questions/index.ts \
  supabase/functions/generate-practice-questions/index.ts \
  supabase/functions/get-practice-questions/index.ts \
  supabase/functions/grade-practice-question/index.ts \
  supabase/functions/publish-exam/index.ts \
  supabase/functions/save-exam-format/index.ts \
  supabase/functions/submit-exam/index.ts \
  supabase/functions/upload-exam/index.ts
```

The eight import maps are identical (`zod` → `npm:zod@4.4.3`). This command resolves public package/type dependencies but does not execute handlers, use secrets or make model calls. Deno reuses cached dependencies unless `--reload` is supplied. Preserve the host's CA trust; this environment used `DENO_TLS_CA_STORE=system`. The npm regression suite uses local synthetic providers and needs no network requests.

## Activation remains separate

No functions have been deployed by this correction. The preview was already ahead when Lovable held the rollout; backend-before-client ordering cannot be claimed. [The corrected activation handoff](deployment.md) requires the complete eight-function set from one reviewed revision, with actual deployed revisions verified before fresh generation. The correction alone changes three function bundles; the held PR #55 activation still requires all eight.

No paid AI calls, student logins, live database writes, migrations, existing-exam edits or website publication were performed. Live database column permissions and deployed backend revisions were not inspected. Passing these checks establishes the tested software behavior, not a scientific quality rating for a future model-written paper.
