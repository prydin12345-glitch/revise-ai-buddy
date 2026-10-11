# Source-backed Exam Profile Builder

The existing profile editor now offers **Build profile for me**. An exact approved course/component/tier/mode loads its existing contract without AI. Otherwise the user can select reviewed official evidence, upload a private course brief, or explicitly request unverified general practice. The proposal is editable and is saved into the existing `subject_exam_profiles` row only after confirmation. A saved generic template compiles into the plan actually used by exam generation.

This change is a complete code-level vertical slice, with a **pending database migration and backend deployment**. It is not enabled on a live database by this task. The website stays unpublished. Automated and controlled browser checks do not certify generated scientific content or a Gemini rating.

## Scope and preservation

- Audited main: `7bf44645ba38d9cef9d2d0f5910e27705c3a9568`.
- Implementation branch: `codex/source-backed-exam-profile-builder`.
- Preserved Edexcel branch: `codex/edexcel-alevel-biology-b-paper1`, commit `65388c2fb303a574db453b9ea0161e7c83649681`. This task does not merge, overwrite or approve it.
- Existing Biology plans, contract fingerprints, ownership/release protections, answer-storage tables, grading failure handling, generation batching and repair budgets are retained.
- No live login, profile save, migration, deployment, paid generation, merge or publication was performed.

## Profile lifecycle

1. **Request:** the browser supplies an explicit course identity, mode and evidence choice. Country/system, qualification, organisation, course/component, specification version and tier are separate. University courses also accept institution/module. There is no date-of-birth requirement or tier inference from a title.
2. **Resolve:** the authenticated backend first resolves an exact approved registry entry. A known subject name alone cannot choose OCR A/B, Edexcel A/B, a component or a tier. An explicit preset ID must match the complete identity and mode.
3. **Propose:** a catalogue match returns the real existing contract with no model/quota call. A registered-source or uploaded-document request produces a bounded AI draft. General practice requires explicit opt-in and cannot become an authentic full mock.
4. **Validate:** strict schemas bind identity, evidence locations/checksums, topics, formats, marks, duration, selection rules and compiler compatibility. Invalid provider JSON still records consumed usage. One draft repair is allowed within the overall budget.
5. **Preview/edit:** the real modal displays identity, origin, plan, topics, part formats/resources, evidence references and unresolved requirements. Editing recalculates validity and approval. Invalid totals or unsupported adapters block saving.
6. **Confirm/save:** the server loads the owned persisted proposal, ignores user approval claims, revalidates the edited template and writes existing profile fields plus a protected provenance envelope atomically. Repeated concurrent confirmation creates one profile.
7. **Reopen/duplicate:** the normal profile row and protected envelope are loaded across devices after rollout. Copies retain provenance but approval is recalculated. Duplicate receipts remain editable and idempotent. Cancel does not save a profile.
8. **Compile/generate:** existing approved profiles retain their original course adapter and gates. Other valid templates compile into exact planned parts. Existing parent-group batching, completion, repair and final publication checks consume this plan. Missing tasks, keys and resources still block readiness.
9. **Snapshot:** ownership is checked before resolving the profile. Existing server-written attempt protections freeze the plan, settings and evidence version. Later profile/source edits do not change a retry. Private extracted document spans, titles and upload references remain owner scoped; shared attempts contain only the necessary frozen facts/checksums.
10. **Mark/mastery:** existing submission and practice marking consume saved scope and private keys. Exam `topic_tag` and practice `subtopic` remain the existing analytics inputs. There is no second answer store or independent mastery calculation. Ordinary practice keeps the requested quiz count/format within the saved scope rather than generating a complete mock paper.

The existing course catalogue, `paper_blueprint`, profile editor, cards, context resolver, marking and resource validators were reused. Generic template metadata is stored in its own protected profile column rather than unrestricted additions to legacy blueprint sections.

## Gold stars and adoption

The gold star means **Examly-approved preset**. It is an explicit founder-controlled repository record, not exam-board endorsement, AI confidence, evidence retrieval, successful saving or an automated-test score.

`supabase/functions/_shared/preset-approval-records.ts` is the canonical durable ledger used by both frontend and backend. Entries bind immutable identity, specification/cohort, tier, mode, contract version, implementation, contract fingerprint and every generation-affecting profile setting. The existing contract fingerprints are not rewritten. The approval revision explicitly lists its approved version IDs.

The founder authorised one-time adoption in implementation request section 5. The audit contains 48 recommended approved versions, two superseded approved OCR versions and two pending Edexcel A Level entries. The [inventory](preset-inventory.md) includes all 52 records and 32 pending legacy layouts. Optional interactive/visual-policy variants need separate approval. Pending entries have no star.

Stars appear on exact paper/mode choices, builder review, profile cards/rows, editor and creation summary. Renaming preserves approval. Changed topics, duration, marks, tier, resource flags, blueprint or other generation settings remove active approval; a derivative displays **Customised from an Examly-approved preset** without a star. **Restore approved settings** is explicit. Older versions are labelled older, and a revoked version is blocked for new catalogue generation without rewriting history.

AI and source-backed drafts cannot become approved by copying a preset's fields or a client flag. Legacy profiles only match through exact generation settings and trustworthy canonical course identity; title resemblance is insufficient.

### Register a future approved version

1. Implement the course adapter and immutable contract version on a feature branch. Preserve earlier versions used by saved attempts.
2. Run its tests, existing fingerprint audits and external founder/subject review. Tests alone do not grant approval.
3. Obtain and record **explicit founder approval** for the exact immutable component/tier/mode/version. A Codex implementation or unfinished PR is not that approval.
4. Add the exact contract/settings fingerprints and a revision record listing the approved IDs. Do not regenerate unrelated baselines or overwrite an existing approved version to silence drift.
5. Run the coverage audit and inspect the gold-star behaviour. Merge through the normal review workflow only after approval and CI review.

Superseding or revoking is a deliberate registry change with a revision record. It does not silently update saved profiles or historical exams. User drafts are never registered automatically.

## Evidence and source architecture

The versioned source registry currently includes one real reviewed example: **Pearson Edexcel A Level Biology B, 9BI0/01**, Issue 4. This is source-backed coverage, not approval of unfinished Edexcel work.

- [Official specification, Issue 4](https://qualifications.pearson.com/content/dam/pdf/A%20Level/biology-b/2015/specification-and-sample-assessment-materials/9781446930892-gce2015-a-biob-spec.pdf).
- [Official June 2025 Paper 1 cover](https://qualifications.pearson.com/content/dam/pdf/A-Level/Biology/2015/Exam-materials/9bi0-01-que-20250606.pdf).

The documents were retrieved and checksummed on 11 October 2026. The registry stores concise manually reviewed fact locations, not whole papers or borrowed questions/images. Its 90 marks, 105 minutes, Topics 1–7 and calculator/compulsory rules are source claims. A selected parent-question arrangement is an Examly design choice. The qualification's minimum mathematical percentage and core-practical requirements are not falsely represented as fixed Paper 1 quotas. Sample-material retrieval exceeded the research size limit; no extra mandatory question count is inferred.

Evidence v1 includes document identity/type/version/cohort, checksum, retrieval date, active/superseded state, bounded page/section locations, literal references, mandatory versus observed claims, unknown facts and conflicts. Owner-upload references must resolve to real parsed page text. Model citations alone cannot create evidence. A checksum binds the saved evidence version; the server rejects altered or forged evidence/provenance.

**Runtime arbitrary URL retrieval is disabled.** The Deno runtime has no established DNS/socket pinning guarantee here. A URL must resolve an exact reviewed registered document; an unregistered URL offers upload or repository review rather than silently falling back to model memory.

The repository-only refresh helper uses exact HTTPS host rules, rejects credentials/ports/private and special-use addresses, validates every redirect/DNS resolution, pins the chosen public address into the TLS socket, limits redirects/bytes/time and checks PDF content types/signatures. `node scripts/check-profile-sources.mjs --refresh --source=pearson-9bi0-01-issue4` reports checksum changes only. It does not approve a new source, mutate a profile or update the registry. Review changed documents and deliberately register a new source version. Saved profiles offer a compare/update action; existing attempts retain their snapshot.

Uploads accept readable PDF or UTF-8 text up to 3 MB, 120 pages and 45,000 extracted characters. The pinned `unpdf@1.8.1` parser disables document evaluation, external font/worker fetches and system fonts, bounds extraction, and destroys its loading task. Scanned/encrypted/unreadable PDFs require a readable alternative; OCR and malware scanning are not claimed. The raw file is not uploaded to public storage. Concise extracted evidence is held in owner-scoped request/profile records. No user cookies/provider credentials are sent to document hosts, and embedded document instructions never acquire tool/approval authority.

## Executable plan and limits

V1 compiles compulsory sections/groups containing single-select MCQs, short answers and long-form responses with no resource, validated tables or graphs. Marks, duration, IDs, scope, MCQ requirements, attainable totals and part limits are checked. The existing database permits at most 50 scored parts.

Optional alternatives calculate **achievable** marks, including equal-mark alternatives, but unsupported optional selection/marking is blocked rather than flattened into compulsory questions. Generic reviewed diagrams, photographs, passages, essay-choice routes, cloze, matching, grids and multi-select conversions need explicit adapters before they can be generation-ready. Existing approved course adapters retain their supported resources and essay behaviour. No unrelated or invented image is substituted.

Evidence does not mechanically prove scientific correctness, curriculum fidelity or every national/institution-specific assessment rule. Specific unsupported or unresolved requirements remain visible. The initial source registry is deliberately small; it does not claim worldwide coverage.

## Authority, cost and reliability

- `profile-builder` verifies the bearer token using the existing Supabase authentication workflow; provider secrets stay server-side.
- The proposed trigger rejects authenticated inserts, overwrites and clears of `profile_template`, including forged server markers. Owner-authorised ordinary edits remain possible; a stale template/settings mismatch blocks generation until reviewed.
- Requests use persisted owner/request/payload hashes. Replays return completed results, reject changed inputs or refuse running/failed requests instead of silently making another paid call.
- A cheap request limit is 120 per user/day; paid builder proposals use the existing atomic AI reservation system with a 10/day, 3/burst feature limit and existing global settings.
- Reserve before transport; record the call intent before calling the provider. There are at most three model calls and a 120-second overall budget, with each transport capped at the remaining budget/45 seconds.
- Known token usage is recorded even if returned JSON is invalid. Transport failures record **unknown provider cost**; they are not claimed to be free. Reservations are not blindly released on a failed paid request. Product refunds would require a separate policy.
- UI cancellation closes/discards an unsaved proposal and ignores late responses; a provider call already running remains bounded and accounted for. It is not described as a guaranteed provider-side abort.
- All builder-derived practice profiles bypass global question/variation caches. Public registered evidence is a checksum/version-bound shared catalogue; private evidence never enters those caches.
- Logs contain safe error categories, not secrets or student records. Missing migration/provider configuration fails closed with an actionable message.

## Review and rollout

See [verification.md](verification.md) for actual results, [rollout.md](rollout.md) for the pending migration/deployment sequence, and [files.md](files.md) for the exact changed file inventory. Browser saves used memory, SQL guards were exercised in PGlite, and provider transports were controlled fixtures. Real backend round trips and paid model/scientific review are deliberately pending.

This implementation can be **Squash and merge after review and green CI**. Do not merge merely to bypass a failing check. Merging repository code is separate from applying the proposed migration, deploying preview functions or publishing the website.
