const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { root, dir, artifacts, fontDir, repoRequire, verifyFrozenHashes } = require('./runtime.cjs');
let playwright;
try { playwright = process.env.PLAYWRIGHT_CORE_PATH ? require(path.resolve(process.env.PLAYWRIGHT_CORE_PATH)) : repoRequire('playwright-core'); }
catch { throw Error('Set PLAYWRIGHT_CORE_PATH to a prepared Playwright Core package directory; see README.md.'); }
function executable() {
  if (process.env.CHROMIUM_EXECUTABLE_PATH) return path.resolve(process.env.CHROMIUM_EXECUTABLE_PATH);
  const bundled = playwright.chromium.executablePath();
  if (fs.existsSync(bundled)) return bundled;
  for (const directory of (process.env.PATH || '').split(path.delimiter)) for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'chrome', 'chrome.exe']) {
    const candidate = path.join(directory, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw Error('Set CHROMIUM_EXECUTABLE_PATH to an installed Chromium executable; see README.md.');
}

(async () => {
  const frozenBefore = verifyFrozenHashes();
  const browser = await playwright.chromium.launch({ executablePath: executable(), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [], consoleErrors = [], failedRequests = [], blockedRequests = [], cases = [], screenshots = [];
  let page;
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    context.setDefaultTimeout(20000);
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== 'http://127.0.0.1:8099') { blockedRequests.push(url.origin + url.pathname); return route.abort(); }
      if (url.pathname === '/verify-builder' && request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/styles.css"><title>Assessment identity verification</title></head><body><div id="root"></div><script>localStorage.clear();document.documentElement.classList.toggle("dark",new URLSearchParams(location.search).get("theme")==="dark");</script><script type="module" src="/bundle.js"></script></body></html>' });
      if (['/bundle.js', '/styles.css'].includes(url.pathname)) return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css', body: fs.readFileSync(path.join(artifacts, url.pathname)) });
      if (url.pathname.startsWith('/fonts/')) return route.fulfill({ contentType: 'font/ttf', body: fs.readFileSync(path.join(fontDir, path.basename(url.pathname))) });
      if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204, body: '' });
      blockedRequests.push(url.pathname); return route.abort();
    });
    page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    const counts = () => page.evaluate(() => window.__counts());
    const dialog = () => page.getByRole('dialog');
    const assessment = () => page.getByRole('combobox', { name: /^(?:Paper|Assessment)$/i });
    const attached = () => page.getByRole('list', { name: 'Attached source files' }).locator('li');
    const advanced = async () => { const summary = page.getByText('Advanced details', { exact: true }); if (!await summary.evaluate(element => element.closest('details').open)) await summary.click(); };
    const layout = async label => {
      const bounds = await dialog().evaluate(element => ({ width: innerWidth, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, scroll: element.scrollWidth, client: element.clientWidth, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 }));
      assert.ok(bounds.left >= -1 && bounds.right <= bounds.width + 1 && bounds.scroll <= bounds.client + 1 && !bounds.pageOverflow, label + ': ' + JSON.stringify(bounds));
    };
    const shot = async name => { await page.screenshot({ path: path.join(artifacts, name + '.png'), animations: 'disabled' }); screenshots.push(name + '.png'); };
    const start = async (theme, scenario = 'business', coded = false) => {
      await page.goto('http://127.0.0.1:8099/verify-builder?theme=' + theme + '&scenario=' + scenario, { waitUntil: 'networkidle' });
      await page.evaluate(async () => { await Promise.all([document.fonts.load('16px Manrope'), document.fonts.load('16px "Source Serif 4"')]); await document.fonts.ready; });
      await page.getByRole('button', { name: 'Build Business profile', exact: true }).click();
      await advanced();
      await page.getByLabel('Course / specification code', { exact: true }).fill('9BS0');
      await page.getByRole('button', { name: 'Upload syllabus', exact: true }).click();
      const text = await page.evaluate(useCode => useCode ? window.__fixtures.codedText : window.__fixtures.businessText, coded);
      await page.getByLabel('Syllabus or assessment brief', { exact: true }).setInputFiles({ name: coded ? 'synthetic-coded-business.txt' : 'synthetic-business-specification.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
      await attached().waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('select[aria-label="Assessment"],select[aria-label="Paper"]')].some(select => select.options.length === 5));
      const options = await assessment().locator('option').evaluateAll(elements => elements.map(element => ({ value: element.value, label: element.textContent })));
      const candidates = options.filter(option => option.value && option.value !== '__manual');
      assert.equal(candidates.length, 3, 'Exactly three source assessment identities');
      if (!coded) assert.deepEqual(candidates.map(option => option.label), (await page.evaluate(() => window.__fixtures.titles)).map((title, index) => `Paper ${index + 1} — ${title}`));
      assert.ok(candidates.every(option => !/35%|30%|6 - 8|5 - 7/.test(option.label)), 'Weighting rows do not leak into display titles');
      const first = candidates[0];
      await assessment().selectOption(first.value);
      await advanced();
      assert.equal(await attached().count(), 1);
      await layout('source selection');
      return { options: candidates, first };
    };
    const ready = async () => { await page.getByRole('button', { name: 'Yes, build it', exact: true }).waitFor(); await page.getByRole('heading', { name: /We’ll build/ }).waitFor(); };
    const selectCode = () => page.getByLabel('Paper / component code', { exact: true });
    const read = () => page.getByRole('button', { name: 'Read syllabus', exact: true }).click();
    const confirmCode = async code => { await selectCode().fill(code); await page.getByRole('button', { name: 'Confirm code', exact: true }).click(); await page.getByRole('alertdialog', { name: 'Use this component code?' }).waitFor(); };
    const viewports = [{ name: 'laptop', width: 1440, height: 1000 }, { name: 'ipad', width: 834, height: 1112 }, { name: 'phone', width: 390, height: 844 }, { name: 'narrow-phone', width: 320, height: 780 }];
    for (const size of process.argv.includes('--smoke') ? viewports.slice(0, 1) : viewports) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: size.width, height: size.height });
      const entry = { ...size, theme, scenarios: [] };

      const chosen = await start(theme);
      entry.sourceOptions = chosen.options;
      assert.equal(await selectCode().inputValue(), '', 'Unknown source code starts blank');
      await confirmCode('9bs0 / 01');
      const popup = page.getByRole('alertdialog', { name: 'Use this component code?' });
      assert.match(await popup.innerText(), /9BS0\/01/);
      assert.match(await popup.innerText(), /Marketing, people and global businesses/);
      assert.match(await popup.innerText(), /has not been verified/);
      const popupBounds = await popup.evaluate(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, width: innerWidth, scroll: element.scrollWidth, client: element.clientWidth }));
      assert.ok(popupBounds.left >= -1 && popupBounds.right <= popupBounds.width + 1 && popupBounds.scroll <= popupBounds.client + 1, 'Code confirmation fits the viewport');
      if (size.name === 'narrow-phone' && theme === 'dark') await shot('narrow-phone-dark-code-confirmation');
      await popup.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(await selectCode().inputValue(), '');
      assert.equal(await assessment().inputValue(), chosen.first.value);
      assert.equal(await attached().count(), 1);
      assert.equal((await counts()).calls.length, 0);
      await confirmCode('9bs0 / 01');
      await page.getByRole('alertdialog').getByRole('button', { name: 'Use code', exact: true }).click();
      assert.equal(await selectCode().inputValue(), '9BS0/01');
      await confirmCode('9BS0/99');
      await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(await selectCode().inputValue(), '9BS0/01', 'Cancel restores the previous confirmed reference');
      await confirmCode('9BS0/98');
      await page.keyboard.press('Escape');
      await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
      assert.equal(await selectCode().inputValue(), '9BS0/01', 'Escape restores the previous reference and keeps the builder open');
      assert.equal(await assessment().inputValue(), chosen.first.value);
      if (size.name === 'laptop' && theme === 'light') { await page.getByText('Advanced details', { exact: true }).click(); await assessment().scrollIntoViewIfNeeded(); await shot('laptop-light-clean-assessment'); }
      await read(); await ready();
      let state = await counts();
      const prepared = state.calls.find(call => call.action === 'prepare_source');
      assert.equal(prepared.identity.component, 'Paper 1');
      assert.equal(prepared.selectedAssessmentId, chosen.first.value);
      assert.deepEqual(prepared.manualComponentCode, { value: '9BS0/01', confirmed: true });
      assert.equal(prepared.uploads.length, 1);
      assert.match(await page.getByRole('heading', { name: /We’ll build/ }).innerText(), /Paper 1.*Marketing, people and global businesses/);
      assert.equal(await attached().count(), 1);
      await layout('manual code ready');
      await page.getByRole('button', { name: 'Close profile builder', exact: true }).click();
      await page.getByRole('button', { name: 'Build Business profile', exact: true }).click();
      assert.equal(await attached().count(), 1, 'Existing workspace attachment survives closing/reopening');
      await page.getByRole('button', { name: 'Start again', exact: true }).waitFor();
      const beforeRestartSelection = await assessment().inputValue();
      await page.getByRole('button', { name: 'Start again', exact: true }).click();
      await page.getByRole('alertdialog', { name: 'Start a new build?', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('alertdialog', { name: 'Start a new build?', exact: true }).waitFor({ state: 'hidden' });
      assert.equal(await dialog().count(), 1, 'Restart Escape keeps the parent builder open');
      assert.equal(await assessment().inputValue(), beforeRestartSelection, 'Restart Escape preserves the current selection');
      assert.equal(await attached().count(), 1, 'Restart Escape keeps the source intact');
      assert.equal((await counts()).prepareCount, 1, 'Restart Escape does not start another request');
      entry.scenarios.push('Three clean source identities replace repeated titles and AO rows; canonical Paper 1 stays separate from its display title and optional manual reference code.');
      entry.scenarios.push('Manual code requires explicit confirmation; Cancel/Escape restores blank or the previously confirmed code, while the builder, selection, name and file remain intact.');
      entry.scenarios.push('Confirmed normalized code is a separate payload field; source preparation, restart-popup Escape and closing/reopening preserve the attached source without another request.');

      await start(theme); await read(); await ready();
      state = await counts();
      assert.equal(state.prepareCount, 1);
      assert.equal(state.calls[0].identity.component, 'Paper 1');
      assert.equal(state.calls[0].manualComponentCode, undefined);
      assert.equal(await attached().count(), 1);
      entry.scenarios.push('A blank technical code is permissible for an uncoded source assessment and sends no manual code claim.');

      await start(theme, 'coded', true);
      assert.equal(await selectCode().inputValue(), '9BS0/01');
      await selectCode().fill('9BS0/02');
      await read();
      assert.match(await dialog().innerText(), /does not match the selected assessment in your source/);
      assert.equal((await counts()).calls.length, 0, 'Source-backed mismatch is blocked before API');
      assert.equal(await attached().count(), 1);
      await selectCode().fill('9BS0/01'); await read(); await ready();
      state = await counts();
      assert.equal(state.calls[0].identity.component, '9BS0/01');
      assert.equal(state.calls[0].manualComponentCode, undefined);
      entry.scenarios.push('An edit that contradicts a source-backed component code is blocked before preparation; restoring the source code retains the assessment and file.');

      await start(theme, 'pages'); await read();
      const question = page.getByRole('region', { name: 'Missing assessment details' });
      await question.waitFor();
      const answer = async value => { await question.getByLabel('Which PDF page shows the assessment overview?', { exact: true }).fill(value); await question.getByRole('button', { name: 'Continue', exact: true }).click(); };
      await answer('15');
      await page.waitForFunction(() => window.__counts().indexes.length === 1);
      state = await counts();
      assert.equal(state.indexes[0].coverage.complete, false);
      assert.equal(state.indexes[0].diagnostics[0].printedPage, 13);
      assert.match(await dialog().innerText(), /PDF page 15.*printed page 13/i);
      assert.ok((await dialog().innerText()).includes(state.indexes[0].coverage.reason), 'Specific index rejection reason is visible');
      await layout('wrong page diagnostic');
      if (size.name === 'phone' && theme === 'dark') { await page.getByRole('status').filter({ hasText: 'PDF page 15' }).scrollIntoViewIfNeeded(); await shot('phone-dark-page-diagnostic'); }
      await answer('14'); await ready();
      state = await counts();
      assert.equal(state.prepareCount, 1);
      assert.equal(state.calls.filter(call => call.action === 'answer_source').length, 2);
      assert.ok(state.calls.filter(call => call.action === 'answer_source').every(call => call.jobId === state.calls[0].requestId));
      assert.deepEqual(state.indexes[1].coverage, { complete: true });
      assert.deepEqual(state.indexes[1].diagnostics, [{ page: 14, printedPage: 12, status: 'selected' }]);
      assert.match(state.indexes[1].selectedText, /100 marks/);
      assert.doesNotMatch(state.indexes[1].selectedText, /Paper 2|90 marks|105 minutes/);
      assert.match(await dialog().innerText(), /PDF page 14.*printed page 12/i);
      assert.equal(await attached().count(), 1);
      await layout('shared physical page accepted');
      if ((size.name === 'laptop' && theme === 'light') || (size.name === 'phone' && theme === 'dark') || (size.name === 'narrow-phone' && theme === 'light')) await shot(size.name + '-' + theme + '-shared-page-ready');
      entry.pageIndexes = state.indexes;
      entry.scenarios.push('Wrong physical page reports its real index reason with PDF/printed labels; shared page 14 reads only Paper 1 and preserves the original job and file.');
      cases.push(entry);
      console.log(JSON.stringify({ size: size.name, theme, status: 'PASS', scenarios: entry.scenarios.length }));
    }
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(failedRequests, []); assert.deepEqual(blockedRequests, []);
    const frozenAfter = verifyFrozenHashes();
    const report = { status: 'PASS', verificationDate: new Date().toISOString().slice(0, 10), browserVersion: await browser.version(), syntheticOnly: true, actualExamProfileBuilder: true, realLocalTextDiscovery: true, realDocumentIndex: true, syntheticSourceJobResponses: true, externalNetworkBlocked: true, backendRequests: 0, realModelCalls: 0, logins: 0, liveDataWrites: 0, cases, scenarioChecks: cases.reduce((total, entry) => total + entry.scenarios.length, 0), screenshots, frozenBefore, frozenAfter, sourceHashesVerifiedBeforeAndAfter: true, errors, consoleErrors, failedRequests, blockedRequests, limitations: ['The actual builder and local text inspection/index code are composed offline with injected synthetic SourceJob responses; signed-in navigation, real provider interpretation and persistence are not exercised.', 'Text attachment inspection is real. The physical/printed PDF page scenario uses original synthetic extracted-page strings, not the user PDF or a PDF parser.', 'Chromium viewport emulation does not establish physical iOS/iPadOS behavior.'] };
    fs.writeFileSync(path.join(artifacts, process.argv.includes('--smoke') ? 'smoke-results.json' : 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'PASS', cases: cases.length, scenarios: report.scenarioChecks }));
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(artifacts, 'failure.png'), animations: 'disabled' }); fs.writeFileSync(path.join(artifacts, 'failure.json'), JSON.stringify({ error: String(error), body: await page.locator('body').innerText(), state: await countsSafe(page), errors, consoleErrors, failedRequests, blockedRequests }, null, 2)); }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
async function countsSafe(page) { try { return await page.evaluate(() => window.__counts?.()); } catch { return null; } }
