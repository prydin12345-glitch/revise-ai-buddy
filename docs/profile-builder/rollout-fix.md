# Profile Builder activation repair

The failure is missing backend installation, not incorrect student choices. Read-only checks against the configured Examly project on 12 October 2026 returned:

| Check | Result |
| --- | --- |
| `GET /functions/v1/profile-builder` | HTTP 404, `NOT_FOUND`, `Requested function was not found` |
| `OPTIONS /functions/v1/profile-builder` | HTTP 404, same missing-function result |
| `GET /rest/v1/subject_exam_profiles?select=id,profile_template&limit=0` | HTTP 400, `42703`, `column subject_exam_profiles.profile_template does not exist` |
| `GET /rest/v1/profile_builder_requests?select=request_id&limit=0` | HTTP 404, `PGRST205`, table absent from schema cache |
| `GET /rest/v1/user_profiles?select=id&limit=0` | HTTP 200; no user records requested |
| `GET https://api.supabase.com/v1/projects/ynhevbrihlnwzehrfoft/functions` | HTTP 401, `No access token provided` |

Codex has the public frontend binding, but no Supabase management connection/token or database credentials. These read-only checks do not confer migration/deployment authority. No live migration, deployment, login, profile write or paid provider call was performed. The latest main commit labelled “Fixed Profile Builder access” changes only `bun.lock`; it does not add the missing migration. Live probes still show the components missing.

## Prepared correction

The canonical apply-once migration is [20261012090000_profile_builder_rollout.sql](../../supabase/migrations/20261012090000_profile_builder_rollout.sql). The earlier documentation proposal is superseded and must not also be applied.

- Request owners reference the existing `public.user_profiles(id)` primary key, not the managed `auth.users` table. Existing signup creates these public profiles and account deletion removes them. The request foreign key preserves cascading removal of private extracted evidence. A service-only parent-delete guard prevents a direct client deletion from erasing receipts and resetting replay/call accounting; existing service-role account deletion still cascades.
- Preflight checks reject existing/partial builder installations, a missing/invalid public parent key and missing profile columns before writing anything. The original nullable envelope, server-only guard, request RLS, service-only RPC grants, bounded accounting and atomic save are preserved.
- PGlite tests execute the actual migration with no `auth.users` table, test service cascade cleanup, client replay-reset prevention and reapplication rejection, and retain the original ownership, idempotency, quota/accounting and concurrent-save checks.
- The frontend distinguishes missing-function, runtime boot and network/session failures while preserving authenticated handler validation/quota/migration messages. It never automatically replays a request or treats an owned-proposal 404 as a missing service.

The original feature's ten-function rollout dependency list remains unchanged; this repair introduces no changes to their handlers, authentication or provider budgets. Full authenticated deployment and generated-type refresh require the connected management workflow. Offline tests are not evidence of live activation.

## Completed verification

Node 24.19.0 and the unchanged npm lockfile: `npm ci` and `npm run check` passed. **1,971 tests / 121 files**, zero failures; the targeted rollout suite passed **29 tests / 3 files**. Typecheck, critical hook lint, 39 Edge Function bundles and production build passed. Biology audit: **52 templates**, all checked; approval coverage: **52 records**, all original fingerprints passed. `git diff --check` passed. Existing package-deprecation, Browserslist, test DOM-nesting, PDF test font, Tailwind-duration and large-chunk warnings remain.

Chromium exercised the actual client and builder with the observed 404 supplied as a controlled fixture at 390 × 844 and 1440 × 1000, light/dark. The deployment message is visible, Save stays disabled without a server receipt, and explicit retry works. No JavaScript, console, request or certificate errors occurred after the saved managed-CA initialization; normal TLS verification remained enabled. No backend request or paid call was made by this browser fixture. See [browser report](rollout-verification/browser.json), [desktop](rollout-verification/desktop-missing-service.png) and [mobile](rollout-verification/mobile-missing-service.png).

These are offline migration/handler and browser checks. Applying SQL, deploying functions, regenerating live types and an authenticated approved-preset save/reopen remain blocked by missing management access. They must not be reported as completed.

## Lovable handoff prompt

The founder has authorised fixing the missing Profile Builder backend. Use the existing connected Examly backend, project `ynhevbrihlnwzehrfoft`. Keep the website unpublished. Do not generate exams or make paid AI calls.

1. Use the reviewed repair branch/PR once merged, preserve newer unrelated work, and inspect the connected schema/migration history. Confirm `public.user_profiles.id` is the UUID primary key created by existing signup, all profile columns named in the migration exist, and the quota RPC `reserve_ai_request` remains available with its current permissions. Inspect any partial installation instead of overwriting it. Verify the existing backend recovery mechanism before changing the schema.
2. Apply **only** `supabase/migrations/20261012090000_profile_builder_rollout.sql` once through the managed migration workflow and record its version. Do not apply the superseded documentation proposal, reset the database or change existing profiles/grades. If its preflight fails, report the exact prerequisite and stop rather than weakening it. Regenerate Supabase types through the managed workflow; do not hand-edit them.
3. Deploy current repository versions of `profile-builder`, `upload-exam`, `save-exam-format`, `extract-exam-questions`, `publish-exam`, `generate-practice-questions`, `get-practice-questions`, `submit-exam`, `grade-practice-question` and `save-exam-timer`. Use each supplied `deno.json` and existing JWT configuration. `profile-builder` retains its explicit server `getUser` authentication check. Do not disable authentication broadly, change quotas or transfer/print provider secrets. Resolve `npm:unpdf@1.8.1` and the existing Zod import mappings normally.
4. Verify the function starts (`OPTIONS` 200 and `GET` 405), anonymous build requests are rejected before any provider call, and the new objects exist with the intended RLS/service-only permissions. In the existing authenticated preview, use an exact approved OCR H420/03 preset to build/save/reopen one clearly named temporary verification profile. Confirm `origin=catalogue`, zero `call_intents`, empty provider usage and no AI quota reservation. Check ownership/provenance guards using existing test facilities. Preserve existing profiles and remove only the temporary verification profile if appropriate. Do not create a paid draft or an exam.
5. Run the repository checks and Biology/approval audits after the generated-type refresh, confirm the fingerprints remain unchanged, and report actual migration/deployment/free-test results. Do not say the feature is live merely because its source was merged.

The migration and approved-preset test are authorised as part of this repair; no renewed blanket approval is needed. Codex cannot perform those live operations with a public frontend key alone. If Lovable cannot access the management workflow either, report that exact access blocker rather than requesting private credentials in chat.
