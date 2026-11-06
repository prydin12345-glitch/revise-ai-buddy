const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/opt/codex/cua_node/lib/node_modules/playwright-core');
const dir = '/workspace/examly-builder-version-recovery-verification';
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
      if (url.pathname === '/verify-builder' && request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/styles.css"><title>Examly version context verification</title></head><body><div id="root"></div><script>localStorage.clear();localStorage.setItem("examly_cookie_consent",JSON.stringify({necessary:true,analytics:false,preferences:false}));document.documentElement.classList.toggle("dark",new URLSearchParams(location.search).get("theme")==="dark");</script><script type="module" src="/bundle.js"></script></body></html>' });
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
    const fresh = async theme => {
      await page.goto('http://127.0.0.1:8099/verify-builder?theme=' + theme, { waitUntil: 'networkidle' });
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
    const startPhysics = async (theme, paper = 'paper_1', version = DATE_TEXT, filename = 'physics-paper1-96-pages.pdf', label = 'A Level Physics') => {
      await fresh(theme);
      await page.getByRole('button', { name: label, exact: true }).click();
      await choose(paper);
      await advanced();
      await versionInput().fill(version);
      await upload(dir + '/' + filename);
      assert.equal(await fileCard(filename).count(), 1);
      assert.equal((await counts()).requests.length, 0);
      return filename;
    };
    const sizes = [{ width: 1440, height: 1000, name: 'laptop' }, { width: 834, height: 1112, name: 'ipad' }, { width: 390, height: 844, name: 'phone' }, { width: 320, height: 780, name: 'narrow-phone' }];
    for (const size of sizes) for (const theme of ['light', 'dark']) {
      const entry = { ...size, theme, scenarios: [] };
      await page.setViewportSize({ width: size.width, height: size.height });

      const filename = await startPhysics(theme);
      assert.equal(await versionInput().inputValue(), DATE_TEXT);
      await read(); await ready();
      let state = await counts();
      const prepared = state.requests.find(request => request.action === 'prepare_source');
      assert.equal(prepared.identity.specificationVersion, DATE_TEXT);
      assert.equal(state.parsedPages, 96);
      assert.ok(state.parsedCharacters > 45000);
      assert.equal(state.syntheticModelCalls, 1);
      assert.equal(state.sourceContexts[0].version, 'Not verified');
      assert.equal(state.sourceContexts[0].userContext.specificationDates, DATE_TEXT);
      assert.equal(state.jobStages[0].requestedIdentity.specificationVersion, DATE_TEXT);
      assert.equal(state.jobStages[0].identity.specificationVersion, VERSION);
      assert.equal(state.jobStages[0].identity.component, '7408/1');
      assert.equal(await fileCard(filename).count(), 1);
      await layout('date-hint-confirmation');
      if (size.name === 'phone' && theme === 'light') await shot('phone-light-date-confirmation');
      await page.getByRole('button', { name: 'Yes, build it', exact: true }).click(); await summary();
      assert.equal(await page.getByRole('img', { name: 'Examly-approved preset', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
      await page.getByLabel('Profile name', { exact: true }).fill('My Physics Paper 1');
      await page.getByRole('button', { name: 'Done editing', exact: true }).click();
      await page.getByRole('button', { name: 'Save profile', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Reopen saved profile', exact: true }).click(); await summary();
      assert.match(await page.getByRole('dialog').innerText(), /My Physics Paper 1/);
      assert.equal((await counts()).syntheticModelCalls, 2);
      await layout('date-hint-saved-summary');
      entry.parsedSource = { pages: state.parsedPages, characters: state.parsedCharacters };
      entry.scenarios.push('Exact teaching/exam dates survive prepare as weak context, resolve to a cited real version, and complete confirmation/edit/memory save/reopen without a gold star');
      await close();

      await startPhysics(theme, 'paper_1', DATE_TEXT, 'physics-missing-dates-96-pages.pdf');
      await page.getByLabel('Assessment mode', { exact: true }).selectOption('full_mock');
      await read(); await ready();
      state = await counts();
      assert.equal(state.jobStages[0].identity.specificationVersion, VERSION);
      assert.equal(state.jobStages[0].requestedIdentity.specificationVersion, DATE_TEXT);
      await page.getByRole('button', { name: 'Yes, build it', exact: true }).click(); await summary();
      assert.equal((await counts()).jobStages[0].identity.specificationVersion, VERSION);
      assert.match(await page.getByRole('dialog').innerText(), /85/);
      assert.match(await page.getByRole('dialog').innerText(), /120/);
      await layout('missing-cover-date-summary');
      entry.scenarios.push('Missing extracted cover years never become evidence: the cited issue resolves independently and Full mock uses the source totals');
      await close();

      await startPhysics(theme, 'paper_1', DATE_TEXT, 'physics-paper2-96-pages.pdf');
      await read();
      const recovery = page.getByRole('combobox', { name: 'Assessment found in your source', exact: true });
      await recovery.waitFor();
      await page.waitForFunction(() => {
        const select = document.querySelector('select[aria-label="Assessment found in your source"]');
        const title = [...document.querySelectorAll('[role="dialog"] h2')][0];
        if (!select || !title) return false;
        const box = select.getBoundingClientRect(), heading = title.getBoundingClientRect();
        const panel = select.closest('[aria-live]'), question = panel?.querySelector('p')?.getBoundingClientRect();
        return question && question.top >= heading.bottom && box.top >= heading.bottom && box.bottom < innerHeight - 80;
      });
      assert.equal(await page.getByRole('button', { name: 'Read syllabus', exact: true }).isEnabled(), false);
      assert.doesNotMatch(await page.getByRole('dialog').innerText(), /We need a source for this course/);
      const recoveredOptions = await recovery.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, label: node.textContent })));
      const paperTwo = recoveredOptions.find(option => option.value && /Paper 2/.test(option.label));
      assert.ok(paperTwo, 'Paper 2 offered from the source');
      assert.ok(recoveredOptions.filter(option => option.value).every(option => !/7407\/1|AS Paper|Paper 1/.test(option.label)), 'AS-only Paper 1 is not a recovery choice');
      state = await counts();
      assert.equal(state.syntheticModelCalls, 0);
      assert.equal(state.jobStages[0].stage, 'needs_details');
      assert.equal(state.jobStages[0].needs.length, 1);
      assert.doesNotMatch(await page.getByRole('dialog').innerText(), /could not find readable assessment information/i);
      assert.equal(await fileCard('physics-paper2-96-pages.pdf').count(), 1);
      await layout('source-recovery-question');
      if (size.name === 'laptop' && theme === 'light') await shot('laptop-light-assessment-recovery');
      if (size.name === 'phone' && theme === 'dark') await shot('phone-dark-assessment-recovery');
      await recovery.selectOption(paperTwo.value);
      assert.equal(await assessment().inputValue(), 'paper_2');
      await advanced(); assert.equal(await versionInput().inputValue(), DATE_TEXT);
      assert.equal(await fileCard('physics-paper2-96-pages.pdf').count(), 1);
      assert.equal((await counts()).syntheticModelCalls, 0);
      await read(); await ready();
      state = await counts();
      assert.equal(state.syntheticModelCalls, 1);
      assert.equal(state.jobStages.at(-1).identity.component, '7408/2');
      assert.equal(state.requests.filter(request => request.action === 'prepare_source').length, 2);
      await layout('source-recovery-confirmation');
      entry.scenarios.push('A long readable source mismatch offers one targeted question and qualification-scoped choices, retains files/dates, and retries only after explicit Read syllabus');
      await close();

      await startPhysics(theme, 'paper_1', DATE_TEXT, 'physics-as-only-96-pages.pdf');
      await read();
      await page.waitForFunction(() => window.__counts().jobStages[0]?.stage === 'needs_details');
      const asBody = await page.getByRole('dialog').innerText();
      assert.match(asBody, /AS|qualification/);
      assert.doesNotMatch(asBody, /could not find readable assessment information/i);
      assert.equal((await counts()).syntheticModelCalls, 0);
      assert.equal(await fileCard('physics-as-only-96-pages.pdf').count(), 1);
      const asChoices = page.getByRole('combobox', { name: 'Assessment found in your source', exact: true });
      if (await asChoices.count()) assert.equal(await asChoices.locator('option').evaluateAll(options => options.filter(option => option.value).length), 0);
      await layout('as-source-rejected');
      entry.scenarios.push('An AS-only source cannot supply A-level Paper 1 or trigger a model call; the retained file receives a qualification-specific message');
      await close();

      await startPhysics(theme, 'paper_1', WRONG_VERSION);
      await read();
      await page.waitForFunction(() => ['needs_details', 'failed'].includes(window.__counts().jobStages[0]?.stage) && window.__counts().syntheticModelCalls > 0);
      state = await counts();
      assert.equal(state.jobStages[0].requestedIdentity.specificationVersion, WRONG_VERSION);
      assert.equal(state.jobStages[0].stage, 'needs_details');
      assert.equal(state.syntheticModelCalls, 1);
      assert.match(await page.getByRole('dialog').innerText(), /specification version/i);
      assert.doesNotMatch(await page.getByRole('dialog').innerText(), /could not find readable assessment information/i);
      assert.equal(await page.getByRole('img', { name: 'Examly-approved preset', exact: true }).count(), 0);
      assert.equal(await fileCard('physics-paper1-96-pages.pdf').count(), 1);
      await layout('real-version-conflict');
      if (size.name === 'ipad' && theme === 'light') await shot('ipad-light-version-conflict');
      entry.scenarios.push('A genuine explicit issue mismatch remains a targeted conflict and cannot reach a saveable or approved preview');
      await close();

      await fresh(theme); await page.getByRole('button', { name: 'Legacy Paper 1', exact: true }).click();
      assert.equal(await assessment().inputValue(), 'paper_1');
      assert.match(await page.getByRole('dialog').innerText(), /AQA/);
      await upload(dir + '/physics-paper1-96-pages.pdf');
      await read(); await ready();
      assert.equal((await counts()).jobStages[0].identity.component, '7408/1');
      entry.scenarios.push('Saved lowercase board and wrapped legacy Paper 1 resolve deterministically to the A-level component');
      await close();

      await fresh(theme); await page.getByRole('button', { name: 'A Level Physics', exact: true }).click();
      await choose('paper_3');
      const option = page.getByRole('combobox', { name: 'Paper option', exact: true });
      await option.selectOption('astrophysics'); await advanced();
      const code = page.getByLabel('Paper / component code', { exact: true });
      await code.fill('7408/3BA');
      assert.equal(await assessment().inputValue(), 'paper_3');
      assert.equal(await option.inputValue(), 'astrophysics');
      await upload(dir + '/physics-option.txt');
      assert.equal(await fileCard('physics-option.txt').count(), 1);
      assert.equal((await counts()).requests.length, 0);
      await code.fill('7408/3BB');
      await page.getByRole('button', { name: 'Read syllabus', exact: true }).click();
      await page.getByRole('alert').first().waitFor();
      assert.equal((await counts()).requests.length, 0);
      assert.equal(await assessment().inputValue(), 'paper_3');
      assert.equal(await option.inputValue(), 'astrophysics');
      await layout('named-option-integrity');
      entry.scenarios.push('Astrophysics remains the explicit Paper 3 option; a conflicting section code does not replace it or start a request');
      await close();

      await fresh(theme); await page.getByRole('button', { name: 'OCR Paper 3', exact: true }).click();
      await page.getByRole('button', { name: 'Yes, build it', exact: true }).click(); await summary();
      assert.equal(await page.getByRole('img', { name: 'Examly-approved preset', exact: true }).count(), 1);
      assert.equal((await counts()).syntheticModelCalls, 0);
      assert.equal((await counts()).syntheticReservations, 0);
      await layout('approved-regression');
      if (size.name === 'laptop' && theme === 'dark') await shot('laptop-dark-approved-regression');
      entry.scenarios.push('Existing approved OCR H420/03 remains immediate, starred and free of model/quota calls');
      await close();

      cases.push(entry);
      console.log(JSON.stringify({ width: size.width, theme, status: 'PASS', scenarios: entry.scenarios.length }));
    }
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(failedRequests, []); assert.deepEqual(blockedRequests, []);
    const report = { status: 'PASS', browserVersion: await browser.version(), syntheticOnly: true, realModelCalls: 0, backendRequests: 0, realLogins: 0, liveDataWrites: 0, cases, scenarioChecks: cases.reduce((total, entry) => total + entry.scenarios.length, 0), screenshots, fixtures: JSON.parse(fs.readFileSync(dir + '/fixtures.json')), errors, consoleErrors, failedRequests, blockedRequests, sourceHashes: JSON.parse(fs.readFileSync(dir + '/source-hashes.json')), limitations: ['Chromium viewport emulation rather than physical iOS/iPadOS devices', 'Provider responses and persistence are synthetic; this does not prove live deployment or real provider quality', 'Synthetic long PDFs contain original software-test content, not official AQA question or mark-scheme material', 'Named option UI integrity is checked without attempting unsupported optional-paper generation'] };
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
