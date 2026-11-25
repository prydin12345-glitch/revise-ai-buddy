const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { artifacts, writeJSON, sha256, verifyInputs } = require('./runtime.cjs');
const playwrightPath = '/opt/codex/runtimes/cua/lib/node_modules/playwright-core';
const { chromium } = require(playwrightPath);
const preflight = process.argv.includes('--preflight');
const diagnostic = process.argv.includes('--diagnostic') || preflight;
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'ipad', width: 834, height: 1194 },
  { name: 'phone', width: 390, height: 844 },
];
const report = {
  status: 'RUNNING', mode: preflight ? 'preflight' : diagnostic ? 'diagnostic' : 'acceptance',
  startedAt: new Date().toISOString(), cases: [], auxiliary: [], screenshots: [], blockedRequests: [], errors: [],
  boundary: 'Production custom modal → production parent payload mapper → owned synthetic memory persistence → actual save outcome → reopen. No live account, source fetch, AI, student data or database. Chromium mobile emulation, not physical iOS.',
  runtime: { node: process.version, playwright: require(path.join(playwrightPath, 'package.json')).version, chromium: '/usr/bin/chromium' },
};
const reportName = preflight ? 'preflight-results.json' : diagnostic ? 'diagnostic-results.json' : 'browser-results.json';
const write = () => writeJSON(reportName, report);
function verifyForRun() {
  try { return verifyInputs(); }
  catch (error) {
    if (!diagnostic) throw error;
    report.sourceDrift = true;
    return JSON.parse(fs.readFileSync(path.join(artifacts, 'hash-verification.json'), 'utf8'));
  }
}
const snapshot = page => page.evaluate(() => window.__customProfileFixture());
const dialog = page => page.getByRole('dialog', { name: /Edit exam profile|Create exam profile/ });
const nav = (page, name) => dialog(page).getByRole('button', { name, exact: true });
async function openSaved(page) {
  await page.getByRole('button', { name: 'Edit synthetic profile', exact: true }).click();
  await dialog(page).waitFor();
  await nav(page, /Topics\s*\d+/).waitFor();
  await dialog(page).evaluate(el => Promise.all(el.getAnimations({ subtree: true }).filter(animation => animation.effect.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
}
async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  const file = name + '.png';
  await page.screenshot({ path: path.join(artifacts, file), fullPage: true, animations: 'disabled' });
  report.screenshots.push({ file, sha256: sha256(path.join(artifacts, file)) });
}
async function measure(page, viewport) {
  const measured = await dialog(page).evaluate(el => {
    const r = el.getBoundingClientRect();
    const visible = node => { const b = node.getBoundingClientRect(); return b.width > 0 && b.height > 0 && node.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }); };
    const controls = [...el.querySelectorAll('button,input,select,[role="combobox"],[role="checkbox"]')].filter(visible);
    return {
      x: r.x, y: r.y, width: r.width, height: r.height, viewportWidth: innerWidth, viewportHeight: innerHeight,
      documentOverflow: document.documentElement.scrollWidth > innerWidth,
      overflow: [...el.querySelectorAll('*')].filter(visible).filter(node => { const b = node.getBoundingClientRect(); return b.left < r.left - 2 || b.right > r.right + 2; }).slice(0, 8).map(node => ({ tag: node.tagName, text: node.textContent?.slice(0, 80) })),
      unnamedButtons: controls.filter(node => node.tagName === 'BUTTON' && (!node.getAttribute('role') || node.getAttribute('role') === 'button') && !node.getAttribute('aria-label') && !node.getAttribute('aria-labelledby') && !node.textContent.trim() && ![...(node.labels || [])].some(label => label.textContent.trim())).map(node => node.outerHTML.slice(0, 180)),
      iconTouchTargets: controls.filter(node => node.tagName === 'BUTTON' && (!node.getAttribute('role') || node.getAttribute('role') === 'button') && node.getAttribute('aria-label') && !node.textContent.trim()).map(node => ({ label: node.getAttribute('aria-label'), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })),
    };
  });
  assert.equal(measured.documentOverflow, false, 'Document must not overflow horizontally');
  assert.equal(measured.overflow.length, 0, 'Visible dialog content must fit horizontally: ' + JSON.stringify(measured.overflow));
  assert.equal(measured.unnamedButtons.length, 0, 'Visible buttons need accessible labels');
  assert.ok(measured.x >= -1 && measured.y >= -1 && measured.x + measured.width <= viewport.width + 1 && measured.y + measured.height <= viewport.height + 1, 'Dialog containment');
  if (viewport.name === 'desktop') assert.ok(Math.abs(measured.width - 1040) <= 2, 'Desktop editor width is 1040px');
  if (viewport.name === 'phone') {
    assert.ok(Math.abs(measured.width - viewport.width) <= 2, 'Phone editor full width');
    assert.ok(Math.abs(measured.height - viewport.height) <= 2, 'Phone editor full height');
  }
  return measured;
}
async function setName(page, value) {
  await nav(page, 'Exam settings').click();
  await dialog(page).getByRole('textbox', { name: 'Profile name', exact: true }).fill(value);
}
async function save(page) {
  await dialog(page).getByRole('button', { name: 'Update Profile', exact: true }).click();
}
async function roundTrip(page, result, initial) {
  const renamed = initial.seed.profile_name + ' revised';
  await setName(page, renamed);
  await save(page);
  await dialog(page).waitFor({ state: 'hidden' });
  let saved = await snapshot(page);
  assert.deepEqual(saved.profile, { ...initial.seed, profile_name: renamed }, 'Only the edited name may change; every nested value must survive');
  result.preservesEverySavedField = true;
  await openSaved(page);
  await nav(page, 'Exam settings').click();
  assert.equal(await dialog(page).getByRole('textbox', { name: 'Profile name', exact: true }).inputValue(), renamed);
  await setName(page, renamed + ' after retry');
  result.expectInjectedConsoleFailure = true;
  await page.evaluate(() => window.__customProfileFailNextSave('core'));
  await save(page);
  await dialog(page).getByRole('alert').filter({ hasText: /fail|retry/i }).waitFor();
  assert.equal(await dialog(page).getByRole('textbox', { name: 'Profile name', exact: true }).inputValue(), renamed + ' after retry');
  assert.deepEqual((await snapshot(page)).profile, saved.profile, 'Failed core save must not mutate persisted row');
  result.saveFailureRetainsDraft = true;
  result.expectInjectedConsoleFailure = false;
  await shot(page, result.name + '-retry');
  await save(page);
  await dialog(page).waitFor({ state: 'hidden' });
  saved = await snapshot(page);
  assert.deepEqual(saved.profile, { ...initial.seed, profile_name: renamed + ' after retry' });
  result.retryAndReopen = true;
  await openSaved(page);
  await setName(page, 'Uncommitted synthetic rename');
  await dialog(page).getByRole('button', { name: 'Discard changes', exact: true }).click();
  assert.equal(await dialog(page).getByRole('textbox', { name: 'Profile name', exact: true }).inputValue(), saved.profile.profile_name);
  await dialog(page).getByRole('button', { name: 'Close profile', exact: true }).click();
  await dialog(page).waitFor({ state: 'hidden' });
  assert.deepEqual((await snapshot(page)).profile, saved.profile, 'Discard cannot write');
  await openSaved(page);
  await nav(page, 'Exam settings').click();
  assert.equal(await dialog(page).getByRole('textbox', { name: 'Profile name', exact: true }).inputValue(), saved.profile.profile_name);
  result.discardRestoresOpeningState = true;
}
async function changeTopicView(page, value) {
  const select = dialog(page).getByRole('combobox', { name: 'Topic view', exact: true });
  if (await select.isVisible()) await select.selectOption(value);
  else await dialog(page).getByRole('button', { name: value === 'library' ? /^Topic library/ : /^In this profile/ }).click();
}
async function topicRoundTrip(page, result) {
  const baseline = await snapshot(page);
  await nav(page, /Topics\s*\d+/).click();
  if (result.scenario === 'guided') {
    assert.equal(await dialog(page).getByRole('button', { name: 'Add topic', exact: true }).isDisabled(), true);
    const actions = dialog(page).getByRole('region', { name: 'Profile topics', exact: true }).getByRole('button', { name: /^Edit |^Remove / });
    for (const action of await actions.all()) assert.equal(await action.isDisabled(), true, 'Guided topic actions stay locked');
    await nav(page, 'Exam settings').click();
    assert.equal(await dialog(page).getByRole('spinbutton', { name: 'Time limit in minutes', exact: true }).isDisabled(), true);
    assert.deepEqual((await snapshot(page)).profile, baseline.profile);
    result.guidedLocksAndIdentity = true;
    return;
  }
  if (result.scenario === 'legacy') {
    assert.equal(baseline.profile.written_question_count, 0);
    assert.equal(baseline.profile.question_structure, 'mcq_only');
    assert.equal(baseline.profile.paper_blueprint, null);
    assert.equal(baseline.profile.time_limit_minutes, null);
    result.legacyZeroWrittenAndNulls = true;
    return;
  }
  const beforeCalls = baseline.calls.length;
  await changeTopicView(page, 'library');
  assert.equal(await dialog(page).getByRole('article', { name: 'Legacy local seminar: coastal voices', exact: true }).count(), 0);
  await dialog(page).getByRole('checkbox', { name: 'Include Unseen poetry', exact: true }).check();
  await changeTopicView(page, 'profile');
  await dialog(page).getByRole('button', { name: 'Edit Poetry anthology', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit topic', exact: true });
  await edit.getByRole('textbox', { name: 'Topic name', exact: true }).fill('Poetry in my own words');
  await edit.getByRole('button', { name: 'Done', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Remove Legacy local seminar: coastal voices', exact: true }).click();
  await setName(page, baseline.profile.profile_name + ' topic edits');
  await nav(page, /Topics\s*\d+/).click();
  await dialog(page).getByRole('button', { name: 'Undo last topic change', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Select topics', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Select shown', exact: true }).click();
  assert.equal(await dialog(page).getByRole('button', { name: 'Remove selected topics', exact: true }).isDisabled(), true);
  await dialog(page).getByRole('button', { name: 'Deselect shown', exact: true }).click();
  await dialog(page).getByRole('checkbox', { name: 'Select Modern drama', exact: true }).check();
  await dialog(page).getByRole('checkbox', { name: 'Select Context', exact: true }).check();
  await dialog(page).getByRole('button', { name: 'Remove selected topics', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Undo last topic change', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Done selecting', exact: true }).click();
  assert.equal((await snapshot(page)).calls.length, beforeCalls, 'Topic draft edits cannot persist before Save');
  await shot(page, result.name + '-topic-edits');
  await save(page); await dialog(page).waitFor({ state: 'hidden' });
  const expected = structuredClone(baseline.profile);
  expected.profile_name += ' topic edits'; expected.topics.push('Unseen poetry');
  expected.paper_blueprint.topicEdits.push({ topic: 'Poetry anthology', label: 'Poetry in my own words' });
  assert.deepEqual((await snapshot(page)).profile, expected, 'Canonical identities and all other saved values survive topic edits');
  await openSaved(page);
  assert.equal(await dialog(page).getByRole('article', { name: 'Poetry in my own words', exact: true }).count(), 1);
  assert.equal(await dialog(page).getByRole('article', { name: 'Legacy local seminar: coastal voices', exact: true }).count(), 1);
  result.topicLabelLibraryBulkUndoRoundTrip = true;
}

(async () => {
  let server, browser;
  try {
    report.hashesBefore = verifyForRun();
    if (!diagnostic) {
      assert.equal(process.env.CUSTOM_PROFILE_BROWSER_CASE, undefined, 'Acceptance requires the complete 18-case matrix');
      const receipt = JSON.parse(fs.readFileSync(path.join(artifacts, 'parent-source-freeze.json'), 'utf8'));
      assert.equal(receipt.confirmedBy, 'parent-source-freeze');
      assert.equal(receipt.manifestSha256, sha256(path.join(artifacts, 'build-manifest.json')), 'Freeze receipt must bind to this build');
      report.parentSourceFreeze = receipt;
    }
    const files = new Map([
      ['/bundle.js', ['bundle.js', 'text/javascript']], ['/styles.css', ['styles.css', 'text/css']],
      ['/fonts/Manrope-Variable.ttf', ['fonts/Manrope-Variable.ttf', 'font/ttf']],
      ['/fonts/SourceSerif4-Variable.ttf', ['fonts/SourceSerif4-Variable.ttf', 'font/ttf']],
    ]);
    server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      res.setHeader('Cache-Control', 'no-store');
      if (url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
      } else if (files.has(url.pathname) && req.method === 'GET') {
        const [file, type] = files.get(url.pathname); res.setHeader('Content-Type', type); res.end(fs.readFileSync(path.join(artifacts, file)));
      } else { report.blockedRequests.push({ url: req.url, method: req.method, boundary: 'server' }); res.writeHead(403); res.end('Blocked'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking'] });
    report.runtime.chromiumVersion = browser.version();
    for (const viewport of viewports) for (const theme of ['light', 'dark']) for (const scenario of ['custom', 'guided', 'legacy']) {
      const name = `${viewport.name}-${theme}-${scenario}`;
      if (process.env.CUSTOM_PROFILE_BROWSER_CASE && !new RegExp(process.env.CUSTOM_PROFILE_BROWSER_CASE).test(name)) continue;
      const result = { name, viewport, theme, scenario, status: 'RUNNING', measurements: {} };
      report.cases.push(result); write();
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: theme, isMobile: viewport.name !== 'desktop', hasTouch: viewport.name !== 'desktop', serviceWorkers: 'block' });
      await context.addInitScript(value => { document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.toggle('dark', value === 'dark')); }, theme);
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === origin && request.method() === 'GET' && (url.pathname === '/' || files.has(url.pathname))) return route.continue();
        report.blockedRequests.push({ case: name, url: request.url(), method: request.method(), boundary: 'browser' });
        return route.abort('blockedbyclient');
      });
      await context.routeWebSocket('**/*', socket => { report.blockedRequests.push({ case: name, url: socket.url(), boundary: 'websocket' }); socket.close(); });
      const page = await context.newPage(); page.setDefaultTimeout(7000);
      page.on('pageerror', error => report.errors.push({ case: name, message: error.message }));
      page.on('console', message => {
        if (message.type() !== 'error') return;
        if (result.expectInjectedConsoleFailure && /^Error updating profile:/.test(message.text())) {
          (result.injectedConsoleErrors ||= []).push(message.text());
        } else report.errors.push({ case: name, message: message.text() });
      });
      try {
        await page.goto(origin + '/?scenario=' + scenario, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => typeof window.__customProfileFixture === 'function');
        const initial = await snapshot(page);
        await openSaved(page);
        assert.equal((await snapshot(page)).calls.length, 0, 'Opening must not read/write persistence');
        result.measurements.topics = await measure(page, viewport);
        await shot(page, name + '-topics');
        if (!preflight) {
          for (const [tab, slug] of [['Exam settings', 'settings'], ['Paper layout', 'layout']]) {
            await nav(page, tab).click(); result.measurements[slug] = await measure(page, viewport); await shot(page, name + '-' + slug);
          }
          await nav(page, /Topics\s*\d+/).click();
          const search = dialog(page).getByRole('searchbox', { name: 'Search topics', exact: true });
          await search.fill('no matching synthetic topic'); await search.fill('');
          const sort = dialog(page).getByRole('combobox', { name: 'Sort topics', exact: true });
          await sort.selectOption('alphabetical'); await sort.selectOption('original');
          await changeTopicView(page, 'library'); await changeTopicView(page, 'profile');
          assert.equal((await snapshot(page)).calls.length, 0, 'Browse/search/sort/tabs make no persistence calls');
          assert.deepEqual((await snapshot(page)).profile, initial.seed);
          result.presentationDoesNotWrite = true;
          await page.keyboard.press('Tab');
          result.keyboardFocus = await page.evaluate(() => ({ tag: document.activeElement.tagName, text: document.activeElement.getAttribute('aria-label') || document.activeElement.textContent?.slice(0, 100), inDialog: !!document.activeElement.closest('[role="dialog"]') }));
          assert.equal(result.keyboardFocus.inDialog, true, 'Keyboard focus stays in the editor');
          await roundTrip(page, result, initial);
          await topicRoundTrip(page, result);
        }
        result.status = diagnostic ? 'DIAGNOSTIC_PASS' : 'PASS';
      } catch (error) {
        result.status = 'FAIL'; result.error = error.stack;
        await shot(page, name + '-failure').catch(() => {});
      } finally { await context.close(); write(); }
    }
    report.hashesAfter = verifyForRun();
    const passed = report.cases.length > 0 && report.cases.length === (process.env.CUSTOM_PROFILE_BROWSER_CASE ? report.cases.length : 18) && report.cases.every(result => result.status !== 'FAIL') && !report.blockedRequests.length && !report.errors.length;
    report.status = !passed ? 'FAIL' : diagnostic ? 'DIAGNOSTIC_ONLY' : 'PASS';
    if (!passed) process.exitCode = 1;
  } catch (error) { report.status = 'FAIL'; report.errors.push({ message: error.stack }); process.exitCode = 1; }
  finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    report.finishedAt = new Date().toISOString(); write();
    console.log(JSON.stringify({ status: report.status, cases: report.cases.length, failures: report.cases.filter(result => result.status === 'FAIL').map(result => ({ name: result.name, error: result.error?.split('\n')[0] })), errors: report.errors, report: path.join(artifacts, reportName) }));
  }
})();
