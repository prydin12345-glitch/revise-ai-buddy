# Assessment choices: official source review

Access date: **6 November 2026**. This change adds assessment **identity and display metadata**, not approved presets, an AI evidence pack, a paper contract or a qualification adapter. Existing approved Biology records/fingerprints and reviewed GCSE source packs are unchanged. No official questions, mark schemes, diagrams or datasets are copied into the application.

## Current official AQA specifications

Official qualification pages were used to locate the current PDFs. The PDFs include AS as well as A-level; only the explicitly identified A-level assessments below are registered. AS 7407/7404 and GCSE Physics/Chemistry 8463/8462 remain different qualifications.

| Course | Qualification page | Current specification PDF | Issue | Physical overview pages | Pages / bytes / SHA-256 |
| --- | --- | --- | --- | --- | --- |
| AQA A-level Physics 7408 | [Official specification page](https://www.aqa.org.uk/subjects/physics/a-level/physics-7408/specification) | [Official PDF](https://cdn.sanity.io/files/p28bar15/green/85944e7114a6a88e8a769b108949133ce30d3cba.pdf) | Version 1.4 July 2026 | 8 (options), 9–10 (A-level assessment) | 94 pages; 1,574,072 bytes; `c39f3a9e4b2fe06ed1160884334c3a6670e814ef23fb03dec8cd1707f2d5c907` |
| AQA A-level Chemistry 7405 | [Official specification page](https://www.aqa.org.uk/subjects/chemistry/a-level/chemistry-7405/specification) | [Official PDF](https://cdn.sanity.io/files/p28bar15/green/973606f23930d71231deed8180ee15c17d464b92.pdf) | Version 1.2 July 2026 | 10–11 (A-level assessment) | 96 pages; 1,374,050 bytes; `7b62a52889214554ced73f6ebb4b23757bd66e3ada2d7103654bbb18a897a6f1` |

The technical version IDs used by Examly's metadata are `v1.4-july-2026` and `v1.2-july-2026`. The sources were fetched through the configured managed proxy with TLS verification. Full downloaded documents and extracted text remain in the temporary research workspace, not in this repository. Checksums bind the exact PDF bytes reviewed.

## Assessment identities and naming

Physics lists **Paper 1**, **Paper 2** and **Paper 3**. A-level Paper 1 covers sections 1–5 and 6.1; Paper 2 covers 6.2, 7 and 8 with assumed earlier knowledge. Paper 3 has a compulsory practical/data section A and one selected option in section B. The UI asks for that option instead of guessing: Astrophysics, Medical physics, Engineering physics, Turning points in physics or Electronics. That choice is preserved in the existing `TemplateIdentity.module` field.

`7408/3` is Examly's internal **whole Paper 3 family identity**, not a claim that one printed question booklet carries that code alone. The actual section documents are `7408/3A` plus the selected section B code `7408/3BA`–`7408/3BE`. The metadata does not turn the existing generic builder into a reviewed optional-routing/marking adapter; existing unsupported-format and optional-selection gates remain authoritative.

Chemistry's current assessment-resource titles name **Paper 1 — Inorganic and physical chemistry**, **Paper 2 — Organic and physical chemistry** and **Paper 3**. They correspond to 7405/1, 7405/2 and 7405/3. Their specification overview must not be confused with the AS papers immediately before it.

The official assessment resource pages are [Physics](https://www.aqa.org.uk/subjects/physics/a-level/physics-7408/assessment-resources) and [Chemistry](https://www.aqa.org.uk/subjects/chemistry/a-level/chemistry-7405/assessment-resources). Their public June 2025 resource records (publication 10 July 2026) provide the following document identifiers and titles:

| Record | Official PDF |
| --- | --- |
| 7408/1, Paper 1 | [Question paper](https://cdn.sanity.io/files/p28bar15/green/c2d052b11c09b8b207fdcb98da24ae0e81515b46.pdf) |
| 7408/2, Paper 2 | [Question paper](https://cdn.sanity.io/files/p28bar15/green/1c8e44133f577fe928eee7acf56fb667cecd11e1.pdf) |
| 7408/3A, Paper 3 Section A | [Question paper](https://cdn.sanity.io/files/p28bar15/green/7a646ed313e2e75c3292dc0173b4941e2f663b69.pdf) |
| 7408/3BA, Section B Option A Astrophysics | [Question paper](https://cdn.sanity.io/files/p28bar15/green/8205535ecf55174ea0683d9f31c0b46935fd33d8.pdf) |
| 7408/3BB, Section B Option B Medical physics | [Question paper](https://cdn.sanity.io/files/p28bar15/green/cf09abe05741a8aaaff9e460f88cfebaaea25833.pdf) |
| 7408/3BC, Section B Option C Engineering physics | [Question paper](https://cdn.sanity.io/files/p28bar15/green/afa82345b93d1e768896e3b273c460a09fb51658.pdf) |
| 7408/3BD, Section B Option D Turning points in physics | [Question paper](https://cdn.sanity.io/files/p28bar15/green/e948c2c60d2bf21a0c33e06f280db45c115ae662.pdf) |
| 7408/3BE, Section B Option E Electronics | [Question paper](https://cdn.sanity.io/files/p28bar15/green/3a4d245a92ef458e2e36b1ade2dd53af8b2ce1f0.pdf) |
| 7405/1, Inorganic and physical chemistry | [Question paper](https://cdn.sanity.io/files/p28bar15/green/159bec124960fd0eb7f69851b9e17546c1c05c28.pdf) |
| 7405/2, Organic and physical chemistry | [Question paper](https://cdn.sanity.io/files/p28bar15/green/e81cd3f333e25fed0111675678d63e8d3efd22b2.pdf) |
| 7405/3, Paper 3 | [Question paper](https://cdn.sanity.io/files/p28bar15/green/6704dc4d3f609f285ad09f2081b20a3cf8d45fbd.pdf) |

Only public title/identifier metadata was used from these resource records. They do not supply a copied question layout or mark scheme.

## Deterministic resolution and limits

The resolver scopes choices by country, subject, board and qualification, then by explicit course identity. AQA casing is canonicalised for display, but institution names are left intact. Recognised aliases such as `(Paper 1)`, `paper1`, `paper_1` and the exact component code map only to a real option in that course. Misspellings, wrong qualification codes and invented papers remain unresolved.

Existing Biology definitions supply concise Paper/Unit labels and official named subtitles. Named aliases such as Unified biology can resolve their existing reviewed component without repeating the course name inside every dropdown option. The technical-code validator checks the selected human assessment and returns a conflict; it does not mutate or replace that selection.

Metadata-only courses still need source evidence before drafting a source-backed profile. No new entry receives a gold star, no old saved context is rewritten, and no runtime arbitrary URL fetching is introduced. All source facts, formats, scope, resources and marking requirements remain subject to the existing server validation.
