import {paperPlanForAttempt} from '../../supabase/functions/_shared/course-selection';
import {OCR_ALEVEL_BIOLOGY_ID} from './assessment-tier';
import {canonicalPartNumber} from '../../supabase/functions/_shared/biology-plan-validator';
import {resolveQuestionResources,formatHeaderUnit,type ResourceQuestion} from '../../supabase/functions/_shared/question-resources';
import type {UnifiedPart} from '../../supabase/functions/_shared/ocr-alevel-biology-paper3-contract';
import {isUnifiedMeasurement} from '../../supabase/functions/_shared/ocr-alevel-biology-paper3-validation';
import type {GraphQuestionData} from '@/components/graph/types';

/** A blank response grid derived only from saved identity and PUBLIC givens.
 * Uses existing plotting response/save machinery and leaves the private point
 * scheme on the server. It never puts the required observations on the canvas. */
export function unifiedPlottingData(context:unknown,question:ResourceQuestion&{question_number?:string}):GraphQuestionData|null {
  try{
    const plan=paperPlanForAttempt(context);
    if(plan?.courseId!==OCR_ALEVEL_BIOLOGY_ID||plan.paperId!=='paper_3')return null;
    const part=plan.parts.find(p=>canonicalPartNumber(p.questionNumber)===canonicalPartNumber(question.question_number)) as UnifiedPart|undefined;
    if(part?.unifiedSkill!=='plotting')return null;
    const r=resolveQuestionResources(question),t=r.table;
    if(r.issues.length||!t||t.headers.length!==2||t.rows.length<3||t.rows.some(row=>row.some(v=>!isUnifiedMeasurement(v))))return null;
    const domain=(values:number[]):[number,number]=>{
      const min=Math.min(0,...values),max=Math.max(0,...values),padding=(max-min||1)*0.1;
      return [min===0?0:min-padding,max+padding];
    };
    const label=(i:number)=>formatHeaderUnit(t.headers[i],t.units?.[i]);
    return {graphType:'plotting',graphConfig:{chartType:'scatter',xLabel:label(0),yLabel:label(1),
      domainX:domain(t.rows.map(row=>Number(row[0]))),domainY:domain(t.rows.map(row=>Number(row[1]))),gridEnabled:true}};
  }catch{return null;}
}
