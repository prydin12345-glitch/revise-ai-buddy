import {buildPaperPlan} from '../functions/_shared/biology-paper-contract';
import {EDEXCEL_BIOLOGY_ID} from '../functions/_shared/assessment-tier';
import {edexcelBiologyComponent} from '../functions/_shared/edexcel-biology-contract';
import type {EdexcelBiologyPaper} from '../functions/_shared/edexcel-biology-scope';
import {fixtureScheme} from './aqa-paper2-fixtures';

export function edexcelSnapshot(paper: EdexcelBiologyPaper = 'paper_1', tier: 'foundation'|'higher' = 'foundation', mode: 'full_mock'|'short_practice' = 'full_mock') {
  return {resolved_by:'server', context_version:2, subject_name:'Biology Higher', exam_board:'Edexcel', educational_tier:'GCSE',
    assessment_tier:tier, course_id:EDEXCEL_BIOLOGY_ID, paper_id:paper, component_code:edexcelBiologyComponent(paper,tier),
    paper_contract:{courseId:EDEXCEL_BIOLOGY_ID,paperId:paper,mode,contractVersion:1}};
}

// Plumbing fixtures only: these exercise data contracts, batching and gates.
// Their repetitive generic tasks are NOT an educational-quality benchmark.
export function edexcelFixture(paper: EdexcelBiologyPaper = 'paper_1', tier: 'foundation'|'higher' = 'foundation', mode: 'full_mock'|'short_practice' = 'full_mock') {
  const plan=buildPaperPlan(mode,tier,EDEXCEL_BIOLOGY_ID,paper)!;
  const rows:any[]=plan.parts.map((p,i)=>({id:`ed-${i}`,question_number:p.questionNumber,
    root_question_number:String(parseInt(p.questionNumber)),parent_question_number:String(parseInt(p.questionNumber)),
    marks:p.marks,topic_tag:p.topic,question_type:p.responseType==='mcq_single'?'mcq':'written',
    question_text:p.responseType==='mcq_single'?'Which method improves the sample?':p.resource==='data_table'?'Calculate the mean of the values in the table.':p.resource==='graph'?'Describe the trend in the graph.':'Explain how repeated measurements improve the investigation.',
    correct_answer:p.responseType==='mcq_single'?'Take random samples':p.marks===6?fixtureScheme:p.resource==='data_table'?'(2 + 4 + 6) / 3 = 4.':'Repeating measurements reduces the influence of random error.',
    options:p.responseType==='mcq_single'?['Take random samples','Choose the largest organisms','Take one reading','Use the first patch']:null,
    diagram_config:p.resource==='data_table'?{type:'data_table',headers:['Sample','Count'],rows:[[1,2],[2,4],[3,6]]}:
      p.resource==='graph'?{type:'line_chart',xAxisLabel:'Time (min)',yAxisLabel:'Length (mm)',datasets:[{label:'Trial',data:[{x:0,y:2},{x:2,y:4},{x:4,y:6}]}]}:null,
  }));
  return {plan,rows,snapshot:edexcelSnapshot(paper,tier,mode)};
}
