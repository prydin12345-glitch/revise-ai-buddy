# Detailed syllabus topics

A source-backed profile could previously save only a paper's umbrella themes. The editor then had no smaller topics to show, and quizzes and topic progress inherited that same coarse scope.

The shared source reader now recovers the smallest supported numbered syllabus units from the selected paper's content, keeping ancestor headings as groups and literal learning-point excerpts with physical PDF page references. For the reviewed public Edexcel Business specification, Paper 1 saves 40 named units from Themes 1 and 4; Paper 2 saves 40 from Themes 2 and 3; Paper 3 saves all 80. A full-paper layout can sample fewer units without discarding the profile's complete topic pool.

The profile review/editor searches and groups these units, with expandable source outcomes. Persisted `topics` contains the detailed labels, so existing quiz filters and question-based progress can distinguish them. Quiz generation now uses the saved profile's vocabulary and selected subset rather than the general subject catalogue. Historical theme scores remain separate; they do not establish scores for new subtopics.

## Scope and provenance

- The logic is shared across subjects and qualification systems; Business labels are not hardcoded in application code. Numbered heading recovery and source-quoted roots provide a conservative fallback for other specifications. Unstructured or ambiguous sources retain their existing quoted topic names; this is not a guarantee of complete parsing for every PDF.
- Selected-paper and qualification/course boundaries apply before content extraction. A content heading cannot expand the preceding assessment's theme allocation. Conflicting heading codes/titles are not resolved by majority vote.
- `evidence.topicDetails` is optional and created locally by the server from retained uploaded pages. Models cannot nominate it; edited templates cannot supply evidence. Its literal source headings and active content documents are validated, and the owned proposal's evidence fingerprint protects persistence. Existing records without this field keep their fingerprints.
- Source outcomes remain in the owner's profile. Shareable exam snapshots contain topic labels and assessment facts, excluding private excerpts, upload IDs, titles and page references. Draft generation receives detailed labels without a second copy of every source excerpt.
- Work is bounded by source, topic, hierarchy and excerpt limits. Unsupported expansion retains the original topic list rather than silently saving a prefix. Learning-point bullets are shown under their named syllabus unit; each bullet is not automatically a separate graded topic. No frequency-of-testing claims are inferred.
- Old saved profiles are not rewritten. A source-backed profile without details offers an explicit re-read action. Starting it makes no AI call; the user must supply/review documents and choose Read syllabus. Regenerating a draft from old evidence alone cannot recover missing source text.

## Reproduction

Keep the public reference PDF outside the repository:

```sh
node docs/profile-builder/detailed-topics/verify-public-pdf.mjs /tmp/edexcel-alevel-business-official.pdf /tmp/detailed-topics-public-results.json
npm run check
node docs/profile-builder/detailed-topics/dependency-graph.mjs
```

The public verification runs actual extraction, discovery, source indexing, resumable jobs and save/snapshot logic, with controlled model responses and an in-memory store. It independently checks every numbered source unit, literal excerpts, sibling exclusions, counts and persistence for all three papers. It is not a private-upload replay or a live model-quality test.

The browser harness and deployment prompt are in this directory. Verification results record the exact commands, boundaries and remaining warnings. No database migration is required.
