const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { artifacts, fontDir, verifyFrozenHashes } = require('./runtime.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || '/tmp/examly-business-tools/node_modules/playwright-core');

(async () => {
  const before = verifyFrozenHashes();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const results = [], errors = [], blocked = [];
  try {
    for (const size of [{ name: 'laptop', width: 1440, height: 1000 }, { name: 'ipad', width: 834, height: 1194 }, { name: 'phone', width: 390, height: 844 }]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: 'reduce' });
        context.setDefaultTimeout(15000);
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          if (url.origin !== 'http://127.0.0.1:8099') { blocked.push(url.origin + url.pathname); return route.abort(); }
          if (url.pathname === '/verify-builder') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script>localStorage.clear();document.documentElement.classList.toggle("dark",new URLSearchParams(location.search).get("theme")==="dark")</script><script type="module" src="/bundle.js"></script></body></html>' });
          if (['/bundle.js', '/styles.css'].includes(url.pathname)) return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css', body: fs.readFileSync(path.join(artifacts, path.basename(url.pathname))) });
          if (url.pathname.startsWith('/fonts/')) return route.fulfill({ contentType: 'font/ttf', body: fs.readFileSync(path.join(fontDir, path.basename(url.pathname))) });
          if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204, body: '' });
          blocked.push(url.pathname); return route.abort();
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        const assessment = () => page.getByRole('combobox', { name: /^(Assessment|Paper)$/ });
        const advanced = async () => { const summary = page.getByText('Advanced details', { exact: true }); if (!await summary.evaluate(element => element.closest('details').open)) await summary.click(); };
        const bounds = async label => {
          const b = await page.getByRole('dialog', { name: 'Build your exam profile' }).evaluate(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, width: innerWidth, client: element.clientWidth, scroll: element.scrollWidth, body: document.documentElement.scrollWidth }));
          assert.ok(b.left >= -1 && b.right <= b.width + 1 && b.scroll <= b.client + 1 && b.body <= b.width + 1, label + ': ' + JSON.stringify(b));
        };
        for (const scenario of ['business', 'errors']) {
          await page.goto(`http://127.0.0.1:8099/verify-builder?theme=${theme}&scenario=${scenario}`, { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: 'Build Business profile', exact: true }).click();
          await advanced();
          // Deliberately leave the default course placeholder unchanged.
          const courseBefore = await page.getByLabel('Course / specification code', { exact: true }).inputValue();
          await page.getByRole('button', { name: 'Upload syllabus', exact: true }).click();
          const text = await page.evaluate(() => window.__fixtures.codedText);
          await page.getByLabel('Syllabus or assessment brief', { exact: true }).setInputFiles({ name: 'synthetic-business.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
          await page.waitForFunction(() => [...document.querySelectorAll('select[aria-label="Assessment"],select[aria-label="Paper"]')].some(select => select.options.length === 5));
          const candidates = await assessment().locator('option').evaluateAll(options => options.filter(option => option.value && option.value !== '__manual').map(option => ({ value: option.value, label: option.textContent })));
          assert.equal(candidates.length, 3);
          assert.ok(candidates.every((candidate, index) => candidate.label.startsWith(`Paper ${index + 1} — `)));
          await assessment().selectOption(candidates[0].value);
          await advanced();
          await page.waitForFunction(() => !document.body.innerText.includes('Finding assessment names in your attached files…'));
          assert.equal(await assessment().inputValue(), candidates[0].value, 'Source selection survives course autofill and local reinspection');
          assert.equal(await page.getByLabel('Course / specification code', { exact: true }).inputValue(), '9BS0');
          assert.equal(await assessment().locator('option[value=""]').evaluate(option => option.disabled), true, 'Assessment placeholder is disabled');
          await assessment().focus();
          await page.keyboard.press('Home');
          assert.equal(await assessment().inputValue(), candidates[0].value, 'Keyboard navigation skips the disabled placeholder');
          assert.equal(await page.getByLabel('Paper / component code', { exact: true }).inputValue(), '9BS0/01');
          assert.equal(await page.getByRole('list', { name: 'Attached source files' }).locator('li').count(), 1);
          assert.ok(await page.getByText('Earlier local inspection could not separate these assessments.', { exact: true }).isVisible());
          await bounds('selected source');
          await page.getByRole('button', { name: 'Read syllabus', exact: true }).click();
          await page.waitForFunction(() => window.__counts().calls.length === 1);
          await page.getByText('Earlier local inspection could not separate these assessments.', { exact: true }).waitFor({ state: 'hidden' });
          const calls = await page.evaluate(() => window.__counts().calls);
          assert.equal(calls[0].identity.course, '9BS0');
          assert.equal(calls[0].identity.tier, null);
          assert.equal(calls[0].uploads.length, 1);
          assert.equal(calls[0].uploads[0].bytes, Buffer.byteLength(text));
          if (scenario === 'errors') {
            await page.getByLabel('Profile validation details').waitFor();
            assert.match(await page.getByLabel('Profile validation details').innerText(), /Selected PDF pages: 14, 15/);
          } else await page.getByRole('button', { name: 'Yes, build it', exact: true }).waitFor();
          assert.equal(await page.getByRole('list', { name: 'Attached source files' }).locator('li').count(), 1);
          await bounds('server-confirmed source');
          const screenshot = `${size.name}-${theme}-${scenario}.png`;
          await page.screenshot({ path: path.join(artifacts, screenshot), animations: 'disabled' });
          results.push({ viewport: size, theme, scenario, candidates, courseBefore, code: '9BS0/01', uploadRetained: true, obsoleteWarningRemoved: true, noHorizontalOverflow: true, screenshot });
        }
        await context.close();
      }
    }
  } finally { await browser.close(); }
  assert.deepEqual(errors, []);
  assert.deepEqual(blocked, []);
  const after = verifyFrozenHashes();
  const report = { status: 'PASS', boundary: 'Actual UI and source inspection, synthetic API. Real client-to-handler and controlled source-job tests are separate; no live AI, backend, private uploads or student records.', cases: results, errors, blockedRequests: blocked, hashesBefore: before, hashesAfter: after };
  fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'PASS', cases: results.length, artifacts }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
