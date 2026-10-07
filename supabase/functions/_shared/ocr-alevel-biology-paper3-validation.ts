import {visualPublicIssue} from './biology-visual-plan.ts';
import type {VisualAssignment} from './biology-visual-types.ts';
import type {CandidatePart,QuestionDefect} from './question-contract-validator.ts';
import type {UnifiedPart} from './ocr-alevel-biology-paper3-contract.ts';
import {resolveQuestionResources} from './question-resources.ts';
import {assembledModelText} from './model-question-normalization.ts';

function privateField(value:unknown):boolean {
  if(typeof value==='string'){try{return privateField(JSON.parse(value));}catch{return false;}}
  return !!value&&typeof value==='object'&&Object.entries(value).some(([key,v])=>
    /^(?:correct_answer|correctAnswer|mark_scheme|solution|solutions|private_key|answer_key|completed_answers|plottingAnswer|expectedPoints|expectedCurve)$/i.test(key)||privateField(v));
}
export const isUnifiedMeasurement=(value:unknown):boolean=>
  (typeof value==='number'||typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))&&Number.isFinite(Number(value));
const CHI_SQUARED_5_PERCENT=[0,3.841,5.991,7.815,9.488,11.070,12.592,14.067,15.507,16.919,18.307];

/** Only the new H420/03 guided contract uses these checks. Shared validators
 * continue to check tasks, shape, graph suitability and resource duplication.
 * This is a structural/numerical gate, not scientific certification. */
export function unifiedPartIssues(row:CandidatePart,part:UnifiedPart,shared:Map<string,string>):{code:QuestionDefect['code'];detail:string}[] {
  const issues:{code:QuestionDefect['code'];detail:string}[]=[];
  const add=(code:QuestionDefect['code'],detail:string)=>issues.push({code,detail});
  if((row as any).topic_tag!==part.topic)add('plan_mismatch',`Retain the planned Unified biology topic ${part.topic}.`);
  if([row.diagram_config,row.diagramConfig,row.chart_data,row.table_data,row.options].some(privateField))add('invalid_resource','Public resources/options contain private marking or a completed plotting answer.');
  const visual=(part as UnifiedPart&{visualAssignment?:VisualAssignment}).visualAssignment;
  const visualIssue=visualPublicIssue(row,visual);if(visualIssue)add('invalid_resource',visualIssue);
  const r=resolveQuestionResources(row);
  if(part.resource==='none'&&!visual&&(row.diagram_config||r.chart||r.passage||r.essay||row.figure_urls&&(row.figure_urls as any).length))add('invalid_resource','An unplanned decorative resource cannot be added to this self-contained part.');
  if(part.sharedDataset&&r.table){
    const t=r.table,fingerprint=JSON.stringify({headers:t.headers,rows:t.rows,units:t.units??[],caption:t.caption??''});
    if(shared.has(part.sharedDataset)&&shared.get(part.sharedDataset)!==fingerprint)add('conflicting_resource_data','Shared investigation observations, headers, units and caption disagree across dependent parts.');
    shared.set(part.sharedDataset,fingerprint);
  }
  if(part.unifiedSkill==='plotting'&&r.table){
    const t=r.table;
    if(t.headers.length!==2||t.rows.length<3||t.rows.some(row=>row.some(v=>!isUnifiedMeasurement(v)))||new Set(t.rows.map(row=>Number(row[0]))).size!==t.rows.length)add('invalid_resource','Plotting needs at least three distinct numerical x observations and two labelled columns with units.');
    if(r.chart?.type!=='data_table')add('invalid_resource','Plotting must supply unsolved observations, not a completed graph.');
  }
  if(part.unifiedSkill==='statistical_analysis'&&r.table){
    const t=r.table,oi=t.headers.findIndex(h=>/\bobserved\b/i.test(h)),ei=t.headers.findIndex(h=>/\bexpected\b/i.test(h));
    const valid=oi>=0&&ei>=0&&oi!==ei&&t.rows.length>=2&&t.rows.every(row=>isUnifiedMeasurement(row[oi])&&Number.isInteger(Number(row[oi]))&&Number(row[oi])>=0&&isUnifiedMeasurement(row[ei])&&Number(row[ei])>=5);
    if(!valid){add('invalid_resource','Chi-squared requires observed integer counts and expected counts of at least five in labelled columns.');return issues;}
    const observed=t.rows.reduce((s,row)=>s+Number(row[oi]),0),expected=t.rows.reduce((s,row)=>s+Number(row[ei]),0);
    if(Math.abs(observed-expected)>1e-6)add('conflicting_resource_data','Observed and expected totals must agree for the planned goodness-of-fit calculation.');
    const text=assembledModelText(row)+'\n'+(t.caption??'');
    if(!/null hypothesis/i.test(text)||!/(?:significance|significant|alpha|α)/i.test(text)||!/(?:degrees? of freedom|\bdf\b)/i.test(text)||!/(?:critical (?:value|χ|chi))[^\n]*\d/i.test(text)||!/(?:χ\s*[²2]|chi[- ]squared?)[^\n]*=/i.test(text)||!/(?:\bO\b[^\n]*observed|observed[^\n]*\bO\b)/i.test(text)||!/(?:\bE\b[^\n]*expected|expected[^\n]*\bE\b)/i.test(text))add('missing_required_resource','State the chi-squared formula, O/E definitions, null hypothesis, significance level, degrees of freedom and numerical critical value visibly.');
    const df=Number(text.match(/(?:degrees? of freedom|\bdf\b)\s*(?:of|is|=|:)?\s*(\d+)/i)?.[1]);
    const critical=Number(text.match(/critical value\s*(?:of|is|=|:)?\s*(\d+(?:\.\d+)?)/i)?.[1]);
    if(df!==t.rows.length-1||!CHI_SQUARED_5_PERCENT[df]||!Number.isFinite(critical)||Math.abs(critical-CHI_SQUARED_5_PERCENT[df])>0.01||!/(?:significance(?: level)?|alpha|α)\s*(?:of|is|=|:)?\s*(?:5\s*%|0\.05\b)/i.test(text))add('invalid_resource','The planned fixed-model goodness-of-fit test needs 5% significance, category count minus one degrees of freedom, and the matching critical value (1–10 df).');
    const statistic=t.rows.reduce((s,row)=>s+(Number(row[oi])-Number(row[ei]))**2/Number(row[ei]),0);
    const key=typeof row.correct_answer==='string'?row.correct_answer:'';
    const final=key.match(/Final statistic\s*:\s*([+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i);
    if(!final||Math.abs(Number(final[1])-statistic)>Math.max(0.01,Math.abs(statistic)*0.005))add('answer_mismatch','Private Final statistic must match the observed/expected dataset with working and a conclusion.');
  }
  return issues;
}
