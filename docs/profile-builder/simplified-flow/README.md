# Simplified profile builder

The previous builder opened a global preset picker, eight identity text fields, tier/stage selectors and evidence controls together. Students now start with their subject and saved Settings/profile context, choose only missing assessment details, confirm one readable summary, then edit a preview before saving. The existing manual editor remains available.

Built on `main` at `13bb6517` (the guided editor and secure source-backed builder). This is a frontend change. No backend, migration, dependency, lockfile, course contract, approval record or source registry is changed.

## Resolution and safety

- The existing editor passes its selected course/paper/tier/mode and saved level, region and board. Existing protected built profiles reopen in their editable preview.
- Human course/paper options come from the existing deterministic course and paper registries. Edexcel Biology A/B and OCR A/B remain separate choices; a generic Biology name cannot select a variant.
- An exact recommended approved preset resolves its existing technical identity and version. Its actual deterministic plan previews immediately, with the existing gold badge. The existing authenticated server resolver still creates the owned proposal receipt. Editing and saving stay disabled until that receipt arrives; a failed receipt can be retried with the original request ID. The server approval, provenance and atomic persistence checks remain authoritative.
- Pending Pearson Biology B entries stay pending and do not gain a star. Choosing its course and paper automatically selects the existing reviewed Issue 4 source, including through the established Edexcel board alias.
- Unsupported courses need a syllabus/brief or explicit unverified general-practice consent. A new URL is not fetched from the open web and never triggers a model-knowledge fallback. Human course/assessment names and `Not verified` fill otherwise unknown identity fields honestly; no official code or cohort is invented. Uploaded evidence remains checksummed and server-validated. If assessment tiers are unknown, a plain question asks whether everyone sits the same assessment; separate tiers are an optional advanced setting. Missing or conflicting evidence still fails closed.
- Advanced details are initially collapsed: technical identity/version overrides and reviewed source choices before building, and technical read-only identity, sources and blueprint editing in the preview. Changing generation settings removes approval as before.
- No second answer store, marking pipeline, cache or mastery implementation is introduced. Saving uses the same secure builder API and frozen-context mechanism.

## Verification

Node 24.19.0 and the existing lockfile were used. `npm ci` passed. The baseline was **1,944 tests / 119 files**. The completed suite passes **1,958 tests / 120 files** with no failed tests; the focused builder suite passes **25 tests / 2 files**. `npm run check` includes typecheck, critical hook lint, all tests, 39 Edge Function bundles and the production build. Biology audit: 52 templates passed. Approval coverage audit: all 52 existing immutable records passed; fingerprints are unchanged. `git diff --check` passed.

Chromium exercised the real frontend components and real proposal/save-validation helpers using an external temporary harness, synthetic provider responses and browser-memory saves. There is no fixture route or authentication bypass in the shipped application. All backend requests were blocked; none were attempted. Approved H420/03 consumed zero synthetic model calls and zero quota reservations.

Checked at **390 × 844, 768 × 1000 and 1440 × 1000**, in light and dark themes:

- saved GCSE Physics level; board, paper and tier choices; technical fields hidden;
- complete OCR Paper 3 selection goes directly to confirmation; 70/90 full preset and editable gold-star preview;
- Change details before building, editing/removing approval/restoring it, and in-memory save/reopen;
- Edexcel A/B ambiguity rejected before a request; Biology B auto-resolves its reviewed source with no star;
- untiered controls, explicit unverified practice and a source-backed uploaded university draft without code entry;
- visible close/manual controls, no horizontal page overflow and footer actions inside each viewport;
- real Google Fonts loaded after the saved managed-proxy CA initialization; no JavaScript, console, request or certificate errors in the completed run. TLS verification stayed enabled.

See [browser-verification.json](browser-verification.json) and [screenshots](screenshots/).

Existing nonblocking warnings include deprecated packages, old Browserslist data, existing test DOM nesting, the synthetic PDF parser font warning, ambiguous Tailwind duration and large production chunks. They were not suppressed.

## Limits and rollout

No real account, database write, migration, deployment, publication or paid model call was performed. Real authenticated save/reopen and actual source-backed model quality remain unverified. Browser checks used emulation, not real iOS/iPadOS hardware. Passing tests do not certify source completeness or generated scientific quality.

This change requires **no new migration and no Edge Function deployment**. Existing secure-builder rollout prerequisites remain those in [the earlier rollout](../rollout.md); this task does not claim they have been applied. Keep the website unpublished. Review the draft PR and green checks, then use **Squash and merge** for this focused UX change.
