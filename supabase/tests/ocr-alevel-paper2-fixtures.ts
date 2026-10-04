import {buildOcrAlevelPaper2Plan} from '../functions/_shared/ocr-alevel-biology-paper2-contract';
import {ocrAlevelSnapshot} from './ocr-alevel-fixtures';
import type {PaperMode} from '../functions/_shared/paper-contract-types';

export function ocrPaper2Snapshot(mode:PaperMode='full_mock') {
  return {...ocrAlevelSnapshot(mode),paper_id:'paper_2',component_code:'H420/02',
    paper_contract:{...ocrAlevelSnapshot(mode).paper_contract,paperId:'paper_2'}};
}

// Original synthetic tasks for software boundary tests, not a question bank or
// evidence of a scientifically reviewed model-generated paper.
const mcqs:Record<string,[string,string[],number]>={
  '2.1.1':['An image is 12 mm long and the cell is 8 micrometres long. Which magnification is correct?',['150 times','1500 times','15000 times','15 times'],1],
  '2.1.2':['Which bond joins amino acids in a polypeptide?',['Glycosidic bond','Peptide bond','Hydrogen bond','Phosphodiester bond'],1],
  '2.1.3':['Which molecule carries the coding sequence from the nucleus to ribosomes?',['Transfer RNA','Messenger RNA','DNA polymerase','ATP'],1],
  '2.1.4':['Which mean reaction rate is shown by the results between 0 and 20 s?',['0.1 cm³/s','0.2 cm³/s','2 cm³/s','4 cm³/s'],1],
  '2.1.5':['Which transport process uses ATP directly?',['Diffusion','Active transport','Osmosis','Facilitated diffusion'],1],
  '2.1.6':['Which process reduces the chromosome number before fertilisation?',['Mitosis','Meiosis','DNA replication','Translation'],1],
  '4.1.1':['Which cells differentiate into plasma cells in a humoral immune response?',['Erythrocytes','B lymphocytes','Platelets','Epithelial cells'],1],
  '4.2.1':['Which species richness is recorded at a sampling area of 20 m² in the graph?',['Two species','Four species','Six species','Eight species'],1],
  '4.2.2':['Which sampling method reduces investigator choice of quadrat location?',['Choose largest plants','Use random coordinates','Choose sites nearest the path','Avoid sparse patches'],1],
  '6.1.1':['Which molecule binds to the lac repressor and changes its shape?',['DNA ligase','Lactose','RNA polymerase','Glucose'],1],
  '6.1.2':['Which phenotype occurs most often in the observed inheritance results?',['White flowers','Purple flowers','Equal frequencies','Neither phenotype'],1],
  '6.1.3':['Which enzyme joins DNA fragments during genetic engineering?',['Restriction endonuclease','DNA ligase','RNA polymerase','Protease'],1],
  '6.2.1':['Which technique produces artificial plant clones?',['Cross pollination','Micropropagation','Meiosis','Seed dispersal'],1],
  '6.3.1':['Which organisms convert ammonium ions into nitrite ions?',['Denitrifying bacteria','Nitrifying bacteria','Nitrogen-fixing bacteria','Herbivores'],1],
  '6.3.2':['A sample contains 20 marked animals among 100 captured. Previously 40 animals were marked. Which population estimate follows N = marked initially × sample size / marked recaptures?',['80 animals','200 animals','400 animals','800 animals'],1],
};
const levels=(science:string)=>`Level 1 (1-2 marks): Some relevant facts with limited links. Level 2 (3-4 marks): Several accurate relationships with some causal links. Level 3 (5-6 marks): Detailed accurate explanation linking the mechanisms to the stated context. Indicative content: ${science}. Scientific content selects the level; coherent communication selects the mark within it. Zero for no relevant response.`;
export function ocrPaper2Fixture(mode:'full_mock'|'short_practice'='full_mock') {
  const plan=buildOcrAlevelPaper2Plan(mode,'not_tiered')!;
  const rows=plan.parts.map((p,i)=>{
    const ref=p.specRefs![0],mcq=p.responseType==='mcq_single';
    let task='',key='',resource:any=null;
    if(p.resource==='data_table') {
      resource=ref==='6.1.2'?{type:'data_table',id:p.resourceId,headers:['Flower phenotype','Observed offspring'],rows:[['Purple',60],['White',20]],caption:'Observed offspring, not a completed genetic prediction'}:
        ref==='6.1.1'?{type:'data_table',id:p.resourceId,headers:['Condition','Enzyme activity (arbitrary units)'],rows:[['No lactose',2],['Lactose',8]],caption:'Observed activity'}:
        ref==='6.3.1'?{type:'data_table',id:p.resourceId,headers:['Trophic level','Biomass (g/m²)'],rows:[['Producer',200],['Primary consumer',20]],caption:'Measured dry biomass'}:
        ref==='2.1.1'?{type:'data_table',id:p.resourceId,headers:['Solution','Initial mass (g)','Final mass (g)'],rows:[['X',5,5.5],['Y',5,4.5]],caption:'Mass of tissue samples'}:
        {type:'data_table',id:p.resourceId,headers:['Time (s)','Product volume (cm³)'],rows:[[0,0],[10,2],[20,4]],caption:'Measured enzyme reaction products'};
    }
    if(p.resource==='graph') {
      const biodiversity=ref.startsWith('4.2'),immune=ref==='4.1.1';
      resource={type:'line_chart',id:p.resourceId,xAxisLabel:biodiversity?'Sample area (m²)':immune?'Time (days)':'Time (hours)',
        yAxisLabel:biodiversity?'Species richness':immune?'Antibody concentration (arbitrary units)':'Microorganism count (thousands)',
        datasets:[{label:'Observed measurements',data:[{x:0,y:0},{x:10,y:2},{x:20,y:4}]}],caption:'Observed measurements'};
    }
    if(mcq) {const item=mcqs[ref];task=item[0];key=item[1][item[2]];}
    else if(resource) {
      if(ref==='6.1.1'){task='Calculate the fold increase in enzyme activity when lactose is present using the results.';key='8 / 2 = 4 times. Credit method and correct value up to the cap.';}
      else if(ref==='6.3.1'){task='Calculate the percentage biomass transferred from producers to primary consumers using the results.';key='20 / 200 × 100 = 10%. Credit method, value and units up to the cap.';}
      else if(ref==='2.1.1'){task='Calculate the percentage mass change for solution X using the results.';key='(5.5 - 5) / 5 × 100 = 10%. Credit method and correct value up to the cap.';}
      else{task='Calculate the mean rate of change of the measured dependent variable between 0 and 20 using the results. Give the unit.';key='(4 - 0) / (20 - 0) = 0.2 dependent-variable units per x-axis unit. Credit method and units up to the cap.';}
    } else {
      const written:Record<string,[string,string]>={
        '2.1.2':['Explain how an increase in temperature affects enzyme activity.','Kinetic energy increases, collisions increase, denaturation alters the active site at high temperature'],
        '2.1.4':['Explain how to investigate enzyme activity fairly.','Control pH, temperature, concentrations; measure initial rates and repeat independent samples'],
        '2.1.1':['Explain why tissue placed in a lower water potential solution loses mass.','Water moves by osmosis through partially permeable membranes down its water potential gradient'],
        '4.1.1':['Explain why vaccination can produce a faster secondary immune response.','Specific lymphocytes are selected; clonal expansion creates memory cells; rapid subsequent antibody production'],
        '4.2.1':['Discuss how habitat change can affect species biodiversity.','Changed conditions affect survival and reproductive success; species richness and evenness may change; use representative repeated sampling'],
        '6.2.1':['Explain the advantages and limitations of using micropropagation to produce plants.','Many genetically identical plants retain desirable alleles, but low genetic diversity increases shared vulnerability'],
        '6.1.1':['Explain how lactose can increase expression of the lac operon.','Lactose binds the repressor, changes its shape, prevents operator binding and permits transcription'],
        '6.3.1':['Discuss how competition can affect succession in an ecosystem.','Changing abiotic conditions alter competitive advantages; colonisers modify the habitat and species composition changes'],
      };
      [task,key]=written[ref];if(p.marks===6)key=levels(key);
    }
    return {id:`ocr-p2-${i}`,question_number:p.questionNumber,root_question_number:String(parseInt(p.questionNumber)),parent_question_number:String(parseInt(p.questionNumber)),
      question_text:task,question_type:mcq?'mcq':'written',marks:p.marks,topic_tag:p.topic,correct_answer:key,options:mcq?mcqs[ref][1]:null,diagram_config:resource};
  });
  return {plan,rows,snapshot:ocrPaper2Snapshot(mode)};
}
