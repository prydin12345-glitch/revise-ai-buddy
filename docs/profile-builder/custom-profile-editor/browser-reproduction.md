# Reproduce the controlled browser checks

Run from the checkout root with the locked dependencies already installed. Use the installed Chromium and Playwright Core paths in `browser/browser.cjs`. `browser/build.cjs` verifies and copies cached fonts from `/tmp/profile-builder-style-cleanup/fonts`; it makes no network request and leaves the cached inputs unchanged. Outputs go to the separate `/tmp/profile-builder-custom-profile-editor` directory.

```sh
node docs/profile-builder/custom-profile-editor/browser/build.cjs
node docs/profile-builder/custom-profile-editor/browser/verify-hashes.cjs
node docs/profile-builder/custom-profile-editor/browser/freeze.cjs --parent-source-freeze
node docs/profile-builder/custom-profile-editor/browser/browser.cjs
node docs/profile-builder/custom-profile-editor/verify-close.cjs
node docs/profile-builder/custom-profile-editor/browser/verify-hashes.cjs
```

Freeze only after application and fixture edits are complete. The acceptance run requires the freeze receipt to match the build manifest. Changed input/output hashes fail acceptance. `--preflight` and `--diagnostic` collect diagnostic evidence but cannot establish acceptance.

The matrix contains 18 cases: desktop 1440×1000, iPad 834×1194 and phone 390×844; light/dark themes; rich custom, guided and legacy MCQ-only profiles. The actual production editor, shared parent payload mapper and save hook use a strict, owner-scoped in-memory client. Each case browses/searches/sorts without persistence, edits and saves a name, reopens the stored row, injects a failed save, retries, discards and checks the complete saved profile. Custom cases also exercise library selection, labels, bulk removal/keep-one and Undo. Guided cases retain their locks and versioned identity; legacy cases retain zero written questions and null timing/blueprint.

The separate close check uses the same frozen bundle at all three viewport sizes. It tests Escape/focus return from the child topic dialog, Keep editing after dirty Close, confirmed discard/close, release of the page's pointer lock, and reopening the unchanged saved profile with zero persistence calls.

`src/test/custom-profile-editor-transfer.test.tsx` additionally covers raw legacy topic arrays, unknown metadata on aliases and layout parts, partial-create retry, and an unrelated synthetic owner's sentinel row. `src/test/custom-profile-save.test.tsx` includes the real SubjectDetail callback, shared mapper and hook outcome checks. The full SubjectDetail page is not mounted in the browser harness; see `browser/CONTRACT.md` for the exact boundary.

No live account, student data, provider, source download or deployed database is used. Chromium touch/viewport emulation does not establish physical iOS/iPadOS or Safari compatibility. The checked-in results are condensed records; the full external report path and SHA-256 identify their original artifacts.
