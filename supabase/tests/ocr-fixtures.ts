import {buildPaperPlan} from '../functions/_shared/biology-paper-contract';
import {OCR_GATEWAY_BIOLOGY_ID as OCR} from '../functions/_shared/assessment-tier';
export function gatewayFixture(tier: 'foundation' | 'higher' = 'foundation') {
  const plan = buildPaperPlan('full_mock', tier, OCR)!;
  const rows = plan.parts.map(p => ({id: p.partId, question_number: p.questionNumber,
    parent_question_number: p.section === 'A' ? null : p.questionNumber.match(/^\d+/)![0],
    root_question_number: p.questionNumber.match(/^\d+/)![0],
    question_type: p.responseType === 'mcq_single' ? 'mcq' : p.responseType,
    question_text: p.resource === 'graph' ? 'Use Figure 1 to describe the trend.' : 'State one function of this structure.',
    topic_tag: p.topic, marks: p.marks,
    correct_answer: p.responseType === 'mcq_single' ? 'A' : p.marks === 6 ? 'Level 1 (1–2): limited relevant science. Level 2 (3–4): linked explanation. Level 3 (5–6): accurate connected evaluation. 0: no relevant science.' : 'Accept a correct scientific explanation.',
    options: p.responseType === 'mcq_single' ? ['Nucleus', 'Membrane', 'Ribosome', 'Cytoplasm'] : null,
    diagram_config: p.resource === 'data_table' ? {type: 'data_table', headers: ['Time / s', 'Mass / g'], rows: [[0, 3], [10, 4]]}
      : p.resource === 'graph' ? {type: 'line_chart', xAxisLabel: 'Time / s', yAxisLabel: 'Rate', datasets: [{label: 'Trial', data: [{x: 0, y: 1}, {x: 10, y: 2}]}]} : null,
  }));
  return {plan, rows};
}
