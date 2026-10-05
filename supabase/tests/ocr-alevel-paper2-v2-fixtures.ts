import {buildOcrAlevelPaper2V2Plan} from '../functions/_shared/ocr-alevel-biology-paper2-v2-contract';
import {ocrPaper2Fixture,ocrPaper2Snapshot} from './ocr-alevel-paper2-fixtures';

export const combinations=['Statements 1 and 2 only','Statements 1 and 3 only','Statements 2 and 3 only','Statements 1, 2 and 3'];
export const fermentationContext='Compare a standard closed batch culture with a steady-state continuous culture.\n\n1. In a closed batch culture, fresh growth medium is not continuously fed into the culture during growth.\n2. In a steady-state continuous culture, fresh medium is added and culture is removed at the same rate to maintain a constant volume.\n3. A continuous culture does not require aseptic conditions.';
export const fermentationTask='Which of the statements are correct?';
export const fermentationStem=fermentationContext+'\n\n'+fermentationTask;
export function ocrPaper2V2Snapshot(mode:'full_mock'|'short_practice'='full_mock') {
  const previous=ocrPaper2Snapshot(mode);
  return {...previous,paper_contract:{...previous.paper_contract,contractVersion:2}};
}
// Synthetic, original provider responses. No backend or AI is contacted.
export function ocrPaper2V2Fixture(mode:'full_mock'|'short_practice'='full_mock') {
  const plan=buildOcrAlevelPaper2V2Plan(mode,'not_tiered')!,old=ocrPaper2Fixture(mode);
  const rows=plan.parts.map((p,i)=>{
    const row={...old.rows[i],topic_tag:p.topic};
    if(row.diagram_config)row.diagram_config={...row.diagram_config,id:p.resourceId};
    const parent=p.questionNumber.match(/^\d+/)![0];
    if(p.mcqStyle==='statements') {
      row.options=combinations;
      row.question_text=fermentationStem;row.correct_answer=combinations[0];
      if(mode==='full_mock'&&parent==='5') {
        row.question_text='Consider plant responses to infection.\n\n1. Callose deposition can restrict movement of pathogens between cells.\n2. Plants produce antibodies to bind pathogen antigens.\n3. Plants can produce antimicrobial chemicals in response to infection.\n\nWhich of the statements are correct?';
        row.correct_answer=combinations[1];
      }
    }
    if(mode==='full_mock'&&parent==='2') {
      row.question_text='Which plant response can restrict the spread of a pathogen between cells?';
      row.options=['Callose deposition','Antibody production','Clonal expansion of B cells','Formation of plasma cells'];row.correct_answer=row.options[0];
    }
    if(mode==='full_mock'&&parent==='3') {
      row.question_text='Which condition can allow geographically isolated populations to develop into different species?';
      row.options=['Different selection pressures with restricted gene flow','Unrestricted gene flow between populations','Identical selection pressures without heritable variation','Absence of mutation and selection'];row.correct_answer=row.options[0];
    }
    if(p.responseType==='mcq_single'&&(mode==='full_mock'?parent==='4':parent==='2')) {
      row.question_text='The table shows fermentation product volume at different times. Calculate the mean rate of product formation between 0 and 20 seconds.';
    }
    if(p.responseType!=='mcq_single'&&(mode==='full_mock'?parent==='16':parent==='6')) {
      if(p.resource==='data_table') {
        row.diagram_config={type:'data_table',id:p.resourceId,headers:['Plant species','Individuals counted'],rows:[['A',10],['B',10]],caption:'Counts in randomly positioned quadrats'};
        row.question_text="Calculate Simpson's Index of Diversity using D = 1 - Σ(n/N)², where n is the count of each species and N is the total count.";
        row.correct_answer='N = 20; sum of squared proportions = (10/20)^2 + (10/20)^2 = 0.5; D = 0.5. Credit the method and value up to the cap.';
      }else {
        row.question_text=p.demand==='AO3'?'Suggest two limitations of estimating diversity from one quadrat and explain how each limitation could be reduced.':'Describe how random quadrat sampling can produce representative evidence of plant species diversity.';
        row.correct_answer='Choose quadrat coordinates using random numbers; sample enough independent locations; use consistent quadrat area and identification rules. Credit distinct relevant points up to the cap.';
      }
    }
    if(mode==='full_mock'&&parent==='18') {
      if(p.resource==='data_table') {
        row.diagram_config={type:'data_table',id:p.resourceId,headers:['Antibody concentration (mg/L)','Antigens bound (arbitrary units)'],rows:[[1,20],[2,30]],caption:'Observed antibody binding in a controlled assay'};
        row.question_text='Calculate the percentage increase in the number of antigens bound when antibody concentration increases from 1 to 2 mg/L.';
        row.correct_answer='(30 - 20) / 20 × 100 = 50%. Credit method, value and units up to the cap.';
      }else{
        row.question_text=p.demand==='AO3'?'Suggest two controls for comparing antibody binding and explain the purpose of each.':'Explain how the tertiary structure of an antibody permits specific binding to an antigen.';
        row.correct_answer='The amino acid sequence determines interactions and folding; the binding site is complementary to a specific antigen; binding depends on that shape. Credit distinct relevant points up to the cap.';
      }
    }
    return row;
  });
  return {plan,rows,snapshot:ocrPaper2V2Snapshot(mode)};
}
