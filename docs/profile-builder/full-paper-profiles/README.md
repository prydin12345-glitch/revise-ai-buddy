# Full paper profiles and independent quizzes

New Profile Builder flows now default to `full_mock`, with no Full mock/Short practice/Custom chooser. The helper explains that quiz topics and length are chosen later. Syllabus-free general practice is not offered for this full-paper flow. Approved presets are filtered to the compatible mode. The enclosing profile modal passes the full default for new profiles, while existing saved short/custom modes and explicit legacy callers remain supported. Existing profiles are not converted or rewritten.

The reported tier message came from missing reviewed metadata for Business `9BS0`, not evidence that it had Foundation/Higher variants. The exact UK Pearson Edexcel A-level Business record now includes its three named papers and an explicit `not_tiered` course fact. It accepts the Business/Business Studies presentation aliases and deterministic Edexcel board alias, with country, stage, qualification and course-code boundaries. It grants neither a course adapter nor Examly approval. Tier provenance remains `assessment_catalogue`; no uploaded PDF is credited with an invented untiered sentence.

Ofqual states: “In line with current practice, all reformed AS and A levels will be untiered.” This was read from the [published assessment arrangements](https://www.gov.uk/government/news/publication-of-gcse-and-a-level-assessment-arrangements-for-2017) and corroborated by its [other consultation outcomes](https://www.gov.uk/government/news/further-consultation-outcomes-in-gcse-as-and-a-level-subjects). The [current qualification register](https://find-a-qualification.services.ofqual.gov.uk/qualifications/60146734) identifies Pearson's GCE A Level Business, QN `601/4673/4`; the public Pearson specification links that qualification to `9BS0`. Only the reviewed Business course record was added. There is no qualification-name-only blanket inference for unknown courses, AS, GCSE, International A-levels or universities. Concrete Foundation/Higher, edition and source-identity conflicts remain blocked.

A new full-paper request whose tier genuinely remains unknown now asks for matching source information and keeps its full-paper intent. It does not offer a forced short-practice conversion. The existing answer protocol still supports an explicitly selected practice alternative on old pending questions; new full-paper requests no longer generate that question.

Quizzes use their own requested count, format and topics while retaining the profile's identity and evidence. A saved source topic is available for a quiz even if it has no question in the full paper's draft layout. Exact saved-topic toggles narrow the allowed quiz topics, and a deselected topic cannot be saved into that filtered quiz. Free-text child topics remain subject to the saved parent scope; no semantic parent mapping or new curriculum fact is inferred. Neither path changes the saved full profile or copies private evidence into a shared cache.

## Verification

[Verification](verification.json), [public-reference results](public-reference-results.json), [reviewed source captures](reviewed-sources.json), [browser results](browser-results.json) and the [actual import graph](edge-function-dependencies.json) record the run.

- `npm run check` passed: 215 files / 3,674 tests, frontend and Physics types, critical lint, all 39 Edge bundles and production build (21.10 seconds).
- Deno 2.5.6 checked all ten affected entrypoints. Their existing import maps are identical and were retained.
- The actual form/client/bundled-handler tests bind all three Business component codes to their owned uploads in full mode. A full Business profile confirms, drafts and saves without a tier downgrade or invented PDF quote. The captured official Paper 3 full-mode follow-up preserves its page-15 duration.
- Both real quiz entrypoints were tested with a 100-mark/120-minute full profile and a two-question subset quiz, using controlled providers and persistence. The profile stays unchanged. New unplanned-topic/deselected-topic regressions failed before the fix and pass after it.
- Fresh public-reference checks verified the exact captured HTML/PDF bytes, official tier wording, register identity and three clean papers with literal, bounded evidence, no sibling leakage, 100 marks and 120 minutes. The reference PDF is outside the repository and is not a private upload.
- Twenty-four laptop/iPad/phone light/dark browser cases passed all three Business papers and an unreviewed course. No mode chooser, unwanted practice downgrade, horizontal overflow, browser error or unexpected request occurred. Application/server/config/fixture/dependency/font/output hashes match before and after the run. The API is controlled; Chromium emulation does not certify physical iOS/iPadOS or complete accessibility coverage.

```sh
npm ls --depth=0 --cache /tmp/examly-business-npm-cache
npm run check
node docs/profile-builder/full-paper-profiles/dependency-graph.mjs
node docs/profile-builder/full-paper-profiles/verify-sources.mjs /tmp/edexcel-alevel-business-official.pdf /tmp/ofqual-2017.html /tmp/ofqual-qualification.out
export PROFILE_BUILDER_BROWSER_ARTIFACT_DIR=/tmp/profile-builder-full-paper-profiles
export PLAYWRIGHT_CORE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/site-packages/playwright/driver/package
node docs/profile-builder/full-paper-profiles/browser/setup-fonts.cjs
node docs/profile-builder/full-paper-profiles/browser/build.cjs
node docs/profile-builder/full-paper-profiles/browser/browser.cjs
```

The source-verification script requires the reviewed public captures, whose URLs/hashes are recorded. If a publisher changes an HTML page, review its new contents before updating a capture; do not bypass the hash check. Generated artifacts and reference files stay outside the checkout, with earlier offline snapshots untouched. Package versions, lockfiles and `.env` are unchanged. Existing build warnings remain recorded without dependency changes.

No paid AI generation, private-upload inspection, student-data access, production profile write, migration, merge, deployment or website publication occurred. See the [Lovable handoff](lovable-prompt.md). The import graph identifies ten affected functions, including downstream users of the reviewed metadata; this handoff is broader than the earlier two-function page-recovery change.
