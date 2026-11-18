# Uploaded Business paper selection follow-up

Selecting a paper now fills the parent course code when the uploaded source declares it. For the public Edexcel A-level Business specification, choosing any of the three papers fills `9BS0` while retaining its individual `9BS0/01`, `/02` or `/03` code. Explicit course constraints and manually confirmed component references are preserved. A manual reference alone cannot establish a source course.

The selectable “Choose an assessment from your syllabus” placeholder is disabled. Keyboard navigation skips it, and an empty selection event cannot discard the current paper. Other optional fields, including an unknown tier, keep their normal behavior.

## Why the selection could fail

Version 3 coded-paper IDs included the requested course, subject and board labels. The same uploaded paper therefore received different IDs for a blank/default course versus `9BS0`, or for Business versus Business Studies. IDs also depended on extracted edition typography despite already containing the PDF checksum. A valid code could consequently accompany an ID that the server could not reproduce.

Version 4 identifies coded papers by their source checksums, code, kind, actual source qualification and any genuine conflicting label. The source checksum pins the document edition; source/edition/qualification conflicts remain unresolved. Uncoded assessments retain their existing scoped identity. The backend still re-discovers the paper in the owner's uploaded bytes and rejects forged IDs, mismatched codes, wrong courses/qualifications and conflicting sources. No fallback accepts an unverified selection.

Course autofill requires both an independently discovered component code and a literal parent-code declaration in a course heading in the same source. It does not guess a course from a manually typed slash-code. The course recheck triggered by autofill retains the selected paper's stable ID.

## Verification

[Results](verification.json), [public PDF retrieval](public-reference.json) and [viewport results](browser-results.json) record this follow-up. The public PDF remains outside the repository; it is not the user's private upload.

`src/test/profile-builder-source-selection.test.tsx` exercises the actual React form, attachment storage, unmocked local source inspection, production client wrapper, real bundled handler and owner-scoped in-memory RPC. All three papers autofill/reinspect/prepare/read through confirmation. Controlled provider outputs use synthetic assessment facts; no live AI or database is used. It also checks a disabled/empty placeholder cannot reset the choice, uploads survive, explicit course constraints are not overwritten and unknown tier remains unknown. Node/jsdom use the encoder's native byte-array realm at the test boundary so esbuild/WebCrypto can run alongside the actual DOM.

Public source regressions compare coded IDs across blank/default/explicit course values and subject/board labels, verify literal parent-course references, and retain source/course/qualification/edition and forged-ID negative controls.

The reused browser runner adds actual course-autofill, stable selection, native disabled-option and keyboard checks to its 12 laptop/iPad/phone light/dark confirmation/failure cases. Run with fresh artifacts to leave the earlier offline snapshot intact:

```sh
export PROFILE_BUILDER_BROWSER_ARTIFACT_DIR=/tmp/profile-builder-business-selection
export PLAYWRIGHT_CORE_PATH=/path/to/prepared/playwright-core
node docs/profile-builder/business-recovery/browser/setup-fonts.cjs
node docs/profile-builder/business-recovery/browser/build.cjs
node docs/profile-builder/business-recovery/browser/browser.cjs
python3 docs/profile-builder/business-recovery/browser/verify-hashes.py
```

Chromium viewport emulation does not certify physical iOS/iPadOS behavior. No live deployed backend revision or paid build was checked. Package manifests, lockfiles and `.env` were not changed.

## Deployment handoff

The [actual import graph](edge-function-dependencies.json), generated against `23d9350e17f9ec48873857ca26265b9c6aadb101`, checks all 39 Edge entry points and identifies **only `profile-builder`** for this incremental change. Reproduce it with `node docs/profile-builder/business-selection/dependency-graph.mjs`.

After review, release the matching `profile-builder` function and frontend from the same approved revision. Include the function's shared imports and existing `deno.json` import map. Verify the deployed revision before enabling fresh builds. The frontend must not send version 4 IDs to an older version 3 backend. Refresh/reopen the builder to discover a fresh selection after release; if a browser reload cleared in-memory files, attach them again. Existing saved profiles need no changes or migration.

This incremental graph does not certify that the earlier PR #58 backend rollout happened; its broader handoff still applies if that earlier backend code was never released. No deployment, merge, website publication, student-data access or paid AI calls were performed by this task.
