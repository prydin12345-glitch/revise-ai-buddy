const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { artifacts, fontDir, verifyFrozenHashes, sha256 } = require('./runtime.cjs');

const playwrightCandidates = [
  process.env.PLAYWRIGHT_CORE_PATH,
  '/tmp/examly-business-tools/node_modules/playwright-core',
  '/opt/codex/runtimes/cua/lib/node_modules/playwright-core',
].filter(Boolean);
const playwrightPath = playwrightCandidates.find(candidate => fs.existsSync(path.join(candidate, 'package.json')));
if (!playwrightPath) throw Error('Set PLAYWRIGHT_CORE_PATH to an installed Playwright Core directory. No packages are downloaded.');
const { chromium } = require(playwrightPath);
const origin = 'http://127.0.0.1:8099';
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'ipad', width: 834, height: 1194 },
  { name: 'phone', width: 390, height: 844 },
];
const errors = [], blocked = [], cases = [], screenshots = [];
const report = {
  status: 'RUNNING', startedAt: new Date().toISOString(),
  boundary: 'Actual ExamProfileBuilder, ProfileTopicList and prepareProfileSave. Synthetic owner-supplied saved contexts and injected save API; localStorage persistence belongs only to this synthetic fixture. No extraction, provider, login, database or physical iOS test.',
  runtime: {
    node: process.version, playwright: require(path.join(playwrightPath, 'package.json')).version,
    playwrightPath, chromiumExecutable: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
  },
  cases, errors, blockedRequests: blocked, screenshots,
};
const writeReport = () => fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
function verifyHashes(field) {
  try { report[field] = verifyFrozenHashes(); }
  catch (error) {
    const verification = path.join(artifacts, 'hash-verification.json');
    if (fs.existsSync(verification)) report[field] = JSON.parse(fs.readFileSync(verification, 'utf8'));
    throw error;
  }
}
const snapshot = page => page.evaluate(() => window.__detailedFixture());
const summary = (list, text) => list.locator('summary').filter({ hasText: text });
const visible = async locator => assert.equal(await locator.isVisible(), true, `Expected visible: ${locator}`);
const count = async (locator, expected) => assert.equal(await locator.count(), expected, `Unexpected count: ${locator}`);

async function layout(page, stage) {
  const result = await page.getByRole('dialog').evaluate(dialog => {
    const box = dialog.getBoundingClientRect();
    const list = dialog.querySelector('[aria-label="Profile topics"]');
    // Chromium may retain layout boxes inside a closed native details element.
    // Ignore those boxes when measuring visible controls and their touch targets.
    const rendered = el => {
      for (let parent = el.parentElement; parent && parent !== dialog; parent = parent.parentElement)
        if (parent.tagName === 'DETAILS' && !parent.open && !parent.querySelector(':scope > summary')?.contains(el)) return false;
      return el.getClientRects().length && el.getBoundingClientRect().width && el.getBoundingClientRect().height;
    };
    const important = [...dialog.querySelectorAll('summary, blockquote, input, textarea')]
      .filter(rendered)
      .map(el => ({ tag: el.tagName, text: (el.textContent || el.getAttribute('aria-label') || '').slice(0, 70),
        left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right,
        scroll: el.scrollWidth, client: el.clientWidth }));
    const touchTargets = [...(list?.querySelectorAll('summary') || [])]
      .filter(rendered)
      .map(el => el.getBoundingClientRect().height);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      dialog: { left: box.left, right: box.right, top: box.top, bottom: box.bottom, scroll: dialog.scrollWidth, client: dialog.clientWidth },
      documentWidth: document.documentElement.scrollWidth,
      overflows: important.filter(el => el.left < box.left - 1 || el.right > box.right + 1 || el.scroll > el.client + 2),
      touchTargets,
    };
  });
  assert.ok(result.dialog.left >= -1 && result.dialog.right <= result.viewport.width + 1, `${stage}: dialog outside viewport`);
  assert.ok(result.dialog.top >= -1 && result.dialog.bottom <= result.viewport.height + 1, `${stage}: footer outside viewport`);
  assert.ok(result.documentWidth <= result.viewport.width + 1 && result.dialog.scroll <= result.dialog.client + 1, `${stage}: horizontal page/dialog overflow`);
  assert.deepEqual(result.overflows, [], `${stage}: clipped content`);
  assert.ok(result.touchTargets.every(height => height >= 43), `${stage}: summary touch targets below 44px: ${JSON.stringify(result.touchTargets)}`);
  return { stage, ...result };
}

async function screenshot(page, label, item) {
  const file = `${item.viewport.name}-${item.theme}-${item.scenario}-${label}.png`;
  await page.screenshot({ path: path.join(artifacts, file), animations: 'disabled' });
  screenshots.push({ file, sha256: sha256(path.join(artifacts, file)) });
  item.screenshots.push(file);
}

async function openSaved(page) {
  await page.getByRole('button', { name: 'Edit saved profile', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Build your exam profile', exact: true });
  await dialog.waitFor();
  await dialog.evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
  });
  await visible(dialog.getByRole('heading', { name: 'Build your exam profile', exact: true }));
  const list = dialog.getByRole('region', { name: 'Profile topics', exact: true });
  await list.waitFor();
  return { dialog, list, search: list.getByRole('searchbox', { name: 'Search topics and source outcomes', exact: true }) };
}

async function detailed(page, item) {
  let { dialog, list, search } = await openSaved(page);
  const original = await snapshot(page);
  assert.equal(original.seed.profile_template.origin, 'source_backed_ai');
  assert.equal(original.seed.profile_template.resolved_by, 'server');
  assert.equal(original.seed.profile_template.template.mode, 'full_mock');
  assert.equal(original.seed.profile_template.evidence.topicDetails.length, 3);
  assert.deepEqual(original.state.calls, []);
  await visible(list.getByRole('status').filter({ hasText: /^3 topics$/ }));
  await count(list.getByText(/This profile saved a flat topic list/), 0);
  assert.equal(await summary(list, original.topics[0]).isVisible(), false);
  item.layouts.push(await layout(page, 'collapsed'));
  await screenshot(page, 'collapsed', item);

  // Native details must work using the keyboard as well as pointer input.
  const theme = summary(list, 'Theme 1: Marketing and people');
  await theme.focus(); await theme.press('Enter');
  assert.equal(await theme.evaluate(el => el.parentElement.open), true);
  const group = summary(list, '1.1 Meeting customer needs');
  await group.click();
  const leaf = summary(list, original.topics[0]);
  await leaf.focus(); await leaf.press('Enter');
  const outcomes = list.getByRole('list', { name: `Source outcomes for ${original.topics[0]}`, exact: true });
  await visible(outcomes);
  await visible(outcomes.getByText('Synthetic Business syllabus · PDF page 14', { exact: true }));
  await visible(outcomes.getByText('Synthetic Business syllabus · PDF page 15', { exact: true }));
  assert.deepEqual(await outcomes.locator('blockquote').allTextContents(), [original.excerpts.research, original.excerpts.researchContinuation]);
  item.layouts.push(await layout(page, 'expanded-source-outcomes'));
  await leaf.scrollIntoViewIfNeeded();
  await screenshot(page, 'outcomes', item);

  const searches = [
    { query: 'ETHNOGRAPHIC', expected: 1, text: original.excerpts.research },
    { query: '1.1 Meeting customer needs', expected: 2 },
    { query: '2.1.1 Sources of finance', expected: 1, text: original.excerpts.finance },
    { query: 'Synthetic Business syllabus', expected: 3 },
    { query: 'definitely-no-matching-outcome', expected: 0 },
  ];
  for (const test of searches) {
    await search.fill(test.query);
    assert.equal(await list.getByRole('status').innerText(), `${test.expected} of 3 topics`);
    if (test.text) {
      await visible(list.getByText(test.text, { exact: true }));
      item.layouts.push(await layout(page, `search:${test.query}`));
    }
    if (!test.expected) await visible(list.getByText('No topics match your search.', { exact: true }));
  }
  await search.fill('ethnographic');
  await search.scrollIntoViewIfNeeded();
  await screenshot(page, 'search', item);
  await search.fill('');
  assert.deepEqual((await snapshot(page)).state, original.state, 'Searching/expanding changed the saved profile or made an API call.');
  assert.equal(await summary(list, original.topics[0]).isVisible(), false);

  await dialog.getByRole('button', { name: 'Edit profile', exact: true }).click();
  const editedName = `Synthetic ${item.viewport.name} ${item.theme} custom`;
  const nextTopics = [...original.topics.slice(0, 2), original.addedTopic];
  await dialog.getByRole('textbox', { name: 'Profile name', exact: true }).fill(editedName);
  await dialog.getByRole('textbox', { name: 'Topics — one per line', exact: true }).fill(nextTopics.join('\n'));
  await dialog.getByRole('spinbutton', { name: 'Time limit (minutes)', exact: true }).fill('35');
  await visible(dialog.getByText('Custom assessment', { exact: true }));
  await search.fill(original.addedTopic);
  await visible(list.getByText('Added by you', { exact: true }));
  await count(list.locator('blockquote'), 0);
  await search.fill(original.topics[2]);
  await visible(list.getByText('No topics match your search.', { exact: true }));
  await search.fill('');
  await count(dialog.getByRole('alert'), 0);
  await dialog.getByRole('button', { name: 'Done editing', exact: true }).click();
  item.layouts.push(await layout(page, 'edited'));
  await search.scrollIntoViewIfNeeded();
  await screenshot(page, 'edited', item);
  const save = dialog.getByRole('button', { name: 'Save profile', exact: true });
  assert.equal(await save.isEnabled(), true);
  await save.click();
  await dialog.waitFor({ state: 'hidden' });
  const saved = await snapshot(page);
  assert.equal(saved.state.calls.length, 1);
  const request = saved.state.calls[0];
  assert.deepEqual(Object.keys(request).sort(), ['action', 'profileId', 'profileName', 'proposalId', 'subjectName', 'template'].sort());
  assert.equal(request.action, 'save');
  assert.equal(request.profileId, original.seed.id);
  assert.equal(request.proposalId, original.seed.profile_template.proposalId);
  assert.equal(request.profileName, editedName);
  assert.equal(saved.state.updateEvents, 1);
  const context = saved.state.profile.profile_template;
  assert.equal(context.template.mode, 'custom');
  assert.equal(context.template.durationMinutes, 35);
  assert.deepEqual(context.template.topics, nextTopics);
  assert.deepEqual(context.template.addedTopics, [original.addedTopic]);
  assert.equal(context.template.marks, original.seed.profile_template.template.marks);
  const parts = context.template.sections.flatMap(section => section.groups.flatMap(group => group.parts));
  const originalParts = original.seed.profile_template.template.sections.flatMap(section => section.groups.flatMap(group => group.parts));
  assert.deepEqual(parts.map(({ topic, ...part }) => part), originalParts.map(({ topic, ...part }) => part));
  assert.ok(parts.every(part => nextTopics.includes(part.topic)));
  assert.deepEqual(context.evidence, original.seed.profile_template.evidence, 'Topic edits changed the owned source evidence.');
  assert.equal(context.evidenceVersion, original.seed.profile_template.evidenceVersion);

  // Reopen the saved context, then reload the whole fixture and reopen again.
  // Both go through the builder's production initialProfile restoration path.
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    ({ dialog, list, search } = await openSaved(page));
    await visible(dialog.getByRole('heading', { name: editedName, exact: true }));
    await visible(dialog.getByText('Custom assessment', { exact: true }));
    await search.fill('ethnographic');
    await visible(list.getByText(original.excerpts.research, { exact: true }));
    await search.fill(original.addedTopic);
    await visible(list.getByText('Added by you', { exact: true }));
    await count(list.locator('blockquote'), 0);
    await search.fill(original.topics[2]);
    await visible(list.getByText('No topics match your search.', { exact: true }));
    await search.fill('');
    await dialog.getByRole('button', { name: 'Edit profile', exact: true }).click();
    assert.equal(await dialog.getByRole('textbox', { name: 'Topics — one per line', exact: true }).inputValue(), nextTopics.join('\n'));
    assert.equal(await dialog.getByRole('spinbutton', { name: 'Time limit (minutes)', exact: true }).inputValue(), '35');
    await dialog.getByRole('button', { name: 'Done editing', exact: true }).click();
    item.layouts.push(await layout(page, reload ? 'reloaded' : 'reopened'));
    if (reload) { await search.scrollIntoViewIfNeeded(); await screenshot(page, 'persisted', item); }
    await dialog.getByRole('button', { name: 'Close profile builder', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
  assert.deepEqual((await snapshot(page)).state, saved.state);
  item.checks = {
    actualSavedContextValidated: true, nestedGroupsAndKeyboardExpansion: true, exactLiteralOutcomesAndPhysicalPages: true,
    searchByLeafGroupOutcomeAndDocument: true, noMatchesAndClear: true, readOnlyInteractionsMakeNoCalls: true,
    editPreservesLeafIdentitiesAndPartIds: true, sourceAdditionAndRemovalSwitchToCustom: true,
    additionsHaveNoBorrowedProvenance: true, saveUsesOriginalReceiptAndEvidence: true,
    saveReopenAndReloadPersist: true, noHorizontalOverflow: true,
  };
  item.savedContext = { name: editedName, topics: context.template.topics, addedTopics: context.template.addedTopics,
    evidenceVersion: context.evidenceVersion, mode: context.template.mode, durationMinutes: context.template.durationMinutes };
}

async function legacy(page, item) {
  const { dialog, list, search } = await openSaved(page);
  const original = await snapshot(page);
  assert.equal(original.seed.profile_template.evidence.topicDetails, undefined);
  await visible(list.getByText('This profile saved a flat topic list. Read the syllabus again to recover more detail.', { exact: true }));
  for (const topic of original.broadTopics) await visible(list.getByText(topic, { exact: true }));
  await count(list.locator('summary, blockquote'), 0);
  await search.fill('BUSINESS STRATEGY');
  assert.equal(await list.getByRole('status').innerText(), '1 of 2 topics');
  await visible(list.getByText(original.broadTopics[1], { exact: true }));
  await count(list.getByText(original.broadTopics[0], { exact: true }), 0);
  await search.fill('no-synthetic-result');
  await visible(list.getByText('No topics match your search.', { exact: true }));
  await search.fill('');
  assert.deepEqual((await snapshot(page)).state, original.state);
  assert.equal(await dialog.getByRole('button', { name: 'Save profile', exact: true }).isEnabled(), true);
  item.layouts.push(await layout(page, 'legacy-flat-profile'));
  await search.scrollIntoViewIfNeeded();
  await screenshot(page, 'flat', item);
  const reread = dialog.getByRole('button', { name: 'Read syllabus again for topic detail', exact: true });
  assert.equal(await reread.isEnabled(), true);
  await reread.click();
  const restart = page.getByRole('alertdialog', { name: 'Start a new build?', exact: true });
  await visible(restart);
  await visible(restart.getByText(/Starting again makes no AI call/));
  assert.deepEqual((await snapshot(page)).state, original.state);
  await screenshot(page, 'reread-confirmation', item);
  await restart.press('Escape');
  await restart.waitFor({ state: 'hidden' });
  await visible(list.getByText(original.broadTopics[0], { exact: true }));
  await reread.click();
  await restart.getByRole('button', { name: 'Start again', exact: true }).click();
  await restart.waitFor({ state: 'hidden' });
  await visible(dialog.getByRole('button', { name: 'Upload syllabus', exact: true }));
  await count(dialog.getByRole('region', { name: 'Profile topics', exact: true }), 0);
  await count(dialog.getByRole('button', { name: 'Save profile', exact: true }), 0);
  assert.deepEqual((await snapshot(page)).state, original.state, 'Re-read started a request or changed the saved profile.');
  item.layouts.push(await layout(page, 'legacy-reread-source-choices'));
  await screenshot(page, 'reread-source-choices', item);
  await dialog.getByRole('button', { name: 'Close profile builder', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const reopened = await openSaved(page);
  for (const topic of original.broadTopics) await visible(reopened.list.getByText(topic, { exact: true }));
  assert.deepEqual((await snapshot(page)).state, original.state);
  item.checks = { legacySourceContextValidated: true, flatNamesAndMissingDetailsHint: true, searchWorksWithoutDetails: true,
    noInventedSourceOutcomes: true, rereadConfirmationEscapeAndSourceChoices: true,
    rereadMakesNoApiCallAndPreservesSavedProfile: true, noAutomaticRebuildOrSave: true, noHorizontalOverflow: true };
}

(async () => {
  verifyHashes('hashesBefore');
  writeReport();
  const browser = await chromium.launch({
    executablePath: report.runtime.chromiumExecutable, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-component-update'],
  });
  report.runtime.chromiumVersion = browser.version();
  try {
    for (const viewport of viewports) for (const theme of ['light', 'dark']) for (const scenario of ['detailed', 'legacy']) {
      const item = { viewport, theme, scenario, status: 'RUNNING', layouts: [], screenshots: [] };
      cases.push(item);
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height }, colorScheme: theme,
        reducedMotion: 'reduce', serviceWorkers: 'block',
        isMobile: viewport.name !== 'desktop', hasTouch: viewport.name !== 'desktop',
      });
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        const reject = () => { blocked.push({ case: `${viewport.name}-${theme}-${scenario}`, method: request.method(), url: url.origin + url.pathname }); return route.abort(); };
        if (url.origin !== origin || request.method() !== 'GET') return reject();
        if (url.pathname === '/verify-builder') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html class="${theme === 'dark' ? 'dark' : ''}" lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>` });
        if (['/bundle.js', '/styles.css'].includes(url.pathname)) return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css', body: fs.readFileSync(path.join(artifacts, path.basename(url.pathname))) });
        if (['/fonts/Manrope-Variable.ttf', '/fonts/SourceSerif4-Variable.ttf'].includes(url.pathname)) return route.fulfill({ contentType: 'font/ttf', body: fs.readFileSync(path.join(fontDir, path.basename(url.pathname))) });
        if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204, body: '' });
        return reject();
      });
      await context.routeWebSocket('**/*', socket => { blocked.push({ case: `${viewport.name}-${theme}-${scenario}`, url: socket.url(), method: 'WEBSOCKET' }); socket.close(); });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on('pageerror', error => errors.push({ case: `${viewport.name}-${theme}-${scenario}`, message: error.message }));
      page.on('console', message => { if (message.type() === 'error') errors.push({ case: `${viewport.name}-${theme}-${scenario}`, message: message.text() }); });
      try {
        await page.goto(`${origin}/verify-builder?scenario=${scenario}`);
        await page.waitForFunction(() => window.__detailedFixture || document.querySelector('[data-fixture-error]'));
        assert.equal(await page.locator('[data-fixture-error]').count(), 0, await page.locator('#root').innerText());
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), theme === 'dark');
        await (scenario === 'legacy' ? legacy(page, item) : detailed(page, item));
        item.status = 'PASS';
      } catch (error) {
        item.status = 'FAIL'; item.error = error.stack;
        await screenshot(page, 'failure', item).catch(() => {});
      } finally {
        await context.close(); writeReport();
      }
      console.log(JSON.stringify({ case: `${viewport.name}-${theme}-${scenario}`, status: item.status, ...(item.error ? { error: item.error.split('\n').slice(0, 3).join('\n') } : {}) }));
    }
  } finally { await browser.close(); }
  verifyHashes('hashesAfter');
  report.finishedAt = new Date().toISOString();
  report.status = cases.length === 12 && cases.every(item => item.status === 'PASS') && !errors.length && !blocked.length ? 'PASS' : 'FAIL';
  writeReport();
  assert.equal(report.status, 'PASS', `See ${path.join(artifacts, 'browser-results.json')}`);
  console.log(JSON.stringify({ status: report.status, cases: cases.length, screenshots: screenshots.length, artifacts }));
})().catch(error => {
  report.status = 'FAIL'; report.fatalError = error.stack; report.finishedAt = new Date().toISOString(); writeReport();
  console.error(error.stack); process.exitCode = 1;
});
