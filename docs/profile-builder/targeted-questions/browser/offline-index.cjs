const fs=require('node:fs'),assert=require('node:assert/strict');
const root='/workspace/revise-ai-buddy',dir=__dirname,esbuild=require(root+'/node_modules/esbuild');
(async()=>{
 const built=await esbuild.build({absWorkingDir:root,stdin:{contents:"export {extractIndexedPdfPages} from './supabase/functions/_shared/profile-document-io.ts'; export {trustedDocumentSelection} from './supabase/functions/_shared/profile-builder-jobs.ts'; export {indexDocumentPages} from './supabase/functions/_shared/profile-document-index.ts'; export {discoverSourceAssessments} from './supabase/functions/_shared/profile-assessment-discovery.ts'; export {checksum} from './supabase/functions/_shared/profile-template.ts';",resolveDir:root},bundle:true,write:false,format:'cjs',platform:'node',logLevel:'error'});
 const mod={exports:{}};new Function('module','exports','require',built.outputFiles[0].text)(mod,mod.exports,require);const api=mod.exports;
 const {getDocumentProxy}=await import(root+'/node_modules/unpdf/dist/index.mjs');
 const reports=[];
 for(const [filename,component,expected,sourcePages] of [['combined-physics-96-pages.pdf','7408/1',true],['paper2-physics-96-pages.pdf','7408/2',true],['unpartitioned-combined.pdf','7408/1',false],['page-choice-combined-96-pages.pdf','7408/1',true,[90]]]){
  const bytes=new Uint8Array(fs.readFileSync(dir+'/'+filename)),pages=await api.extractIndexedPdfPages(bytes,getDocumentProxy);
  const identity={country:'GB',educationSystem:'UK',stage:'Secondary',qualification:'A-level',subject:'Physics',organisation:'AQA',course:'7408',component,specificationVersion:'First teaching 2015, first exams 2017',tier:'not_tiered'};
  const indexed=api.indexDocumentPages(pages,{...api.trustedDocumentSelection(identity),...(sourcePages?{sourcePages}:{})});
  const choices=await api.discoverSourceAssessments([{id:'upload-1',checksum:await api.checksum(bytes),pages}],identity);
  assert.equal(indexed.coverage.complete,expected,JSON.stringify(indexed.coverage));
  const excerpt=indexed.chunks.flatMap(chunk=>chunk.pages).map(page=>page.text).join('\n');
  if(expected){assert.match(excerpt,/85 marks/);assert.doesNotMatch(excerpt,/AS-only sentinel|70 marks|90 minutes|Waves at AS depth/);if(!sourcePages){assert.equal(choices.ambiguous,false);assert.ok(choices.candidates.some(c=>c.componentCode===component));}}
  else assert.ok(choices.ambiguous);
  reports.push({name:filename,physicalPages:pages.length,characters:pages.reduce((n,p)=>n+p.length,0),component,...(sourcePages?{sourcePages}:{}),coverage:indexed.coverage,chunks:indexed.chunks.length,selectedCharacters:indexed.chunks.reduce((n,c)=>n+c.characterCount,0),selectedPages:indexed.selectedPages,discovery:{ambiguous:choices.ambiguous,candidates:choices.candidates.map(c=>({label:c.label,componentCode:c.componentCode}))},ASFactsExcluded:expected?true:null});
 }
 fs.writeFileSync(dir+'/offline-index-results.json',JSON.stringify({realModelCalls:0,reports},null,2)+'\n');console.log(JSON.stringify(reports));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
