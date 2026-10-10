import type {PaperPlan,PlannedPart} from './paper-contract-types.ts';
import type {UnifiedPart} from './ocr-alevel-biology-paper3-contract.ts';
import {plannedPartKey} from './guided-batching.ts';
import {resolveQuestionResources,type DataTable} from './question-resources.ts';

const resourceFields=['chart_data','diagram_config','diagramConfig','table_data'] as const;
const referenceFields=new Set(['type','id','shared_dataset_ref','source_question_number']);
const record=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function payload(value:unknown):unknown {
  if(typeof value!=='string')return value;
  try{return JSON.parse(value);}catch{return value;}
}
export const isSharedTableReference=(value:unknown):boolean=>{
  const parsed=payload(value);return record(parsed)&&Object.prototype.hasOwnProperty.call(parsed,'shared_dataset_ref');
};
export function paper3SharedParts(plan:PaperPlan|null|undefined,parts:readonly PlannedPart[]):UnifiedPart[]{
  return plan?.courseId==='ocr_alevel_biology_a_h420'&&plan.paperId==='paper_3'
    ?parts.filter((p):p is UnifiedPart=>p.resource==='data_table'&&!!(p as UnifiedPart).sharedDataset):[];
}
export const sharedTableFingerprint=(table:DataTable):string=>JSON.stringify({headers:table.headers,rows:table.rows,units:table.units??[],caption:table.caption??''});
function aliasTablesAgree(row:Record<string,any>,table:DataTable):boolean {
  return resourceFields.every(field=>{
    if(row[field]==null||isSharedTableReference(row[field]))return true;
    const other=resolveQuestionResources({question_text:row.question_text,[field]:row[field]});
    return !other.issues.length&&(!other.table||sharedTableFingerprint(other.table)===sharedTableFingerprint(table));
  });
}

/** Transport references are expanded only under the protected H420/03 plan.
 * Missing resources are never inferred, conflicting observations never chosen,
 * and full-group repairs cannot borrow stale data from the original group.
 * These references never reach assessment, marking, review or PDF storage. */
export function expandPaper3SharedTables<T extends Record<string,any>>(rows:T[],plan:PaperPlan|null|undefined):{
  rows:T[];diagnostics:{code:'invalid_resource';partNumber:string;detail:string}[];
}{
  const shared=paper3SharedParts(plan,plan?.parts??[]);
  const diagnostics:{code:'invalid_resource';partNumber:string;detail:string}[]=[];
  if(!shared.length)return {rows,diagnostics};
  const byPart=new Map(shared.map(p=>[plannedPartKey(p.questionNumber),p]));
  const byNumber=new Map<string,T[]>();
  for(const row of rows){
    if(!record(row))continue;
    const key=plannedPartKey(row.question_number);
    byNumber.set(key,[...(byNumber.get(key)??[]),row]);
  }
  const expanded=rows.map(row=>{
    if(!record(row))return row;
    const part=byPart.get(plannedPartKey(row.question_number));
    if(!part)return row;
    const result={...row};
    for(const field of resourceFields){
      if(!isSharedTableReference(row[field]))continue;
      const ref=payload(row[field]) as Record<string,unknown>;
      const fail=(detail:string)=>diagnostics.push({code:'invalid_resource',partNumber:String(row.question_number),detail:'Shared investigation reference: '+detail});
      if(ref.type!=='data_table'||Object.keys(ref).some(key=>!referenceFields.has(key))){
        fail('return only type, optional id, shared_dataset_ref and source_question_number; do not combine a reference with replacement data or hidden fields.');continue;
      }
      if(ref.shared_dataset_ref!==part.sharedDataset||ref.id!=null&&ref.id!==part.resourceId){
        fail('dataset and destination resource ID must match this saved part.');continue;
      }
      const sourceKey=typeof ref.source_question_number==='string'?plannedPartKey(ref.source_question_number):'';
      const sourcePart=byPart.get(sourceKey),sources=byNumber.get(sourceKey)??[];
      if(!sourcePart||sourcePart.parentId!==part.parentId||sourcePart.sharedDataset!==part.sharedDataset||sourceKey===plannedPartKey(part.questionNumber)||sources.length!==1){
        fail('name exactly one different returned sibling in the same planned dataset; another group, an absent source or an ambiguous number cannot supply this table.');continue;
      }
      const source=sources[0];
      if(resourceFields.some(key=>isSharedTableReference(source[key]))){
        fail('the source sibling must return a complete table, not another reference or a cycle.');continue;
      }
      const resolved=resolveQuestionResources(source);
      if(!resolved.table||resolved.issues.length||!aliasTablesAgree(source,resolved.table)){
        fail('the named source must supply one complete, internally consistent table with headers and all rows.');continue;
      }
      if(!aliasTablesAgree(row,resolved.table)){
        fail('another resource alias disagrees with the referenced headers, rows, units or caption; rewrite the complete group rather than hiding either copy.');continue;
      }
      // Preserve every source property so private/leaked fields still fail the
      // existing gates. Never sanitise an invalid table into an accepted one.
      (result as Record<string,any>)[field]={...structuredClone(resolved.table),id:part.resourceId};
    }
    return result;
  });
  return {rows:expanded,diagnostics};
}

/** Extra runtime guidance; the frozen versioned contract remains unchanged. */
export function paper3SharedDataInstructions(plan:PaperPlan|null|undefined,parts:readonly PlannedPart[],field:'chart_data'|'diagram_config'):string {
  const datasets=new Set(paper3SharedParts(plan,parts).map(p=>p.sharedDataset!));
  if(!datasets.size)return '';
  return 'SHARED INVESTIGATION DATA (mandatory H420/03 transport):\n'+[...datasets].map(dataset=>{
    const dependent=paper3SharedParts(plan,plan!.parts).filter(p=>p.sharedDataset===dataset),source=dependent[0];
    const refs=dependent.slice(1).map(p=>`Q${p.questionNumber}: ${field} = ${JSON.stringify({type:'data_table',id:p.resourceId,shared_dataset_ref:dataset,source_question_number:source.questionNumber})}`).join('\n');
    return `${dataset}: ${dependent.map(p=>'Q'+p.questionNumber).join(', ')} use ONE investigation table. Author its complete headers, rows, units and neutral caption once on Q${source.questionNumber} in ${field}, type=data_table, id=${source.resourceId}. Use these explicit transport references for the other dependent parts instead of independently recreating their data or caption:\n${refs}\nDo not omit a required table or use null/"see previous question". A reference still needs its own separately stated task and complete private key. The server expands explicit references into full visible tables before validation and storage. Returning full copies is also valid only when headers, rows, units and caption are exactly identical (resource IDs differ per saved part). Preserve the same sampling conditions and recalculate every dependent private key against that ONE dataset. No computed result or private marking belongs in public resources. Completion responses must return only requested parts and may reference an already accepted source sibling supplied in context. If a reference source is unavailable, return complete data; never guess an absent reading.`;
  }).join('\n');
}

export function paper3SharedRepairExamples(plan:PaperPlan|null|undefined,group:Record<string,any>[]):Record<string,any>[]|null {
  const parts=paper3SharedParts(plan,plan?.parts??[]).filter(p=>group.some(row=>plannedPartKey(row.question_number)===plannedPartKey(p.questionNumber)));
  if(!parts.length)return null;
  const resourceByPart=new Map<string,Record<string,any>>();
  for(const dataset of new Set(parts.map(p=>p.sharedDataset!))){
    const dependent=parts.filter(p=>p.sharedDataset===dataset),source=dependent[0];
    const resolved=dependent.map(p=>resolveQuestionResources(group.find(row=>plannedPartKey(row.question_number)===plannedPartKey(p.questionNumber))!));
    const intact=resolved.every((r,i)=>r.table&&!r.issues.length&&aliasTablesAgree(group.find(row=>plannedPartKey(row.question_number)===plannedPartKey(dependent[i].questionNumber))!,r.table))&&new Set(resolved.map(r=>r.table?sharedTableFingerprint(r.table):'')).size===1;
    const table=intact?resolved[0].table!:null;
    // This is prompt shape only, never inserted into a question by the server.
    // Conflicting originals do not justify selecting either dataset as truth.
    resourceByPart.set(source.questionNumber,table?{type:'data_table',id:source.resourceId,headers:table.headers,rows:table.rows,
      ...(table.units!==undefined?{units:table.units}:{}),...(table.caption!==undefined?{caption:table.caption}:{})}
      :{type:'data_table',id:source.resourceId,headers:['Independent variable (unit)','Observed response (unit)'],rows:[[1,2],[2,4],[3,5]],caption:'Illustrative JSON shape only; replace with one coherent new investigation dataset'});
    for(const p of dependent.slice(1))resourceByPart.set(p.questionNumber,{type:'data_table',id:p.resourceId,shared_dataset_ref:dataset,source_question_number:source.questionNumber});
  }
  return group.map(row=>({question_number:row.question_number,context:'...',task:'...',correct_answer:'...',
    diagram_config:resourceByPart.get(plan!.parts.find(p=>plannedPartKey(p.questionNumber)===plannedPartKey(row.question_number))?.questionNumber??'')??row.diagram_config??null}));
}
