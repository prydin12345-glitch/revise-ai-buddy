import {buildOcrAlevelPaper3Plan,type UnifiedPart} from '../functions/_shared/ocr-alevel-biology-paper3-contract';
import {ocrAlevelSnapshot} from './ocr-alevel-fixtures';
import type {PaperMode} from '../functions/_shared/paper-contract-types';

export function ocrPaper3Snapshot(mode:PaperMode='full_mock') {
  const base=ocrAlevelSnapshot(mode);
  return {...base,paper_id:'paper_3',component_code:'H420/03',paper_contract:{...base.paper_contract,paperId:'paper_3'}};
}
const levels=(science:string)=>`Level 1 (1–2 marks): Relevant science with limited links to the investigation. Level 2 (3–4 marks): Accurate mechanisms with some supported causal links. Level 3 (5–6 marks): Accurate integrated mechanisms, supported by evidence, with a coherent line of reasoning. Indicative content: ${science}. Science selects the level; communication selects the mark within it. Zero for no relevant response.`;
// Entirely original synthetic test data/tasks. These verify software boundaries,
// not the scientific quality of an AI-generated assessment.
export function ocrPaper3Fixture(mode:'full_mock'|'short_practice'='full_mock') {
  const plan=buildOcrAlevelPaper3Plan(mode,'not_tiered')!;
  const rows=(plan.parts as UnifiedPart[]).map((p,i)=>{
    let context=`Researchers investigate ${p.unifiedContext.toLowerCase()}.`,task='',key='',resource:any=null;
    const n=Number(p.parentId.slice(1)),letter=p.questionNumber.match(/\(([a-z])\)/)![1];
    if(p.resource==='graph')resource={type:'line_chart',id:p.resourceId,xAxisLabel:'Time (min)',yAxisLabel:'Measured uptake (cm³)',datasets:[{label:'Independent measurements',data:[{x:0,y:0},{x:5,y:2},{x:10,y:6},{x:15,y:7}]}],caption:'Measurements under the stated treatment'};
    if(p.resource==='data_table')resource={type:'data_table',id:p.resourceId,headers:['Temperature (°C)','Initial enzyme activity (arbitrary units min⁻¹)'],rows:[[10,2],[20,5],[30,8],[40,3]],caption:'Independent initial activity measurements'};
    if(p.unifiedSkill==='statistical_analysis'){
      context+=' A resistance model predicts equal frequencies of two phenotypes in 80 independent organisms. The null hypothesis is that the observed frequencies agree with this prediction. Use χ² = Σ((O − E)²/E), where O is observed count and E is expected count; significance level 5%, degrees of freedom 1, critical value 3.84.';
      resource={type:'data_table',id:p.resourceId,headers:['Resistance phenotype','Observed count','Expected count'],rows:[['Resistant',42,40],['Susceptible',38,40]],caption:'Sampled organisms and model expectations, not a completed statistical calculation'};
      task='Calculate the chi-squared statistic and explain whether the evidence supports rejecting the null hypothesis. Show your working.';
      key=`Final statistic: 0.2. Working: (42−40)²/40 + (38−40)²/40 = 0.1 + 0.1. 0.2 < 3.84, do not reject the null hypothesis at 5%; insufficient evidence against the model, not proof it is true. Credit calculation method and supported conclusion, capped at ${p.marks}.`;
    }else if(p.unifiedSkill==='plotting'){
      task='Plot a graph of initial enzyme activity against temperature using the supplied measurements. Represent all observations accurately and use an appropriate line or curve.';
      key='Credit accurate plotting of observations, an appropriate line/curve and representation of the trend: three independent method/accuracy marks; cap 3. The expected coordinates remain private.';
    }else if(p.unifiedSkill==='test_selection'){
      context+=' At 18 independently sampled sites, researchers recorded soil moisture (%) and plant species richness. Both variables were ranked; the relationship is monotonic and the observations are not normally distributed.';
      task='Suggest an appropriate statistical test for this relationship and explain your choice.';
      key='Spearman rank correlation; two ranked variables; association across independent sites rather than a difference between group means. Three capped marking points.';
    }else if(p.unifiedSkill==='calculation'){
      if(resource?.type==='line_chart'){task='Calculate the mean rate of uptake between 0 and 10 min. Show your working and give the unit.';key='(6−0)/(10−0) = 0.6 cm³ min⁻¹. Credit method and correctly unit-labelled result, cap 2.';}
      else if(resource){task='Calculate the percentage increase in initial enzyme activity between 10 °C and 30 °C. Show your working.';key=`(8−2)/2 × 100 = 300%. Credit subtraction, division/multiplication and correct percentage, capped at ${p.marks}.`;}
      else{context+=' A measured flow is 0.6 cm³ min⁻¹ and the exchange area is 3.0 cm².';task='Calculate the flow per unit exchange area. Show your working and include the unit.';key='0.6/3.0 = 0.2 cm³ min⁻¹ cm⁻². Credit method and correct value with units, cap 2.';}
    }else{
      const tasks:Record<number,[string,string]>={
        1:['Explain how temperature-dependent respiratory enzyme activity can alter microbial decomposition and carbon release.','Enzyme-mediated respiration supplies ATP; temperature affects catalytic rates; microbial activity changes decomposition and carbon dioxide release.'],
        2:['Explain how water stress can affect plant transport, photosynthesis and competition in the habitat.','Reduced water potential affects uptake and stomata; closure restricts carbon dioxide; lower assimilation changes growth and competition.'],
        3:['Explain how inherited protein variation can affect infection resistance and allele frequencies over generations.','Sequence variation can change protein binding or function; resistant organisms survive and reproduce more successfully; allele frequencies can change by selection.'],
        4:['Suggest controls and improvements for a biotechnology enzyme experiment linked to metabolic feedback, and explain their purposes.','Control substrate, pH and enzyme concentrations; repeat independent cultures; distinguish expression changes from direct enzyme inhibition; feedback alters pathway activity.'],
        5:['Explain how a pathogen can affect gas exchange and circulation, and how a specific immune response limits these effects.','Tissue damage reduces gas exchange; altered oxygen supply limits aerobic respiration; specific lymphocyte responses reduce pathogen load and restore exchange.'],
        6:['Explain how environmental change can alter plant productivity and selection in the sampled populations.','Changed abiotic conditions affect photosynthesis and growth; heritable variation affects reproductive success; altered populations affect competitive relationships.'],
      };
      [task,key]=tasks[mode==='short_practice'?(n===1?2:3):n];
      if(p.unifiedSkill==='evaluation'&&letter!=='a')task='Suggest two improvements to the sampling and controls in this investigation, and explain how they improve validity or reliability.';
      if(p.marks===6)key=levels(key);else key+=` Independently credit relevant links to the context, capped at ${p.marks}; accept scientifically valid alternatives.`;
    }
    return {id:`ocr-p3-${i}`,question_number:p.questionNumber,root_question_number:String(n),parent_question_number:String(n),
      question_text:context+'\n\n'+task,question_type:p.responseType==='long_form'?'written':'short_answer',marks:p.marks,topic_tag:p.topic,correct_answer:key,options:null,diagram_config:resource};
  });
  return {plan,rows,snapshot:ocrPaper3Snapshot(mode)};
}
