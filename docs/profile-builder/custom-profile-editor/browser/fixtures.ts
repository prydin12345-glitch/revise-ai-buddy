import { buildPaperPlan } from '../../../../src/lib/biology-paper-contract';

export const fixtureOwner = 'synthetic-custom-editor-owner';
export const fixtureOtherOwner = 'synthetic-other-owner';
export const fixtureLibrary = [
  'Shakespeare', 'Poetry anthology', 'Modern drama', 'Narrative voice',
  'Language and imagery', 'Unseen poetry', 'Comparative essays', 'Context',
];
export const fixtureTopics = [
  'Shakespeare', 'Poetry anthology', 'Modern drama',
  'Legacy local seminar: coastal voices', 'Narrative voice',
  'Language and imagery', 'Comparative essays', 'Context',
];

const base = {
  id: 'synthetic-custom-profile', user_id: fixtureOwner,
  subject_name: 'English Literature', profile_name: 'Synthetic literature paper',
  topics: fixtureTopics, question_count: 6, written_question_count: 4, mcq_count: 2,
  educational_tier: 'Local diploma in literary studies', assessment_tier: null,
  exam_board: 'Synthetic examination board', time_limit_minutes: null,
  structure_preset: 'legacy-local-layout', mcq_position: 'mixed',
  mark_distribution: { 1: 2, 4: 1, 6: 1, 12: 2 },
  include_extended: true, extended_marks: 12, difficulty_progression: 'mixed',
  calculator_policy: 'mixed', question_structure: 'mixed',
  parent_question_count: 2, max_parts_per_question: 3, mcq_options_count: 5,
  include_graphs: false, include_tables: true,
  studied_texts: [
    { role: 'shakespeare', title: 'The Tempest', syntheticMetadata: { edition: 'local annotated edition' } },
    { role: 'modern_drama', title: 'An Inspector Calls' },
    { role: 'legacy_local_text_role', title: 'Fictional coastal voices anthology', retain: [0, false, null] },
  ],
  profile_template: null,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z',
};

export function makeFixture(scenario: 'custom' | 'guided' | 'legacy' = 'custom') {
  if (scenario === 'legacy') return structuredClone({
    ...base, id: 'synthetic-legacy-profile', profile_name: 'Synthetic legacy MCQ paper',
    topics: ['Legacy local seminar: coastal voices', 'Shakespeare'],
    educational_tier: 'level2', written_question_count: 0, mcq_count: 6,
    question_structure: 'mcq_only', include_extended: false, extended_marks: 0,
    paper_blueprint: null, studied_texts: null,
  });
  if (scenario === 'guided') {
    const plan = buildPaperPlan('full_mock', 'higher', 'aqa_gcse_biology', 'paper_2')!;
    const mcq = plan.parts.filter(part => part.responseType === 'mcq_single').length;
    return structuredClone({
      ...base, id: 'synthetic-guided-profile', subject_name: 'Biology Higher',
      profile_name: 'Synthetic guided Biology paper', exam_board: 'AQA',
      educational_tier: 'level2', assessment_tier: 'higher', topics: [...new Set(plan.parts.map(part => part.topic))],
      question_count: plan.partCount, written_question_count: plan.partCount - mcq, mcq_count: mcq,
      time_limit_minutes: plan.durationMinutes, calculator_policy: 'allowed',
      structure_preset: 'custom', mcq_position: 'start', mark_distribution: {},
      include_extended: false, extended_marks: 0, difficulty_progression: 'ascending',
      question_structure: 'sub_questions', parent_question_count: plan.parentCount,
      max_parts_per_question: Math.max(...plan.parts.map(part => plan.parts.filter(p => p.parentId === part.parentId).length)),
      mcq_options_count: 4, include_graphs: plan.parts.some(p => p.resource === 'graph'),
      include_tables: plan.parts.some(p => p.resource === 'data_table'), studied_texts: null,
      paper_blueprint: {
        courseSelection: { courseId: plan.courseId, paperId: plan.paperId, syntheticVersionHint: 'keep-course-metadata' },
        paperContract: { courseId: plan.courseId, paperId: plan.paperId, mode: plan.mode, contractVersion: plan.contractVersion, syntheticContractMetadata: { retain: true } },
        syntheticUnknown: { guided: true, retain: [0, false, null] },
      },
    });
  }
  return structuredClone({
    ...base,
    paper_blueprint: {
      sections: [
        { title: 'Close reading', answerCount: 1, syntheticSectionId: 'section-preserved-a', questions: [
          { marks: 4, style: 'Explain language choices', syntheticQuestion: { id: 'part-a', demand: 'AO2' } },
          { marks: 6, style: 'Compare two passages', syntheticQuestion: { id: 'part-b', demand: 'AO3' } },
        ] },
        { title: 'Extended interpretation', answerCount: 1, syntheticSectionId: 'section-preserved-b', questions: [
          { marks: 12, style: 'Evaluate an interpretation', syntheticQuestion: { id: 'part-c', demand: 'AO4' } },
          { marks: 12, style: 'Discuss a writer’s methods', syntheticQuestion: { id: 'part-d', demand: 'AO2' } },
        ] },
      ],
      topicEdits: [{ topic: 'Shakespeare', label: 'Drama and dramatic craft', syntheticAliasMetadata: { retain: true } }],
      courseSelection: { courseId: 'legacy-local-literature', paperId: 'seminar-2', specificationVersion: 'local-2024', syntheticIdentityMetadata: [false, 0, null] },
      responseFormats: 'interactive_v1', visualAssessment: 'legacy-local-visual-v0',
      biologyBCustomSettings: { topics: ['Archived Biology snapshot'], writtenCount: 0, mcqCount: 3, syntheticSnapshot: { keep: true } },
      syntheticUnknown: { schemaVersion: 17, notes: 'Must survive browsing and unrelated edits', values: [0, false, null, { opaque: 'preserve me' }] },
    },
  });
}

export type FixtureProfile = ReturnType<typeof makeFixture>;
