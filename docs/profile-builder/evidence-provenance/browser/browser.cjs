const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/opt/codex/cua_node/lib/node_modules/playwright-core');
const dir = __dirname;
const DATE_TEXT = 'First teaching 2015, first exams 2017';
const VERSION = 'Version 1.4 July 2026';
const WRONG_VERSION = 'Version 1.3 May 2025';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/lib/chromium/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [], consoleErrors = [], failedRequests = [], blockedRequests = [], cases = [], screenshots = [];
  let activePage;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    context.setDefaultTimeout(18000);
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname !== '127.0.0.1') {
        blockedRequests.push({ host: url.hostname, method: request.method(), path: url.pathname });
        return route.abort();
      }
      if (url.pathname === '/verify-builder' && request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/styles.css"><title>Examly evidence provenance verification</title></head><body><div id="root"></div><script>localStorage.clear();localStorage.setItem("examly_cookie_consent",JSON.stringify({necessary:true,analytics:false,preferences:false}));document.documentElement.classList.toggle("dark",new URLSearchParams(location.search).get("theme")==="dark");</script><script type="module" src="/bundle.js"></script></body></html>' });
      if (url.pathname === '/bundle.js' || url.pathname === '/styles.css') return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css', body: fs.readFileSync(dir + url.pathname) });
      if (url.pathname.startsWith('/fonts/')) return route.fulfill({ contentType: 'font/ttf', body: fs.readFileSync(path.join(dir, url.pathname)) });
      if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204, body: '' });
      blockedRequests.push({ host: url.hostname, method: request.method(), path: url.pathname });
      return route.abort();
    });
    const page = await context.newPage();
    activePage = page;
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    const counts = () => page.evaluate(() => window.__counts());
    const fresh = async (theme, scenario = 'null-tier') => {
      await page.goto('http://127.0.0.1:8099/verify-builder?theme=' + theme + '&scenario=' + scenario, { waitUntil: 'networkidle' });
      const fonts = await page.evaluate(async () => {
        await Promise.all([document.fonts.load('16px Manrope'), document.fonts.load('16px "Source Serif 4"')]);
        await document.fonts.ready;
        return { manrope: document.fonts.check('16px Manrope'), serif: document.fonts.check('16px "Source Serif 4"') };
      });
      assert.deepEqual(fonts, { manrope: true, serif: true });
    };
    const close = async () => {
      await page.getByRole('button', { name: 'Close profile builder', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    };
    const assessment = () => page.getByRole('combobox', { name: /^(?:Paper|Unit|Component|Assessment)$/i });
    const choose = async value => {
      const select = assessment();
      await select.waitFor();
      await page.waitForFunction(value => {
        const control = [...document.querySelectorAll('select')].find(el => /^(Paper|Unit|Component|Assessment)$/i.test(el.getAttribute('aria-label') || ''));
        return control && [...control.options].some(option => option.value === value || (option.value && new RegExp(value, 'i').test(option.textContent || '')));
      }, value);
      const options = await select.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, label: node.textContent })));
      const option = options.find(option => option.value === value) || options.find(option => option.value && new RegExp(value, 'i').test(option.label));
      assert.ok(option, 'Assessment option ' + value + ' exists: ' + JSON.stringify(options));
      await select.selectOption(option.value);
      return option;
    };
    const advanced = async () => {
      const summary = page.getByText('Advanced details', { exact: true });
      if (!await summary.evaluate(element => element.closest('details').open)) await summary.click();
    };
    const versionInput = () => page.getByLabel('Specification version / teaching dates (optional)', { exact: true });
    const fileCard = name => page.getByRole('list', { name: 'Attached source files' }).locator('li').filter({ hasText: name });
    const upload = async file => {
      let input = page.getByLabel('Syllabus or assessment brief', { exact: true });
      if (!await input.count()) await page.getByRole('button', { name: 'Upload syllabus', exact: true }).click();
      input = page.getByLabel('Syllabus or assessment brief', { exact: true });
      await input.setInputFiles(file);
      await fileCard(path.basename(file)).waitFor();
      return input;
    };
    const read = async () => {
      const button = page.getByRole('button', { name: 'Read syllabus', exact: true });
      await button.click();
    };
    const ready = async () => {
      await page.getByRole('button', { name: 'Yes, build it', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Yes, build it', exact: true }).isEnabled(), true);
      assert.doesNotMatch(await page.getByRole('dialog').innerText(), /could not find readable assessment information|Choose which paper this specification should follow/i);
    };
    const summary = async () => {
      await page.getByText('Your profile is ready', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Save profile', exact: true }).isEnabled(), true);
    };
    const layout = async label => {
      const dialog = page.getByRole('dialog');
      const result = await dialog.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, overflow: element.scrollWidth > element.clientWidth + 1, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1, width: innerWidth, height: innerHeight };
      });
      assert.ok(result.left >= -1 && result.right <= result.width + 1, label + ': horizontal fit');
      assert.ok(result.top >= -1 && result.bottom <= result.height + 1, label + ': vertical fit');
      assert.equal(result.overflow, false, label + ': dialog overflow');
      assert.equal(result.pageOverflow, false, label + ': page overflow');
      const primary = dialog.locator('button').last();
      const box = await primary.boundingBox();
      assert.ok(box && box.x >= -1 && box.x + box.width <= result.width + 1 && box.y + box.height <= result.height + 1, label + ': footer visible');
      assert.equal(await primary.evaluate(element => {
        const rect = element.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return element === hit || element.contains(hit) || (element instanceof HTMLButtonElement && element.disabled && element.parentElement?.contains(hit));
      }), true, label + ': footer uncovered');
      return result;
    };
    const shot = async name => {
      await page.screenshot({ path: dir + '/' + name + '.png', animations: 'disabled' });
      screenshots.push(name + '.png');
    };
    const startPhysics = async (theme, scenario = 'null-tier', paper = 'paper_1', version = DATE_TEXT) => {
      await fresh(theme, scenario);
      await page.getByRole('button', { name: 'A Level Physics', exact: true }).click();
      await choose(paper);
      if(paper === 'paper_3') await page.getByRole('combobox',{name:'Paper option',exact:true}).selectOption('astrophysics');
      await advanced();
      await versionInput().fill(version);
      const filename = paper === 'paper_3' ? 'physics-optional-96-pages.pdf' : 'physics-spec-96-pages.pdf';
      await upload(dir + '/' + filename);
      await page.getByLabel('Assessment mode', {exact:true}).selectOption('full_mock');
      assert.equal(await fileCard(filename).count(), 1);
      assert.equal((await counts()).requests.length, 0);
      return filename;
    };
    const terminal = () => page.waitForFunction(() => ['failed','needs_details'].includes(window.__counts().jobStages.at(-1)?.stage));
    const noDisclosure = async () => {
      const body = await page.getByRole('dialog').innerText();
      assert.doesNotMatch(body, /PRIVATE_MODEL_NOTE_DO_NOT_RENDER|invalidExtraction|invalidDraft|SourceChunk|promptTokens/);
      const status = await page.evaluate(() => window.__status());
      assert.doesNotMatch(JSON.stringify(status), /PRIVATE_MODEL_NOTE_DO_NOT_RENDER|invalidExtraction|invalidDraft|SourceChunk/);
      for (const issue of status?.validationIssues ?? []) assert.equal(Object.hasOwn(issue, 'detail'), false);
      return status;
    };
    const diagnosticsInView = async () => {
      await page.waitForFunction(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const details = dialog?.querySelector('[aria-label="Profile validation details"]');
        const title = dialog?.querySelector('h2');
        const buttons = dialog?.querySelectorAll('button');
        if (!details || !title || !buttons?.length) return false;
        const last = [...details.querySelectorAll('li')].at(-1);
        if (!last) return false;
        const header = title.closest('.shrink-0')?.getBoundingClientRect() ?? title.getBoundingClientRect();
        const body = details.getBoundingClientRect(), message = last.getBoundingClientRect();
        const footer = buttons[buttons.length-1].getBoundingClientRect();
        return body.top >= header.bottom && message.bottom <= footer.top;
      });
    };
    const sizes = [{ width: 1440, height: 1000, name: 'laptop' }, { width: 834, height: 1112, name: 'ipad' }, { width: 390, height: 844, name: 'phone' }, { width: 320, height: 780, name: 'narrow-phone' }];
    for (const size of sizes) for (const theme of ['light', 'dark']) {
      const entry = { ...size, theme, scenarios: [] };
      await page.setViewportSize({ width: size.width, height: size.height });

      const filename = await startPhysics(theme, 'unquoted-tier');
      await read(); await ready();
      let state = await counts();
      assert.equal(state.parsedPages,96); assert.ok(state.parsedCharacters>45000);
      assert.equal(state.syntheticModelCalls,1);
      const evidence = state.jobStages[0].evidence;
      assert.equal(evidence.facts.tier,'not_tiered');
      assert.equal(evidence.catalogueFacts.length,1);
      assert.equal(evidence.catalogueFacts[0].source,'assessment_catalogue');
      assert.equal(evidence.facts.selection,'all_compulsory');
      assert.equal(evidence.facts.calculator,'allowed');
      const publicStatus = await page.evaluate(() => window.__status());
      assert.equal(publicStatus.reviewedFacts?.tier?.source, 'assessment_catalogue');
      assert.equal(publicStatus.reviewedFacts?.tier?.value, 'not_tiered');
      assert.equal(publicStatus.reviewedFacts?.assessmentInstructions?.selection, 'all_compulsory');
      assert.equal(publicStatus.reviewedFacts?.assessmentInstructions?.calculator, 'allowed');
      assert.ok(publicStatus.reviewedFacts?.assessmentInstructions?.sourceUrls.every(url => /^https:\/\//.test(url)));
      entry.reviewedFacts = publicStatus.reviewedFacts;
      const verifiedFacts = page.locator('details[aria-label="Verified assessment facts"]');
      await verifiedFacts.waitFor();
      if (!await verifiedFacts.evaluate(element => element.open)) await verifiedFacts.locator('summary').click();
      assert.match(await verifiedFacts.innerText(), /Untiered.*course catalogue/s);
      assert.match(await verifiedFacts.innerText(), /reviewed.*official paper cover/s);
      assert.equal(await verifiedFacts.getByRole('link', {name:'Official assessment instructions',exact:true}).getAttribute('href'), publicStatus.reviewedFacts.assessmentInstructions.sourceUrls[0]);
      assert.ok(evidence.documents.some(doc=>doc.authority==='owner_supplied'&&doc.url===null));
      assert.ok(evidence.documents.some(doc=>doc.authority==='official_registered'&&/^https:\/\//.test(doc.url)));
      assert.equal(await fileCard(filename).count(),1);
      await layout('reviewed-provenance-confirmation');
      if(size.name==='phone'&&theme==='light') await shot('phone-light-reviewed-confirmation');
      await page.getByRole('button',{name:'Yes, build it',exact:true}).click(); await summary();
      assert.match(await page.getByRole('dialog').innerText(),/85/);
      assert.match(await page.getByRole('dialog').innerText(),/120/);
      assert.equal(await page.getByRole('img',{name:'Examly-approved preset',exact:true}).count(),0);
      await page.getByRole('button',{name:'Edit profile',exact:true}).click();
      await page.getByLabel('Profile name',{exact:true}).fill('Reviewed Physics Paper 1');
      await page.getByRole('button',{name:'Done editing',exact:true}).click();
      await page.getByRole('button',{name:'Save profile',exact:true}).click();
      await page.getByRole('dialog').waitFor({state:'hidden'});
      await page.getByRole('button',{name:'Reopen saved profile',exact:true}).click(); await summary();
      assert.match(await page.getByRole('dialog').innerText(),/Reviewed Physics Paper 1/);
      assert.equal((await counts()).syntheticModelCalls,2);
      await layout('reviewed-fullmock-saved-summary');
      if(size.name==='laptop'&&theme==='light') await shot('laptop-light-reviewed-fullmock');
      entry.parsedSource={pages:state.parsedPages,characters:state.parsedCharacters};
      entry.scenarios.push('Full mock accepts catalogue-backed untiered status with no invented PDFtierquote, injects exact reviewed official-cover instructions, and completes 85mark120minute editable memory save/reopen without a goldstar');
      await close();

      await startPhysics(theme,'observed-topics');
      await read(); await ready(); state=await counts();
      assert.equal(state.syntheticModelCalls,1);
      assert.equal(state.jobStages[0].evidence.facts.tier,'not_tiered');
      assert.equal(state.jobStages[0].evidence.facts.mathsRequirement,'At least 40% of the overall assessment uses mathematical skills at Level 2 or above, equivalent to higher GCSE mathematics.');
      await page.getByRole('button',{name:'Yes, build it',exact:true}).click(); await summary();
      assert.equal(await page.getByRole('img',{name:'Examly-approved preset',exact:true}).count(),0);
      await layout('observed-topic-complete-literal-maths');
      entry.scenarios.push('Null tier and observed normative specification topics resolve safely; a complete maths sentence split across source lines remains literal rather than using prefix acceptance');
      await close();

      await startPhysics(theme,'invalid-evidence');
      await read(); await terminal(); state=await counts();
      assert.equal(state.syntheticModelCalls,2);
      const issues=state.jobStages[0].validationIssues;
      assert.equal(issues.length,2);
      assert.deepEqual(issues.map(issue=>issue.attempt),[1,2]);
      assert.ok(issues.every(issue=>issue.stage==='extraction'&&issue.code&&issue.message));
      assert.ok(issues.some(issue=>issue.field==='marks'||/marks/i.test(issue.code+issue.message)));
      assert.ok(issues.some(issue=>issue.field==='topics'||/topic/i.test(issue.code+issue.message)));
      const details=page.locator('[aria-label="Profile validation details"]'); await details.waitFor();
      assert.match(await details.innerText(),/1/);assert.match(await details.innerText(),/2/);
      await diagnosticsInView();
      assert.equal(await page.getByRole('button',{name:'Save profile',exact:true}).count(),0);
      assert.equal(await fileCard('physics-spec-96-pages.pdf').count(),1);
      await noDisclosure(); const before=state.syntheticModelCalls; await page.evaluate(()=>window.__status()); assert.equal((await counts()).syntheticModelCalls,before);
      await layout('two-extraction-rejections-visible');
      if(size.name==='phone'&&theme==='dark')await shot('phone-dark-two-rejection-details');
      entry.scenarios.push('Both marks/topic rejection reasons survive the bounded repair, are shown safely, retain the upload and cannot replay model work or disclose rejected private payloads');
      await close();

      await fresh(theme,'unknown-maths-calculator');
      await page.getByRole('button',{name:'University',exact:true}).click();
      await upload(dir+'/institution-maths-only.txt');
      await assessment().selectOption('__manual');
      await page.getByLabel('Assessment name (manual)',{exact:true}).fill('Final assessment');
      await page.getByLabel('Assessment mode',{exact:true}).selectOption('full_mock');
      await read(); await terminal(); state=await counts();
      assert.equal(state.syntheticModelCalls,2);
      assert.ok(state.jobStages[0].validationIssues.some(issue=>issue.field==='calculator'||/calculator/i.test(issue.message+issue.code)));
      assert.equal(state.jobStages[0].evidence,null);
      assert.equal(await page.getByRole('button',{name:'Yes, build it',exact:true}).count(),0);
      assert.equal(await fileCard('institution-maths-only.txt').count(),1);
      await noDisclosure(); await layout('maths-mention-is-not-calculator-permission');
      entry.scenarios.push('An unregistered institution course receives no catalogue/cover privileges and a maths example mentioning a calculator cannot establish permission');
      await close();

      await startPhysics(theme,'optional-paper3','paper_3');
      await read(); await terminal(); state=await counts();
      assert.equal(state.syntheticModelCalls,1);
      assert.equal(state.jobStages[0].stage,'needs_details');
      assert.equal(state.jobStages[0].evidence.facts.selection,'optional');
      assert.ok(!state.jobStages[0].evidence.documents.some(doc=>doc.authority==='official_registered'));
      assert.equal(await page.getByRole('button',{name:'Yes, build it',exact:true}).count(),0);
      assert.match(await page.getByRole('dialog').innerText(),/optional|adapter|choices/i);
      await layout('paper3-option-cannot-inherit-paper1-rules');
      entry.scenarios.push('Paper3 optional content stays blocked by its reviewed-adapter requirement and never inherits Paper1 compulsory/calculator instructions');
      await close();

      await startPhysics(theme,'version-conflict','paper_1',WRONG_VERSION);
      await read(); await terminal(); state=await counts();
      assert.equal(state.jobStages[0].stage,'needs_details'); assert.equal(state.syntheticModelCalls,1);
      assert.match(await page.getByRole('dialog').innerText(),/specification.*version|version.*specification/i);
      assert.equal(await page.getByRole('button',{name:'Yes, build it',exact:true}).count(),0);
      assert.equal(await fileCard('physics-spec-96-pages.pdf').count(),1);
      await layout('genuine-version-conflict-preserved');
      entry.scenarios.push('A genuine specification issue conflict remains a one-call targeted stop, preserving version and file rather than applying a blanket default');
      await close();

      await startPhysics(theme,'draft-failures');
      await read(); await ready(); await page.getByRole('button',{name:'Yes, build it',exact:true}).click(); await terminal();
      state=await counts(); assert.equal(state.syntheticModelCalls,3);
      const draftIssues=state.jobStages[0].validationIssues;
      assert.equal(draftIssues.length,2); assert.ok(draftIssues.every(issue=>issue.stage==='draft'));
      assert.deepEqual(draftIssues.map(issue=>issue.attempt),[2,3]);
      await page.locator('[aria-label="Profile validation details"]').waitFor();
      await diagnosticsInView();
      assert.equal(await page.getByRole('button',{name:'Save profile',exact:true}).count(),0);
      await noDisclosure(); await layout('draft-repair-history-within-overall-budget');
      entry.scenarios.push('Both rejected draft attempts are retained and shown within the original overall three-call budget; no invalid profile becomes saveable');
      await close();

      await fresh(theme,'approved-preset');
      await page.getByRole('button',{name:'OCR Paper 3',exact:true}).click();
      await page.getByRole('button',{name:'Yes, build it',exact:true}).click(); await summary();
      assert.equal(await page.getByRole('img',{name:'Examly-approved preset',exact:true}).count(),1);
      assert.equal((await counts()).syntheticModelCalls,0); assert.equal((await counts()).syntheticReservations,0);
      await layout('approved-preset-zero-ai-regression');
      if(size.name==='laptop'&&theme==='dark')await shot('laptop-dark-approved-regression');
      if(size.name==='ipad'&&theme==='light')await shot('ipad-light-approved-regression');
      entry.scenarios.push('Existing approved OCR H420/03 retains its gold badge with zero model calls or quota reservations');
      await close();

      cases.push(entry); console.log(JSON.stringify({width:size.width,theme,status:'PASS',scenarios:entry.scenarios.length}));
    }
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(failedRequests, []); assert.deepEqual(blockedRequests, []);
    const report = { status: 'PASS', browserVersion: await browser.version(), syntheticOnly: true, realModelCalls: 0, backendRequests: 0, realLogins: 0, liveDataWrites: 0, cases, scenarioChecks: cases.reduce((total, entry) => total + entry.scenarios.length, 0), screenshots, fixtures: JSON.parse(fs.readFileSync(dir + '/fixtures.json')), errors, consoleErrors, failedRequests, blockedRequests, sourceHashes: JSON.parse(fs.readFileSync(dir + '/source-hashes.json')), limitations: ['Chromium viewport emulation rather than physical iOS/iPadOS devices', 'Provider responses and persistence are synthetic; this does not prove live deployment or real provider quality', 'Synthetic long PDFs contain original software-test content, not official AQA question or mark-scheme material', 'Named optional-paper rules are rejected rather than attempting unsupported optional-paper generation'] };
    fs.writeFileSync(dir + '/browser-results.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ status: report.status, matrixCases: cases.length, scenarioChecks: report.scenarioChecks, screenshots: screenshots.length }));
  } catch (error) {
    if (activePage) {
      await activePage.screenshot({ path: dir + '/failure.png', animations: 'disabled' });
      fs.writeFileSync(dir + '/failure.json', JSON.stringify({ error: String(error), body: await activePage.locator('body').innerText(), counts: await activePage.evaluate(() => window.__counts?.()), errors, consoleErrors, failedRequests, blockedRequests }, null, 2));
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
