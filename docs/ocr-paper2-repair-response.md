# OCR Paper 2: Q8 repair-response failure

Prepared from fetched main `ec92ad231deaa3449a581773a9c26c5bdc2504dc` (Fixed automatic retry failure), preserving the merged H420/02 implementation and later Lovable changes.

## Evidence

The supplied error reports Q8 `missing_task`, followed by `invalid_response_shape (Expected a non-empty parts array.)` after five repair calls across the request. The complete live model response, Q8 stem/resource and deployed function revision were not supplied or read. This patch does not claim that the original provider returned a particular envelope, or that the original scientific content was valid.

The same final error is reproducible in the actual bundled extraction handler using an original synthetic H420/02 full-paper fixture: Q8 has a valid graph, four choices and a private key but only contextual text. A provider returns a complete, explicitly numbered task repair as a single JSON object rather than a `parts` array. The old parser discards it and fails after three attempts for this one group. An object-valued `parts` envelope fails identically. Transport success is distinct from repair acceptance.

The task-only prompt also says to return only `question_number`, `task` and `correct_answer`, without explaining that these are fields within the required array. For a group whose healthy sibling appears first, its example can use that sibling's number instead of the defective target.

## Fix

- Request one non-empty `parts` array consistently, even for one target. Make target-entry fields distinct from the outer envelope. Use the actual scored target in the task-only example.
- Losslessly wrap a single explicitly numbered repair, either directly or in the supported `parts`/`questions` envelopes. Existing direct arrays and array-valued envelopes remain supported.
- Never infer a missing number from target identity, array position, dictionary keys or arbitrary nested wrappers. Reject competing containers rather than dropping content.
- Describe invalid response shape and the expected envelope without printing response bodies or arbitrary field values. A truly empty or unrecognised response remains failed.
- Run every adapted response through the existing assessed-task, source-preservation, private-key, resource, syllabus and saved-plan gates before saving it. No source measurement, choice or required resource is invented.
- Preserve three attempts per group, eight total repairs, the shared 26-call/nine-minute ceiling, fair group scheduling, recent full-group escalation and full-stem task recovery, ownership filters and confirmed repair saves.

No course/plan definitions, contract fingerprints, migrations, dependencies, lockfiles, generated database types, quotas, saved records or marking policy are changed.

## Regression checks

`supabase/tests/question-repair-response.test.ts` exercises supported envelopes, explicit identity, private MCQ keys, context/source/choice preservation, unsupported/empty/ambiguous shapes, scope rejection, full-group sibling completeness and independent partial progress.

`supabase/tests/ocr-alevel-paper2-repair.test.ts` calls actual bundled handlers with simulated providers/databases. Q8 recovers in one repair, retains its graph and choices, completes all fifteen MCQs / 43 scored parts / 100 marks, and passes finalisation. Additional tests preserve full-group escalation and the recent full-stem fallback, refuse an omitted required graph, and stop genuinely empty responses at the original limit.

Verification on Node 24.19.0 passed: unchanged-lockfile `npm ci --cache /workspace/.npm-cache`; `npm run check` with **1,118 tests across 77 files, zero failures**, TypeScript, critical hook lint, Edge identifier checks, all 38 bundles and the production build; both Biology template audits (46 combinations, including full/short H420/02); and `git diff --check`. Thirty new regressions cover this repair failure. Existing non-blocking package deprecation, DOM-nesting, Browserslist, Tailwind and chunk-size warnings remain.

No test makes an external AI call or writes real database records.

## Rollout

Esbuild dependency metadata identifies only **`extract-exam-questions`** as requiring redeployment for this patch's shared-module change. Merge/redeploy must happen separately; this development task does neither. No migration or website publication is required.

A fresh owner-authorised generation after deployment must confirm actual provider behaviour, scientific quality, resources and cost. The original failed draft is not silently rewritten, regraded or retried by this patch. If the model genuinely returned no repair, the new diagnostic makes that visible; it does not turn an empty response into an answerable question. Automated tests do not establish an external Gemini rating.
