/** Original reading resources; stored in existing diagram_config JSON.
 * References are expanded only against an unambiguous source in the SAME
 * question group. Missing/conflicting prose is never invented or overwritten. */
export interface BiologyComprehension {
  type:'biology_comprehension'; resourceId:string; title:string; paragraphs:string[];
}
type Issue={code:'invalid_resource'|'conflicting_resource_data';detail:string};
type Row={question_number?:unknown;chart_data?:unknown;diagram_config?:unknown;diagramConfig?:unknown;question_text?:unknown;[key:string]:any};
const object=(v:unknown):Record<string,any>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:null;
const fields=['chart_data','diagram_config','diagramConfig'] as const;
export const isComprehensionResource=(v:unknown):boolean=>['biology_comprehension','biology_comprehension_ref'].includes(object(v)?.type);
export const comprehensionParent=(number:unknown):string=>String(number??'').trim().replace(/^Q\s*/i,'').match(/^(\d+)/)?.[1]??'';
export function readComprehension(q:Row):{passage:BiologyComprehension|null;issues:Issue[]} {
  const candidates=fields.map(f=>object(q[f])).filter(v=>v?.type==='biology_comprehension');
  const refs=fields.map(f=>object(q[f])).filter(v=>v?.type==='biology_comprehension_ref');
  const issues:Issue[]=[];
  const valid:BiologyComprehension[]=[];
  for(const c of candidates){
    if(!c||Object.keys(c).some(k=>!['type','resourceId','title','paragraphs'].includes(k))||typeof c.resourceId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(c.resourceId)||
      typeof c.title!=='string'||!c.title.trim()||c.title.length>200||!Array.isArray(c.paragraphs)||c.paragraphs.length<3||c.paragraphs.length>10||
      c.paragraphs.some((p:unknown)=>typeof p!=='string'||!p.trim()||p.length>8000||/<[^>]+>/.test(p))){
      issues.push({code:'invalid_resource',detail:'Comprehension needs a resourceId, plain title and 3–10 non-empty prose paragraphs; no extra fields, HTML or private answer keys.'});continue;
    }
    valid.push({type:'biology_comprehension',resourceId:c.resourceId,title:c.title.trim(),paragraphs:c.paragraphs.map((p:string)=>p.trim())});
  }
  const passage=valid[0]??null;
  if(valid.some(p=>JSON.stringify(p)!==JSON.stringify(passage)))issues.push({code:'conflicting_resource_data',detail:'Stored copies of the comprehension passage disagree; repair the whole group and keys.'});
  if(refs.length&&(!passage||refs.some(r=>r?.resourceId!==passage.resourceId)))issues.push({code:'invalid_resource',detail:'Unresolved comprehension reference: return the complete source or its matching same-group source.'});
  return {passage,issues};
}

export function expandComprehensionReferences<T extends Row>(rows:readonly T[]):T[] {
  return rows.map(row=>{
    const refs=fields.map(f=>object(row[f])).filter(v=>v?.type==='biology_comprehension_ref');
    if(!refs.length)return row;
    const parent=comprehensionParent(row.question_number);
    if(!parent)return row;
    const sources=rows.filter(r=>comprehensionParent(r.question_number)===parent).map(readComprehension)
      .filter(r=>r.passage&&!r.issues.length).map(r=>r.passage!);
    if(!sources.length||sources.some(p=>JSON.stringify(p)!==JSON.stringify(sources[0]))||refs.some(r=>r?.resourceId!==sources[0].resourceId))return row;
    const next={...row};
    for(const field of fields)if(object(next[field])?.type==='biology_comprehension_ref')next[field]=sources[0];
    return next;
  });
}

/** Lengths are internal drafting targets, not asserted AQA requirements. */
export function comprehensionTaskIssues(row:Row,fullMock:boolean):Issue[] {
  const {passage,issues}=readComprehension(row);
  if(!passage)return issues.length?issues:[{code:'invalid_resource',detail:'This comprehension part needs the complete saved passage.'}];
  const words=passage.paragraphs.join(' ').split(/\s+/).length;
  if(words<(fullMock?350:180)||words>(fullMock?650:350)||passage.paragraphs.length<(fullMock?4:3)||passage.paragraphs.length>(fullMock?8:5))issues.push({code:'invalid_resource',detail:`Comprehension source must have ${fullMock?'350–650 words in 4–8':'180–350 words in 3–5'} paragraphs for this Examly mode; received ${words} words / ${passage.paragraphs.length} paragraphs.`});
  const text=String(row.question_text??'');
  const refs=[...text.matchAll(/\bparagraphs?\s+(\d+(?:\s*(?:[-–—,&]|and|to)\s*\d+)*)/gi)];
  if(!refs.length)issues.push({code:'invalid_resource',detail:'Each comprehension task must refer to its numbered source paragraph(s), not a generic unseen extract.'});
  if(refs.some(m=>[...m[1].matchAll(/\d+/g)].some(n=>Number(n[0])<1||Number(n[0])>passage.paragraphs.length)))issues.push({code:'invalid_resource',detail:'The task cites a paragraph that does not exist in the saved comprehension source.'});
  const lineRefs=[...text.matchAll(/\blines?\s+\d+/gi)].filter(m=>!(/\bcell\s+$/i.test(text.slice(0,m.index))));
  if(lineRefs.length)issues.push({code:'invalid_resource',detail:'Use paragraph references: this passage has numbered paragraphs, not printed line numbers.'});
  return issues;
}

/** Public insert projection. Deliberately exposes no answer or marking fields. */
export function comprehensionInsertFigures(rows:readonly Row[]):any[] {
  const figures:any[]=[];const seen=new Map<string,string>();
  for(const row of rows){
    const result=readComprehension(row);
    if(result.issues.length)throw new Error(result.issues.map(i=>i.detail).join(' '));
    if(!result.passage)continue;
    const p=result.passage;const key=`${comprehensionParent(row.question_number)}:${p.resourceId}`;const text=JSON.stringify(p);
    if(seen.has(key)){if(seen.get(key)!==text)throw new Error('Conflicting comprehension passages in one question group.');continue;}
    seen.set(key,text);figures.push({type:'text_extract',resourceId:key,title:p.title,paragraphs:p.paragraphs,numberParagraphs:true,sourceLine:'Original Examly comprehension passage',figureNumber:figures.length+1});
  }
  return figures;
}
