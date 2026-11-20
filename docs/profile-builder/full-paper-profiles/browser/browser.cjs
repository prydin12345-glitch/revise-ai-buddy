const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const{artifacts,fontDir,verifyFrozenHashes}=require('./runtime.cjs');
const{chromium}=require(process.env.PLAYWRIGHT_CORE_PATH||'/tmp/examly-business-tools/node_modules/playwright-core');
(async()=>{
  const before=verifyFrozenHashes(),errors=[],blocked=[],cases=[];
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    for(const viewport of[{name:'laptop',width:1440,height:1000},{name:'ipad',width:834,height:1194},{name:'phone',width:390,height:844}])for(const theme of['light','dark'])for(const scenario of['paper1','paper2','paper3','unknown']){
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},reducedMotion:'reduce'});
      await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!=='http://127.0.0.1:8099'){blocked.push(url.origin+url.pathname);return route.abort();}
        if(url.pathname==='/verify-builder')return route.fulfill({contentType:'text/html',body:`<!doctype html><html class="${theme==='dark'?'dark':''}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>`});
        if(['/bundle.js','/styles.css'].includes(url.pathname))return route.fulfill({contentType:url.pathname.endsWith('.js')?'text/javascript':'text/css',body:fs.readFileSync(path.join(artifacts,path.basename(url.pathname)))});
        if(url.pathname.startsWith('/fonts/'))return route.fulfill({contentType:'font/ttf',body:fs.readFileSync(path.join(fontDir,path.basename(url.pathname)))});
        if(url.pathname==='/favicon.ico')return route.fulfill({status:204,body:''});
        blocked.push(url.pathname);return route.abort();
      });
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
      await page.goto(`http://127.0.0.1:8099/verify-builder?scenario=${scenario}`);
      await page.getByRole('button',{name:'Build profile',exact:true}).click();
      assert.equal(await page.getByRole('combobox',{name:'Assessment mode',exact:true}).count(),0);
      assert.equal(await page.getByRole('button',{name:'General practice without a syllabus',exact:true}).count(),0);
      assert.equal(await page.getByText('Choose quiz topics and length later.',{exact:false}).isVisible(),true);
      await page.getByRole('button',{name:'Upload syllabus',exact:true}).click();
      const text=await page.evaluate(()=>window.__text);
      await page.getByLabel('Syllabus or assessment brief',{exact:true}).setInputFiles({name:'synthetic-assessment.txt',mimeType:'text/plain',buffer:Buffer.from(text)});
      const select=page.getByRole('combobox',{name:/^(Assessment|Paper)$/});
      const number=scenario==='unknown'?1:Number(scenario.slice(-1));
      const option=select.locator('option').filter({hasText:new RegExp('^Paper '+number+'(?: —|$)')});
      await option.waitFor({state:'attached'});await select.selectOption(await option.getAttribute('value'));
      await page.getByRole('button',{name:'Read syllabus',exact:true}).click();
      if(scenario==='unknown'){
        await page.getByText(/We could not verify the assessment tier for this full-paper profile/).waitFor();
        assert.equal(await page.getByText('Continue as short practice with tier unverified',{exact:true}).count(),0);
        assert.equal(await page.getByRole('button',{name:'Start new build',exact:true}).isEnabled(),true);
      }else{
        await page.getByRole('button',{name:'Yes, build it',exact:true}).waitFor();
        assert.match(await page.getByText(/Full mock using/).innerText(),/Full mock/);
        assert.equal(await page.getByText(/These sources do not establish/).count(),0);
        await page.getByText('Verified assessment facts',{exact:true}).click();
        assert.equal(await page.getByText(/Untiered — verified from the course catalogue/).isVisible(),true);
      }
      const history=await page.evaluate(()=>window.__calls());
      assert.equal(history.length,1);assert.equal(history[0].mode,'full_mock');
      assert.equal(history[0].identity.component,scenario==='unknown'?'UX01/01':`9BS0/0${number}`);
      if(scenario!=='unknown')assert.equal(history[0].identity.tier,'not_tiered');
      assert.equal(history[0].uploads.length,1);
      const b=await page.getByRole('dialog',{name:'Build your exam profile'}).evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:innerWidth,scroll:el.scrollWidth,client:el.clientWidth,body:document.documentElement.scrollWidth}));
      assert.ok(b.left>=-1&&b.right<=b.width+1&&b.scroll<=b.client+1&&b.body<=b.width+1,JSON.stringify(b));
      const screenshot=`${viewport.name}-${theme}-${scenario}.png`;await page.screenshot({path:path.join(artifacts,screenshot),animations:'disabled'});
      cases.push({viewport,theme,scenario,mode:'full_mock',noModeChooser:true,uploadRetained:true,noHorizontalOverflow:true,screenshot});await context.close();
    }
  }finally{await browser.close();}
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  fs.writeFileSync(path.join(artifacts,'browser-results.json'),JSON.stringify({status:'PASS',boundary:'Actual UI/local discovery, controlled source API. Provider and generation flows are tested separately; no live AI/account/database.',cases,errors,blockedRequests:blocked,hashesBefore:before,hashesAfter:verifyFrozenHashes()},null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',cases:cases.length,artifacts}));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
