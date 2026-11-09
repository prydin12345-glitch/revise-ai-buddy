const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH||'/opt/codex/cua_node/lib/node_modules/playwright-core');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..');
const dir=process.env.PROFILE_BUILDER_BROWSER_ARTIFACT_DIR||'/workspace/examly-source-edition-verification';
const frozenManifest=fs.readFileSync(dir+'/source-hashes.json');
const frozenHashes=JSON.parse(frozenManifest);
const frozenDigest=crypto.createHash('sha256').update(frozenManifest).digest('hex');
function verifySourceHashes(){
 for(const [file,expected] of Object.entries(frozenHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),expected,'Frozen source changed: '+file);
}
const DATE_TEXT='First teaching 2015, first exams 2017';
(async()=>{
 verifySourceHashes();
 const browser=await chromium.launch({executablePath:'/usr/lib/chromium/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors=[],consoleErrors=[],failedRequests=[],blockedRequests=[],cases=[],screenshots=[];
 let page;
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  context.setDefaultTimeout(18000);
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.hostname!=='127.0.0.1'){blockedRequests.push({host:url.hostname,path:url.pathname});return route.abort();}
   if(url.pathname==='/verify-builder'&&request.isNavigationRequest())return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/styles.css"><title>Examly source edition recovery verification</title></head><body><div id="root"></div><script>localStorage.clear();localStorage.setItem("examly_cookie_consent",JSON.stringify({necessary:true,analytics:false,preferences:false}));document.documentElement.classList.toggle("dark",new URLSearchParams(location.search).get("theme")==="dark");</script><script type="module" src="/bundle.js"></script></body></html>'});
   if(['/bundle.js','/styles.css'].includes(url.pathname))return route.fulfill({contentType:url.pathname.endsWith('.js')?'text/javascript':'text/css',body:fs.readFileSync(dir+url.pathname)});
   if(url.pathname.startsWith('/fonts/'))return route.fulfill({contentType:'font/ttf',body:fs.readFileSync(path.join(dir,url.pathname))});
   if(url.pathname==='/favicon.ico')return route.fulfill({status:204,body:''});
   blockedRequests.push({host:url.hostname,path:url.pathname});return route.abort();
  });
  page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('requestfailed',request=>failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
  const counts=()=>page.evaluate(()=>window.__counts());
  const fresh=async(theme,scenario='combined')=>{
   await page.goto('http://127.0.0.1:8099/verify-builder?theme='+theme+'&scenario='+scenario,{waitUntil:'networkidle'});
   const fonts=await page.evaluate(async()=>{await Promise.all([document.fonts.load('16px Manrope'),document.fonts.load('16px "Source Serif 4"')]);await document.fonts.ready;return {manrope:document.fonts.check('16px Manrope'),serif:document.fonts.check('16px "Source Serif 4"')};});
   assert.deepEqual(fonts,{manrope:true,serif:true});
  };
  const close=async()=>{await page.getByRole('button',{name:'Close profile builder',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});};
  const assessment=()=>page.getByRole('combobox',{name:/^(?:Paper|Unit|Component|Assessment)$/i});
  const choose=async value=>{await assessment().waitFor();await assessment().selectOption(value);};
  const advanced=async()=>{const summary=page.getByText('Advanced details',{exact:true});if(!await summary.evaluate(el=>el.closest('details').open))await summary.click();};
  const fileCard=name=>page.getByRole('list',{name:'Attached source files'}).locator('li').filter({hasText:name});
  const upload=async filename=>{
   let input=page.getByLabel('Syllabus or assessment brief',{exact:true});
   if(!await input.count())await page.getByRole('button',{name:'Upload syllabus',exact:true}).click();
   input=page.getByLabel('Syllabus or assessment brief',{exact:true});await input.setInputFiles(dir+'/'+filename);await fileCard(filename).waitFor();
  };
  const read=()=>page.getByRole('button',{name:'Read syllabus',exact:true}).click();
  const ready=async()=>{await page.getByRole('button',{name:'Yes, build it',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Yes, build it',exact:true}).isEnabled(),true);};
  const summary=()=>page.getByText('Your profile is ready',{exact:true}).waitFor();
  const start=async(theme,scenario='combined',filename='combined-physics-96-pages.pdf',version=null,paper='paper_1')=>{
   await fresh(theme,scenario);await page.getByRole('button',{name:'A Level Physics',exact:true}).click();await choose(paper);if(paper==='paper_3')await page.getByLabel('Paper option',{exact:true}).selectOption('astrophysics');if(version!==null){await advanced();await page.getByLabel('Specification version / teaching dates (optional)',{exact:true}).fill(version);}await upload(filename);await page.getByLabel('Assessment mode',{exact:true}).selectOption('full_mock');
   assert.equal((await counts()).requests.length,0);
  };
  const shot=async name=>{await page.screenshot({path:dir+'/'+name+'.png',animations:'disabled'});screenshots.push(name+'.png');};
  const layout=async label=>{
   const dialog=page.getByRole('dialog');
   const result=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();const style=getComputedStyle(el);return {borderRadius:parseFloat(style.borderTopLeftRadius),fontFamily:style.fontFamily,left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:el.scrollWidth>el.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,width:innerWidth,height:innerHeight};});
   assert.ok(result.left>=-1&&result.right<=result.width+1,label+': horizontal fit');assert.ok(result.top>=-1&&result.bottom<=result.height+1,label+': vertical fit');assert.equal(result.overflow,false,label+': dialog overflow');assert.equal(result.pageOverflow,false,label+': page overflow');assert.ok(result.borderRadius>0,label+': production Tailwind dialog shape');assert.match(result.fontFamily,/Manrope/i,label+': production font');
   return result;
  };
  const question=()=>page.getByRole('group',{name:'Assessment clarification',exact:true});
  const questionInput=()=>question().locator('select,input:not([type="hidden"]),textarea').first();
  const answer=async value=>{
   const input=questionInput();
   if(await input.evaluate(el=>el.tagName)==='SELECT'){
    const options=await input.locator('option').evaluateAll(nodes=>nodes.map(el=>({value:el.value,label:el.textContent})));
    const option=options.find(x=>x.value===value)||options.find(x=>x.value&&new RegExp(value,'i').test(x.label));
    assert.ok(option,'Missing answer option '+value+': '+JSON.stringify(options));await input.selectOption(option.value);
   }else await input.fill(value);
   await question().getByRole('button',{name:/^(Continue|Use this|Confirm)/i}).click();
  };
  const onlyQuestion=async(filename,kind='select')=>{
   await question().waitFor();await questionInput().waitFor();
   assert.equal(await page.getByRole('dialog').locator('select,input:not([type="hidden"]):not([type="file"]),textarea').count(),1,'Only the current missing question is editable');
   assert.equal(await page.getByRole('dialog').locator('input[type="file"]').count(),0,'File picker is collapsed while clarification is active');
   assert.equal(await fileCard(filename).count(),1,'Upload is retained');
   assert.equal(await page.getByRole('button',{name:'Read syllabus',exact:true}).count(),0,'No duplicate read button');
   const body=await page.getByRole('dialog').innerText();assert.match(body,/Physics/);assert.match(body,/AQA/);assert.match(body,/A.?level/i);assert.match(body,/Change/);
   await layout('focused-'+kind+'-question');
   const footerTop=await page.getByRole('button',{name:'Close',exact:true}).evaluate(el=>el.parentElement.getBoundingClientRect().top);
   const headerBottom=await page.getByRole('dialog').getByRole('heading',{name:'Build your exam profile',exact:true}).evaluate(el=>el.closest('.shrink-0').getBoundingClientRect().bottom);
   for(const control of [questionInput(),question().getByRole('button',{name:'Continue',exact:true})]){
    const box=await control.boundingBox();assert.ok(box&&box.y>=headerBottom-1&&box.y+box.height<=footerTop+1,'Question control and Continue remain visible between fixed header and footer');
   }
  };
  const sizes=[{width:1440,height:1000,name:'laptop'},{width:834,height:1112,name:'ipad'},{width:390,height:844,name:'phone'},{width:320,height:780,name:'narrow-phone'}];
  for(const size of sizes)for(const theme of ['light','dark']){
   if(process.argv.includes('--smoke')&&(size.name!=='laptop'||theme!=='light'))continue;
   await page.setViewportSize({width:size.width,height:size.height});
   const entry={...size,theme,scenarios:[]};

   await start(theme);await read();await ready();let state=await counts();
   assert.equal(state.parseCalls,1);assert.equal(state.parsedPages,96);assert.ok(state.parsedCharacters>45000);assert.equal(state.syntheticModelCalls,1);
   const intake=state.requests.find(x=>x.action==='prepare_source');
   assert.equal(intake.specificationVersionIntent,'source','An unedited catalogue default must not pin the upload edition');
   assert.match(state.jobStages[0].identity.specificationVersion,/1\.3/);assert.doesNotMatch(state.jobStages[0].identity.specificationVersion,/1\.4|2026/);
   assert.equal(state.jobStages[0].evidence.facts.selection,'all_compulsory');assert.equal(state.jobStages[0].evidence.facts.calculator,'allowed');
   assert.equal(state.jobStages[0].evidence.facts.topics.length,6);
   assert.equal(state.requests.filter(x=>x.action==='answer_source').length,0,'Reviewed Paper1 rules must not produce an impossible instruction-page question');
   assert.equal(await page.getByRole('img',{name:'Examly-approved preset',exact:true}).count(),0);
   const snippets=state.sourceContexts.flatMap(x=>x.documents.flatMap(d=>d.pages.map(p=>p.text))).join('\n');
   assert.doesNotMatch(snippets,/AS-only sentinel|70 marks|90 minutes|Waves at AS depth/);assert.match(snippets,/85 marks/);
   assert.ok(state.sourceContexts.every(x=>x.qualification==='A-level'&&x.component==='7408/1'&&/1\.3/.test(x.version)));
   assert.ok(state.jobStages[0].evidence.documents.some(x=>x.authority==='official_registered'));
   await page.getByRole('button',{name:'Yes, build it',exact:true}).click();await summary();
   assert.equal((await counts()).syntheticModelCalls,2);assert.match(await page.getByRole('dialog').innerText(),/85/);assert.match(await page.getByRole('dialog').innerText(),/120/);await layout('2017-fullmock-preview');
   await page.getByRole('button',{name:'Edit profile',exact:true}).click();await page.getByLabel('Profile name',{exact:true}).fill('2017 Physics Paper 1');await page.getByRole('button',{name:'Done editing',exact:true}).click();await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByRole('button',{name:'Reopen saved profile',exact:true}).click();await summary();assert.match(await page.getByRole('dialog').innerText(),/2017 Physics Paper 1/);assert.equal((await counts()).syntheticModelCalls,2);
   assert.match(await page.evaluate(()=>window.__saved.profile_template.template.identity.specificationVersion),/1\.3/);
   if(size.name==='laptop'&&theme==='light')await shot('laptop-light-2017-profile-preview');
   if(size.name==='phone'&&theme==='dark')await shot('phone-dark-2017-profile-preview');
   entry.scenarios.push('A 96-page 2017 source overrides the unedited catalogue default, keeps six literal topics and uses reviewed Paper 1 instructions without a page question; the editable 85-mark/120-minute preview saves and reopens edition 1.3 in memory');await close();

   await start(theme,'stale-ai-edition');await read();await ready();state=await counts();
   assert.match(state.sourceContexts[0].modelVersion,/1\.4/);assert.match(state.jobStages[0].identity.specificationVersion,/1\.3/);assert.equal(state.syntheticModelCalls,1);assert.equal(state.parseCalls,1);assert.equal(state.requests.filter(x=>x.action==='answer_source').length,0);await layout('stale-ai-edition-metadata');
   entry.scenarios.push('Stale AI edition 1.4 metadata cannot replace a parsed 1.3 cover or consume a repair call');await close();

   await start(theme,'explicit-version','combined-physics-96-pages.pdf','Version 1.4 July 2026');await read();
   await question().waitFor();state=await counts();
   assert.equal(state.requests.find(x=>x.action==='prepare_source').specificationVersionIntent,'explicit');assert.equal(state.syntheticModelCalls,0);assert.equal(state.syntheticReservations,0);assert.equal(state.parseCalls,1);assert.equal(await fileCard('combined-physics-96-pages.pdf').count(),1);assert.equal(await page.getByRole('button',{name:'Yes, build it',exact:true}).count(),0);assert.match(await question().innerText(),/edition|version|specification/i);await layout('explicit-edition-conflict');
   if(size.name==='ipad'&&theme==='dark')await shot('ipad-dark-explicit-edition-conflict');
   entry.scenarios.push('An explicit 1.4 override remains blocked against a literal 1.3 cover before any model or quota call, with the PDF retained and a focused source question');await close();

   await start(theme,'current-source','current-physics-96-pages.pdf');await read();await ready();state=await counts();assert.match(state.jobStages[0].identity.specificationVersion,/1\.4/);assert.equal(state.syntheticModelCalls,1);assert.equal(state.parseCalls,1);await layout('current-source-compatible');
   entry.scenarios.push('A current 1.4 source resolves as 1.4 under automatic edition detection');await close();

   await start(theme,'page-choice','page-choice-combined-96-pages.pdf');await read();await onlyQuestion('page-choice-combined-96-pages.pdf');
   state=await counts();assert.equal(state.syntheticModelCalls,0);assert.equal(state.parseCalls,1);const pageJob=state.requests.find(x=>x.action==='prepare_source').requestId;
   if(size.name==='narrow-phone'&&theme==='dark')await shot('narrow-phone-dark-page-question');
   await answer('90');await ready();state=await counts();assert.equal(state.parseCalls,1);assert.equal(state.syntheticModelCalls,1);assert.equal(state.jobStages[0].id,pageJob);assert.equal(state.requests.filter(x=>x.action==='prepare_source').length,1);assert.equal(await fileCard('page-choice-combined-96-pages.pdf').count(),1);
   assert.match(state.jobStages[0].identity.specificationVersion,/1\.3/);
   const selectedText=state.sourceContexts.flatMap(x=>x.documents.flatMap(d=>d.pages.map(p=>p.text))).join('\n');assert.match(selectedText,/85 marks/);assert.doesNotMatch(selectedText,/70 marks|90 minutes|AS-only topics/);await layout('page-answer-reuses-reading');
   entry.scenarios.push('A physical-page answer selects an anchored A-level overview, reaches confirmation once, retains edition 1.3 and the PDF, and reuses the same job and single parse');await close();

   await start(theme,'ambiguous-numbered','ambiguous-numbered-96-pages.pdf');await read();await onlyQuestion('ambiguous-numbered-96-pages.pdf');
   await answer('90');await question().locator('input[type="file"]').waitFor({state:'attached'});state=await counts();assert.equal(state.syntheticModelCalls,1);assert.equal(state.parseCalls,1);assert.equal(state.jobStages[0].missingItems[0].field,'source');assert.match(await question().innerText(),/section|topic|content/i);assert.equal(await page.getByRole('button',{name:'Yes, build it',exact:true}).count(),0);assert.equal(await fileCard('ambiguous-numbered-96-pages.pdf').count(),1);assert.match(await page.getByRole('dialog').innerText(),/90/);await layout('ambiguous-numbered-needs-headings');
   entry.scenarios.push('An ambiguous combined document with only the overview selected asks for the missing named-topic source without repeating the page question, dropping the scope or discarding the PDF');await close();

   await start(theme,'selected-headings','selected-headings-96-pages.pdf');await read();await onlyQuestion('selected-headings-96-pages.pdf');
   const selectedHeadingsJob=(await counts()).requests.find(x=>x.action==='prepare_source').requestId;
   await answer('30,90');await ready();state=await counts();assert.equal(state.syntheticModelCalls,1);assert.equal(state.parseCalls,1);assert.equal(state.jobStages[0].id,selectedHeadingsJob);assert.equal(state.jobStages[0].evidence.facts.topics.length,6);assert.equal(state.requests.filter(x=>x.action==='answer_source').length,1);assert.deepEqual(state.jobStages[0].pageReview,[{document:1,requestedPages:[30,90],readPages:[30,90],skippedPages:[]}]);await layout('selected-qualified-headings');
   entry.scenarios.push('Selecting the explicitly A-level named-headings page and assessment overview resolves all six numbered topics despite an unselected ambiguous comparison page, on the original job and single PDF parse');await close();

   await start(theme,'follow-up','followup-physics-96-pages.pdf');await read();await onlyQuestion('followup-physics-96-pages.pdf');
   state=await counts();assert.equal(state.syntheticModelCalls,1);assert.equal(state.parseCalls,1);const followupJob=state.requests.find(x=>x.action==='prepare_source').requestId;
   if(size.name==='phone'&&theme==='light')await shot('phone-light-followup-question');
   if(size.name==='narrow-phone'&&theme==='dark')await shot('narrow-phone-dark-followup-question');
   assert.doesNotMatch(await question().innerText(),/calculator|which questions.*answer|answer all/i);
   await answer('90-92');await ready();state=await counts();assert.equal(state.syntheticModelCalls,2);assert.equal(state.parseCalls,1);assert.equal(state.jobStages[0].id,followupJob);assert.equal(state.requests.filter(x=>x.action==='answer_source').length,1);assert.equal(state.requests.filter(x=>x.action==='prepare_source').length,1);
   assert.deepEqual(state.jobStages[0].pageReview,[{document:1,requestedPages:[90,91,92],readPages:[90,91],skippedPages:[92]}]);
   assert.match(await page.getByRole('dialog').innerText(),/92/);assert.match(await page.getByRole('dialog').innerText(),/skip|different|another|outside/i);await layout('followup-missing-formats');
   const followupPayload=state.sourceContexts[1].documents.flatMap(d=>d.pages);assert.ok(followupPayload.some(p=>p.page===91));assert.ok(!followupPayload.some(p=>p.page===92));assert.equal(await fileCard('followup-physics-96-pages.pdf').count(),1);
   if(size.name==='laptop'&&theme==='light')await shot('laptop-light-page-review');
   if(size.name==='phone'&&theme==='light')await shot('phone-light-page-review');
   entry.scenarios.push('A genuine missing-format follow-up accepts pages 90–92 once, reads Paper 1 pages 90–91, reports skipped Paper 2 page 92, preserves valid evidence and one PDF parse, then reaches confirmation');await close();

   await start(theme,'missing-assessment','paper2-physics-96-pages.pdf');await read();await onlyQuestion('paper2-physics-96-pages.pdf');state=await counts();const assessmentJob=state.requests.find(x=>x.action==='prepare_source').requestId;assert.equal(state.syntheticModelCalls,0);
   await question().getByRole('button',{name:'Change',exact:true}).click();await page.getByRole('button',{name:'Back to question',exact:true}).click();await onlyQuestion('paper2-physics-96-pages.pdf');
   await answer('Paper 2');await ready();state=await counts();assert.equal(state.parseCalls,1);assert.equal(state.syntheticModelCalls,1);assert.equal(state.jobStages[0].id,assessmentJob);assert.equal(state.jobStages[0].identity.component,'7408/2');assert.match(state.jobStages[0].identity.specificationVersion,/1\.3/);assert.equal(state.requests.filter(x=>x.action==='prepare_source').length,1);await layout('paper2-same-job');
   entry.scenarios.push('Selecting source-backed Paper 2 after Change/Back preserves edition 1.3, one parse and the original owned receipt; reviewed Paper 2 instructions avoid a loop');await close();

   await start(theme,'optional-paper3','physics-optional-96-pages.pdf',null,'paper_3');await read();
   await page.waitForFunction(()=>window.__counts().jobStages.at(-1)&&['ready','needs_details','failed'].includes(window.__counts().jobStages.at(-1).stage));state=await counts();assert.equal(await page.getByRole('button',{name:'Yes, build it',exact:true}).count(),0);assert.ok(!state.jobStages[0].evidence||!state.jobStages[0].evidence.documents.some(x=>x.id?.includes('reviewed')));await layout('optional-paper3-not-guessed');
   entry.scenarios.push('Optional Paper 3 never receives Paper 1/2 compulsory rules or a full-mock confirmation by guessing');await close();

   await fresh(theme,'approved-preset');await page.getByRole('button',{name:'OCR Paper 3',exact:true}).click();await page.getByRole('button',{name:'Yes, build it',exact:true}).click();await summary();
   assert.equal(await page.getByRole('img',{name:'Examly-approved preset',exact:true}).count(),1);state=await counts();assert.equal(state.syntheticModelCalls,0);assert.equal(state.syntheticReservations,0);await layout('approved-zero-ai');
   if(size.name==='laptop'&&theme==='dark')await shot('laptop-dark-approved-regression');entry.scenarios.push('The existing approved OCR Biology A Paper 3 preset retains its gold badge without model calls or quota reservation');await close();

   cases.push(entry);console.log(JSON.stringify({width:size.width,theme,status:'PASS',scenarios:entry.scenarios.length}));
  }
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(blockedRequests,[]);
  verifySourceHashes();
  const report={sourceFilesVerified:Object.keys(frozenHashes).length,sourceManifestSha256:frozenDigest,sourceHashesVerifiedBeforeAndAfter:true,verificationDate:new Date().toISOString().slice(0,10),status:'PASS',browserVersion:await browser.version(),syntheticOnly:true,realModelCalls:0,backendRequests:0,realLogins:0,liveDataWrites:0,cases,scenarioChecks:cases.reduce((n,c)=>n+c.scenarios.length,0),screenshots,fixtures:JSON.parse(fs.readFileSync(dir+'/fixtures.json')),errors,consoleErrors,failedRequests,blockedRequests,sourceHashes:JSON.parse(fs.readFileSync(dir+'/source-hashes.json')),limitations:['Chromium viewport emulation rather than physical iOS/iPadOS','Providers and persistence are synthetic; real extraction quality and live rollout remain unverified','Original generated fixtures contain no official questions, diagrams, answers or datasets']};
  fs.writeFileSync(dir+(process.argv.includes('--smoke')?'/smoke-results.json':'/browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,matrixCases:cases.length,scenarioChecks:report.scenarioChecks,screenshots:screenshots.length}));
 }catch(error){if(page){await page.screenshot({path:dir+'/failure.png',animations:'disabled'});fs.writeFileSync(dir+'/failure.json',JSON.stringify({error:String(error),body:await page.locator('body').innerText(),counts:await page.evaluate(()=>window.__counts?.()),errors,consoleErrors,failedRequests,blockedRequests},null,2));}throw error;}
 finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
