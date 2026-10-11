import {buildEdexcelBiologyBPlan,EDEXCEL_B_DIAGRAM_LETTERS,type EdexcelBPart} from '../functions/_shared/edexcel-alevel-biology-b-contract';
import {EDEXCEL_B_SPECIFICATION} from '../functions/_shared/edexcel-alevel-biology-b-scope';
import {EDEXCEL_ALEVEL_BIOLOGY_B_ID} from '../functions/_shared/assessment-tier';
export const pearsonLevels=(science:string)=>`Level 0 (0): No rewardable biological content. Level 1 (1–2): Isolated biological knowledge with limited contextual application and basic reasoning. Level 2 (3–4): Relevant biological knowledge with some evidence-based application and connected reasoning. Level 3 (5–6): Comprehensive accurate biological knowledge applied to the supplied context with sustained, coherent scientific reasoning and supported evaluation. Indicative biological content: ${science} Accept valid alternatives; use best fit then a mark within the level, capped at 6.`;
export function edexcelBSnapshot(mode='full_mock') {
  return {context_version:2,resolved_by:'server',profile_id:'profile',subject_name:'Biology',exam_board:'Pearson Edexcel',educational_tier:'level3',assessment_tier:'not_tiered',
    course_id:EDEXCEL_ALEVEL_BIOLOGY_B_ID,paper_id:'9bi0_01',component_code:'9BI0/01',specification_version:EDEXCEL_B_SPECIFICATION,
    paper_contract:{courseId:EDEXCEL_ALEVEL_BIOLOGY_B_ID,paperId:'9bi0_01',mode,contractVersion:1,specificationVersion:EDEXCEL_B_SPECIFICATION}};
}
/** Original offline data and questions, never copied from Pearson. These exercise
 * pipeline contracts and are not a scientifically certified model paper. */
export function edexcelBFixture(mode:'full_mock'|'short_practice'='full_mock') {
  const plan=buildEdexcelBiologyBPlan(mode,'not_tiered')!;
  const rows=(plan.parts as EdexcelBPart[]).map((p,i)=>{
    const topic=Number(p.specRefs![0][0]);
    let context=`A research group investigates ${p.investigation.toLowerCase()}.`,task='',key='',resource:any=null,options:string[]|null=null;
    if(p.resource==='data_table')resource={type:'data_table',id:p.resourceId,headers:['Time (min)','Product concentration (mmol dm⁻³)'],rows:[[0,0],[2,3],[4,6],[6,7]],caption:'Independent experimental measurements'};
    if(p.resource==='graph')resource={type:'line_chart',id:p.resourceId,xAxisLabel:'Time (min)',yAxisLabel:'Measured uptake (cm³)',datasets:[{label:'Controlled treatment',data:[{x:0,y:0},{x:5,y:2},{x:10,y:6},{x:15,y:7}]}],caption:'Supplied investigation measurements'};
    if(p.resource==='diagram')resource={type:p.specRefs!.includes('4.4')?'heart':'plant_cell',showLabels:true,labelMode:'anonymous',letterLabels:[...EDEXCEL_B_DIAGRAM_LETTERS],hideIntrinsicLabels:true};
    const items:Record<number,[string,string,string[]]>={
      1:['Which bond links amino acids in a polypeptide?','Peptide bond',['Peptide bond','Glycosidic bond','Ester bond','Phosphodiester bond']],
      2:['Which structure is present in bacterial cells?','Ribosome',['Ribosome','Chloroplast','Golgi apparatus','Nuclear envelope']],
      3:['Which rank lies immediately below genus in the classification hierarchy?','Species',['Species','Family','Order','Class']],
      4:['Which process directly requires ATP hydrolysis?','Active transport',['Active transport','Simple diffusion','Osmosis','Facilitated diffusion']],
      5:['Which molecule is the terminal electron acceptor in aerobic respiration?','Oxygen',['Oxygen','Carbon dioxide','Glucose','Pyruvate']],
      6:['Which antibiotic effect prevents bacterial multiplication without directly killing the cells?','Bacteriostatic',['Bacteriostatic','Bactericidal','Lytic','Virucidal']],
      7:['Which process produces many copies of a selected DNA sequence?','PCR',['PCR','Translation','Splicing','Exocytosis']],
    };
    if(p.responseType==='mcq_single'){[task,key,options]=items[topic];}
    else if(p.pearsonSkill==='plotting'){
      task='Plot product concentration against time from the supplied table. Plot all observations accurately and use an appropriate line.';
      key=`Method marks: accurately place the supplied points and draw an appropriate line; axes are provided. Independently capped plotting credit, maximum ${p.marks}.`;
    }else if(p.pearsonSkill==='calculation'){
      if(p.specRefs![0]==='3.3'){
        resource={type:'data_table',id:p.resourceId,headers:['Species','Number of individuals'],rows:[['Species R',10],['Species S',10]],caption:'Counts in the supplied habitat sample'};
        context+=' Use D = N(N−1)/Σn(n−1), where N is the total number of individuals and n is the number belonging to each species.';
        task='Calculate the index of diversity for these counts. Show your working and give your answer to three significant figures.';
        key='Method: N = 20; numerator 20 × 19 = 380; denominator 10 × 9 + 10 × 9 = 180; final result 380/180 = 2.11 (three significant figures, dimensionless). Award method and accurate final answer, cap 2.';
      }else if(p.specRefs![0]==='2.1'){
        context+=' The specimen image is 24 mm long at a magnification of ×600.';
        task='Calculate the actual specimen length in micrometres. Show your working and include the unit.';
        key='Method: 24/600 = 0.040 mm; final answer = 40 µm. Credit division and unit conversion, cap 2.';
      }else if(resource){task='Calculate the mean rate of product formation between 0 and 4 min. Show working and include units.';key=`Method: (6−0)/(4−0) = 1.5 mmol dm⁻³ min⁻¹. Accept equivalent units; cap ${p.marks}.`;}
      else{context+=' A pigment travelled 32 mm and the solvent front travelled 80 mm.';task='Calculate the Rf value of the pigment. Show working and give your answer to two significant figures.';key='Method: 32/80 = 0.40 (dimensionless, two significant figures). Credit working and final result, cap 2.';}
    }else if(p.resource==='diagram'){
      if(resource.type==='heart'){task='Describe how the structure of the ventricle walls shown in the diagram relates to their functions.';key='The left ventricular wall has more muscle than the right; it generates higher pressure for systemic circulation. Cap 2; accept equivalent explanations without demanding given labels.';}
      else{task='Devise a controlled investigation of the water potential of the plant tissue shown. Explain how the measurements would support a conclusion.';key='Method: equal-size tissue samples across known solution water potentials; standard time/temperature; replicate and blot consistently before measuring mass; interpolate the zero percentage mass change. Credit four justified method/data-processing points, cap 4.';}
    }else if(p.assessmentRole==='extended_response'){
      if(topic===5){context+=' Plants under two light treatments show different carbon dioxide uptake rates. Temperature and watering are controlled; the lower-light treatment has lower uptake.';task='Explain how the supplied results can be related to photosynthesis and evaluate the investigation.';key=pearsonLevels('Light supplies photophosphorylation energy; ATP/reduced NADP support carbon fixation. Relate the uptake difference to the controlled light treatments; consider replication, confounding factors and evidence limitations.');}
      else{context+=' A treatment proposal uses induced pluripotent cells from the patient rather than donor embryonic cells. Researchers have not yet completed long-term safety trials.';task='Assess the potential advantages and limitations of this treatment proposal.';key=pearsonLevels('Patient-derived cells may reduce immune rejection and avoid embryo sourcing; differentiation/purity and uncontrolled proliferation require testing. Balance medical potential, consent, trial evidence and long-term uncertainty with a supported conclusion.');}
    }else if(p.pearsonSkill==='practical'||p.pearsonSkill==='evaluation'){
      task='Suggest two improvements to the controlled investigation and explain the purpose of each.';
      key=`Use independent replicates and calculate a mean to reduce the influence of random error; control temperature with a monitored water bath to isolate the independent variable. Credit justified scientific alternatives up to ${p.marks}.`;
    }else if(resource){task='Describe the trend in the supplied data and explain a limitation of the evidence.';key=`Uptake/product increases over the measured interval, slowing later; one series without repeat variation cannot demonstrate reliability. Credit relevant evidence and limitations, cap ${p.marks}.`;}
    else{const tasks:Record<number,[string,string]>={
      1:['Explain how amino acid sequence can determine enzyme specificity.','Sequence affects folding/bonding and the active-site shape and chemistry, determining substrate interactions.'],
      2:['Describe how meiosis produces variation in gametes.','Homologous chromosomes cross over and segregate independently, producing new combinations of alleles.'],
      3:['Explain how molecular sequence evidence can distinguish species.','Compare homologous sequences; differences reflect accumulated changes and shared ancestry, interpreted alongside other evidence.'],
      4:['Explain how tissue fluid is formed at the arteriole end of a capillary.','Hydrostatic pressure exceeds opposing oncotic pressure; fluid and small solutes leave, while large plasma proteins remain.'],
      5:['Explain how oxidative phosphorylation produces ATP.','Electron transport releases energy for proton transfer across the inner mitochondrial membrane; return via ATP synthase drives phosphorylation.'],
      6:['Explain how memory lymphocytes contribute to the secondary immune response.','Persist after initial antigen exposure; faster clonal expansion and antibody production on exposure to the same antigen.'],
      7:['Explain how a transcription factor can change gene expression.','Binding to regulatory DNA alters transcription machinery recruitment, changing transcription and protein production.'],
    };[task,key]=tasks[topic];key+=` Independently credit relevant biological points, cap ${p.marks}; accept valid alternatives.`;}
    return {id:`edexcel-b-${i}`,question_number:p.questionNumber,root_question_number:p.parentId.slice(1),parent_question_number:p.parentId.slice(1),
      question_text:context+'\n\n'+task,question_type:p.responseType==='mcq_single'?'mcq':p.responseType==='long_form'?'written':'short_answer',marks:p.marks,topic_tag:p.topic,
      correct_answer:key,options,diagram_config:resource};
  });
  return {plan,rows,snapshot:edexcelBSnapshot(mode)};
}
