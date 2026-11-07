const fs=require('node:fs'),assert=require('node:assert/strict');
const root='/workspace/revise-ai-buddy',dir=__dirname;
const esbuild=require(root+'/node_modules/esbuild');
(async()=>{
 const b=await esbuild.build({absWorkingDir:root,entryPoints:['supabase/functions/_shared/profile-document-io.ts'],bundle:true,write:false,format:'cjs',platform:'node'});
 const mod={exports:{}};new Function('module','exports','require',b.outputFiles[0].text)(mod,mod.exports,require);
 const {getDocumentProxy}=await import(root+'/node_modules/unpdf/dist/index.mjs');
 const reports=[];
 const fixtures=JSON.parse(fs.readFileSync(dir+'/fixtures.json'));
 for(const name of Object.keys(fixtures)){
  const pages=await mod.exports.extractIndexedPdfPages(new Uint8Array(fs.readFileSync(dir+'/'+name)),getDocumentProxy);
  const text=pages.join('\n');
  const report={name,pages:pages.length,characters:text.length,lateAssessmentPage:90,containsUntieredClaim:/\b(?:untiered|not[ -]tiered|no tiers)\b/i.test(text),containsAnswerAllInstruction:/\banswer all questions\b/i.test(text),containsCalculatorPermission:/calculator (?:is )?(?:allowed|required)|expected to use a scientific calculator/i.test(text),containsMathsMention:/worked numerical example may use a calculator/i.test(text),containsOptionalInstruction:/answer one optional topic/i.test(text),containsCompleteMathsSentence:pages[90].replace(/\s+/g,' ').includes('At least 40% of the overall assessment uses mathematical skills at Level 2 or above, equivalent to higher GCSE mathematics.')};
  assert.equal(pages.length,96);assert.equal(report.containsUntieredClaim,false);assert.equal(report.containsAnswerAllInstruction,false);assert.equal(report.containsCalculatorPermission,false);assert.equal(report.containsMathsMention,true);assert.equal(report.containsCompleteMathsSentence,true);
  reports.push(report);
 }
 fs.writeFileSync(dir+'/offline-parser-results.json',JSON.stringify({realModelCalls:0,reports},null,2)+'\n');
 console.log(JSON.stringify(reports));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
