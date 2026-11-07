import React,{useState} from 'react';
import {MemoryRouter} from 'react-router-dom';
import {CookieConsent,openCookieSettings} from '/workspace/revise-ai-buddy/src/components/CookieConsent';
import {createRoot} from 'react-dom/client';
import {ExamProfileBuilder} from '/workspace/revise-ai-buddy/src/components/profiles/ExamProfileBuilder';
import {ExamProfileModal} from '/workspace/revise-ai-buddy/src/components/stats/ExamProfileModal';
import {WorkspaceContext,WorkspaceStore} from '/workspace/revise-ai-buddy/src/hooks/use-workspace-session';
import {prepareProfileSave,proposeProfile} from '/workspace/revise-ai-buddy/supabase/functions/_shared/profile-builder-service';
import {prepareSourceJob,advanceSourceJob,confirmSourceJob,getSourceJob,answerSourceJob,type SourceJobStore,type SourceJobRecord} from '/workspace/revise-ai-buddy/supabase/functions/_shared/profile-builder-jobs';
import {checksum,canonical,type ProfileTemplate} from '/workspace/revise-ai-buddy/supabase/functions/_shared/profile-template';
import {extractIndexedPdfPages} from '/workspace/revise-ai-buddy/supabase/functions/_shared/profile-document-io';
import {getDocumentProxy} from 'unpdf';
import {templateFixture} from '/workspace/revise-ai-buddy/supabase/tests/profile-builder-fixtures';
const owner='browser-owner',workspaceStore=new WorkspaceStore('browser-owner'),clone=<T,>(v:T):T=>structuredClone(v);
(window as any).__owner=owner;
const calls:any[]=[],proposals=new Map<string,any>(),claims=new Map<string,any>(),jobs=new Map<string,any>(),cache=new Map<string,any>();
let models=0,reservations=0,saved:any=null,parsedPages=0,parsedCharacters=0,parseCalls=0,holdStage=0,uiQuestionStep=0;
const usages:any[]=[],sourceContexts:any[]=[];
(window as any).__scenario=new URLSearchParams(location.search).get('scenario')||'null-tier';
const store:SourceJobStore={
 async create(o,id,hash,key,data,stage,elapsedMs){const old=jobs.get(o+id);if(old){if(old.hash!==hash)throw Error('Idempotency mismatch');return clone(old);}const row={owner:o,id,stage,revision:0,leaseToken:null,quotaReserved:false,callIntents:0,activeMs:elapsedMs,data:clone(data),hash,key,inFlight:false};jobs.set(o+id,row);return clone(row);},
 async load(o,id){return clone(jobs.get(o+id)||null);},
 async cached(o,key){return clone(cache.get(o+key)||null);},
 async acquire(o,id){const row=jobs.get(o+id);if(!row)throw Error('Owned job missing');if(row.leaseToken)return {...clone(row),leaseToken:null};if(['complete','failed','needs_details'].includes(row.stage))return clone(row);row.leaseToken=crypto.randomUUID();return clone(row);},
 async commit(r,change){const row=jobs.get(r.owner+r.id);if(row.revision!==r.revision||row.leaseToken!==r.leaseToken)throw Error('Lease mismatch');Object.assign(row,{stage:change.stage,data:clone(change.data),activeMs:row.activeMs+change.elapsedMs,leaseToken:null,revision:row.revision+1});if(change.proposal)proposals.set(row.id,clone(change.proposal));return clone(row);},
 async reserve(r){const row=jobs.get(r.owner+r.id);if(!row.quotaReserved){reservations++;row.quotaReserved=true;}},
 async beginCall(r){const row=jobs.get(r.owner+r.id);if(row.inFlight||row.callIntents>=3)throw Error('Call budget exhausted');row.callIntents++;row.inFlight=true;},
 async finishCall(r,change,usage){const row=jobs.get(r.owner+r.id);if(!row.inFlight)throw Error('No call intent');row.inFlight=false;usages.push(clone(usage));const result=await store.commit(r,change);if(result.stage==='ready'&&result.data.evidence)cache.set(r.owner+row.key,clone(result.data.evidence));return result;},
};
function sourceTemplate(identity:any,evidence:any,mode:any):ProfileTemplate{
 const t=templateFixture();t.identity=identity;t.mode=mode;t.topics=evidence?.facts?.topics?.length?evidence.facts.topics:['Cells','Enzymes'];t.calculator=evidence?.facts?.calculator??'not_allowed';
 t.marks=mode==='full_mock'?evidence.facts.marks:6;t.durationMinutes=mode==='full_mock'?evidence.facts.durationMinutes:10;
 t.sections=[{id:'practice',title:'Assessment',groups:[]}];
 let remaining=t.marks,i=0;while(remaining>0){const marks=Math.min(remaining,30);t.sections[0].groups.push({id:'group-'+i,parts:[{id:'part-'+i,topic:t.topics[i%t.topics.length],marks,response:'short_answer',demand:'AO1',resource:'none'}]});remaining-=marks;i++;}
 return t;
}
const fixtureBrief='BIO101 Final assessment. Specification version 2026. This assessment is untiered. 6 marks; 30 minutes. Cells and Enzymes. Short structured answers. Answer all questions. No calculator allowed.';
async function syntheticModel(system:string,payload:any){
 models++;
 if(holdStage){const delay=holdStage;holdStage=0;await new Promise(resolve=>setTimeout(resolve,delay));}
 const scenario=(window as any).__scenario;
 let value:any;
 if(payload.documents&&payload.identity.subject==='Physics'){
  sourceContexts.push({version:payload.identity.specificationVersion,component:payload.identity.component,qualification:payload.identity.qualification,documents:clone(payload.documents),userContext:clone(payload.userContext??null),reviewedContext:clone(payload.reviewedContext??null)});
  const source=payload.documents[0];
  const selected=source.pages.find((page:any)=>page.text.includes('85 marks'))??source.pages[0];
  const overview=selected.text.trim(), id=source.id,locationId=payload.chunkId+'-physics';
  const identity={...payload.identity,specificationVersion:'Version 1.4 July 2026'};
  const observed=scenario==='observed-topics';
  const invalid=scenario==='invalid-evidence';
  const retry=payload.invalidExtraction!==undefined;
  const optional=scenario==='optional-paper3';
  const facts={marks:invalid&&!retry?86:85,durationMinutes:120,topics:invalid&&retry?['An invented unsourced topic']:['Sections 1 to 5','6.1'],tier:scenario==='unquoted-tier'?'not_tiered':null,calculator:'allowed',formats:['mcq_single','short_answer','long_form'],selection:optional?'optional':'all_compulsory',mathsRequirement:null,practicalRequirement:null};
  const locations:any[]=[{id:locationId,page:selected.page,section:'Synthetic assessment overview',text:overview}];
  const claims:any[]=[['marks','85 marks'],['durationMinutes','2 hours'],['topics','Sections 1 to 5 and 6.1'],['formats','60 marks of short and long answer questions and 25 multiple-choice questions on content']].map(([field,quote])=>({field,quote,documentId:id,locationId,rule:field==='topics'&&observed?'observed':'mandatory'}));
  claims.push({field:'calculator',quote:'A scientific calculator is allowed.',documentId:id,locationId,rule:'mandatory'});
  if(!optional)claims.push({field:'selection',quote:'Answer all questions.',documentId:id,locationId,rule:'mandatory'});
  if(optional)claims.push({field:'selection',quote:'Section B: answer one optional topic.',documentId:id,locationId,rule:'mandatory'});
  if(observed){
   const maths=source.pages.find((page:any)=>page.text.includes('At least 40%'));
   if(maths){
    const mathsText='At least 40% of the overall assessment uses mathematical skills at Level 2 or above, equivalent to higher GCSE mathematics.';
    const mathsId=payload.chunkId+'-maths';
    locations.push({id:mathsId,page:maths.page,section:'Synthetic mathematical requirement',text:mathsText});
    facts.mathsRequirement=mathsText as any;
    claims.push({field:'mathsRequirement',quote:mathsText,documentId:id,locationId:mathsId,rule:'mandatory'});
   }
  }
  value={evidence:{version:1,identity,documents:[{id,checksum:source.checksum,title:'Original synthetic Physics specification',url:null,version:'Version 1.4 July 2026',kind:'specification',authority:'owner_supplied',retrievedOn:'2026-11-06',state:'active',applicableCohort:'Original software fixture',locations}],facts,claims,unresolved:invalid?['PRIVATE_MODEL_NOTE_DO_NOT_RENDER']:[],conflicts:[]},identityClaims:[{field:'specificationVersion',quote:'Version 1.4 July 2026',documentId:id,locationId}]};
 }else if(payload.documents){
  const document=payload.documents[0], page=document.pages[0],text=page.text.trim();
  const identity={...payload.identity,course:'BIO101',component:'Final assessment',specificationVersion:'2026',tier:'not_tiered'};
  const id=document.id,locationId=payload.chunkId+'-brief';
  value={evidence:{version:1,identity,documents:[{id,checksum:document.checksum,title:'Original private module brief',url:null,version:'2026',kind:'institution_brief',authority:'owner_supplied',retrievedOn:'2026-11-06',state:'active',applicableCohort:'2026 software fixture',locations:[{id:locationId,page:page.page,section:'Assessment brief',text}]}],facts:{marks:6,durationMinutes:30,topics:['Cells','Enzymes'],tier:'not_tiered',calculator:'allowed',formats:['short_answer'],selection:'all_compulsory',mathsRequirement:null,practicalRequirement:null},claims:[['marks','6 marks'],['durationMinutes','30 minutes'],['topics','Cells and Enzymes'],['tier','untiered'],['calculator','Mathematical skills example: use a calculator to evaluate a percentage.'],['formats','Short structured answers'],['selection','Answer all questions']].map(([field,quote])=>({field,quote,documentId:id,locationId,rule:'mandatory'})),unresolved:[],conflicts:[]},identityClaims:[['course','BIO101'],['component','Final assessment'],['specificationVersion','2026'],['tier','untiered']].map(([field,quote])=>({field,quote,documentId:id,locationId}))};
 }else{
  value=sourceTemplate(payload.identity,payload.evidence,payload.mode);
  if(scenario==='draft-failures'){
    if(payload.invalidDraft===undefined)value.marks++;
    else value.durationMinutes=0;
  }
 }
 return {value,promptTokens:20,completionTokens:10};
}
const deps={store,model:syntheticModel,parsePdf:async(bytes:Uint8Array)=>{parseCalls++;const pages=await extractIndexedPdfPages(bytes,getDocumentProxy as any);parsedPages=pages.length;parsedCharacters=pages.reduce((n,p)=>n+p.length,0);return pages;}};
function questionFixture(job:any){return {...job,stage:'needs_details',canAdvance:false,revision:uiQuestionStep,needs:[],missingItems:uiQuestionStep===0?[{field:'assessment',question:'Which assessment are you preparing for?',choices:[{value:'paper_1',label:'Paper 1'}]},{field:'source_pages',question:'Which PDF page shows the assessment overview?'}]:[{field:'source_pages',question:'Which PDF page shows the assessment overview?'}]};}
const api=async(input:any)=>{
 calls.push({action:input.action,answers:input.answers?clone(input.answers):undefined,revision:input.revision,jobId:input.jobId,requestId:input.requestId,presetId:input.presetId,sourceId:input.sourceId,identity:input.identity?clone(input.identity):undefined});
 if(input.action==='prepare_source'){
  const job=await prepareSourceJob(owner,input,deps);
  if((window as any).__scenario==='two-items')return {job:questionFixture(job)};
  return {job};
 }
 if(input.action==='answer_source'){
  if((window as any).__scenario==='two-items'){
   uiQuestionStep++;
   const job=await getSourceJob(owner,input.jobId,deps);
   return {job:uiQuestionStep<2?questionFixture(job):job};
  }
  return {job:await answerSourceJob(owner,input.jobId,input,deps)};
 }
 if(input.action==='advance_source')return {job:await advanceSourceJob(owner,input.jobId,deps)};
 if(input.action==='source_status'){
  if(jobs.has(owner+input.jobId))return {job:await getSourceJob(owner,input.jobId,deps)};
  const receipt=claims.get(owner+input.jobId);
  if(!receipt)throw Error('This profile build was not found in your account.');
  if(receipt.state==='complete')return {job:{jobId:input.jobId,stage:'complete',canAdvance:false,identity:receipt.result.template.identity,mode:receipt.result.template.mode,progress:{completed:1,total:1},message:'Your profile is ready to review.',proposalId:input.jobId,proposal:receipt.result}};
  return {job:{jobId:input.jobId,stage:receipt.state==='failed'?'failed':'drafting',canAdvance:false,mode:'short_practice',progress:{completed:0,total:1},message:receipt.state==='failed'?'This build stopped safely. Your saved profiles are unchanged.':'Your existing profile build is still processing. Check again shortly.'}};
 }
 if(input.action==='confirm_source')return {job:await confirmSourceJob(owner,input.jobId,input,deps)};
 if(input.action==='save'){
  const p=proposals.get(input.proposalId),prepared=prepareProfileSave(p,input.template);
  saved={...prepared.settings,id:crypto.randomUUID(),profile_name:input.profileName,profile_template:{...prepared.context,proposalId:input.proposalId}};
  (window as any).__saved=saved;return {profile:saved};
 }
 const proposal=await proposeProfile(owner,{...input,unverified:input.unverified??false},{
  claim:async(o,key,hash)=>{const old=claims.get(o+key);if(old){if(old.hash!==hash)throw Error('Idempotency mismatch');return {state:old.state==='running'?'busy':old.state,result:old.result};}claims.set(o+key,{state:'running',hash});return {state:'claimed'};},
  finish:async(o,key,state,p)=>{Object.assign(claims.get(o+key),{state,result:p});},reserve:async()=>{reservations++;},beginCall:async()=>{},usage:async(o,key,u)=>{usages.push(u);},parsePdf:deps.parsePdf,model:syntheticModel,
  loadProposal:async(o,key)=>proposals.get(key)
 });
 proposals.set(input.requestId,proposal);return {proposal,proposalId:input.requestId};
};
(window as any).__api=api;
(window as any).__status=async()=>{const job=[...jobs.values()].at(-1);return job?getSourceJob(owner,job.id,deps):null;};
(window as any).__counts=()=>({requests:clone(calls),syntheticModelCalls:models,syntheticReservations:reservations,parsedPages,parsedCharacters,parseCalls,uiQuestionStep,jobStages:[...jobs.values()].map(j=>({id:j.id,stage:j.stage,calls:j.callIntents,identity:j.data.identity,requestedIdentity:j.data.requestedIdentity,needs:j.data.needs,missingItems:j.data.missingItems,revision:j.revision,assessmentChoices:j.data.assessmentChoices,validationIssues:j.data.validationIssues,privateInvalidExtractionPresent:!!j.data.invalidExtraction,evidence:j.data.evidence?{facts:j.data.evidence.facts,catalogueFacts:j.data.evidence.catalogueFacts,documents:j.data.evidence.documents.map((d:any)=>({id:d.id,authority:d.authority,url:d.url,checksum:d.checksum}))}:null})),legacyStages:[...claims.values()].map(j=>j.state),usages:usages.length,sourceContexts:clone(sourceContexts)});
(window as any).__hold=(ms=1000)=>{holdStage=ms;};
(window as any).__fixtureBrief=fixtureBrief;
(window as any).__openCookieSettings=openCookieSettings;
function App(){
 const [ctx,setCtx]=useState<any>(null),[open,setOpen]=useState(false),[manual,setManual]=useState(false),[parent,setParent]=useState(false);
 const launch=(context:any,parentEntry=false)=>{setCtx(context);setManual(false);setParent(parentEntry);setOpen(true);};
 (window as any).__launch=launch;
 (window as any).__unmount=()=>{setOpen(false);setCtx(null);};
 const ocr={subjectName:'Biology',examBoard:'OCR',educationalLevel:'level3',curriculumRegion:'GB',courseId:'ocr_alevel_biology_a_h420',paperId:'paper_3'};
 return <WorkspaceContext.Provider value={{ownerId:owner,ready:true,store:workspaceStore}}><main className="min-h-screen bg-background p-6 text-foreground"><div className="mx-auto max-w-5xl space-y-4"><h1 className="font-serif text-3xl">Examly</h1><p className="text-sm text-muted-foreground">Synthetic preview · no live account or AI calls</p>
 <div className="flex flex-wrap gap-3">{[
 ['Build profile for me',()=>launch({subjectName:'Physics',examBoard:'AQA',educationalLevel:'level2',curriculumRegion:'GB'},true)],
 ['GCSE Physics',()=>launch({subjectName:'Physics',educationalLevel:'level2',curriculumRegion:'GB'})],
 ['A Level Physics',()=>launch({subjectName:'Physics',examBoard:'aqa',educationalLevel:'level3',curriculumRegion:'GB'})],
 ['Legacy Paper 1',()=>launch({subjectName:'Physics',examBoard:'aqa',educationalLevel:'level3',curriculumRegion:'GB',paperId:'(Paper 1)'})],
 ['WJEC Biology',()=>launch({subjectName:'Biology',examBoard:'WJEC',educationalLevel:'level2',curriculumRegion:'GB'})],['OCR Paper 3',()=>launch(ocr)],
 ['Edexcel Biology',()=>launch({subjectName:'Biology',examBoard:'Pearson Edexcel',educationalLevel:'level3',curriculumRegion:'GB'})],
 ['University',()=>launch({subjectName:'Biology',educationalLevel:'undergrad',curriculumRegion:'US',examBoard:'Example University'})],
 ['Cookie settings',()=>openCookieSettings()],
 ['Reopen saved profile',()=>launch({...ctx,initialProfile:saved})]
 ].map(([label,onClick]:any)=><button className="min-h-11 rounded-lg border border-border bg-card px-4 text-sm" key={label} disabled={label==='Reopen saved profile'&&!saved} onClick={onClick}>{label}</button>)}</div>
 {ctx&&(parent||manual?<ExamProfileModal open={open} onOpenChange={setOpen} initialBuilder={parent} subjectName={ctx.subjectName} subjectColor="#2d4f9c" examBoard={ctx.examBoard} availableTopics={[]} onSave={()=>{throw Error('Manual save disabled in fixture')}} />:<ExamProfileBuilder {...ctx} accountId={owner} open={open} onOpenChange={setOpen} onManual={()=>setManual(true)} api={api} />)}
 </div></main><CookieConsent /></WorkspaceContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><App/></MemoryRouter>);
