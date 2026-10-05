# Examly academic workspace design

This presentation-only change starts from `8f4113ed664484fd9b05064a547717a7113e6154` on `codex/academic-workspace-design`. The merged OCR Paper 2 work is preserved.

## Direction and scope

The existing public page used several decorative textures, oversized serif marketing headings and elevated feature cards. Authentication showed unsupported usage statistics and animated background blobs. Dashboard statistics depended on hover labels, class thumbnails competed with the content, and compact paper covers constrained long titles. Shared surfaces and controls used different borders, radii and accent treatments.

The revised interface uses warm neutral surfaces, a deeper Examly blue, clear borders and a consistent spacing and control scale. Manrope remains the interface font; Source Serif 4 remains available for assessment text. Subject colours and meaningful assessment status colours are retained. Decorative gradients, glow and lifting card effects are reduced. Public copy explains existing tasks and removes unsupported usage statistics and time promises.

Changed areas:

- Shared screen foundations in `src/styles/workspace.css`, imported by `src/index.css`; browser title and initial background colours in `index.html`.
- Shared buttons, cards, badges, inputs, textareas, selects, tabs, dialogs and page headings.
- Dashboard shell, role dashboards, class/activity panels, profile statistics, subject statistics and mobile navigation presentation.
- Exam library and paper covers: readable metadata, wrapping titles, wider covers and contained filter controls.
- Profile cards and profile settings: clearer section grouping, guided-mode selections, comfortable controls and a stable dialog footer.
- Assessment and review chrome: reading width, question-detail touch target, calmer surfaces, clearer feedback headings and accessible question-navigation labels.
- Tutor exam, class and feedback pages and their shared cards.
- Public landing and authentication presentation.

No hooks, effects, callbacks, state, routing destinations, API requests, backend functions, dependencies, lockfiles, data models, migrations, assessment content or answer-release conditions were changed. PDF implementation files and printed-paper layouts were left untouched. The theme bootstrap retains its original logic; only its background colour literals changed. Screen palette overrides are inside `@media screen`.

## Validation

| Check | Result |
| --- | --- |
| Node / install | Node 24.19.0; `npm ci --cache /workspace/.npm-cache` passed with the existing lockfile |
| `npm run check` | Passed: TypeScript, critical hook lint, 1,190 tests in 82 files, Edge identifiers, 38 Edge Function bundles and production build |
| Final UI type-check, critical lint and build | Passed after the visual refinements |
| `node scripts/audit-biology.mjs` | Passed, 48 template combinations |
| `node scripts/audit-ocr-alevel-paper2.mjs` | Passed, four contract-version/mode combinations |
| `git diff --check` | Passed |
| Screen colour contrast | Core text, secondary text, primary controls, input boundaries and status text passed their 4.5:1 text / 3:1 boundary thresholds in both themes |
| Behaviour-expression review | All 42 changed TypeScript files retained their original non-presentational expressions; handler bindings and rendering conditions were reviewed against the baseline |
| Full `npm run lint` | Existing failure: 1,970 errors and 134 warnings; no new lint findings in the changed TypeScript files |

The first full-lint error is `scripts/edge-runtime-globals.d.ts:5:37`: `Unexpected any. Specify a different type` (`@typescript-eslint/no-explicit-any`). Comparing changed files with the baseline gives 132 errors before and after, with zero new findings. No lint rules or checks were suppressed to make this pass.

Existing non-blocking output includes transitive package deprecations, stale Browserslist data, test DOM-nesting warnings and large production chunks. The ambiguous mobile animation-duration class was replaced with an existing Tailwind duration utility as part of the styling work.

## Browser review

Chromium used normal certificate verification and the environment's existing managed-proxy trust. Public landing and sign-in pages were checked at 1,440, 390 and 320 pixels, in light and dark themes. Google Fonts requests returned HTTP 200 and keyboard focus was visibly outlined.

Authenticated screens were rendered from the actual repository components in a temporary offline harness outside the checkout. Its synthetic backend responses cannot access an account or real records; live Supabase requests were blocked. Screenshots covered dashboard, exam library, exam setup, profile settings, exam-taking, review, tutor classes, tutor exams and tutor feedback at 1,440 and 390 pixels. Additional cases covered empty and loading dashboard/library views, failed review loading, hidden scores and populated tutor feedback. Representative dashboard, library, profile, assessment, review and tutor screens were also checked in dark mode.

The final reviewed cases had no page or console errors and no horizontal document overflow. Profile controls were exercised only in the offline harness, including applying the Full mock settings. No profile was saved to a backend, no form was submitted to a real account, and no exam or paid AI request was generated.

## Remaining limits

- Live account data, billing and backend-dependent success/failure paths still need account-based acceptance testing.
- Specialist drawing, graph, keypad and every resource-specific layout were not individually rechecked visually; their existing automated tests passed.
- Existing full-lint debt remains a separate technical task.
- Existing social-preview image assets were retained; no new promotional imagery was invented.
- No deployment, publication, migration or backend-function change is included. Keep any pull request as a draft. Use **Squash and merge** when approved, to keep this coherent visual change together in the base-branch history.
