import {buildPaperPlan} from '../functions/_shared/biology-paper-contract';
import {AQA_ALEVEL_BIOLOGY_ID} from '../functions/_shared/assessment-tier';
import {AQA_ALEVEL_BIOLOGY_SPECIFICATION} from '../functions/_shared/aqa-alevel-biology-scope';

export const pointScheme='1. Use equal initial sizes (1). 2. Prepare known solution concentrations (1). 3. Keep temperature constant (1). 4. Measure initial and final mass (1). 5. Repeat and calculate a mean (1). 6. Estimate the zero-change concentration (1). Maximum 6 marks; accept valid alternatives.';
export function alevelSnapshot(mode:'full_mock'|'short_practice'='full_mock') {
  return {resolved_by:'server',context_version:2,subject_name:'Biology Higher',exam_board:'AQA',educational_tier:'level3',assessment_tier:'not_tiered',
    specification_version:AQA_ALEVEL_BIOLOGY_SPECIFICATION,course_id:AQA_ALEVEL_BIOLOGY_ID,paper_id:'paper_1',component_code:'7402/1',
    curriculum:{country:'GB',jurisdiction:'England',qualification:'A-level',subject:'Biology'},
    paper_contract:{courseId:AQA_ALEVEL_BIOLOGY_ID,paperId:'paper_1',mode,contractVersion:1,specificationVersion:AQA_ALEVEL_BIOLOGY_SPECIFICATION}};
}
/** Synthetic integration fixtures. These test pipeline handling, not science quality. */
export function alevelFixture(mode:'full_mock'|'short_practice'='full_mock') {
  const plan=buildPaperPlan(mode,'not_tiered',AQA_ALEVEL_BIOLOGY_ID,'paper_1')!;
  const rows:any[]=plan.parts.map((p,i)=>({id:`alevel-${i}`,question_number:p.questionNumber,
    root_question_number:String(parseInt(p.questionNumber)),parent_question_number:String(parseInt(p.questionNumber)),
    marks:p.marks,topic_tag:p.topic,question_type:'written',options:null,
    question_text:p.resource==='data_table'?'Calculate the mean of the values in the table.':p.resource==='graph'?'Describe the trend in the graph.':'Explain how repeated measurements improve an investigation.',
    correct_answer:p.resource==='data_table'?'(2 + 4 + 6) / 3 = 4.':`Independent creditable points for this ${p.marks}-mark task; repeated measurements reduce the effect of random variation. Maximum ${p.marks} marks.`,
    diagram_config:p.resource==='data_table'?{type:'data_table',headers:['Sample','Count'],rows:[[1,2],[2,4],[3,6]]}:
      p.resource==='graph'?{type:'line_chart',xAxisLabel:'Time (min)',yAxisLabel:'Length (mm)',datasets:[{label:'Trial',data:[{x:0,y:2},{x:2,y:4},{x:4,y:6}]}]}:null,
  }));
  return {plan,rows,snapshot:alevelSnapshot(mode)};
}
