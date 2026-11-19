import { build } from 'esbuild';
import { getDocumentProxy } from 'unpdf';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Explicit local public reference only; no network, provider, DB or student data.
const file = process.argv[2];
if (!file) throw Error('Usage: node docs/profile-builder/business-page-recovery/verify-pages.mjs /tmp/reference.pdf [baseline-ref]');
const root = process.cwd(), artifacts = await mkdtemp(path.join(tmpdir(), 'business-reference-'));
const baseline = process.argv[3];
let sourceRoot = root;
if (baseline) {
  const archive = path.join(artifacts, 'baseline.tar');
  execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, baseline, 'supabase/functions']);
  execFileSync('tar', ['-xf', archive, '-C', artifacts]);
  sourceRoot = artifacts;
}
const shared = path.join(sourceRoot, 'supabase/functions/_shared');
await build({ stdin: { contents: `export {extractIndexedPdfPages} from ${JSON.stringify(path.join(shared, 'profile-document-io.ts'))};export {discoverSourceAssessments} from ${JSON.stringify(path.join(shared, 'profile-assessment-discovery.ts'))};export {indexDocumentPages} from ${JSON.stringify(path.join(shared, 'profile-document-index.ts'))};`, resolveDir: root },
  bundle: true, format: 'esm', platform: 'node', nodePaths: [path.join(root, 'node_modules')],
  outfile: path.join(artifacts, 'modules.mjs'), logLevel: 'error' });
const { extractIndexedPdfPages, discoverSourceAssessments, indexDocumentPages } = await import(pathToFileURL(path.join(artifacts, 'modules.mjs')).href);
const bytes = new Uint8Array(await readFile(file)), checksum = createHash('sha256').update(bytes).digest('hex');
if (checksum !== '8d66018d0a9d826cdb9729c78012d73f5e7ab32bd8946f9eb9fd501827c9829f') throw Error('The file differs from the reviewed public Pearson reference; no private upload is accepted by this fixture.');
const pages = await extractIndexedPdfPages(bytes, getDocumentProxy);
const continuation = JSON.parse(await readFile(path.join(root, 'supabase/tests/fixtures/edexcel-alevel-business-continuation.json'), 'utf8'));
if (continuation.source.sha256 !== checksum || !continuation.excerpts.every(excerpt => pages[excerpt.page - 1] === excerpt.text))
  throw Error('The continuation fixture differs from the extracted public reference.');
const scope = { qualification: 'A-level', subject: 'Business', organisation: 'Pearson Edexcel', course: '9BS0' };
const discovery = await discoverSourceAssessments([{ id: 'reference', checksum, pages }], scope);
const definitions = {
  '9BS0/01': { good: [[18], [40], [18,40], [13,14,17,18,39,40,45]], bad: [[26], [32]] },
  '9BS0/02': { good: [[26], [32], [26,32]], bad: [[18], [40]] },
  '9BS0/03': { good: [[18], [26], [32], [40], [18,26,32,40]], bad: [] },
};
const cases = [];
for (const candidate of discovery.candidates) {
  const definition = definitions[candidate.componentCode];
  if (!definition) throw Error('Unexpected source assessment');
  const number = Number(candidate.componentCode.slice(-1));
  for (const test of [{ sourcePages: undefined, expected: true }, ...definition.good.map(sourcePages => ({ sourcePages, expected: true })), ...definition.bad.map(sourcePages => ({ sourcePages, expected: false }))]) {
    const index = indexDocumentPages(pages, { ...scope, component: candidate.canonicalComponent, componentAliases: candidate.aliases, ...(test.sourcePages ? { sourcePages: test.sourcePages } : {}) });
    const snippets = index.chunks.flatMap(chunk => chunk.pages), text = snippets.map(page => page.text).join('\n');
    const literal = snippets.every(page => pages[page.page - 1].includes(page.text));
    const siblingsExcluded = [1,2,3].filter(n => n !== number).every(n => !new RegExp('\\bPaper\\s*' + n + '\\b','i').test(text) && !text.includes(`9BS0/0${n}`));
    const focusedSelected = !test.sourcePages || test.sourcePages.every(page => index.pageDiagnostics?.some(d => d.page === page && d.status === 'selected'));
    const bounded = index.chunks.length <= 2 && index.chunks.every(chunk => chunk.characterCount <= 18000);
    const passed = index.coverage.complete === test.expected && literal && bounded && (test.expected ? focusedSelected && siblingsExcluded && /Duration:\s*2 hours/.test(text) && /100 marks/.test(text) : index.chunks.length === 0);
    cases.push({ paper: candidate.componentCode, sourcePages: test.sourcePages ?? 'automatic', expectedCoverage: test.expected, coverage: index.coverage, selectedPages: index.selectedPages, diagnostics: index.pageDiagnostics, characters: text.length, literal, siblingsExcluded, focusedSelected, bounded, passed });
  }
}
const report = { source: { checksum, bytes: bytes.length, physicalPages: pages.length, continuationFixtureLiteral: true, boundary: 'Public Pearson reference; not a private uploaded copy.' }, revision: baseline || 'working checkout', discoveredAssessments: discovery.candidates.map(c => ({ label:c.label, code:c.componentCode })), cases, passed: cases.filter(c => c.passed).length, total: cases.length };
await writeFile(path.join(artifacts,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if (!baseline && report.passed !== report.total) process.exitCode = 1;
