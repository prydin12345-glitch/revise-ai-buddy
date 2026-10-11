import type { CandidatePart, QuestionDefect } from './question-contract-validator.ts';
import type { EdexcelBPart } from './edexcel-alevel-biology-b-contract.ts';
import { EDEXCEL_B_DIAGRAM_LETTERS } from './edexcel-alevel-biology-b-contract.ts';
import { assembledModelText, readAnswerKey, hasThreeLevelScheme } from './model-question-normalization.ts';
import { resolveQuestionResources } from './question-resources.ts';
import { savedBiologyDiagram } from './biology-assessment-resources.ts';
import { singleChoiceKey } from './single-choice-marking.ts';
import { edexcelBiologyBContentIssue } from './edexcel-alevel-biology-b-scope.ts';

type Issue = { code: QuestionDefect['code']; detail: string };
/** Accept prose or the shared structured private-key envelope. The Pearson
 * ranges and contextual reasoning must survive normalization and repair. */
export function pearsonBiologyLevelsIssue(value: unknown): string | null {
  const key = readAnswerKey({correct_answer:value});
  const bands=[...key.matchAll(/\blevel[\s_-]*([0-3])\b/gi)];
  const ranges=[[1,2],[3,4],[5,6]];
  const validRanges=ranges.every(([min,max],i)=>bands.some((match,index)=>{
    if(Number(match[1])!==i+1)return false;
    const body=key.slice(match.index!+match[0].length,bands[index+1]?.index??key.length);
    // The shared normalizer preserves structured keys as labelled text. Accept
    // explicit numeric bounds as well as prose ranges, within the correct band.
    return new RegExp(`\\b${min}\\s*[–—-]\\s*${max}\\b`).test(body)||
      new RegExp(`\\bmin(?:imum)?[ _]*(?:marks?)?\\s*:\\s*${min}\\b[\\s\\S]*?\\bmax(?:imum)?[ _]*(?:marks?)?\\s*:\\s*${max}\\b`,'i').test(body)||
      new RegExp(`\\bmarks?\\s*:\\s*${min}\\s+${max}\\b`,'i').test(body);
  }));
  if(!hasThreeLevelScheme(value) || !/\b(?:zero|level\s*0|0\s*marks?)\b/i.test(key) ||
    !validRanges ||
    !/indicative\s+(?:content|biolog(?:y|ical content)|science)/i.test(key) ||
    !/context|application|appl(?:y|ied|ication)/i.test(key) || !/reasoning|coheren|logical|linkage/i.test(key))
    return 'Six-mark Pearson response needs zero, populated task-specific Level 1 (1–2), Level 2 (3–4), Level 3 (5–6), contextual application/reasoning and indicative biological content; a model answer or AQA essay rubric is insufficient.';
  return null;
}
const privateResourceField = (value: unknown): boolean => {
  if(typeof value === 'string') {try{return privateResourceField(JSON.parse(value));}catch{return false;}}
  if(!value || typeof value !== 'object')return false;
  return Object.entries(value).some(([k,v])=>/^(?:correct_answer|mark_scheme|solution|solutions|answer_key|private_key|completed_answers|expected_answers)$/i.test(k)||privateResourceField(v));
};
/** Known supported Pearson commands and ordinary assessed choice questions.
 * This supplements (never replaces) the shared answerability gate. */
export function hasPearsonTask(value: string): boolean {
  return /\b(?:add|label|assess|calculate|comment on|compare(?: and contrast)?|complete|criticise|deduce|describe|determine|devise|discuss|draw|evaluate|explain|give|identify|justify|name|plot|predict|select|sketch|state|suggest|show that|write|which|what|how)\b/i.test(value);
}
export function edexcelBiologyBPartIssues(row: CandidatePart, p: EdexcelBPart): Issue[] {
  const issues: Issue[] = [], push=(code:Issue['code'],detail:string)=>issues.push({code,detail});
  if((row as any).topic_tag!==p.topic)push('plan_mismatch',`Retain the planned Topic 1–7 attribution "${p.topic}".`);
  const text=assembledModelText(row),task=typeof row.task==='string'&&row.task.trim()?row.task:text;
  if(!hasPearsonTask(task))push('missing_task','Return a separately stated assessed Pearson task, not context only.');
  const scope=edexcelBiologyBContentIssue(row);if(scope)push('out_of_level',scope);
  if(privateResourceField(row.chart_data)||privateResourceField(row.diagram_config))push('invalid_resource','Student resources contain private marking or completed answers.');
  if(p.responseType==='mcq_single')try{singleChoiceKey(row);}catch(e){push('invalid_options',(e as Error).message);}
  if(p.assessmentRole==='extended_response'){
    const issue=pearsonBiologyLevelsIssue(row.correct_answer);if(issue)push('missing_answer',issue);
  }
  const resources=resolveQuestionResources(row);
  if(p.resource==='diagram'){
    const diagram=savedBiologyDiagram({...row,diagram_config:row.diagram_config??row.chart_data}),type=p.specRefs?.includes('4.4')?'heart':'plant_cell';
    if(!diagram)push('missing_required_resource','Return the required validated deterministic biological diagram.');
    else if(diagram.type!==type||diagram.showLabels!==true||diagram.labelMode!=='anonymous'||
      JSON.stringify(diagram.letterLabels)!==JSON.stringify(EDEXCEL_B_DIAGRAM_LETTERS)||diagram.hideIntrinsicLabels!==true||
      diagram.labels!=null||diagram.revealedLabels!=null)
      push('invalid_resource',`This task needs an answer-safe ${type} diagram: visible anonymous targets A–K in the exact saved order, hideIntrinsicLabels:true, and no labels/revealedLabels overrides. Anonymous mode without a complete letterLabels list reveals anatomical names.`);
  }
  if(p.pearsonSkill==='plotting'){
    const t=resources.table;
    if(!t||t.headers.length!==2||t.rows.length<3||t.rows.some(r=>r.some(v=>String(v).trim()===''||!Number.isFinite(Number(v))))||new Set(t.rows.map(r=>Number(r[0]))).size<3)
      push('invalid_resource','Plotting requires two labelled numerical columns and at least three finite observations at distinct x values; provide a data table, not a completed answer graph.');
  }
  if(p.pearsonSkill==='calculation'){
    const key=readAnswerKey(row);
    if(!/\d/.test(key)||!/(?:working|method|=|÷|\/|×)/i.test(key))push('missing_answer','Calculation key needs creditable method/working and a numerical final result, not only prose.');
    if(/\b(?:units?|significant figures?|decimal places?)\b/i.test(task)&&!/(?:unit|\b(?:cm|mm|µm|μm|um|min|s|g|mol|kPa)\b|%|significant|decimal)/i.test(key))push('missing_answer','The private calculation scheme must preserve assessed units/precision.');
  }
  return issues;
}
