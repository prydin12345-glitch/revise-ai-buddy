This offline harness opens the actual `ExamProfileBuilder` with a synthetic saved server context. It exercises the production `ProfileTopicList`, topic editor, `applyTopicEdit`, evidence validation, fingerprinting and `prepareProfileSave`. The injected API accepts only a synthetic save with the original profile/proposal receipt; it derives the saved context from the original owned proposal. Browser localStorage simulates persistence for these synthetic fixtures only. This establishes builder behavior, not live database persistence or extraction quality.

All files owned by this harness live in this directory. It reuses the assessment-identity build/runtime/hash helpers and pinned font manifest. It never edits application files or older artifact directories. Its default output directory is `/tmp/profile-builder-detailed-topics`; generated bundles, manifests, JSON reports and screenshots stay outside the checkout.

Use the repository's installed dependencies and Node engine (`>=22 <25`), Python 3, an installed Chromium and Playwright Core. No dependency installation or download is performed. From the checkout root:

```sh
export PROFILE_BUILDER_BROWSER_ARTIFACT_DIR=/tmp/profile-builder-detailed-topics
export PROFILE_BUILDER_CACHED_FONT_DIR=/tmp/profile-builder-full-paper-profiles/fonts
export CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
export PLAYWRIGHT_CORE_PATH=/opt/codex/runtimes/cua/lib/node_modules/playwright-core
node docs/profile-builder/detailed-topics/browser/setup-fonts.cjs
node docs/profile-builder/detailed-topics/browser/build.cjs
python3 docs/profile-builder/detailed-topics/browser/verify-hashes.py
node docs/profile-builder/detailed-topics/browser/browser.cjs
python3 docs/profile-builder/detailed-topics/browser/verify-hashes.py
```

`PLAYWRIGHT_CORE_PATH` can select another installed package, including `/tmp/examly-business-tools/node_modules/playwright-core` when present. The runner tries that path and the installed Cloud runtime path if the variable is unset. `PROFILE_BUILDER_REPO_ROOT`, `PROFILE_BUILDER_FONT_DIR` and `PYTHON_EXECUTABLE` retain their shared-helper meanings. Font setup verifies the existing cache, copies the six pinned fonts/CSS/license files into the new artifact directory and verifies the copy. `setup-fonts.cjs --verify` performs no copy. Missing or changed cached assets fail; this wrapper never calls the shared download routine.

The runner fulfills only its exact HTML, JavaScript, CSS and font routes at a virtual loopback origin. Every other HTTP request and every WebSocket is blocked and recorded; any attempt fails the run. The bundle replaces Supabase with the shared offline guard, and the injected API rejects actions other than synthetic save. No student data, account, external source, backend, provider or paid request is used.

The matrix has 12 cases: desktop 1440×1000, iPad 834×1194 and phone 390×844, each in light/dark, each with detailed and legacy fixtures. Tablet and phone contexts enable touch/mobile emulation. The detailed fixture has three exact numbered leaves under two themes, nested subgroups and four literal excerpts on physical PDF pages 14, 15, 16 and 27. Both fixtures use synthetic owner-supplied source evidence with a checksum-bound fingerprint; `prepareProfileSave` creates their initial editable server contexts before the builder opens.

The detailed cases verify keyboard/pointer group and source expansion; exact source prose, document title and physical page; searches by leaf, group, source outcome and document; no matches and clearing; no API calls from read-only interactions; profile name/time/topic edits; switching a changed source scope from full mock to custom; added-topic labels without borrowed provenance; removed-topic exclusion; exact retained leaf identities and part IDs; unchanged owned evidence/fingerprint; one save with the original receipt; and saved values/source details after both reopening and reloading.

Legacy cases verify the flat labels and missing-detail hint, filtering without fabricated outcomes, the safe re-read confirmation, Escape cancellation, and proceeding to source choices without an API call or saved-profile change. Reopening still displays the original saved flat profile. Layout checks cover viewport/dialog containment, horizontal overflow, visible source/editor content and 44px topic-summary targets. Measurements wait for the real dialog opening animation to finish, and native closed-details descendants are excluded from visible layout measurements.

`browser-results.json` records each case, assertions, layout measurements, screenshot hashes, runtime versions, browser errors, blocked requests, and strict before/after hash reports. Failed cases produce screenshots and the runner continues the matrix. Frozen checks cover application/configuration/lock inputs, all server TS/JSON/JSONC and configuration, bundled installed dependencies, all six local fixture files and reused helpers, fonts and generated bundle/styles. Concurrent source changes invalidate a diagnostic run; rebuild after the application is frozen for final evidence. Font preparation, build and browser verification all remain offline.

Screenshots require visual review in addition to automated checks. Chromium viewport/touch emulation does not establish physical iOS/iPadOS behavior or complete assistive-technology coverage. Source ingestion, deterministic expansion, security boundaries and database persistence need their separate application/server checks.
