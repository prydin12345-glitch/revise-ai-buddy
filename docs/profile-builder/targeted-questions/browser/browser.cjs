const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('/opt/codex/cua_node/lib/node_modules/playwright-core');
const dir=__dirname;
const DATE_TEXT='First teaching 2015, first exams 2017';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/lib/chromium/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors=[],consoleErrors=[],failedRequests=[],blockedRequests=[],cases=[],screenshots=[];
 let page;
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  context.setDefaultTimeout(18000);
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.hostname!=='127.0.0.1'){blockedRequests.push({host:url.hostname,path:url.pathname});return route.abort();}
   if(url.pathname==='/verify-builder'&&request.isNavigationRequest())return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/styles.css"><title>Examly targeted follow-up verification</title></head><body><div id="root"></div><script>localStorage.clear();localStorage.setItem("examly_cookie_consent",JSON.stringify({necessary:true,analytics:false,preferences:false}));document.documentElement.classList.toggle("dark",new URLSearchParams(location.search).get("theme")==="dark");</script><script type="module" src="/bundle.js"></script></body></html>'});
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
  const start=async(theme,scenario='combined',filename='combined-physics-96-pages.pdf',version=DATE_TEXT)=>{
   await fresh(theme,scenario);await page.getByRole('button',{name:'A Level Physics',exact:true}).click();await choose('paper_1');await advanced();await page.getByLabel('Specification version / teaching dates (optional)',{exact:true}).fill(version);await upload(filename);await page.getByLabel('Assessment mode',{exact:true}).selectOption('full_mock');
   assert.equal((await counts()).requests.length,0);
  };
  const shot=async name=>{await page.screenshot({path:dir+'/'+name+'.png',animations:'disabled'});screenshots.push(name+'.png');};
  const layout=async label=>{
   const dialog=page.getByRole('dialog');
   const result=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:el.scrollWidth>el.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,width:innerWidth,height:innerHeight};});
   assert.ok(result.left>=-1&&result.right<=result.width+1,label+': horizontal fit');assert.ok(result.top>=-1&&result.bottom<=result.height+1,label+': vertical fit');assert.equal(result.overflow,false,label+': dialog overflow');assert.equal(result.pageOverflow,false,label+': page overflow');
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
   if(process.argv.includes('--laptop-capture')&&(size.name!=='laptop'||theme!=='light'))continue;
   await page.setViewportSize({width:size.width,height:size.height});
   const entry={...size,theme,scenarios:[]};

   await start(theme);await read();await ready();let state=await counts();
   assert.equal(state.parseCalls,1);assert.equal(state.parsedPages,96);assert.ok(state.parsedCharacters>45000);assert.equal(state.syntheticModelCalls,1);
   const snippets=state.sourceContexts.flatMap(x=>x.documents.flatMap(d=>d.pages.map(p=>p.text))).join('\n');
   assert.doesNotMatch(snippets,/AS-only sentinel|70 marks|90 minutes|Waves at AS depth/);
   assert.match(snippets,/85 marks/);assert.ok(state.sourceContexts.every(x=>x.qualification==='A-level'&&x.component==='7408/1'));
   await page.getByRole('button',{name:'Yes, build it',exact:true}).click();await summary();
   assert.equal((await counts()).syntheticModelCalls,2);assert.match(await page.getByRole('dialog').innerText(),/85/);assert.match(await page.getByRole('dialog').innerText(),/120/);await layout('combined-fullmock-preview');
   await page.getByRole('button',{name:'Edit profile',exact:true}).click();await page.getByLabel('Profile name',{exact:true}).fill('Combined A-level Physics Paper 1');await page.getByRole('button',{name:'Done editing',exact:true}).click();await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByRole('button',{name:'Reopen saved profile',exact:true}).click();await summary();assert.match(await page.getByRole('dialog').innerText(),/Combined A-level Physics Paper 1/);assert.equal((await counts()).syntheticModelCalls,2);
   if(size.name==='laptop'&&theme==='light')await shot('laptop-light-combined-profile-preview');
   entry.scenarios.push('Combined 96-page AS/A-level source resolves the chosen A-level course and Paper 1 without exposing AS marks or topics to extraction, then reaches the editable 85-mark/120-minute preview');await close();

   await start(theme,'missing-assessment','paper2-physics-96-pages.pdf');await read();await onlyQuestion('paper2-physics-96-pages.pdf');
   state=await counts();assert.equal(state.syntheticModelCalls,0);assert.equal(state.parseCalls,1);const before=state.requests.find(x=>x.action==='prepare_source').requestId;
   if(size.name==='phone'&&theme==='dark')await shot('phone-dark-targeted-assessment');
   if(size.name==='ipad'&&theme==='light')await shot('ipad-light-targeted-assessment');
   await question().getByRole('button',{name:'Change',exact:true}).click();
   await page.getByRole('button',{name:'Back to question',exact:true}).waitFor();assert.equal(await fileCard('paper2-physics-96-pages.pdf').count(),1);assert.equal((await counts()).parseCalls,1);assert.equal((await counts()).syntheticModelCalls,0);
   await page.getByRole('button',{name:'Back to question',exact:true}).click();await onlyQuestion('paper2-physics-96-pages.pdf');
   await answer('Paper 2');await ready();state=await counts();
   assert.equal(state.parseCalls,1,'Answer reuses the prior PDF read');assert.equal(state.syntheticModelCalls,1);assert.equal(state.requests.filter(x=>x.action==='prepare_source').length,1);assert.ok(state.requests.filter(x=>x.jobId).every(x=>x.jobId===before));assert.equal(state.jobStages.length,1);assert.equal(state.jobStages[0].identity.component,'7408/2');assert.equal(await fileCard('paper2-physics-96-pages.pdf').count(),1);
   await page.getByRole('button',{name:'Yes, build it',exact:true}).click();await summary();assert.equal((await counts()).syntheticModelCalls,2);await layout('samejob-assessment-answer');
   entry.scenarios.push('A missing assessment shows one source-backed choice with locked details and a retained file; answering continues the same job with one PDF parse and no duplicate extraction');await close();

   await start(theme,'two-items');await read();await onlyQuestion('combined-physics-96-pages.pdf');
   assert.equal(await page.getByRole('textbox').count(),0,'The dependent page question is not yet rendered');
   await answer('Paper 1');await question().getByText('Which PDF page shows the assessment overview?',{exact:true}).waitFor();await onlyQuestion('combined-physics-96-pages.pdf','text');
   if(size.name==='phone'&&theme==='light')await shot('phone-light-dependent-question');
   await answer('90');await ready();state=await counts();assert.equal(state.uiQuestionStep,2);assert.equal(state.parseCalls,1);assert.equal(state.syntheticModelCalls,1);assert.equal(state.requests.filter(x=>x.action==='answer_source').length,2);await layout('two-focused-question-ui');
   entry.scenarios.push('A controlled two-item owner-scoped response renders dependent questions one at a time, keeps the upload and hides unrelated form fields; answering both resumes the real indexed service');await close();

   await start(theme,'page-choice','page-choice-combined-96-pages.pdf');await read();await onlyQuestion('page-choice-combined-96-pages.pdf');
   state=await counts();assert.equal(state.syntheticModelCalls,0);assert.equal(state.parseCalls,1);const pageJob=state.requests.find(x=>x.action==='prepare_source').requestId;
   if(size.name==='narrow-phone'&&theme==='dark')await shot('narrow-phone-dark-page-question');
   if(size.name==='laptop'&&theme==='light')await shot('laptop-light-page-question');
   await answer('Page 90');await ready();state=await counts();assert.equal(state.parseCalls,1);assert.equal(state.syntheticModelCalls,1);assert.equal(state.jobStages[0].id,pageJob);assert.equal(await fileCard('page-choice-combined-96-pages.pdf').count(),1);
   const selectedText=state.sourceContexts.flatMap(x=>x.documents.flatMap(d=>d.pages.map(p=>p.text))).join('\n');assert.match(selectedText,/85 marks/);assert.doesNotMatch(selectedText,/70 marks|90 minutes|AS-only topics/);await layout('page-answer-reuses-reading');
   entry.scenarios.push('Choosing the explicit A-level overview page bypasses an unrelated inseparable comparison page while reusing the same parsed source, job and strict literal evidence checks');await close();

   await start(theme,'undecidable','unpartitioned-combined.pdf');await read();await question().waitFor();
   state=await counts();assert.equal(state.syntheticModelCalls,0);assert.equal(state.parseCalls,1);assert.equal(await fileCard('unpartitioned-combined.pdf').count(),1);assert.equal(await page.getByRole('button',{name:'Yes, build it',exact:true}).count(),0);assert.match(await question().innerText(),/page|overview|source|qualification/i);await layout('undecidable-combined-question');
   await answer('Page 1');await question().locator('input[type="file"]').waitFor({state:'attached'});assert.match(await question().innerText(),/assessment overview|qualification/i);state=await counts();assert.equal(state.syntheticModelCalls,0);assert.equal(state.parseCalls,1);assert.equal(await fileCard('unpartitioned-combined.pdf').count(),1);assert.equal(await page.getByRole('button',{name:'Yes, build it',exact:true}).count(),0);assert.equal(await question().locator('input[type="file"]').count(),1);
   entry.scenarios.push('An inseparable mixed AS/A-level table asks for focused source information; selecting the still-inseparable page requests a separate overview, retains the upload and blocks generation without a model call or invented row assignment');await close();

   await start(theme,'version-conflict','combined-physics-96-pages.pdf','Version 1.3 May 2025');await read();
   await page.waitForFunction(()=>window.__counts().jobStages.at(-1)?.needs?.some(x=>/edition|version/i.test(x)));
   state=await counts();assert.equal(state.syntheticModelCalls,1);assert.equal(await page.getByRole('button',{name:'Yes, build it',exact:true}).count(),0);assert.equal(await fileCard('combined-physics-96-pages.pdf').count(),1);await layout('version-gate-preserved');
   entry.scenarios.push('A genuinely different specification edition remains blocked after one accounted extraction, with the upload retained and no silent version override');await close();

   await fresh(theme,'approved-preset');await page.getByRole('button',{name:'OCR Paper 3',exact:true}).click();await page.getByRole('button',{name:'Yes, build it',exact:true}).click();await summary();
   assert.equal(await page.getByRole('img',{name:'Examly-approved preset',exact:true}).count(),1);state=await counts();assert.equal(state.syntheticModelCalls,0);assert.equal(state.syntheticReservations,0);await layout('approved-zero-ai');
   if(size.name==='laptop'&&theme==='dark')await shot('laptop-dark-approved-regression');entry.scenarios.push('Existing OCR A-level Biology A Paper 3 approved preset retains its gold badge with no model calls or quota reservation');await close();

   cases.push(entry);console.log(JSON.stringify({width:size.width,theme,status:'PASS',scenarios:entry.scenarios.length}));
  }
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(blockedRequests,[]);
  const report={verificationDate:new Date().toISOString().slice(0,10),status:'PASS',browserVersion:await browser.version(),syntheticOnly:true,realModelCalls:0,backendRequests:0,realLogins:0,liveDataWrites:0,cases,scenarioChecks:cases.reduce((n,c)=>n+c.scenarios.length,0),screenshots,fixtures:JSON.parse(fs.readFileSync(dir+'/fixtures.json')),errors,consoleErrors,failedRequests,blockedRequests,sourceHashes:JSON.parse(fs.readFileSync(dir+'/source-hashes.json')),limitations:['Chromium viewport emulation rather than physical iOS/iPadOS','Providers and persistence are synthetic; real extraction quality and live rollout remain unverified','Two-item UI response is controlled while real same-job assessment continuation is separately exercised','Original generated fixtures contain no official questions, diagrams, answers or datasets']};
  fs.writeFileSync(dir+(process.argv.includes('--laptop-capture')?'/laptop-capture-results.json':'/browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,matrixCases:cases.length,scenarioChecks:report.scenarioChecks,screenshots:screenshots.length}));
 }catch(error){if(page){await page.screenshot({path:dir+'/failure.png',animations:'disabled'});fs.writeFileSync(dir+'/failure.json',JSON.stringify({error:String(error),body:await page.locator('body').innerText(),counts:await page.evaluate(()=>window.__counts?.()),errors,consoleErrors,failedRequests,blockedRequests},null,2));}throw error;}
 finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
