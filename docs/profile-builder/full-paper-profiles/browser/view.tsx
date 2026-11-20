import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {ExamProfileBuilder} from '../../../../src/components/profiles/ExamProfileBuilder';
import {WorkspaceContext,WorkspaceStore} from '../../../../src/hooks/use-workspace-session';
import type {BuilderApi,SourceJobView} from '../../../../src/lib/profile-builder-client';

const unknown = new URLSearchParams(location.search).get('scenario') === 'unknown';
const owner='synthetic-browser-owner', store=new WorkspaceStore(owner), calls:any[]=[];
const titles=['Marketing, people and global businesses','Business activities, decisions and strategy','Investigating business in a competitive environment'];
const text=unknown?'Example Board A-level Unreviewed Studies (UX01)\nPaper 1: Customer needs (UX01/01)\n80 marks':[
  'Pearson Edexcel A-level Business (9BS0)',...titles.map((title,index)=>`Paper ${index+1}: ${title} (9BS0/0${index+1})\n100 marks`),
].join('\n');
const api:BuilderApi=async(input:any)=>{
  calls.push(structuredClone(input));
  if(input.action!=='prepare_source')throw Error('Only synthetic preparation is enabled.');
  const job:SourceJobView={jobId:input.requestId,revision:1,stage:unknown?'needs_details':'ready',canAdvance:false,
    identity:{...input.identity,tier:unknown?null:'not_tiered'},assessmentConfirmed:true,mode:input.mode,progress:{completed:1,total:2},
    message:unknown?'We need a little more assessment information.':'Your assessment is ready to confirm.',
    ...(unknown?{missingItems:[{field:'source' as const,question:'We could not verify the assessment tier for this full-paper profile. Check the course code and qualification, or add an assessment source that identifies the tier or confirms the course is untiered.'}]}:{reviewedFacts:{tier:{value:'not_tiered' as const,source:'assessment_catalogue' as const,courseId:'pearson_alevel_business_9bs0'}}}),
  };
  return {job};
};
Object.assign(window,{__text:text,__calls:()=>structuredClone(calls)});
function App(){const[open,setOpen]=useState(false);return <WorkspaceContext.Provider value={{ownerId:owner,ready:true,store}}><main className="min-h-screen bg-background p-4 text-foreground">
  <h1 className="font-serif text-2xl">Full paper profile verification</h1><p>Offline fixture with synthetic preparation; no account or AI calls.</p>
  <button className="min-h-11 rounded border px-4" onClick={()=>setOpen(true)}>Build profile</button>
  <ExamProfileBuilder subjectName={unknown?'Unreviewed Studies':'Business'} examBoard={unknown?'Example Board':'Pearson Edexcel'} educationalLevel="level3" curriculumRegion="GB" accountId={owner} open={open} onOpenChange={setOpen} onManual={()=>{throw Error('Manual editing is outside this fixture.');}} api={api}/>
</main></WorkspaceContext.Provider>}
createRoot(document.getElementById('root')!).render(<MemoryRouter><App/></MemoryRouter>);
