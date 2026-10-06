import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Offline only. No provider, credentials, backend or generated student records.
const root=fileURLToPath(new URL('../',import.meta.url));
const bundle=await build({entryPoints:[resolve(root,'supabase/functions/_shared/biology-paper-audit.ts')],bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const rows=api.auditBiologyTemplates().filter(r=>r.courseId==='ocr_alevel_biology_a_h420'&&r.paperId==='paper_3');
if(rows.length!==2)throw new Error('Expected two H420/03 v1 guided templates.');
for(const r of rows){
  const full=r.mode==='full_mock';
  if(r.componentCode!=='H420/03'||r.tier!=='not_tiered'||r.contractVersion!==1||r.marks!==(full?70:20)||r.minutes!==(full?90:26)||r.parts!==(full?24:6)||r.parents!==(full?6:2)||r.mcqs!==0||r.tables<2||r.annotatedMathsMarks<2||r.annotatedPracticalMarks<4)throw new Error('Invalid Unified biology template.');
}
console.table(rows.map(({componentCode,contractVersion,tier,mode,marks,minutes,parents,parts,mcqs,tables,graphs,annotatedMathsMarks,annotatedPracticalMarks})=>({componentCode,contractVersion,tier,mode,marks,minutes,parents,parts,mcqs,tables,graphs,annotatedMathsMarks,annotatedPracticalMarks})));
console.log('H420/03 structure and synoptic plan audit passed. Counts/skills are Examly template choices. No paper generated; scientific accuracy, live resources and external review remain unverified.');
