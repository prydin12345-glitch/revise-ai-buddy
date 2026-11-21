import { build } from 'esbuild';
import { getDocumentProxy } from 'unpdf';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Public reference copy only. Model, account and database boundaries are local
// controlled substitutes; actual PDF extraction, discovery, reader and save run.
const [pdfPath, resultPath] = process.argv.slice(2);
assert.ok(pdfPath, 'Usage: node verify-public-pdf.mjs /tmp/business.pdf [/tmp/results.json]');
const bytes = await readFile(pdfPath);
const sha256 = createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256, '8d66018d0a9d826cdb9729c78012d73f5e7ab32bd8946f9eb9fd501827c9829f');
const root = process.cwd(), dir = await mkdtemp(path.join(tmpdir(), 'detailed-topics-source-'));
const shared = path.join(root, 'supabase/functions/_shared');
const exports = [
  ['profile-document-io.ts', 'extractIndexedPdfPages'],
  ['profile-assessment-discovery.ts', 'discoverSourceAssessments'],
  ['profile-builder-jobs.ts', 'prepareSourceJob,advanceSourceJob,confirmSourceJob'],
  ['profile-builder-service.ts', 'prepareProfileSave'],
  ['profile-evidence.ts', 'validateEvidence'],
  ['profile-template-context.ts', 'snapshotTemplate'],
].map(([file, names]) => `export {${names}} from ${JSON.stringify(path.join(shared, file))};`).join('\n');
await build({ stdin: { contents: exports + `\nexport {memoryJobStore,ownerKey} from ${JSON.stringify(path.join(root, 'supabase/tests/profile-builder-jobs-fixtures.ts'))};`, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', outfile: path.join(dir, 'reader.mjs'), logLevel: 'error', plugins: [{ name: 'offline-test-helper', setup(b) { b.onResolve({ filter: /^vitest$/ }, () => ({ path: 'vitest', namespace: 'local' })); b.onLoad({ filter: /.*/, namespace: 'local' }, () => ({ contents: 'export const vi={fn:fn=>fn};' })); } }] });
const m = await import(pathToFileURL(path.join(dir, 'reader.mjs')).href);
const pages = await m.extractIndexedPdfPages(new Uint8Array(bytes), getDocumentProxy);
const identity = { country: 'GB', educationSystem: 'UK', stage: 'Secondary', qualification: 'A-level', subject: 'Business', organisation: 'Pearson Edexcel', course: '9BS0', component: 'Paper 1', specificationVersion: 'Not verified', tier: null };
const discovery = await m.discoverSourceAssessments([{ id: 'upload-1', checksum: sha256, pages }], identity);
assert.equal(discovery.candidates.length, 3); assert.equal(discovery.ambiguous, false);
const results = [];
for (const selected of discovery.candidates) {
  const memory = m.memoryJobStore(), owner = 'offline-public-reference', requestId = crypto.randomUUID();
  let calls = 0;
  const deps = { store: memory.store, parsePdf: async supplied => {
    assert.equal(createHash('sha256').update(supplied).digest('hex'), sha256);
    return pages;
  }, model: async (_system, payload) => {
    calls++;
    if (!payload.documents) {
      assert.equal(payload.evidence.topicDetails, undefined);
      const topics = payload.evidence.facts.topics;
      return { promptTokens: 0, completionTokens: 0, value: {
        schemaVersion: 1, identity: payload.identity, mode: payload.mode, marks: 100, durationMinutes: 120,
        topics, calculator: payload.evidence.facts.calculator,
        sections: [{ id: 'paper', title: 'Examly layout', groups: [0, 1, 2, 3].map(i => ({ id: `g${i}`, parts: [{ id: `p${i}`, topic: topics[i], marks: 25, response: i % 2 ? 'long_form' : 'short_answer', demand: 'AO2', resource: 'none' }] })) }],
        warnings: [], designDecisions: ['Four 25-mark parts are a controlled practice layout, not an official question distribution.'],
      } };
    }
    const source = payload.documents[0], locations = [], claims = [];
    const cite = (field, physicalPage, text, quote = text) => {
      assert.ok(source.pages.some(p => p.page === physicalPage && p.text.includes(text)), `${field}: literal supplied span`);
      assert.ok(pages[physicalPage - 1].includes(text), `${field}: original PDF span`);
      const id = `loc${locations.length}`;
      locations.push({ id, page: physicalPage, section: 'Assessment', text });
      claims.push({ field, documentId: source.id, locationId: id, quote, rule: 'mandatory' });
    };
    const content = source.pages.map(p => p.text).join('\n');
    const paperNumber = Number(selected.componentCode.slice(-1));
    for (const sibling of discovery.candidates.filter(c => c.id !== selected.id)) assert.ok(!content.includes(sibling.componentCode));
    const find = regex => {
      for (const page of source.pages) { const match = page.text.match(regex); if (match) return { page: page.page, text: match[0] }; }
      throw Error('Required public assessment quote is absent: ' + regex);
    };
    for (const [field, pattern] of [['marks', /100 marks available\./], ['durationMinutes', /Duration: 2 hours\./], ['selection', /Students answer all questions from both sections\./]]) {
      const match = find(pattern); cite(field, match.page, match.text);
    }
    const formats = find(/Sections A and B each comprise one data response question broken down into\s+a number of parts, including one extended open-response question\./);
    cite('formats', formats.page, formats.text);
    const roots = [];
    for (const theme of paperNumber === 1 ? [1, 4] : paperNumber === 2 ? [2, 3] : [1, 2, 3, 4]) {
      const heading = find(new RegExp('Theme ' + theme + ': [^\\n]+'));
      roots.push(heading.text.trim()); cite('topics', heading.page, heading.text);
    }
    return { promptTokens: 0, completionTokens: 0, value: { evidence: {
      version: 1, identity: payload.identity,
      documents: [{ id: source.id, checksum: source.checksum, title: 'Public Pearson Business reference', url: null, kind: 'specification', authority: 'owner_supplied', state: 'active', version: payload.identity.specificationVersion, retrievedOn: '2026-11-21', applicableCohort: 'First assessment 2017', locations }],
      facts: { marks: 100, durationMinutes: 120, topics: roots, tier: null, calculator: 'unknown', formats: ['short_answer', 'long_form'], selection: 'all_compulsory', mathsRequirement: null, practicalRequirement: null }, claims, unresolved: [], conflicts: [],
    }, identityClaims: [] } };
  } };
  const prepared = await m.prepareSourceJob(owner, { action: 'prepare_source', requestId, identity: { ...identity, component: selected.label }, selectedAssessmentId: selected.id, specificationVersionIntent: 'source', mode: 'full_mock', uploads: [{ contentType: 'application/pdf', base64: bytes.toString('base64') }] }, deps);
  assert.equal(prepared.stage, 'identifying', JSON.stringify(prepared));
  let ready;
  do { ready = await m.advanceSourceJob(owner, requestId, deps); } while (ready.stage === 'identifying');
  assert.equal(ready.stage, 'ready', JSON.stringify(ready));
  const evidence = memory.records.get(m.ownerKey(owner, requestId)).data.evidence;
  m.validateEvidence(evidence);
  assert.ok(evidence.topicDetails?.length > 20, 'Detailed syllabus, rather than umbrella themes');
  for (const detail of evidence.topicDetails) for (const span of detail.sources) assert.ok(pages[span.page - 1].includes(span.text), 'Original literal outcome excerpt');
  const allowed = selected.componentCode === '9BS0/01' ? ['1', '4'] : selected.componentCode === '9BS0/02' ? ['2', '3'] : ['1', '2', '3', '4'];
  assert.ok(evidence.facts.topics.every(topic => allowed.includes(topic.split('.')[0])));
  const originalLeafCodes = [...new Set(pages.flatMap(text => [...text.matchAll(/^\s*(\d{1,2}\.\d{1,2}\.\d{1,2})(?:\s|$)/gm)].map(match => match[1])).filter(code => allowed.includes(code.split('.')[0])))].sort();
  assert.deepEqual(evidence.facts.topics.map(topic => topic.split(' ')[0]).sort(), originalLeafCodes, 'Every selected numbered syllabus unit, without silently dropping content pages');
  if (selected.componentCode === '9BS0/01') {
    for (const expected of ['Market research', 'Price elasticity of demand', 'Pricing strategies', 'Motivation in theory and practice', 'Trading blocs', '4.3.1 Marketing']) assert.ok(evidence.facts.topics.some(topic => topic.includes(expected)), expected);
    for (const outcome of ['market share', 'Maslow', 'NAFTA', 'child labour']) assert.ok(evidence.topicDetails.some(detail => detail.sources.some(s => s.text.includes(outcome))), outcome);
  }
  await m.confirmSourceJob(owner, requestId, { identity: evidence.identity, mode: 'full_mock' }, deps);
  const completed = await m.advanceSourceJob(owner, requestId, deps);
  assert.equal(completed.stage, 'complete', JSON.stringify(completed));
  const saved = m.prepareProfileSave(completed.proposal, completed.proposal.template);
  assert.deepEqual(saved.settings.topics, evidence.facts.topics);
  assert.deepEqual(saved.context.evidence.topicDetails, evidence.topicDetails);
  const frozen = m.snapshotTemplate({ ...saved.settings, profile_template: saved.context });
  assert.equal(frozen.context.evidence.topicDetails, undefined);
  assert.equal(calls, 2, 'One controlled read and one controlled draft; no paid calls');
  results.push({ code: selected.componentCode, leafTopics: evidence.facts.topics.length, paths: [...new Set(evidence.topicDetails.map(d => d.path.join(' > ')))], physicalContentPages: [...new Set(evidence.topicDetails.flatMap(d => d.sources.map(s => s.page)))], literalExcerpts: true, siblingsExcluded: true, saveRoundTrip: true, privateOutcomesRedactedFromSharedSnapshot: true, controlledModelCalls: calls });
}
const report = { status: 'PASS', boundary: 'Actual public PDF and local reader/job/save flow; controlled model and in-memory store, no live AI or user data.', sha256, physicalPages: pages.length, papers: results };
if (resultPath) await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
