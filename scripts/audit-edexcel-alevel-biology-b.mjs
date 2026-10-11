import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const entry=`import {edexcelBFixture} from '${root}supabase/tests/edexcel-alevel-biology-b-fixtures.ts';
import {assertBiologyPlanIntegrity} from '${root}supabase/functions/_shared/biology-course-packs.ts';
import {validateQuestionCandidates} from '${root}supabase/functions/_shared/question-contract-validator.ts';
import {biologyScopeFromContext} from '${root}supabase/functions/_shared/gcse-biology-scope.ts';
export function audit(){return ['full_mock','short_practice'].map(mode=>{const f=edexcelBFixture(mode);assertBiologyPlanIntegrity(f.plan);const r=validateQuestionCandidates(f.rows,{plan:f.plan,scope:biologyScopeFromContext(f.snapshot)});return {mode,component:f.plan.componentCode,marks:f.plan.totalMarks,minutes:f.plan.durationMinutes,parents:f.plan.parentCount,parts:f.plan.partCount,mcqs:f.plan.parts.filter(p=>p.responseType==='mcq_single').length,status:r.ok?'PASS':'FAIL',defects:r.defects}});}`;
try{const bundle=await build({stdin:{contents:entry,resolveDir:root},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'});
 const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 const reports=api.audit();console.log(JSON.stringify(reports,null,2));
 console.log('Offline Examly templates and synthetic fixtures only; no model generation or scientific certification.');
 if(reports.some(r=>r.status!=='PASS'))process.exitCode=1;
}catch(e){console.error(e.message);process.exitCode=1;}
