# Offline Business recovery viewport check

This harness renders the actual builder, attachment storage and local discovery with production CSS and pinned fonts. The injected API is synthetic; a build-only plugin retains a controlled obsolete local warning to verify its removal after canonical server confirmation. All browser requests outside local fixture assets are blocked. Real client/handler and controlled backend build flows are tested separately by Vitest.

Prerequisites: installed locked application dependencies, Python 3, Chromium and Playwright Core. Reuse an installed compatible browser/tool. For this run, Playwright Core 1.57.0 was installed in `/tmp/examly-business-tools` and system Chromium was used. No application package versions were changed for browser tooling.

```sh
export PLAYWRIGHT_CORE_PATH=/tmp/examly-business-tools/node_modules/playwright-core
export CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
# Optional: PROFILE_BUILDER_BROWSER_ARTIFACT_DIR and PROFILE_BUILDER_FONT_DIR
node docs/profile-builder/business-recovery/browser/setup-fonts.cjs
node docs/profile-builder/business-recovery/browser/build.cjs
node docs/profile-builder/business-recovery/browser/browser.cjs
python3 docs/profile-builder/business-recovery/browser/verify-hashes.py
```

The wrapper reuses the existing assessment-identity harness, including licensed pinned font setup and source/output hash checks. Generated bundles, fonts, screenshots and full hash maps remain outside the checkout, by default `/tmp/profile-builder-business-recovery`. There is no production fixture route or authentication bypass.

The run covers laptop 1440×1000, iPad 834×1194 and phone 390×844, in light and dark themes, with successful confirmation and controlled failure scenarios: 12 cases total. It checks three source options, correct component code, default course intake, unknown tier, upload payload and retention, obsolete-warning removal, trusted error context and horizontal bounds. Chromium viewport emulation does not certify physical iOS/iPadOS behavior or complete accessibility coverage. These synthetic UI scenarios do not establish the accuracy of a real model or the contents of a private upload.

Selected reviewed screenshots and the summarized runner report are in `results/`. The runner's full report in the external artifact directory includes before/after hash verification.
