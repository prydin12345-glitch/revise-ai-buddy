import {buildAqaAlevelPaper2Plan} from '../functions/_shared/aqa-alevel-biology-paper2-contract';
import {alevelSnapshot} from './aqa-alevel-fixtures';

/** Original synthetic reading. It exercises software, not assessment quality. */
export const readingParagraphs = [
  'Researchers investigated how a treatment affected gene expression in cultured human cells. Cells from each donor were divided between a control culture and a treated culture. Both cultures received the same nutrients and were kept at the same temperature for two days. The researchers measured the amount of a particular RNA and counted the living cells. Samples were identified by codes so that the people making measurements did not know which treatment had been used.',
  'The treatment reduced the activity of an enzyme involved in DNA methylation. The researchers examined a regulatory region associated with the gene under investigation. A labelled probe was used to measure the RNA produced from this gene. Fresh cultures were prepared for repeated measurements because collecting RNA destroyed the cells. The amount of a reference RNA was measured in each sample to help account for differences in the quantity of material collected.',
  'The control cultures had a mean RNA measurement of twelve units, compared with eighteen units in the treated cultures. Six donors supplied cells, and the effect differed between donors. These means alone did not show whether the observed difference was statistically significant. The concentration of the protein coded for by the gene did not increase in direct proportion to the RNA measurement. The researchers therefore considered processes that could affect protein production and removal.',
  'In a follow-up investigation, samples were collected at several times after treatment began. The researchers recorded the proportion of cells that were dividing and the number of living cells. They also measured methylation in the regulatory region and the rate of protein breakdown. Separate cultures were needed at each sampling time. Variation between cultures was taken into account when deciding how many samples to collect and when interpreting the resulting patterns of change.',
  'The researchers considered whether the treatment might eventually be useful for patients. However, cells growing in a culture do not experience all the interactions found in an intact tissue. The concentration reaching a particular organ could also differ from that used in the investigation. Further studies would need to examine unwanted effects on other genes and on other cell types. The results did not demonstrate that the treatment would improve a medical condition.',
  'A second laboratory repeated the investigation using cells from different donors and the same written procedure. Both laboratories retained the sample codes until measurements were complete. They shared individual measurements as well as calculated means so that variation could be examined. A suitable statistical comparison was planned before interpreting differences between treatments. The researchers agreed that a repeatable association would support further investigation but would not, by itself, establish every step in the proposed mechanism.',
];
export function alevelPaper2Snapshot(mode:'full_mock'|'short_practice'='full_mock') {
  const original=alevelSnapshot(mode);
  return {...original,paper_id:'paper_2',component_code:'7402/2',paper_contract:{...original.paper_contract,paperId:'paper_2'}};
}
export function alevelPaper2Fixture(mode:'full_mock'|'short_practice'='full_mock') {
  const plan=buildAqaAlevelPaper2Plan(mode,'not_tiered')!;
  const rows:any[]=plan.parts.map((p,i)=>({id:`p2-${i}`,question_number:p.questionNumber,
    root_question_number:String(parseInt(p.questionNumber)),parent_question_number:String(parseInt(p.questionNumber)),
    marks:p.marks,topic_tag:p.topic,question_type:'written',options:null,
    question_text:p.resource==='passage'?`Using paragraph ${i%(mode==='full_mock'?6:3)+1}, explain how the evidence can help the researchers investigate gene expression.`:
      p.resource==='data_table'?'Calculate the mean of the values in the table.':p.resource==='graph'?'Describe the trend in the graph.':'Explain how repeated measurements improve an investigation.',
    correct_answer:`PRIVATE P2 KEY: credit independent points for the stated ${p.marks}-mark task, with a maximum of ${p.marks} marks.`,
    diagram_config:p.resource==='passage'?{type:'biology_comprehension',resourceId:`${p.parentId}_reading`,title:'Gene expression in cultured cells',paragraphs:mode==='full_mock'?readingParagraphs:readingParagraphs.slice(0,3)}:
      p.resource==='data_table'?{type:'data_table',headers:['Sample','Reading (units)'],rows:[[1,2],[2,4],[3,6]]}:
      p.resource==='graph'?{type:'line_chart',xAxisLabel:'Time (min)',yAxisLabel:'Length (mm)',datasets:[{label:'Trial',data:[{x:0,y:2},{x:2,y:4},{x:4,y:6}]}]}:null,
  }));
  return {plan,rows,snapshot:alevelPaper2Snapshot(mode)};
}
