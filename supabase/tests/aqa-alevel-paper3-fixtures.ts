import {buildAqaAlevelPaper3Plan} from '../functions/_shared/aqa-alevel-biology-paper3-contract';
import {alevelSnapshot} from './aqa-alevel-fixtures';
/** Synthetic fixtures exercise software; they are not certified exam content. */
export const essayResource = {
  type:'biology_essay_choice',version:1,
  titles:[{id:'A',title:'The importance of proteins in the control of biological processes.'},
    {id:'B',title:'The importance of movement of substances in living organisms.'}],
};
export const essayKey = {
  type:'biology_essay_key',version:1,
  titles:essayResource.titles.map(t=>({...t,areas:['3.1.4.2','3.2.3','3.3.4.1','3.5.1'].map(specRef=>({
    specRef,content:`PRIVATE ESSAY ${t.id}: detailed indicative biological explanation for synthetic outcome ${specRef}, with the relevant mechanisms and valid alternatives.`,
    link:`Explain explicitly how this biological mechanism supports the theme of essay title ${t.id}, using accurate scientific reasoning.`,
  }))})),
};
export const experimentTable={type:'data_table',headers:['Treatment','Mean rate','Standard deviation'],units:['','mg / h','mg / h'],
  rows:[['Control',20,2],['Treated',30,3]],caption:'Six independent replicates per treatment under the same controlled conditions.'};
export function alevelPaper3Snapshot(mode:'full_mock'|'short_practice'='full_mock'){
  const original=alevelSnapshot(mode);
  return {...original,paper_id:'paper_3',component_code:'7402/3',paper_contract:{...original.paper_contract,paperId:'paper_3'}};
}
export function alevelPaper3Fixture(mode:'full_mock'|'short_practice'='full_mock'){
  const plan=buildAqaAlevelPaper3Plan(mode,'not_tiered')!;
  const rows:any[]=plan.parts.map((p,i)=>({id:`p3-${i}`,question_number:p.questionNumber,
    root_question_number:String(parseInt(p.questionNumber)),parent_question_number:String(parseInt(p.questionNumber)),
    marks:p.marks,topic_tag:p.topic,question_type:'written',options:null,
    question_text:p.resource==='essay_choice'?'Write an essay on ONE of the two titles. Indicate your chosen title A or B.':
      p.resource==='data_table'?'Calculate the difference between the two mean values in the table.':'Explain how repeated measurements improve an investigation.',
    correct_answer:p.resource==='essay_choice'?JSON.stringify(essayKey):`PRIVATE P3 KEY: credit independent points and working for the stated ${p.marks}-mark task, up to a maximum of ${p.marks}.`,
    diagram_config:p.resource==='essay_choice'?structuredClone(essayResource):p.resource==='data_table'?structuredClone(experimentTable):null,
  }));
  return {plan,rows,snapshot:alevelPaper3Snapshot(mode)};
}
