import {buildOcrAlevelPaper1Plan} from '../functions/_shared/ocr-alevel-biology-contract';
import {OCR_ALEVEL_BIOLOGY_ID} from '../functions/_shared/assessment-tier';
import {OCR_ALEVEL_BIOLOGY_SPECIFICATION} from '../functions/_shared/ocr-alevel-biology-scope';
import type {PaperMode} from '../functions/_shared/paper-contract-types';

export const ocrLevelScheme='Level 1 (1-2 marks): Some relevant scientific facts, with limited links. Level 2 (3-4 marks): Explains several relevant relationships with some causal links. Level 3 (5-6 marks): Gives a detailed, scientifically accurate explanation linking the processes to the stated conditions. Indicative content: temperature affects kinetic energy and collisions; enzyme-substrate complexes form; altered active sites prevent complementary binding at high temperature. Scientific content selects the level; coherent communication selects the upper mark within it. Zero marks for no relevant response.';
export function ocrAlevelSnapshot(mode:PaperMode='full_mock'){
  return {resolved_by:'server',context_version:2,profile_id:'profile',subject_name:'OCR A-Level Biology Higher',exam_board:'OCR',educational_tier:'level3',
    assessment_tier:'not_tiered',course_id:OCR_ALEVEL_BIOLOGY_ID,paper_id:'paper_1',component_code:'H420/01',specification_version:OCR_ALEVEL_BIOLOGY_SPECIFICATION,
    paper_contract:{courseId:OCR_ALEVEL_BIOLOGY_ID,paperId:'paper_1',mode,contractVersion:1,specificationVersion:OCR_ALEVEL_BIOLOGY_SPECIFICATION}};
}
const table=(id:string)=>({type:'data_table',id,headers:['Time (s)','Oxygen volume (cm³)'],rows:[[0,0],[10,2],[20,4]],caption:'Experimental measurements'});
const graph=(id:string)=>({type:'line_chart',id,xAxisLabel:'Time (s)',yAxisLabel:'Oxygen volume (cm³)',datasets:[{label:'Measurements',data:[{x:0,y:0},{x:10,y:2},{x:20,y:4}]}],caption:'Experimental measurements'});
// Synthetic fixtures exercise contracts and I/O, not a reusable question bank or quality rating.
export function ocrAlevelFixture(mode:'full_mock'|'short_practice'='full_mock'){
  const plan=buildOcrAlevelPaper1Plan(mode,'not_tiered')!;
  const rows=plan.parts.map((p,i)=>{
    const mcq=p.responseType==='mcq_single';
    const resource=p.resource==='data_table'?table(p.resourceId!):p.resource==='graph'?graph(p.resourceId!):null;
    const question_text=resource ? (mcq?'Which oxygen volume was measured at 10 s in the results?':'Calculate the mean rate of oxygen production between 0 s and 20 s using the results. Give the unit.'):
      mcq?(p.mcqStyle==='statements'?'1. Enzymes lower activation energy. 2. Enzymes are used up. 3. Enzymes have active sites. Which combination of statements is correct?':p.mcqStyle==='calculation'?'A cell image measures 45 mm. The actual cell length is 30 micrometres. Which magnification is correct?':'Which process requires ATP directly?'):
      'Explain how a change in temperature affects the rate of an enzyme-controlled reaction.';
    const options=mcq?(resource?['1 cm³','2 cm³','3 cm³','4 cm³']:p.mcqStyle==='statements'?['1 and 2 only','2 and 3 only','1 and 3 only','1, 2 and 3']:p.mcqStyle==='calculation'?['150 times','1500 times','15000 times','15 times']:['Diffusion','Active transport','Osmosis','Facilitated diffusion']):null;
    const answer=mcq?options![p.mcqStyle==='statements'?2:1]:p.marks===6?ocrLevelScheme:resource?'4 / 20 = 0.2 cm³/s. Award method and correct value with units up to the part cap.':'Increased kinetic energy produces more successful collisions and enzyme-substrate complexes. Award relevant points up to the part cap.';
    return {id:`ocr-part-${i}`,question_number:p.questionNumber,root_question_number:String(parseInt(p.questionNumber)),parent_question_number:String(parseInt(p.questionNumber)),
      question_text,question_type:mcq?'mcq':'written',marks:p.marks,topic_tag:p.topic,correct_answer:answer,options,diagram_config:resource};
  });
  return {plan,rows,snapshot:ocrAlevelSnapshot(mode)};
}
