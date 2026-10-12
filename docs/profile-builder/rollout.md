# Pending preview rollout

The founder has now authorised the missing-backend repair. The reviewed migration and connected-backend handoff are documented in [rollout-fix.md](rollout-fix.md). Codex has confirmed the missing live service/schema but cannot apply or deploy using its public frontend access. Keep the website unpublished; paid tests remain outside this repair. Merging a PR alone does not make the builder backend ready.

## Migration review

The canonical reviewed additive SQL is [20261012090000_profile_builder_rollout.sql](../../supabase/migrations/20261012090000_profile_builder_rollout.sql). The earlier documentation proposal is superseded and must not be applied as well. It adds:

- Nullable protected `subject_exam_profiles.profile_template`, with a version/server/origin envelope check and security-invoker guard.
- Owner-readable, service-write-only `profile_builder_requests`, references to existing public account profiles and saved exam profiles, state/accounting bounds and RLS.
- Service-only request claim, call intent, usage and atomic profile-save RPCs.

Existing profiles remain `NULL`; ordinary owner-authorised core edits and deletion remain on the existing paths. No answers, scores or historical grades are changed. The existing 1–50 question constraint is retained. No public storage bucket is introduced.

Before applying, the deployer must inspect the connected schema and function/trigger names, verify every existing column used by `save_builder_profile`, the auth roles, table owner/RLS and `reserve_ai_request` availability, and confirm that this proposal has not already been applied. Apply exactly once through the existing managed migration workflow, recording the reviewed migration version. The migration rejects partial/existing installations instead of overwriting them.

Review and verify a **restorable backup/recovery procedure** in the backend's actual management interface before a live application. PGlite tests do not establish that safety net. Prefer an isolated rehearsal where available; never claim staging or snapshot restoration exists unless verified. Stop and report the precise missing capability rather than using a false assurance.

After an authorised migration, regenerate Supabase types through the existing managed workflow. Do not hand-edit generated definitions. Re-run the supported lockfile installation, `npm run check` and both audits against the final regenerated types and deployment code.

### Recovery proposal

For a deployment problem, first disable access to the builder/backend entry and restore the previous application/function code while retaining the additive data. Export or back up the new profile envelopes/request records before any destructive reversal. Ordinary legacy profile operations do not require deleting these records.

If a fully reviewed schema rollback is necessary, restore the verified snapshot where supported, or use an authorised down migration in reverse dependency order: remove the new service RPCs; drop the new `guard_profile_builder_owner_delete` trigger/function and the `guard_profile_template` trigger/function; remove the envelope constraint; then remove the new request table and profile column **only after preserving their data and accepting that new templates/receipts would be lost**. Do not run a blind `DROP ... CASCADE`. None of these recovery actions is performed or authorised by this PR.

## Function deployment dependency graph

The list below was derived from esbuild's actual local-import metadata for all 39 entry points against audited main. The [complete graph](deployment-dependencies.json) records each changed dependency. Recompute if newer work changes shared imports.

| Function | Reason |
| --- | --- |
| `profile-builder` | New authenticated proposal/save/duplicate workflow and PDF parser |
| `upload-exam` | Owned profile context/snapshot resolution |
| `save-exam-format` | Saved context and paper-plan routing |
| `extract-exam-questions` | Compiled plan, bounded generation and generic validation |
| `publish-exam` | Plan/resource/answerability readiness checks |
| `generate-practice-questions` | Saved scope, private cache isolation and practice validation |
| `get-practice-questions` | Same shared scope/cache/validation dependencies |
| `submit-exam` | Saved marking context/plan |
| `grade-practice-question` | Saved practice marking context |
| `save-exam-timer` | Shared course/context dependency; include its import map |

Each uses its supplied `deno.json` mapping for the shared Zod import. The new parser is pinned with a Deno `npm:unpdf@1.8.1` import. Local bundling treats Deno URL/npm packages as runtime externals; deployment must confirm that the managed runtime resolves them. Use the backend already connected to the intended unpublished preview; never guess that a production project is disposable. Existing configured provider credentials are required; do not print or transfer secrets.

The existing function named `publish-exam` finalises an individual exam. Deploying it does not grant permission to publish the website or change its domain/visibility.

## Founder verification sequence after authorised rollout

Complete free settings checks first, using temporary profiles and preserving existing records/settings:

1. Select OCR A Level Biology A H420/03 in an approved mode/version. Preview the actual preset, verify the gold star and confirm no provider call/reservation. Save/reopen across devices once the database rollout is ready.
2. Rename and duplicate it: approval remains only while generation settings match. Change duration/topics: no active star. Restore explicitly: the star returns. An older approved version is labelled older; a pending component has no star.
3. Open existing AQA GCSE/A Level, OCR, Edexcel GCSE and WJEC profiles. Their course/cohort/tier/mode settings and existing unsupported entries must remain intact. Check the manual editor and advanced options.
4. Validate missing identity, wrong component/tier and unsafe/unregistered URLs. A retrieval failure must not automatically become a model-memory draft. Confirm private uploads and proposals are owner isolated using test accounts.
5. Authorise a small source-backed Pearson draft and an institution brief only when ready for bounded paid provider calls. Review real evidence references, unknowns and executable parts before saving. They must have no approval star.
6. Authorise one short draft exam and ordinary practice quiz. Check saved identity/version/scope, required resources, private answer handling, marking and graded-only mastery analytics. An incomplete or unsupported paper must still be blocked.
7. After the short run succeeds, deliberately test a full supported template. Check actual spend/repair accounting and frozen retry behaviour. Review cover, released/unreleased review, resource zoom and a browser-downloaded PDF. Use the founder's external Gemini/subject review for science and board fidelity.

Do not run paid retries while a known installation/deployment failure remains. Capture safe request/exam IDs, saved identity/tier/mode/versions, deployed function version, call intentions/known versus unknown cost, defects and transport/acceptance/persistence/readiness separately. Do not share secrets or student personal data in logs.

Public source updates require repository review and a new evidence version. Show a comparison and ask the user to adopt it deliberately; saved profiles and historical attempts are not rewritten automatically.
