export type EssayChoice = 'A'|'B';
export interface BiologyEssayResource {type:'biology_essay_choice';version:1;titles:{id:EssayChoice;title:string}[];}
const object=(v:unknown):Record<string,any>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:null;
export const isBiologyEssayResource=(v:unknown):boolean=>object(v)?.type==='biology_essay_choice';
export function readBiologyEssay(q:{[key:string]:any}):{essay:BiologyEssayResource|null;issues:{code:'invalid_resource'|'conflicting_resource_data';detail:string}[]} {
  const sources=[q.chart_data,q.diagram_config,q.diagramConfig].filter(isBiologyEssayResource);
  const issues:ReturnType<typeof readBiologyEssay>['issues']=[];
  const valid:BiologyEssayResource[]=[];
  for(const raw of sources){
    const c=object(raw)!;
    if(c.version!==1||Object.keys(c).some(k=>!['type','version','titles'].includes(k))||!Array.isArray(c.titles)||c.titles.length!==2||c.titles.some((t:any,i:number)=>!object(t)||Object.keys(t).some(k=>!['id','title'].includes(k))||t.id!==['A','B'][i]||typeof t.title!=='string'||t.title.trim().length<15||t.title.length>350||/[<>\r\n]/.test(t.title))){
      issues.push({code:'invalid_resource',detail:'Essay choice needs exactly two distinct plain titles A and B, version 1; no private keys, extra fields or HTML.'});continue;
    }
    if(c.titles[0].title.trim().toLowerCase()===c.titles[1].title.trim().toLowerCase()){issues.push({code:'invalid_resource',detail:'Essay titles A and B must differ.'});continue;}
    valid.push({type:'biology_essay_choice',version:1,titles:c.titles.map((t:any)=>({id:t.id,title:t.title.trim()}))});
  }
  const essay=valid[0]??null;
  if(valid.some(v=>JSON.stringify(v)!==JSON.stringify(essay)))issues.push({code:'conflicting_resource_data',detail:'Saved copies of the essay titles disagree; repair both titles and their private schemes together.'});
  return {essay,issues};
}
/** Existing answer_text is the durable store: no new client-writable metadata. */
export function parseBiologyEssayAnswer(value:unknown):{choice:EssayChoice|null;text:string;invalidChoice:boolean} {
  const text=typeof value==='string'?value:'';
  const match=text.match(/^\[Essay ([^\]\r\n]+)\](?:\r?\n){0,2}/);
  if(!match)return {choice:null,text,invalidChoice:false};
  const choice=match[1]==='A'||match[1]==='B'?match[1]:null;
  return {choice,text:text.slice(match[0].length),invalidChoice:!choice};
}
export const serializeBiologyEssayAnswer=(choice:EssayChoice,text:string):string=>`[Essay ${choice}]\n\n${text}`;
export const hasBiologyEssayText=(value:unknown):boolean=>!!parseBiologyEssayAnswer(value).text.trim();
