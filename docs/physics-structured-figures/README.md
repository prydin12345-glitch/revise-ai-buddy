# Physics generation: structured figures and numerical integrity

Baseline: `82cfc84b032c634c164799e18657a60c2b13d45f`, reviewed 9 November 2026. This preserves the merged Profile Builder edition fix and Lovable's newer Physics corrections and notation work. No existing exam, profile, answer, grade or approved contract is rewritten.

## What was missing

Physics setup drawings existed, but assessment pages generally invoked text detectors that guessed their configuration. Generic profile validation also rejected those resources, so merely asking the model for a pulley would not make the complete generation/publication path accept it. Practice generation had additional legacy rewriting that could remove figures or replace keys. Some saved renderers hid setups during exams, and structured response/PDF paths could skip them.

The existing private-key check detected a narrow class of contradictory final values. It did not independently evaluate submitted numerical working. Whole-paper repetition checks caught exact tasks and some recall, but missed several written/MCQ paraphrases. Ordinary Physics MCQs also needed to recognize the new private answer envelope during marking.

## Generation and release contract

New server-resolved Physics attempts freeze `physics_generation_version: 1`. Historical attempts retain their original policy and legacy detector fallback. The practice cache has a separate versioned namespace; old cache rows cannot supply an unchecked new paper. Existing authentication, ownership, quotas, attempt snapshots and provider-call/repair budgets remain authoritative.

Each new scored part supplies a `diagram_config` with `physics_figure_version: 1` and `diagram_intent`. A setup uses the exact renderer configuration; a supplied graph/table uses `graph`; `none` and `student_draws` use a small `physics_no_figure` sentinel. The server does not invent a configuration from missing model output. A required setup without a usable configuration enters the existing bounded repair flow, then blocks release if unresolved.

Strict shared schemas cover the existing 21 mechanics/Physics/circuit type families. Only faithful assessment variants are accepted: unsupported eye/mirror models, several wave/field placeholders and unsupported nuclear scenes are rejected rather than replaced by a generic illustration. Horizontal-table pulleys, horizontal free-body scenes and vertical spring scenes retain their existing renderer limits. The prompt lists the supported variants.

Visible numerical labels must match stated physical quantities with compatible units. Schematic positions and SVG coordinates are not treated as experimental data. Declared unknowns cannot carry numerical solutions, even in fields the renderer does not label. Public resources reject nested private keys, working, numerical verification ASTs and hidden expected plots. Circuits remain limited to topology-dependent tasks; graphs and tables keep their existing consistency checks.

Screen, review, practice, structured-response and PDF paths share the saved figure resolver. Saved figures take precedence; malformed new figures produce a controlled error rather than keyword-based invention. Assessment rendering suppresses derived images, daughter nuclei and resultants when they would reveal the task's answer. Standing-wave geometry now follows the requested harmonic, and figure labels/fills remain readable inside their SVG viewports.

## Numerical checks and marking

Numerical tasks provide a private `correct_answer` JSON envelope containing the answer, working, marking scheme and `calculation_checks`. This uses the existing protected answer column; checks never belong in public diagrams. Plain answer extraction, MCQ matching and student feedback omit the AST metadata. Both marking handlers use the existing deterministic single-choice scorer for new Physics MCQs.

The numerical verifier evaluates bounded expression trees without `eval` or model-supplied code. It checks SI dimensions and prefixes, source quantities, supported constants, derived rounding tolerances, final-answer links and explicit numerical substitutions. Supported operations include arithmetic, powers, roots, trigonometry, exponentials and logarithms with real-domain and size limits. Qualitative evaluation and unit-expression questions do not require fictitious arithmetic checks.

Inputs must come from quoted stem quantities, a bounded constants registry, or precise public table cells/line-chart coordinates with explicit units. Private expected graphs, schematic coordinates and invented observations cannot supply inputs. Verified resource aliases are rebound to the canonical persisted column; nonexistent or changed sources remain invalid. Generation, repair, postprocessing and publication all retain the same checks.

These checks prove supported arithmetic and dimensional consistency, not the physical correctness of every chosen formula or interpretation. Unsupported computations require repair and may exhaust the unchanged request budget. No arbitrary prose calculation is silently declared verified.

## Whole-paper planning

A generation sidecar records exact topic marks and cognitive demands from the saved paper layout. Explicit validated official per-paper percentages are identified when available; otherwise balancing is clearly advisory. It does not invent official weightings or change approved fingerprints, topic allocations or mark totals.

Applicable practical requirements can designate an existing written parent of at least six marks for an investigation with reasoning/evaluation. Explicit bans and unknown applicability remain in force. A layout without a suitable parent cannot silently gain marks or claim an official named required practical. The private profile retains full source references; shared attempt summaries omit private upload identifiers.

The covered-concept ledger spans all generated batches and both written/MCQ sections. Deterministic canonical patterns additionally catch recognizable paraphrases of laws/definitions/assumptions, moderator roles and identical capacitor data/tasks, while allowing distinct applications. This is a conservative detector, not a universal semantic-equivalence oracle. Content-demand defects are repairable without relaxing structural layout checks.

An examiner self-check is requested within existing generation/repair responses. This change does not add a separate paid examiner call or claim a scientific 10/10 certification. Independent review of a newly generated paper is still needed to assess its scientific quality.

## Verification and activation

The [verification record](verification.json) and [browser/PDF evidence](browser/README.md) record the completed offline checks, source fingerprints, real handler simulations and practical limitations. `npm run check` passes **3,274 tests in 201 files**, TypeScript, critical lint, all **39 Edge Function** checks and the production build. The browser passes **80 saved-figure renders and 58 scenario groups across eight viewport/theme cases**; both PDFs pass figure, Unicode/font and private-key checks. All **3,342 source/style/dependency fingerprints** match the final run. The baseline passed 3,069 tests in 190 files. Both Biology/approval audits remain byte-for-byte identical to that baseline, with 52 entries and the same pending legacy layouts.

No paid model call, real sign-in, live-data write, migration, deployment, merge or publication is performed here. Tests use original synthetic questions and controlled providers. The original private exams and real future model responses were not used to certify quality.

After review, the [deployment handoff](deployment.md) identifies the exact backend dependency set and matching preview client. Keep the website unpublished. Start a fresh attempt after activation; historical exams are not upgraded in place.
