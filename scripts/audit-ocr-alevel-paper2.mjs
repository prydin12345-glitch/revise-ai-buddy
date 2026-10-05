import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Offline inventory only: no AI, backend, generated questions or external score.
const root=fileURLToPath(new URL('../',import.meta.url));
const bundle=await build({entryPoints:[resolve(root,'supabase/functions/_shared/biology-paper-audit.ts')],bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const rows=api.auditBiologyTemplates().filter(r=>r.courseId==='ocr_alevel_biology_a_h420'&&r.paperId==='paper_2');
if(rows.length!==4)throw new Error('Expected full and short H420/02 v1/v2 templates.');
for(const r of rows){
  const full=r.mode==='full_mock';
  if(r.componentCode!=='H420/02'||r.tier!=='not_tiered'||![1,2].includes(r.contractVersion)||r.marks!==(full?100:25)||r.minutes!==(full?135:34)||r.mcqs!==(full?15:5))throw new Error('Invalid H420/02 template structure.');
}
console.table(rows.map(({componentCode,contractVersion,tier,mode,marks,minutes,mcqs,parts,status})=>({componentCode,contractVersion,tier,mode,marks,minutes,mcqs,parts,status})));
console.log('H420/02 template audit passed. No paper generated; scientific and rendered-paper review remains required.');
