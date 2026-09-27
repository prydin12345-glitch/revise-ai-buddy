# AQA A-level Biology Paper 1: answerability/resource repair

Audited against `54088bd21e97b3d91dd7809c58322e0f641808bf` (Reinstalled AQA Biology update).

## Evidence and scope

The supplied failure reported a valid `Distinguish between magnification and resolution in microscopy.` instruction being rejected, a missing resource on Q5(d), and a malformed table. The command rejection is directly reproducible from the code. The exact live table payload and the complete failed paper were not supplied; this change does not claim to reconstruct those records or identify their missing measurements.

Code inspection and synthetic handler tests also reproduced loss of supported resource aliases during repair and saving. These are fixed alongside more useful resource instructions and diagnostics. No live database was read or written, no paid model call was made, and no website/backend deployment was performed while preparing this patch.

## Changes

- Recognise `Distinguish` as an assessed command, including existing leading-adverb handling. Narrative/context-only statements still fail.
- Normalize only lossless data-table representations: keyed row objects must contain exactly the declared headers and scalar finite/text values. Preserve header order, every measurement and metadata. Missing cells, extra keys, ambiguous headers and non-finite values remain errors. Never pad rows or truncate data to pass validation.
- Store the same canonical resource that was validated. Respect supported `chart_data`, `diagram_config`, `diagramConfig` and `table_data` aliases in generation/repair instead of discarding a valid alias or saving its raw inconsistent representation.
- Report the first bad table row and its expected/actual width or invalid cell, once per distinct defect, rather than two generic messages.
- Give generation and full-group repair an explicit rectangular table/line-graph schema. Give repairs a per-part resource checklist. Required resources remain required. A reference to another part's resource is not treated as a local payload.
- For resource=none parts such as full-mock Q5(d), prefer a complete self-contained task. A repair may rewrite the complete task and key, but cannot make a data-dependent task answerable by merely deleting “Figure 5”. Supplied measurements must be reused when recoverable; irrecoverable data requires an explicitly complete synthetic group rewrite, not guessed replacement cells.
- Use saved marking policy for repair instructions: A-level point-based keys must not acquire GCSE three-level descriptors.
- Give all failed groups their first repair attempt before retrying earlier groups. Retain the existing three-per-group/eight-total repair limits and the 26-call/nine-minute overall budget.
- Include question numbers alongside draft IDs in final defects and repair prompts.

## Preservation

All 38 current course/tier/mode plans and course definitions remain unchanged. The 36 GCSE whole-paper and first-batch prompts remain unchanged; the two A-level generation prompts deliberately gain resource instructions. Shared repair guidance and parsers benefit existing courses as well. Plan IDs, marks, durations, parts, fingerprints and saved identities are unchanged.

No migration, dependency/lockfile update, generated-types edit, historical-grade change, quota change, ownership/release relaxation or new paper is included. The site must remain unpublished.

## Verification

`npm ci` and `npm run check` on Node 24.19.0; `node scripts/audit-biology.mjs` for the 38 offline template combinations. The new `supabase/tests/alevel-generation-repair.test.ts` includes 28 tests, with real Edge Function handlers running against simulated provider responses/databases:

- the exact previously refused command is accepted and persisted in one repair;
- invalid context alone remains blocked;
- keyed tables normalize without mutation/data loss; malformed/conflicting sources remain blocked;
- initial/repair aliases save in the canonical resource column;
- a full simulated 91-mark paper containing all three reported failure classes is repaired, saved and accepted by exam finalisation;
- a missing sibling graph is still rejected at finalisation;
- permanent malformed tables remain failed with no fabricated cells;
- four defective groups receive fair turns within the existing eight-call limit.

Tests do not certify a real Gemini response, scientific accuracy, screen/PDF quality or the user's external Gemini rating. A fresh live paper is still required after installation and deployment; refreshing a failed old draft does not regenerate it.

## Preview deployment and next check

Shared-import analysis for this patch requires eight Edge Functions: `upload-exam`, `save-exam-format`, `extract-exam-questions`, `publish-exam`, `generate-practice-questions`, `get-practice-questions`, `submit-exam`, `grade-practice-question`. Deploying `publish-exam` updates exam finalisation, not website publication. Recompute dependencies if newer remote changes alter them.

Verify the AQA 7402/1 saved profile remains untiered with the same short/full plan. Check existing GCSE profiles without modifying them. Do not generate a paid paper automatically. After verification, the owner can generate a fresh short Paper 1 and then a full Paper 1; only the full paper exercises the reported Q2(a)/Q5(d) positions.

If it fails, retain exam ID, saved course/component/mode/version, deployed function version, failing question numbers, table header/cell counts and repair phases. Separate transport success, acceptance, saving and final readiness. Do not share secrets, student personal data or unrestricted private answer keys.
