# Rebuilt Profile Builder rollout — not executed

The website must remain unpublished. No live SQL, deployment, paid draft, exam, login or data change was performed by this implementation. Merging code is separate from enabling the new source-processing backend.

## Database review

Review [the proposed additive SQL](../../pending-migrations/20261104120000_profile_builder_jobs.sql) before applying it through the connected managed workflow. It is deliberately outside the applied migration directories. The existing request receipt cannot store checkpoints while running because its constraint requires `result IS NULL`; the separate private job table preserves that invariant and the existing budgets.

Verify the existing Profile Builder installation, `public.user_profiles`, request/proposal functions, service-role privileges, `reserve_ai_request` and `ai_request_settings` against the connected schema and migration history. Check the current recovery/backup mechanism. A partial installation or failing preflight must be investigated without weakening the guards. This proposal requires separate review/approval before live application.

The proposed table/RPCs have no client access. Receipts are claimed before PDF parsing; the existing 120/day cheap request limit, 10/day and three/burst paid-build limits, three-call maximum, active-time budget and global AI pause remain authoritative. Source cache/processing expiry is 24 hours; it is not an automatic deletion schedule. Account deletion cascades as before. Existing saved profiles and completed request results remain unchanged.

## Function dependency report

The [esbuild dependency report](deployment-dependencies.json) examines all 39 deployed entry points. Exactly 10 intersect changed server code: `extract-exam-questions`, `generate-practice-questions`, `get-practice-questions`, `grade-practice-question`, `profile-builder`, `publish-exam`, `save-exam-format`, `save-exam-timer`, `submit-exam`, `upload-exam`.

The additional consumers read the shared evidence schema; they must accept new physical-page references beyond 120 consistently with the builder. This list is calculated from actual imports, not the previous task's deployment list. No other function is requested for deployment.

## Preview verification after approved rollout

After the SQL is approved and applied, deploy only the functions above with the existing per-function Deno configuration and JWT/authentication policy. Keep provider keys and quotas unchanged; do not print or transfer credentials. Generated database types, if needed, must come from the managed generation workflow, not manual edits.

Use synthetic/local tests first. A real authenticated, non-paid preview verification can then build/save/reopen one clearly named temporary approved OCR H420/03 profile. Its provider intents/reservations must be zero. Preserve existing profiles and delete only that verification profile if appropriate. Do not make a paid draft or generate a paper during activation checks. Do not claim activation solely because the source was merged.

Real source-backed AI output requires a separately authorised paid verification after deployment. It should receive an external quality review before broad use; automated tests and synthetic browser replies do not establish scientific quality or an external rating.

## Rollback proposal

Stop new source builds before rollback. Decide how required private checkpoints will be retained or removed. Then, through the reviewed managed workflow, drop only these new functions and the new table:

```sql
DROP FUNCTION public.finish_profile_builder_job_call(uuid,uuid,uuid,integer,text,jsonb,integer,jsonb,jsonb);
DROP FUNCTION public.commit_profile_builder_job(uuid,uuid,uuid,integer,text,jsonb,integer,jsonb);
DROP FUNCTION public.begin_profile_builder_job_call(uuid,uuid,uuid,integer);
DROP FUNCTION public.reserve_profile_builder_job(uuid,uuid,uuid,integer);
DROP FUNCTION public.acquire_profile_builder_job(uuid,uuid);
DROP FUNCTION public.cached_profile_builder_source(uuid,text);
DROP FUNCTION public.read_profile_builder_job(uuid,uuid);
DROP FUNCTION public.create_profile_builder_job(uuid,uuid,text,text,jsonb,text,integer);
DROP FUNCTION public.profile_builder_job_json(public.profile_builder_jobs);
DROP TABLE public.profile_builder_jobs;
```

Retain the original request table, its call/usage accounting, quota reservations, profile envelopes and existing builder functions. Do not use `CASCADE` or reset the database. Previously saved profiles and completed proposals continue through the original system. An older frontend/backend can be restored together; older code cannot analyse a newly introduced >120-page evidence reference, so review that compatibility before rolling back consumers.
