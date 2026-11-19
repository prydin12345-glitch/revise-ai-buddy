# Source identity and selected-paper evidence

This correction builds one selected assessment. Whole-document discovery still identifies all source papers locally, and the backend retains its owned parsed pages for follow-up. It does not generate all profiles in one model request or add paid calls.

## Reproduced failures

1. A controlled source reader returned `Paper 1` for the source-confirmed `9BS0/01`. The baseline compared the different strings as different assessments and scheduled a repair. The new regression failed before the fix, then reached confirmation and a complete draft using only one extraction and one draft call after the fix.
2. Actual public-PDF retrieval on baseline `1ad1faee7bdf2566fd5b44d252fe37f4f23287ca` excluded sibling codes but still included Theme 2 from the qualification overview and Paper 3 teaching prose on Paper 1's allocated theme pages. A page-number list could therefore look reasonable while the selected passages still mixed scopes.

The reported private build also had an unconfirmed source-service call. That message does not prove why the provider failed or whether a call was charged. No live backend receipt, private upload or provider logs were accessed here.

## Final behavior

- The server canonicalises only proven presentation aliases for the owned selected assessment. `Paper 1`, its uniquely sourced title and `9BS0/01` resolve to the same confirmed code. Unknown manual references, other papers/courses and unsupported titles are not promoted or silently corrected.
- Safe spelling/case and supported country/board aliases preserve the confirmed identity. Business/Business Studies is limited to the source-declared Edexcel A-level `9BS0` course, not a new curriculum, tier rule or approval grant. Genuine subject, qualification, tier, module and edition conflicts remain blocked.
- Qualification overview and contents bodies cannot establish paper topic facts. Selected assessment blocks are retained even on shared overview pages. Allocated theme headings remain available, while cross-paper theme prose is excluded. Explicit qualification-wide rules are preserved, including bounded shared calculator and command-word policies. Plain named assessment blocks (such as “Final assessment”) resume after an overview only with nearby instructions; teaching examples and denied shared applicability do not escape overview masking. Raw extracted pages remain untouched, and each supplied excerpt is a literal span of its physical page.
- The extraction payload names the confirmed assessment and source aliases. The prompt tells the reader that a sibling's presence is not an identity conflict; deterministic scoping and validation enforce the boundary.
- Identity failures report a controlled field such as paper, course code or specification edition. Rejected values and raw model output stay private. Actual source-version lines and trusted selected context remain useful where supported.
- A subsequent unconfirmed service call gets a separate `provider_outcome_unknown` attempt record instead of leaving only the earlier identity error visible. Status, repeated prepare and advance do not repeat that possibly charged call. The three-call cap, quotas, ownership checks and save contract are unchanged.
- The UI explains that page numbers refer to selected passages. Document index version 8 invalidates older evidence cache keys for fresh requests; existing profiles and failed receipts are not rewritten.

## Verification and reproduction

[Verification](verification.json), [baseline PDF scope](scope-baseline.json), [current PDF scope](scope-current.json), [browser results](browser-results.json) and [function dependencies](edge-function-dependencies.json) are recorded separately.

The public Pearson reference is 574,854 bytes / 68 physical pages with SHA-256 `8d66018d0a9d826cdb9729c78012d73f5e7ab32bd8946f9eb9fd501827c9829f`. The PDF, full raw text and generated browser artifacts stay outside the checkout. The additional scope fixture contains only four relevant public pages; it complements the earlier sparse identity fixture rather than reproducing the entire PDF.

```sh
node docs/profile-builder/business-source-evidence/verify-scope.mjs /tmp/edexcel-alevel-business-official.pdf
node docs/profile-builder/business-source-evidence/verify-scope.mjs /tmp/edexcel-alevel-business-official.pdf 1ad1faee7bdf2566fd5b44d252fe37f4f23287ca
node docs/profile-builder/business-source-evidence/dependency-graph.mjs
npm run check
DENO_TLS_CA_STORE=system DENO_DIR=/tmp/examly-business-deno-cache /tmp/examly-business-tools/node_modules/.bin/deno check --no-lock --config supabase/functions/profile-builder/deno.json supabase/functions/profile-builder/index.ts supabase/functions/extract-exam-questions/index.ts

# Reuse the installed Playwright package; keep fresh artifacts separate.
export PROFILE_BUILDER_BROWSER_ARTIFACT_DIR=/tmp/profile-builder-business-source-evidence
export PLAYWRIGHT_CORE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/site-packages/playwright/driver/package
node docs/profile-builder/business-recovery/browser/setup-fonts.cjs
node docs/profile-builder/business-recovery/browser/build.cjs
node docs/profile-builder/business-recovery/browser/browser.cjs
```

All six current full/focused retrievals remain complete and literal, retain marks/time, exclude sibling codes/names and qualification topic tables, and expose only the allocated theme headings: Paper 1 → 1/4; Paper 2 → 2/3; Paper 3 → 1/2/3/4. Paper 3 still retains its page-15 duration when focused on page 46.

The actual form/client/real bundled-handler regression now deliberately uses model-returned paper names and supported display labels for all three papers. Additional scope regressions cover shared policies, negative calculator policies, plain named assessments, literal CRLF spans and bounded qualification/topic boundaries. Other tests cover wrong papers, source-less manual code promotion, forged IDs, course/qualification/edition boundaries, private diagnostics, initial mismatch followed by service failure, and no charged-call replay. Providers and persistence are controlled test boundaries.

The browser harness is reused with fresh artifacts under `/tmp/profile-builder-business-source-evidence`, leaving earlier offline snapshots intact. Its failure scenario renders a paper-field error followed by an unconfirmed service attempt, using the real controlled diagnostic generator. Twelve laptop/iPad/phone light/dark cases check context, uploads, controls and bounds. Chromium emulation does not certify physical iOS/iPadOS behavior or complete accessibility coverage. No live AI build is claimed.

See [the Lovable deployment prompt](lovable-prompt.md). No deployment, merge, website publication, migration, student-data access or paid AI calls were performed.
