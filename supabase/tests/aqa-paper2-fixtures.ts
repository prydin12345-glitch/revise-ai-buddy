import { buildPaperPlan } from '../functions/_shared/biology-paper-contract';
import { AQA_BIOLOGY_P2, aqaPaper2Component } from '../functions/_shared/aqa-biology-paper2';

export function paper2Snapshot(tier: 'foundation' | 'higher' = 'foundation', mode: 'full_mock' | 'short_practice' = 'full_mock') {
  return {resolved_by: 'server', context_version: 2, subject_name: 'Biology Higher', exam_board: 'AQA', educational_tier: 'GCSE',
    assessment_tier: tier, course_id: 'aqa_gcse_biology', paper_id: 'paper_2', component_code: aqaPaper2Component(tier),
    paper_contract: {courseId: AQA_BIOLOGY_P2.courseId, paperId: 'paper_2', mode, contractVersion: 1}};
}

export const fixtureScheme = [
  {level: 1, marks: '1-2', descriptor: 'Gives simple relevant statements about the investigation.', indicative_content: ['Repeat readings.']},
  {level: 2, marks: '3-4', descriptor: 'Links an appropriate method and control to a fair comparison.', indicative_content: ['Keep the measured conditions constant.']},
  {level: 3, marks: '5-6', descriptor: 'Develops a coherent method with controls and justified treatment of evidence.', indicative_content: ['Calculate a mean from repeated measurements.']},
];

// Synthetic plumbing fixtures, deliberately not a model-generated paper or a
// scientific/educational quality benchmark. They exercise data shapes and gates.
export function paper2Fixture(tier: 'foundation' | 'higher' = 'foundation', mode: 'full_mock' | 'short_practice' = 'full_mock') {
  const plan = buildPaperPlan(mode, tier, AQA_BIOLOGY_P2.courseId, 'paper_2')!;
  const rows: any[] = plan.parts.map((part, i) => ({
    id: `p2-${i}`, question_number: part.questionNumber, root_question_number: String(parseInt(part.questionNumber)),
    parent_question_number: String(parseInt(part.questionNumber)), marks: part.marks, topic_tag: part.topic,
    question_type: part.responseType === 'mcq_single' ? 'mcq' : 'written',
    question_text: part.responseType === 'mcq_single' ? 'Which method makes the sample more representative?'
      : part.resource === 'data_table' ? 'Calculate the mean of the three values in the table.'
      : part.resource === 'graph' ? 'Describe the trend in the graph.' : 'Describe how repeated measurements improve the investigation.',
    correct_answer: part.responseType === 'mcq_single' ? 'Take random samples'
      : part.marks === 6 ? fixtureScheme : part.resource === 'data_table' ? '(2 + 4 + 6) / 3 = 4.' : 'Repeating measurements reduces the influence of random error.',
    options: part.responseType === 'mcq_single' ? ['Take random samples', 'Choose the largest organisms', 'Take one reading', 'Use the first patch'] : null,
    diagram_config: part.resource === 'data_table' ? {type: 'data_table', headers: ['Sample', 'Count'], rows: [[1,2],[2,4],[3,6]]}
      : part.resource === 'graph' ? {type: 'line_chart', xAxisLabel: 'Time (min)', yAxisLabel: 'Length (mm)', datasets: [{label: 'Seedling', data: [{x:0,y:2},{x:2,y:4},{x:4,y:6}]}]} : null,
  }));
  return {plan, rows, snapshot: paper2Snapshot(tier, mode)};
}
