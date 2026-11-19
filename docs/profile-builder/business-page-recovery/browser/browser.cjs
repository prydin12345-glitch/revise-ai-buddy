const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { artifacts, fontDir, verifyFrozenHashes } = require('./runtime.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || '/tmp/examly-business-tools/node_modules/playwright-core');
(async () => {
  const before = verifyFrozenHashes(), errors = [], blocked = [], cases = [];
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  try {
    for (const viewport of [{name:'laptop',width:1440,height:1000},{name:'ipad',width:834,height:1194},{name:'phone',width:390,height:844}]) for (const theme of ['light','dark']) for (const scenario of ['pages','tier','failed']) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'http://127.0.0.1:8099') { blocked.push(url.origin+url.pathname); return route.abort(); }
        if (url.pathname === '/verify-builder') return route.fulfill({ contentType:'text/html', body:`<!doctype html><html class="${theme === 'dark' ? 'dark' : ''}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>` });
        if (['/bundle.js','/styles.css'].includes(url.pathname)) return route.fulfill({ contentType:url.pathname.endsWith('.js')?'text/javascript':'text/css', body:fs.readFileSync(path.join(artifacts,path.basename(url.pathname))) });
        if (url.pathname.startsWith('/fonts/')) return route.fulfill({ contentType:'font/ttf',body:fs.readFileSync(path.join(fontDir,path.basename(url.pathname))) });
        if (url.pathname === '/favicon.ico') return route.fulfill({status:204,body:''});
        blocked.push(url.pathname); return route.abort();
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if(message.type()==='error') errors.push(message.text()); });
      const calls = () => page.evaluate(() => window.__calls());
      const bounds = async () => {
        const b = await page.getByRole('dialog',{name:'Build your exam profile'}).evaluate(el => ({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:innerWidth,client:el.clientWidth,scroll:el.scrollWidth,body:document.documentElement.scrollWidth}));
        assert.ok(b.left>=-1 && b.right<=b.width+1 && b.scroll<=b.client+1 && b.body<=b.width+1,JSON.stringify(b));
      };
      await page.goto(`http://127.0.0.1:8099/verify-builder?scenario=${scenario}`);
      await page.getByRole('button',{name:'Build Business profile',exact:true}).click();
      await page.getByRole('button',{name:'Upload syllabus',exact:true}).click();
      const text = await page.evaluate(() => window.__fixtures.text);
      await page.getByLabel('Syllabus or assessment brief',{exact:true}).setInputFiles({name:'synthetic-business.txt',mimeType:'text/plain',buffer:Buffer.from(text)});
      const assessment = page.getByRole('combobox',{name:/^(Assessment|Paper)$/});
      await assessment.locator('option').filter({hasText:'Paper 1 —'}).waitFor({state:'attached'});
      const value = await assessment.locator('option').filter({hasText:'Paper 1 —'}).getAttribute('value');
      await assessment.selectOption(value);
      await page.getByRole('button',{name:'Read syllabus',exact:true}).click();
      await page.getByRole('button',{name:'Start new build',exact:true}).waitFor();
      assert.equal((await calls()).length,1);
      if (scenario === 'pages') {
        const input = page.getByLabel(/Which PDF page has this information/);
        await input.fill('13,14,17,18,39,40,45');
        assert.equal((await calls()).length,1);
        await page.getByRole('button',{name:'Continue',exact:true}).click();
        await page.getByRole('button',{name:'Yes, build it',exact:true}).waitFor();
        const status = await page.getByRole('status').filter({hasText:'PDF page 18'}).innerText();
        assert.match(status,/PDF page 18[^:]*: selected for reading/);
        assert.match(status,/PDF page 40[^:]*: selected for reading/);
        assert.doesNotMatch(status,/couldn.t safely link/);
      } else if (scenario === 'tier') {
        const choice = page.getByLabel('These sources do not establish the assessment tier.',{exact:true});
        assert.equal(await page.getByRole('button',{name:'Continue',exact:true}).isDisabled(),true);
        await choice.selectOption('unknown_practice');
        assert.equal((await calls()).length,1);
        await page.getByRole('button',{name:'Continue',exact:true}).click();
        await page.getByRole('button',{name:'Yes, build it',exact:true}).waitFor();
        assert.match(await page.getByText(/Short practice using/).innerText(),/Short practice/);
      } else {
        await page.getByRole('button',{name:'Change details or documents',exact:true}).click();
        assert.equal((await calls()).length,1);
        assert.equal(await assessment.inputValue(),value);
        await page.getByRole('button',{name:'Start new build',exact:true}).click();
        const dialog = page.getByRole('alertdialog',{name:'Start a new build?'});
        assert.match(await dialog.innerText(),/Starting again makes no AI call/);
        await dialog.getByRole('button',{name:'Start again',exact:true}).click();
        assert.equal((await calls()).length,1);
        assert.equal(await assessment.inputValue(),value);
        assert.equal(await page.getByText('synthetic-business.txt',{exact:true}).count(),1);
        await page.getByRole('button',{name:'Read syllabus',exact:true}).click();
        await page.getByRole('button',{name:'Start new build',exact:true}).waitFor();
        const history = await calls();
        assert.equal(history.length,2);
        assert.notEqual(history[0].requestId,history[1].requestId);
        assert.deepEqual(history[0].uploads,history[1].uploads);
        assert.equal(history[0].identity.component,history[1].identity.component);
        await page.getByRole('button',{name:'Start new build',exact:true}).scrollIntoViewIfNeeded();
      }
      await bounds();
      assert.equal((await calls()).length,2);
      const screenshot=`${viewport.name}-${theme}-${scenario}.png`;
      await page.screenshot({path:path.join(artifacts,screenshot),animations:'disabled'});
      cases.push({viewport,theme,scenario,noHorizontalOverflow:true,explicitActionOnly:true,uploadRetained:true,screenshot});
      await context.close();
    }
  } finally { await browser.close(); }
  assert.deepEqual(errors,[]); assert.deepEqual(blocked,[]);
  const report={status:'PASS',boundary:'Actual UI/local inspection and deterministic public-excerpt indexing; controlled API. Backend/client build-flow regressions run separately. No live AI, account, database or private upload.',cases,errors,blockedRequests:blocked,hashesBefore:before,hashesAfter:verifyFrozenHashes()};
  fs.writeFileSync(path.join(artifacts,'browser-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',cases:cases.length,artifacts}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
