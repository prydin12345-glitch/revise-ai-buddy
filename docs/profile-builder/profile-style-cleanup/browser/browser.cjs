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
const diagnostic = process.argv.includes('--diagnostic');
const report = {
  status: 'RUNNING', mode: process.argv.includes('--preflight') ? 'preflight' : diagnostic ? 'diagnostic' : 'matrix', startedAt: new Date().toISOString(),
  boundary: 'Actual ExamProfileBuilder, AIProfileReview and prepareProfileSave. Synthetic owner-supplied saved contexts and injected fixture proposal/save API; localStorage persistence belongs only to this synthetic fixture. No extraction, provider, login, database or physical iOS test.',
  runtime: {
    node: process.version, playwright: require(path.join(playwrightPath, 'package.json')).version,
    playwrightPath, chromiumExecutable: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
  },
  cases, errors, blockedRequests: blocked, screenshots,
};
const writeReport = () => fs.writeFileSync(path.join(artifacts, process.argv.includes('--preflight') ? 'preflight-results.json' : 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
function verifyHashes(field) {
  try { report[field] = verifyFrozenHashes(); }
  catch (error) {
    const verification = path.join(artifacts, 'hash-verification.json');
    if (fs.existsSync(verification)) report[field] = JSON.parse(fs.readFileSync(verification, 'utf8'));
    report.sourceDrift = true;
    if (!diagnostic) throw error;
  }
}

const snapshot = page => page.evaluate(() => window.__aiProfileFixture());
const visible = async locator => { await locator.waitFor({ state: 'visible' }); assert.equal(await locator.isVisible(), true, `Expected visible: ${locator}`); };
async function screenshot(page, label, item) {
  const file = `${item.viewport.name}-${item.theme}-${item.scenario}-${label}.png`;
  await page.screenshot({ path: path.join(artifacts, file), animations: 'disabled' });
  screenshots.push({ file, sha256: sha256(path.join(artifacts, file)) });
  item.screenshots.push(file);
}
async function preflight(page, item) {
  const fixture = await snapshot(page);
  assert.equal(fixture.seed.profile_template.resolved_by, 'server');
  assert.equal(fixture.seed.profile_template.proposalId, fixture.receipt);
  assert.deepEqual(fixture.seed.profile_template.template, fixture.proposal.template);
  assert.deepEqual(fixture.state.calls, []);
  assert.equal(fixture.proposal.evidence.topicDetails?.length ?? 0, item.scenario === 'legacy' ? 0 : 3);
  await page.getByRole('button', { name: 'Edit saved profile', exact: true }).click();
  await page.getByRole('dialog', { name: 'Build your exam profile', exact: true }).waitFor();
  assert.deepEqual((await snapshot(page)).state.calls, []);
  item.checks = { productionBuilderOpens: true, ownedContextValidated: true,
    receiptAndEntireTemplateRetained: true, evidenceFixtureCorrect: true, noNetworkOrAPI: true };
}
async function settled(dialog) {
  await dialog.waitFor();
  await dialog.evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
  });
}
async function editor(page) {
  const dialog = page.getByRole('dialog', { name: 'Build your exam profile', exact: true });
  await settled(dialog);
  const review = dialog.getByRole('region', { name: 'AI exam profile editor', exact: true });
  await visible(review);
  const list = review.getByRole('region', { name: 'Profile subtopics', exact: true });
  const search = list.getByRole('searchbox', { name: 'Search subtopics and source outcomes', exact: true });
  return { dialog, review, list, search };
}
async function openSaved(page) {
  await page.getByRole('button', { name: 'Edit saved profile', exact: true }).click();
  return editor(page);
}
const row = (list, name) => list.getByRole('article', { name, exact: true });
const nameOf = topic => topic.replace(/^\d+(?:\.\d+)*\s+/, '');
const saveButton = dialog => dialog.getByRole('button', { name: /^(Save changes|Save profile)$/ });
const topicTab = review => review.getByRole('tab', { name: /^Subtopics\s+\d+$/ });

async function noPageCaptions(list, stage) {
  assert.doesNotMatch(await list.innerText(), /\b(?:physical\s+)?PDF\s+pages?\b|\bpages?\s+\d+/i,
    `${stage}: topic pane exposes a PDF page caption`);
}

function assertEvidenceProvenance(context, fixture) {
  assert.deepEqual(context.evidence, fixture.proposal.evidence, 'Complete original source evidence changed.');
  assert.equal(context.evidenceVersion, fixture.proposal.evidenceVersion);
  assert.deepEqual(context.evidence.topicDetails.flatMap(topic => topic.sources.map(source => source.page)), [14, 15, 16, 27]);
  assert.deepEqual(context.evidence.documents[0].locations.map(location => location.page), [1, 14, 15, 16, 27]);
  assert.equal(context.evidence.documents[0].checksum, fixture.proposal.evidence.documents[0].checksum);
  assert.ok(context.evidence.documents[0].checksum, 'Original source checksum is missing.');
}

async function iconAction(button, icon, stage) {
  await visible(button);
  const result = await button.evaluate(element => {
    const svg = element.querySelector('svg');
    const rect = element.getBoundingClientRect(), svgRect = svg?.getBoundingClientRect();
    return {
      name: element.getAttribute('aria-label'), title: element.getAttribute('title'),
      visibleText: element.innerText.trim(), width: rect.width, height: rect.height,
      icon: svg?.getAttribute('class'), hiddenFromAT: svg?.getAttribute('aria-hidden'),
      shapes: svg?.querySelectorAll('path,line,polyline,polygon,circle,rect').length ?? 0,
      iconWidth: svgRect?.width ?? 0, iconHeight: svgRect?.height ?? 0,
    };
  });
  assert.equal(result.visibleText, '', `${stage}: action has visible text`);
  assert.ok(result.name?.trim() && result.title?.trim(), `${stage}: action needs an accessible name and title`);
  assert.match(result.icon ?? '', new RegExp(`(?:^|\\s)lucide-${icon}(?:\\s|$)`), `${stage}: incorrect action icon`);
  assert.ok(result.shapes > 0 && result.iconWidth > 0 && result.iconHeight > 0, `${stage}: empty or invisible icon`);
  assert.equal(result.hiddenFromAT, 'true', `${stage}: decorative SVG should not duplicate its button name`);
  assert.ok(result.width >= 44 && result.height >= 44, `${stage}: action must be at least 44×44`);
  return result;
}

async function cleanPresentation(ui, item, stage) {
  await noPageCaptions(ui.list, stage);
  const actions = [await iconAction(ui.list.getByRole('button', { name: 'Add subtopic', exact: true }), 'plus', `${stage}: Add`)];
  for (const article of await ui.list.getByRole('article').all()) {
    for (const [action, icon] of [['Edit', 'pencil'], ['Remove', 'trash2']])
      actions.push(await iconAction(article.getByRole('button', { name: new RegExp(`^${action} `) }), icon, `${stage}: ${action}`));
  }
  const presentation = await ui.review.evaluate(review => {
    const shown = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
    const style = element => {
      const computed = getComputedStyle(element);
      return { background: computed.backgroundColor, backgroundImage: computed.backgroundImage, shadow: computed.boxShadow,
        radii: [computed.borderTopLeftRadius, computed.borderTopRightRadius, computed.borderBottomLeftRadius, computed.borderBottomRightRadius],
        borders: [computed.borderTopWidth, computed.borderRightWidth, computed.borderBottomWidth, computed.borderLeftWidth] };
    };
    const counts = [...review.querySelectorAll('[role="tab"] span, nav[aria-label="Filter subtopics"] button span, section[aria-labelledby] > div > span')]
      .filter(element => shown(element) && /^\d+(?: subtopics?)?$/.test(element.textContent.trim()))
      .map(element => ({ text: element.textContent.trim(), ...style(element) }));
    return {
      counts,
      headerSparkles: [...review.querySelectorAll('header svg.lucide-sparkles')].filter(shown).length,
      rows: [...review.querySelectorAll('article')].filter(shown).map(element => ({
        name: element.getAttribute('aria-label'), ...style(element), parent: style(element.parentElement),
        // The production list uses sibling dividers; a final or single row
        // has its upper boundary on the previous row or section heading.
        before: element.parentElement.previousElementSibling
          ? style(element.parentElement.previousElementSibling)
          : style(element.parentElement.parentElement.previousElementSibling),
      })),
    };
  });
  assert.equal(presentation.headerSparkles, 0, `${stage}: decorative Sparkles remain in the header`);
  assert.ok(presentation.counts.length > 0, `${stage}: no plain subtopic counts found`);
  for (const count of presentation.counts) {
    assert.match(count.background, /^(?:transparent|rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\))$/, `${stage}: count has a background badge`);
    assert.equal(count.backgroundImage, 'none', `${stage}: count has a background image`);
    assert.equal(count.shadow, 'none', `${stage}: count has a shadow badge`);
  }
  assert.ok(presentation.rows.length > 0, `${stage}: no rows measured`);
  for (const article of presentation.rows) {
    assert.ok(article.radii.every(radius => parseFloat(radius) === 0), `${stage}: row remains a rounded card`);
    assert.ok([article.borders[1], article.borders[3]].every(border => parseFloat(border) === 0), `${stage}: row has card side borders`);
    assert.equal(article.shadow, 'none', `${stage}: row has a card shadow`);
    assert.ok([article.borders[0], article.borders[2], article.parent.borders[0], article.parent.borders[2], article.before.borders[2]].some(border => parseFloat(border) >= 1),
      `${stage}: row has no flat border divider`);
  }
  item.presentation ??= [];
  item.presentation.push({ stage, actions, ...presentation, topicPaneHasNoPageCaptions: true });
}

async function layout(page, item, stage) {
  const result = await page.getByRole('dialog', { name: 'Build your exam profile', exact: true }).evaluate(dialog => {
    const box = dialog.getBoundingClientRect();
    const rendered = element => {
      if (element.closest('[data-state="inactive"]')) return false;
      for (let parent = element.parentElement; parent && parent !== dialog; parent = parent.parentElement)
        if (parent.tagName === 'DETAILS' && !parent.open && !parent.querySelector(':scope > summary')?.contains(element)) return false;
      const rect = element.getBoundingClientRect();
      return element.getClientRects().length && rect.width > 0 && rect.height > 0;
    };
    const content = [...dialog.querySelectorAll('article, blockquote, input, textarea, [role="tablist"], footer')].filter(rendered);
    const buttons = [...dialog.querySelectorAll('article button')].filter(rendered);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      dialog: { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, scroll: dialog.scrollWidth, client: dialog.clientWidth },
      documentWidth: document.documentElement.scrollWidth,
      overflows: content.map(element => ({ tag: element.tagName, text: (element.textContent || element.getAttribute('aria-label') || '').slice(0, 70),
        left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, scroll: element.scrollWidth, client: element.clientWidth }))
        // Native form fields scroll their entered value by design. Their outer
        // bounds must fit; only rendered prose/card/tab content must wrap.
        .filter(element => element.left < box.left - 1 || element.right > box.right + 1 ||
          (!['INPUT', 'TEXTAREA'].includes(element.tag) && element.scroll > element.client + 2)),
      rowControls: buttons.map(element => ({ label: element.getAttribute('aria-label'), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
    };
  });
  item.layouts.push({ stage, ...result });
  assert.ok(result.dialog.left >= -1 && result.dialog.right <= result.viewport.width + 1, `${stage}: dialog outside viewport`);
  assert.ok(result.dialog.top >= -1 && result.dialog.bottom <= result.viewport.height + 1, `${stage}: footer outside viewport`);
  assert.ok(result.documentWidth <= result.viewport.width + 1 && result.dialog.scroll <= result.dialog.client + 1, `${stage}: horizontal overflow`);
  assert.deepEqual(result.overflows, [], `${stage}: clipped content`);
  assert.ok(result.rowControls.every(control => control.width >= 43 && control.height >= 43), `${stage}: row action touch targets below 44px`);
  if (item.viewport.name === 'desktop') assert.ok(Math.abs(result.dialog.width - 1040) <= 2, `${stage}: expected 1040px desktop review`);
  if (item.viewport.name === 'phone') assert.ok(Math.abs(result.dialog.width - 390) <= 2, `${stage}: expected full-width phone review`);
}

async function renameProfile(review, value) {
  await review.getByRole('button', { name: 'Edit profile name', exact: true }).click();
  const input = review.getByRole('textbox', { name: 'Profile name', exact: true });
  await input.fill(value); await input.press('Enter');
  await visible(review.getByRole('heading', { name: value, exact: true }));
}
async function editTopic(page, list, original, alias, notes) {
  await row(list, original).getByRole('button', { name: `Edit ${original}`, exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Edit subtopic', exact: true });
  await settled(modal);
  await modal.getByRole('textbox', { name: 'Subtopic name', exact: true }).fill(alias);
  await modal.getByRole('textbox', { name: /^Your notes/ }).fill(notes);
  await modal.getByRole('button', { name: 'Done', exact: true }).click();
  await modal.waitFor({ state: 'hidden' });
  await visible(row(list, alias));
  assert.equal(await row(list, alias).getByRole('button', { name: `Edit ${alias}`, exact: true }).evaluate(element => element === document.activeElement), true, 'Subtopic editor did not return focus to its row action.');
}
async function cancelTopicEditor(page, ui, alias) {
  const trigger = row(ui.list, alias).getByRole('button', { name: `Edit ${alias}`, exact: true });
  const modal = page.getByRole('dialog', { name: 'Edit subtopic', exact: true });
  await trigger.click(); await settled(modal);
  await modal.getByRole('textbox', { name: 'Subtopic name', exact: true }).fill('Cancelled subtopic alias');
  await modal.getByRole('textbox', { name: /^Your notes/ }).fill('Cancelled private notes');
  await modal.press('Escape'); await modal.waitFor({ state: 'hidden' });
  await visible(row(ui.list, alias));
  assert.equal(await trigger.evaluate(element => element === document.activeElement), true, 'Escape did not return focus to the topic action.');
  await trigger.click(); await settled(modal);
  const parent = await ui.dialog.boundingBox();
  await page.mouse.click(parent.x + 8, parent.y + 8);
  await modal.waitFor({ state: 'hidden' });
  await visible(ui.review);
  assert.equal(await page.getByRole('alertdialog').count(), 0, 'Child backdrop click closed the parent review or opened its discard guard.');
  assert.equal(await trigger.evaluate(element => element === document.activeElement), true, 'Backdrop dismissal did not return focus to the topic action.');
}
async function selectGroup(review, list, item, value) {
  if (item.viewport.name === 'phone') {
    const select = list.getByRole('combobox', { name: 'Filter by syllabus group', exact: true });
    await select.selectOption({ label: value === 'all' ? 'All subtopics (3)' : `${value} (${value.startsWith('Theme 1') ? 2 : 1})` });
  } else {
    await review.getByRole('navigation', { name: 'Filter subtopics', exact: true }).getByRole('button', { name: value === 'all' ? /^All subtopics\s+3$/ : new RegExp(value) }).click();
  }
}
async function paperValues(ui, fixture) {
  await ui.review.getByRole('tab', { name: 'Exam settings', exact: true }).click();
  assert.equal(await ui.dialog.getByRole('spinbutton', { name: 'Time limit (minutes)', exact: true }).inputValue(), String(fixture.proposal.template.durationMinutes));
  assert.equal(await ui.dialog.getByRole('spinbutton', { name: 'Total marks', exact: true }).inputValue(), String(fixture.proposal.template.marks));
  await ui.review.locator('summary').filter({ hasText: 'Question layout & advanced settings' }).click();
  const question = ui.review.locator('summary').filter({ hasText: /^Question 1/ });
  await question.click();
  const parts = fixture.proposal.template.sections[0].groups[0].parts;
  for (const [index, part] of parts.entries()) {
    const label = `1${String.fromCharCode(97 + index)}`;
    assert.equal(await ui.dialog.getByRole('combobox', { name: `Topic ${label}`, exact: true }).inputValue(), part.topic);
    assert.equal(await ui.dialog.getByRole('spinbutton', { name: `Marks ${label}`, exact: true }).inputValue(), String(part.marks));
    assert.equal(await ui.dialog.getByRole('combobox', { name: `Resource ${label}`, exact: true }).inputValue(), part.resource);
    assert.equal(await ui.dialog.getByRole('combobox', { name: `Response ${label}`, exact: true }).inputValue(), part.response);
  }
  await topicTab(ui.review).click();
}
async function sourceReferences(page, ui, fixture, item) {
  const summaries = ui.review.locator('summary').filter({ hasText: /^Assessment references$/ });
  assert.equal(await summaries.count(), fixture.proposal.evidence.documents.length);
  item.sourceReferences = [];
  for (const [index, document] of fixture.proposal.evidence.documents.entries()) {
    await visible(ui.review.getByText(document.title, { exact: true }));
    const summary = summaries.nth(index);
    await summary.click();
    const references = summary.locator('..').getByRole('listitem');
    const claims = fixture.proposal.evidence.claims.filter(claim => claim.documentId === document.id);
    assert.equal(await references.count(), claims.length);
    for (const [claimIndex, claim] of claims.entries()) {
      const location = document.locations.find(location => location.id === claim.locationId);
      assert.ok(location, 'Source claim lost its original document location.');
      const reference = references.nth(claimIndex);
      const caption = reference.locator('p').first();
      await visible(caption);
      assert.ok((await caption.innerText()).endsWith(` · PDF page ${location.page}`), 'Source tab lost its original page reference.');
      assert.deepEqual(await reference.locator('blockquote').allTextContents(), [claim.quote], 'Source claim quote changed.');
      item.sourceReferences.push({ documentId: document.id, field: claim.field, page: location.page, exactClaimQuoteRetained: true });
    }
    await screenshot(page, 'source-references', item);
    await summary.click();
  }
}
async function discardAndClose(page, ui, originalName) {
  const before = await snapshot(page);
  await renameProfile(ui.review, 'Discard this synthetic rename');
  await ui.dialog.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await visible(ui.review.getByRole('heading', { name: originalName, exact: true }));
  assert.deepEqual((await snapshot(page)).state, before.state);
  await renameProfile(ui.review, 'Discard this synthetic rename');
  await ui.review.getByRole('button', { name: 'Close profile builder', exact: true }).click();
  const alert = page.getByRole('alertdialog');
  await visible(alert);
  await alert.getByRole('button', { name: /^(Keep editing|Continue editing|Cancel)$/ }).click();
  await visible(ui.review.getByRole('heading', { name: 'Discard this synthetic rename', exact: true }));
  await ui.review.getByRole('button', { name: 'Close profile builder', exact: true }).click();
  await visible(alert);
  await alert.press('Escape');
  await alert.waitFor({ state: 'hidden' });
  await visible(ui.review.getByRole('heading', { name: 'Discard this synthetic rename', exact: true }));
  await ui.review.getByRole('button', { name: 'Close profile builder', exact: true }).click();
  await visible(alert);
  await alert.getByRole('button', { name: /^Discard/ }).click();
  await ui.dialog.waitFor({ state: 'hidden' });
  assert.deepEqual((await snapshot(page)).state, before.state, 'Discard/close modified saved data or made an API call.');
  const reopened = await openSaved(page);
  await visible(reopened.review.getByRole('heading', { name: originalName, exact: true }));
  return reopened;
}
function assertOwnedContext(context, fixture, expectedTemplate) {
  assert.deepEqual(context, { ...fixture.seed.profile_template, template: expectedTemplate }, 'Complete saved context changed unexpectedly.');
  assert.equal(context.proposalId, fixture.receipt);
  if (fixture.scenario === 'detailed') assertEvidenceProvenance(context, fixture);
}

async function generatedRoundTrip(page, item) {
  await page.goto(`${origin}/verify-builder?scenario=detailed&generated=1`);
  await page.waitForFunction(() => window.__aiProfileFixture);
  const original = await snapshot(page);
  assert.equal(original.state.profile, null);
  await page.getByRole('button', { name: 'Build new profile', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Build your exam profile', exact: true });
  await settled(dialog);
  await dialog.locator('summary').filter({ hasText: 'Advanced details' }).click();
  await dialog.getByRole('textbox', { name: 'Official specification URL', exact: true }).fill(original.sourceUrl);
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.getByRole('button', { name: 'Yes, build it', exact: true }).click();
  const ui = await editor(page);
  assert.deepEqual((await snapshot(page)).state.calls.map(call => call.action), ['propose']);
  assert.equal(await topicTab(ui.review).getAttribute('aria-selected'), 'true');
  await cleanPresentation(ui, item, 'new-generated-proposal');
  await layout(page, item, 'new-generated-proposal');
  await screenshot(page, 'new-generated-review', item);
  await saveButton(ui.dialog).click();
  await ui.dialog.waitFor({ state: 'hidden' });
  const saved = await snapshot(page);
  assert.deepEqual(saved.state.calls.map(call => call.action), ['propose', 'save']);
  assert.deepEqual(saved.state.calls[1].template, original.proposal.template, 'Generated proposal was reconstructed or dropped fields before save.');
  assert.equal(saved.state.calls[1].profileId, undefined);
  assertOwnedContext(saved.state.profile.profile_template, original, original.proposal.template);
  await page.reload();
  const reopened = await openSaved(page);
  assert.deepEqual((await snapshot(page)).state, saved.state);
  await reopened.search.fill('ethnographic');
  assert.deepEqual(await row(reopened.list, 'Market research').locator('blockquote').allTextContents(), [original.excerpts.research, original.excerpts.researchContinuation]);
  await noPageCaptions(reopened.list, 'new-generated-reloaded');
  await layout(page, item, 'new-generated-reloaded');
  await screenshot(page, 'new-generated-reloaded', item);
  item.generated = { exactProposalToSaveAndReload: true, oneProposeOneSave: true,
    entireIdentityDemandResourcesCalculatorWarningsDesignSectionsPreserved: true,
    evidencePhysicalPagesChecksumFingerprintAndReceiptPreserved: true,
    savedContext: saved.state.profile.profile_template };
}

async function addedTopicRoundTrip(page, item, original, alias, aliasNotes) {
  const added = 'Independent pricing experiment';
  const notes = 'Private added-topic note: compare my family shop example before Friday.';
  const ui = await openSaved(page);
  const before = await snapshot(page);
  await ui.list.getByRole('button', { name: 'Add subtopic', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Add subtopic', exact: true });
  await settled(modal);
  await modal.getByRole('textbox', { name: 'Subtopic name', exact: true }).fill(added);
  await modal.getByRole('textbox', { name: /^Your notes/ }).fill(notes);
  await modal.getByRole('button', { name: 'Done', exact: true }).click();
  await modal.waitFor({ state: 'hidden' });
  assert.equal(await ui.list.getByRole('button', { name: 'Add subtopic', exact: true }).evaluate(element => element === document.activeElement), true, 'Add-subtopic editor did not restore trigger focus.');
  await ui.search.fill(added);
  await visible(row(ui.list, added).getByText('Added by you', { exact: true }));
  await visible(row(ui.list, added).getByText(notes, { exact: true }));
  await cleanPresentation(ui, item, 'added-topic-with-notes');
  assert.equal(await row(ui.list, added).locator('blockquote').count(), 0, 'An added topic borrowed source provenance.');
  assert.deepEqual((await snapshot(page)).state, before.state, 'Adding a topic made an API call before Save.');
  await saveButton(ui.dialog).click(); await ui.dialog.waitFor({ state: 'hidden' });
  const saved = await snapshot(page);
  const template = { ...original.proposal.template, mode: 'custom',
    topics: [...original.topics, added], addedTopics: [added],
    topicEdits: [{ topic: original.topics[0], label: alias, notes: aliasNotes }, { topic: added, notes }] };
  assert.deepEqual(saved.state.calls.at(-1).template, template);
  assert.deepEqual(saved.state.profile.profile_template.template, template);
  assert.deepEqual(template.sections, original.proposal.template.sections, 'A new personal topic changed scored-part identities, marks or canonical tags.');
  assert.deepEqual(saved.state.profile.profile_template.evidence, original.proposal.evidence);
  assert.equal(saved.state.profile.profile_template.evidenceVersion, original.proposal.evidenceVersion);
  assert.equal(saved.state.profile.profile_template.proposalId, original.receipt);
  assertEvidenceProvenance(saved.state.profile.profile_template, original);
  const shared = await page.evaluate(() => window.__aiProfileSharedSnapshot());
  assert.ok(shared);
  assert.ok(!JSON.stringify(shared).includes(notes) && !JSON.stringify(shared).includes(aliasNotes), 'Personal notes leaked into a shared exam snapshot.');
  assert.ok(shared.context.template.topicEdits.every(edit => !Object.hasOwn(edit, 'notes')));
  assert.equal(shared.context.evidence.topicDetails, undefined);
  assert.deepEqual(shared.context.template.topics, template.topics);
  assert.equal(shared.context.template.topicEdits[0].label, alias);
  await page.reload();
  const reloaded = await openSaved(page);
  await reloaded.search.fill(notes);
  await visible(row(reloaded.list, added).getByText(notes, { exact: true }));
  await visible(row(reloaded.list, added).getByText('Added by you', { exact: true }));
  assert.equal(await row(reloaded.list, added).locator('blockquote').count(), 0);
  await cleanPresentation(reloaded, item, 'added-topic-reloaded');
  assert.deepEqual((await snapshot(page)).state, saved.state);
  await layout(page, item, 'added-topic-notes-reloaded');
  await screenshot(page, 'added-topic-notes-reloaded', item);
  await reloaded.review.getByRole('button', { name: 'Close profile builder', exact: true }).click();
  await reloaded.dialog.waitFor({ state: 'hidden' });
  item.addedTopic = { notesPersistThroughSaveAndReload: true, stableCanonicalIdentityAndScoredParts: true,
    noBorrowedSourceProvenance: true, sharedSnapshotRedactsAllPersonalNotes: true };
}

async function detailed(page, item) {
  let ui = await openSaved(page);
  const original = await snapshot(page);
  assert.equal(await topicTab(ui.review).getAttribute('aria-selected'), 'true');
  assert.equal(await ui.list.getByRole('article').count(), 3);
  assert.equal(await ui.list.locator('blockquote').count(), 0, 'Source excerpts should start collapsed.');
  await cleanPresentation(ui, item, 'collapsed-overview');
  await layout(page, item, 'overview'); await screenshot(page, 'overview', item);
  const research = row(ui.list, 'Market research');
  const expand = research.getByRole('button', { name: 'Show source outcomes and notes for Market research', exact: true });
  await expand.focus(); await expand.press('Enter');
  assert.deepEqual(await research.locator('blockquote').allTextContents(), [original.excerpts.research, original.excerpts.researchContinuation]);
  await cleanPresentation(ui, item, 'expanded-source-outcomes');
  assertEvidenceProvenance(original.seed.profile_template, original);
  await layout(page, item, 'expanded-outcomes'); await screenshot(page, 'expanded', item);
  for (const [topic, excerpt] of [['Market positioning', original.excerpts.positioning], ['Sources of finance', original.excerpts.finance]]) {
    const sourceRow = row(ui.list, topic);
    await sourceRow.getByRole('button', { name: `Show source outcomes and notes for ${topic}`, exact: true }).click();
    assert.deepEqual(await sourceRow.locator('blockquote').allTextContents(), [excerpt], `${topic}: literal source text changed`);
    await noPageCaptions(ui.list, `expanded: ${topic}`);
    await sourceRow.getByRole('button', { name: `Hide source outcomes and notes for ${topic}`, exact: true }).click();
  }
  for (const [query, expected] of [['ETHNOGRAPHIC', 1], ['1.1 Meeting customer needs', 2], ['2.1.1 Sources of finance', 1], ['Synthetic Business syllabus', 3], ['no-matching-fixture-topic', 0]]) {
    await ui.search.fill(query);
    await noPageCaptions(ui.list, `search: ${query}`);
    assert.equal(await ui.list.getByRole('article').count(), expected);
    if (!expected) await visible(ui.list.getByText('No matching subtopics. Try another search or group.', { exact: true }));
  }
  await ui.list.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await selectGroup(ui.review, ui.list, item, 'Theme 1: Marketing and people');
  assert.equal(await ui.list.getByRole('article').count(), 2);
  await selectGroup(ui.review, ui.list, item, 'all');
  for (const tab of ['Exam settings', 'Syllabus & source']) {
    await ui.review.getByRole('tab', { name: tab, exact: true }).click();
    if (tab === 'Syllabus & source') {
      await sourceReferences(page, ui, original, item);
      const details = ui.review.locator('summary').filter({ hasText: 'Course details' });
      await details.click();
      const text = await details.locator('..').locator('dl').innerText();
      for (const value of Object.values(original.proposal.template.identity))
        assert.ok(text.includes(value === 'not_tiered' ? 'Untiered' : value), `Identity value missing from source details: ${value}`);
      await visible(ui.review.getByText(original.proposal.template.warnings[0], { exact: true }));
    }
    await layout(page, item, tab); await screenshot(page, tab === 'Exam settings' ? 'settings' : 'source', item);
  }
  await topicTab(ui.review).click();
  assert.deepEqual((await snapshot(page)).state, original.state, 'View-only search, filters or tabs changed data or made an API call.');
  const alias = 'Customer research — my revision label';
  const notes = 'Personal note: rehearse the sampling-bias example; this is not source wording.';
  const editedName = `Synthetic ${item.viewport.name} ${item.theme} edited`;
  await renameProfile(ui.review, editedName);
  await editTopic(page, ui.list, 'Market research', alias, notes);
  await cancelTopicEditor(page, ui, alias);
  await ui.search.fill(notes);
  await visible(row(ui.list, alias).getByText(notes, { exact: true }));
  assert.deepEqual(await row(ui.list, alias).locator('blockquote').allTextContents(), [original.excerpts.research, original.excerpts.researchContinuation]);
  await cleanPresentation(ui, item, 'edited-source-outcomes');
  await ui.search.fill('');
  await ui.list.getByRole('button', { name: item.viewport.name === 'phone' ? 'Select multiple' : 'Select topics', exact: true }).click();
  await ui.list.getByRole('button', { name: 'Select shown', exact: true }).click();
  item.bulkRemoveIcon = await iconAction(ui.list.getByRole('button', { name: 'Remove selected', exact: true }), 'trash2', 'bulk Remove');
  assert.equal(await ui.list.getByRole('button', { name: 'Remove selected', exact: true }).isEnabled(), false);
  await ui.list.getByRole('checkbox', { name: 'Select Market positioning', exact: true }).uncheck();
  await ui.list.getByRole('button', { name: 'Remove selected', exact: true }).click();
  assert.equal(await ui.list.getByRole('article').count(), 1);
  assert.equal(await row(ui.list, 'Market positioning').getByRole('button', { name: 'Remove Market positioning', exact: true }).isEnabled(), false);
  await cleanPresentation(ui, item, 'keep-one-after-bulk-remove');
  await visible(ui.review.getByText('Custom assessment', { exact: true }));
  await ui.list.getByRole('button', { name: 'Undo last topic change', exact: true }).click();
  assert.equal(await ui.list.getByRole('article').count(), 3);
  await visible(row(ui.list, alias));
  await ui.list.getByRole('button', { name: 'Done selecting', exact: true }).click();
  await paperValues(ui, original);
  await row(ui.list, 'Sources of finance').getByRole('button', { name: 'Remove Sources of finance', exact: true }).click();
  assert.equal(await ui.list.getByRole('article').count(), 2);
  await ui.review.getByRole('button', { name: 'Restore full paper', exact: true }).click();
  assert.equal(await ui.list.getByRole('article').count(), 3);
  await visible(ui.review.getByText('Full mock', { exact: true }));
  assert.deepEqual((await snapshot(page)).state.calls, [], 'Edits triggered proposal regeneration or persistence before Save.');
  await layout(page, item, 'edited-restored'); await screenshot(page, 'edited-restored', item);
  await page.evaluate(() => window.__aiProfileFailNextSave());
  await saveButton(ui.dialog).click();
  await visible(ui.dialog.getByText('Synthetic save failure. Your draft is still open; retry Save profile.', { exact: true }));
  await visible(ui.review.getByRole('heading', { name: editedName, exact: true }));
  await visible(row(ui.list, alias));
  assert.deepEqual((await snapshot(page)).state.profile, original.seed, 'Failed save changed saved data.');
  await screenshot(page, 'save-failure', item);
  await saveButton(ui.dialog).click(); await ui.dialog.waitFor({ state: 'hidden' });
  const saved = await snapshot(page);
  assert.deepEqual(saved.state.calls.map(call => call.action), ['save', 'save']);
  assert.deepEqual(saved.state.calls[0], saved.state.calls[1], 'Retry changed the draft or proposal receipt.');
  const expected = { ...original.proposal.template, topicEdits: [{ topic: original.topics[0], label: alias, notes }] };
  assert.deepEqual(saved.state.calls[1].template, expected, 'Undo/restore failed to preserve exact layout, IDs, marks, tags or metadata.');
  assert.equal(saved.state.profile.profile_name, editedName);
  assertOwnedContext(saved.state.profile.profile_template, original, expected);
  assert.equal(saved.state.updateEvents, 1);
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    const reopened = await openSaved(page);
    await visible(reopened.review.getByRole('heading', { name: editedName, exact: true }));
    await reopened.search.fill(notes);
    await visible(row(reopened.list, alias).getByText(notes, { exact: true }));
    assert.deepEqual(await row(reopened.list, alias).locator('blockquote').allTextContents(), [original.excerpts.research, original.excerpts.researchContinuation]);
    await cleanPresentation(reopened, item, reload ? 'persisted-reloaded' : 'persisted-reopened');
    assert.deepEqual((await snapshot(page)).state, saved.state);
    await layout(page, item, reload ? 'reloaded' : 'reopened');
    if (reload) await screenshot(page, 'persisted', item);
    await reopened.review.getByRole('button', { name: 'Close profile builder', exact: true }).click();
    await reopened.dialog.waitFor({ state: 'hidden' });
  }
  item.checks = { defaultSubtopicsTab: true, literalSourceExcerptsIntact: true,
    noTopicPageCaptionsCollapsedExpandedFilteredEditedAndReloaded: true, originalEvidencePagesAndChecksumRetained: true,
    iconOnlyActionsWithAccessibleNamesTitlesAnd44pxTargets: true, plainCountsNoDecorativeSparklesAndFlatRowDividers: true,
    searchByLeafGroupOutcomeDocumentAndNotes: true, filtersAndTabsMakeZeroAPICalls: true,
    profileRenameAndTopicDisplayAliasAndPersonalNotes: true, canonicalTopicsAndPartTagsPreserved: true,
    childEditorEscapeBackdropCancelAndFocusReturn: true,
    bulkRemoveKeepOneGuardUndoAndRestoreExactLayoutIdsMarks: true, noRegenerationOnEdits: true,
    failedSaveRetainsExactDraftAndRetry: true,
    saveReopenAndReload: true, completeOwnedContextRetained: true, noHorizontalOverflow: true };
  await addedTopicRoundTrip(page, item, original, alias, notes);
  await generatedRoundTrip(page, item);
  // Run modal cleanup after the independent edit/persistence checks so a stuck
  // pointer-events lock does not hide failures in those other behaviors.
  await page.goto(`${origin}/verify-builder?scenario=detailed`);
  await page.waitForFunction(() => window.__aiProfileFixture);
  await discardAndClose(page, await openSaved(page), editedName);
  item.checks.discardResetAndCloseConfirmationKeepAndDiscard = true;
}

async function legacy(page, item) {
  let ui = await openSaved(page);
  const original = await snapshot(page);
  assert.equal(original.proposal.evidence.topicDetails, undefined);
  assert.equal(await ui.list.getByRole('article').count(), 2);
  await cleanPresentation(ui, item, 'legacy-flat-overview');
  for (const topic of original.broadTopics) await visible(row(ui.list, topic).getByText('No source detail saved', { exact: true }));
  assert.equal(await ui.list.locator('blockquote').count(), 0);
  assert.equal(await ui.list.getByRole('button', { name: /^(Show|Hide) source outcomes/ }).count(), 0);
  assert.equal(await ui.review.getByText(/Theme 1:|Theme 2:/).count(), 0);
  await ui.search.fill('BUSINESS STRATEGY'); assert.equal(await ui.list.getByRole('article').count(), 1);
  await ui.search.fill('no-legacy-result'); assert.equal(await ui.list.getByRole('article').count(), 0);
  await ui.list.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await layout(page, item, 'legacy-flat'); await screenshot(page, 'flat', item);
  await ui.review.getByRole('tab', { name: 'Syllabus & source', exact: true }).click();
  await sourceReferences(page, ui, original, item);
  const reread = ui.dialog.getByRole('button', { name: 'Read syllabus again for topic detail', exact: true });
  await visible(reread); await reread.click();
  const restart = page.getByRole('alertdialog', { name: 'Start a new build?', exact: true });
  await visible(restart); await restart.press('Escape'); await restart.waitFor({ state: 'hidden' });
  assert.deepEqual((await snapshot(page)).state, original.state);
  await reread.click(); await restart.getByRole('button', { name: 'Start again', exact: true }).click();
  await visible(ui.dialog.getByRole('button', { name: 'Upload syllabus', exact: true }));
  assert.deepEqual((await snapshot(page)).state, original.state, 'Legacy reread made an API call or changed the saved profile.');
  await screenshot(page, 'reread-source-choices', item);
  await ui.dialog.getByRole('button', { name: 'Close profile builder', exact: true }).click();
  await ui.dialog.waitFor({ state: 'hidden' });
  await page.reload(); ui = await openSaved(page);
  assert.equal(await ui.list.getByRole('article').count(), 2);
  assert.equal(await ui.list.locator('blockquote').count(), 0);
  assert.deepEqual((await snapshot(page)).state, original.state);
  await cleanPresentation(ui, item, 'legacy-flat-reloaded');
  item.checks = { flatLegacyLabelsAndNoInventedGroupsOrOutcomes: true, searchWithoutFabrication: true,
    rereadConfirmationEscapeAndSourceChoices: true, noAPIOrSavedDataChange: true,
    freshReloadRemainsLegacy: true, noHorizontalOverflow: true,
    noTopicPageCaptions: true, iconOnlyActionsWithAccessibleNamesTitlesAnd44pxTargets: true,
    plainCountsNoDecorativeSparklesAndFlatRowDividers: true };
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
      if (process.env.PROFILE_BUILDER_BROWSER_CASE && !new RegExp(process.env.PROFILE_BUILDER_BROWSER_CASE).test(`${viewport.name}-${theme}-${scenario}`)) continue;
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
        await page.waitForFunction(() => window.__aiProfileFixture || document.querySelector('[data-fixture-error]'));
        assert.equal(await page.locator('[data-fixture-error]').count(), 0, await page.locator('#root').innerText());
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), theme === 'dark');
        await (process.argv.includes('--preflight') ? preflight(page, item) : scenario === 'legacy' ? legacy(page, item) : detailed(page, item));
        item.status = 'PASS';
      } catch (error) {
        item.status = 'FAIL'; item.error = error.stack;
        item.dom = await page.locator('body').ariaSnapshot().catch(() => 'unavailable');
        item.pointerState = await page.evaluate(() => ({
          body: { style: document.body.getAttribute('style'), pointerEvents: getComputedStyle(document.body).pointerEvents },
          dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]')].map(element => ({ role: element.getAttribute('role'), state: element.getAttribute('data-state'), html: element.outerHTML.slice(0, 1200) })),
        })).catch(() => null);
        await screenshot(page, 'failure', item).catch(() => {});
      } finally {
        await context.close(); writeReport();
      }
      console.log(JSON.stringify({ case: `${viewport.name}-${theme}-${scenario}`, status: item.status, ...(item.error ? { error: item.error.split('\n').slice(0, 3).join('\n') } : {}) }));
    }
  } finally { await browser.close(); }
  verifyHashes('hashesAfter');
  report.finishedAt = new Date().toISOString();
  report.expectedCases = viewports.flatMap(viewport => ['light', 'dark'].flatMap(theme => ['detailed', 'legacy'].map(scenario => `${viewport.name}-${theme}-${scenario}`)))
    .filter(name => !process.env.PROFILE_BUILDER_BROWSER_CASE || new RegExp(process.env.PROFILE_BUILDER_BROWSER_CASE).test(name)).length;
  report.status = cases.length > 0 && cases.length === report.expectedCases && cases.every(item => item.status === 'PASS') && !errors.length && !blocked.length && !report.sourceDrift ? 'PASS' : 'FAIL';
  writeReport();
  assert.equal(report.status, 'PASS', `See ${path.join(artifacts, process.argv.includes('--preflight') ? 'preflight-results.json' : 'browser-results.json')}`);
  console.log(JSON.stringify({ status: report.status, cases: cases.length, screenshots: screenshots.length, artifacts }));
})().catch(error => {
  report.status = 'FAIL'; report.fatalError = error.stack; report.finishedAt = new Date().toISOString(); writeReport();
  console.error(error.stack); process.exitCode = 1;
});
