const fs=require('node:fs');
const assert=require('node:assert/strict');
const esbuild=require('/workspace/revise-ai-buddy/node_modules/esbuild');
const root='/workspace/revise-ai-buddy',dir=__dirname;
(async()=>{
 const built=await esbuild.build({absWorkingDir:root,stdin:{contents:"export {extractIndexedPdfPages} from './supabase/functions/_shared/profile-document-io.ts'; export {trustedDocumentSelection} from './supabase/functions/_shared/profile-builder-jobs.ts'; export {indexDocumentPages} from './supabase/functions/_shared/profile-document-index.ts';",resolveDir:root},bundle:true,write:false,format:'cjs',platform:'node',logLevel:'error'});
 const mod={exports:{}};new Function('module','exports','require',built.outputFiles[0].text)(mod,mod.exports,require);const api=mod.exports;
 const {getDocumentProxy}=await import(root+'/node_modules/unpdf/dist/index.mjs');
 const reports=[];
 for(const [filename,component,moduleName] of [['physics-spec-96-pages.pdf','7408/1',undefined],['physics-optional-96-pages.pdf','7408/3','Astrophysics']]){
  const bytes=new Uint8Array(fs.readFileSync(dir+'/'+filename)),pages=await api.extractIndexedPdfPages(bytes,getDocumentProxy);
  const identity={country:'GB',educationSystem:'UK',stage:'Secondary',qualification:'A-level',subject:'Physics',organisation:'AQA',course:'7408',component,specificationVersion:'First teaching 2015, first exams 2017',tier:'not_tiered',...(moduleName?{module:moduleName}:{})};
  const selection=api.trustedDocumentSelection(identity),indexed=api.indexDocumentPages(pages,selection);
  assert.equal(indexed.coverage.complete,true,JSON.stringify(indexed.coverage));
  const excerpt=indexed.chunks.flatMap(chunk=>chunk.pages).map(page=>page.text).join('\n').replace(/\s+/g,' ').trim();
  const completeMaths='At least 40% of the overall assessment uses mathematical skills at Level 2 or above, equivalent to higher GCSE mathematics.';
  assert.ok(excerpt.includes(completeMaths));
  assert.doesNotMatch(excerpt,/untiered|not[ -]tiered|Answer all questions|calculators? (?:is |are )?(?:allowed|permitted|required)/i);
  reports.push({name:filename,physicalPages:pages.length,component,coverage:indexed.coverage,chunks:indexed.chunks.length,selectedCharacters:indexed.chunks.reduce((n,chunk)=>n+chunk.characterCount,0),selectedPages:indexed.selectedPages,completeMathsQuote:true,containsInventedTierOrPermission:false});
 }
 fs.writeFileSync(dir+'/offline-index-results.json',JSON.stringify({realModelCalls:0,reports},null,2)+'\n');
 console.log(JSON.stringify(reports));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
