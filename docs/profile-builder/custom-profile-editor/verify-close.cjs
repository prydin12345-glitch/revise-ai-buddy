const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { artifacts, verifyInputs, writeJSON } = require('./browser/runtime.cjs');
const { chromium } = require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');

// Use the same frozen production bundle and owner-scoped offline adapter. No
// new build or source changes are needed to check nested modal dismissal.
(async () => {
  const hashesBefore = verifyInputs();
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const cases = [];
  try {
    for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 },
      { name: 'ipad', width: 834, height: 1194 }, { name: 'phone', width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, isMobile: viewport.name !== 'desktop', hasTouch: viewport.name !== 'desktop' });
      const errors = [], blocked = [];
      const origin = 'http://127.0.0.1:8197';
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === origin && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body:
          '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>' });
        const allowed = url.pathname === '/bundle.js' || url.pathname === '/styles.css' || /^\/fonts\/[\w.-]+$/.test(url.pathname);
        if (url.origin === origin && allowed && route.request().method() === 'GET') {
          const file = path.join(artifacts, url.pathname.slice(1));
          if (fs.existsSync(file)) return route.fulfill({ body: fs.readFileSync(file), contentType:
            file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'font/ttf' });
        }
        blocked.push(route.request().url()); return route.abort();
      });
      await context.routeWebSocket('**/*', socket => { blocked.push(socket.url()); socket.close(); });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', entry => { if (entry.type() === 'error') errors.push(entry.text()); });
      await page.goto(origin + '/?scenario=custom');
      await page.waitForFunction(() => typeof window.__customProfileFixture === 'function');
      const parent = page.getByRole('dialog', { name: 'Edit exam profile', exact: true });
      const open = async () => {
        await page.getByRole('button', { name: 'Edit synthetic profile', exact: true }).click();
        await parent.getByRole('button', { name: /^Topics\s*8$/ }).waitFor();
      };
      await open();
      const editTrigger = parent.getByRole('button', { name: 'Edit Poetry anthology', exact: true });
      await editTrigger.click();
      const child = page.getByRole('dialog', { name: 'Edit topic', exact: true });
      await child.getByRole('textbox', { name: 'Topic name', exact: true }).fill('Cancelled child edit');
      await page.keyboard.press('Escape'); await child.waitFor({ state: 'hidden' });
      assert.equal(await editTrigger.evaluate(element => document.activeElement === element), true);
      assert.equal(await parent.getByRole('article', { name: 'Poetry anthology', exact: true }).count(), 1);
      await parent.getByRole('button', { name: 'Exam settings', exact: true }).click();
      await parent.getByRole('textbox', { name: 'Profile name', exact: true }).fill('Uncommitted guard test');
      await parent.getByRole('button', { name: 'Close profile', exact: true }).click();
      const guard = page.getByRole('alertdialog', { name: 'Discard unsaved changes?', exact: true });
      await guard.getByRole('button', { name: 'Keep editing', exact: true }).click();
      await guard.waitFor({ state: 'hidden' });
      assert.equal(await parent.getByRole('textbox', { name: 'Profile name', exact: true }).inputValue(), 'Uncommitted guard test');
      await parent.getByRole('button', { name: 'Close profile', exact: true }).click();
      await guard.getByRole('button', { name: 'Discard and continue', exact: true }).click();
      await guard.waitFor({ state: 'hidden' }); await parent.waitFor({ state: 'hidden' });
      assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).pointerEvents), 'none');
      // Reopening by clicking the page proves the underlying page is interactive.
      await open();
      const snapshot = await page.evaluate(() => window.__customProfileFixture());
      assert.deepEqual(snapshot.profile, snapshot.seed);
      assert.deepEqual(snapshot.calls, []);
      await parent.getByRole('button', { name: 'Exam settings', exact: true }).click();
      assert.equal(await parent.getByRole('textbox', { name: 'Profile name', exact: true }).inputValue(), snapshot.seed.profile_name);
      assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
      cases.push({ viewport, status: 'PASS', childEscapeReturnsFocus: true,
        dirtyCloseKeepEditingRetainsDraft: true, discardCloseReleasesPointerLock: true,
        reopenRestoresSavedProfile: true, zeroPersistenceCalls: true, errors, blocked });
      await context.close();
    }
  } finally { await browser.close(); }
  const hashesAfter = verifyInputs();
  writeJSON('close-guard-results.json', { status: 'PASS', cases, hashesBefore, hashesAfter,
    boundary: 'Actual frozen production components with synthetic offline storage. No live account, data, provider or physical Apple hardware.' });
  console.log(JSON.stringify({ status: 'PASS', cases: cases.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
