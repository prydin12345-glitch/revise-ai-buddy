This controlled harness exercises the production custom editor, parent payload mapper, actual profile hook and owned in-memory persistence. See [CONTRACT.md](./CONTRACT.md) for the exact boundary. Reports and images stay outside the checkout.

Run from the checkout root using installed dependencies, cached fonts, Chromium and Playwright Core:

```sh
node docs/profile-builder/custom-profile-editor/browser/build.cjs
node docs/profile-builder/custom-profile-editor/browser/verify-hashes.cjs
node docs/profile-builder/custom-profile-editor/browser/browser.cjs --diagnostic
node node_modules/vitest/vitest.mjs run src/test/custom-profile-editor-transfer.test.tsx
```

Diagnostics never establish acceptance. After the parent confirms all application and harness source is frozen, rebuild and run:

```sh
node docs/profile-builder/custom-profile-editor/browser/build.cjs
node docs/profile-builder/custom-profile-editor/browser/freeze.cjs --parent-source-freeze
node docs/profile-builder/custom-profile-editor/browser/browser.cjs
node docs/profile-builder/custom-profile-editor/browser/verify-hashes.cjs
```

`CUSTOM_PROFILE_ARTIFACT_DIR` may select a new child of `/tmp/profile-builder-custom-profile-editor`. `CUSTOM_PROFILE_BROWSER_CASE` selects names for diagnosis; a filtered run cannot replace the matrix. `--preflight` checks opening, geometry and captures Topics without saving. `--diagnostic` records source drift while continuing to collect evidence; acceptance rejects missing/stale freeze receipts and any drift. Every build invalidates the previous freeze receipt.

The matrix contains the requested 12 custom/guided cases plus 6 legacy cases: desktop 1440×1000, iPad 834×1194 and phone 390×844, each light/dark. It captures three tabs, checks containment after animations, keyboard focus, icon names/sizes, presentation-only browsing, exact saved-row preservation, failed save/retry, Discard and reopening. Custom cases also exercise library inclusion, display aliases, individual/bulk removal, keep-one protection and Undo retaining unrelated edits. Guided cases check topic/timing locks; legacy cases verify zero written questions and nulls. Transfer tests add raw arrays, layout edits with unknown metadata, alias metadata preservation, partial-create failure/retry and the synthetic owner guard.

`build-manifest.json` pins bundle inputs, Tailwind candidates, CSS imports, configs/lockfile, installed build/browser dependencies, browser/compiler executables, all local harness files, reused font manifest, cached fonts and generated outputs. Hash verification runs before/after the matrix. Only console errors caused by explicit injected failures are expected; other errors/requests fail. Human screenshot review is recorded separately in the output directory. Chromium emulation does not establish physical iOS/iPadOS, comprehensive assistive technology behavior or deployed database enforcement. The parent runs repository-wide checks and deployment dependency review.
