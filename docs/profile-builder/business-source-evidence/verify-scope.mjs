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
if (!file) throw Error('Usage: node docs/profile-builder/business-source-evidence/verify-scope.mjs /tmp/reference.pdf [baseline-ref]');
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
const scope = { qualification: 'A-level', subject: 'Business', organisation: 'Pearson Edexcel', course: '9BS0' };
const discovery = await discoverSourceAssessments([{ id: 'reference', checksum, pages }], scope);
const papers = discovery.candidates.filter(candidate => candidate.label.includes(' — ')).map(candidate => {
  const number = Number(candidate.componentCode?.slice(-1) || candidate.label.match(/Paper (\d)/)?.[1]);
  const overview = number === 3 ? 15 : 14, summary = number === 3 ? 46 : 45;
  const selection = { ...scope, component: candidate.canonicalComponent, componentAliases: candidate.aliases };
  const expectedThemes = number === 1 ? [1, 4] : number === 2 ? [2, 3] : [1, 2, 3, 4];
  const inspect = index => {
    const snippets = index.chunks.flatMap(chunk => chunk.pages), text = snippets.map(page => page.text).join('\n');
    const themeHeadings = [...new Set([...text.matchAll(/\bTheme\s+(\d{1,2})\s*:/gi)].map(match => Number(match[1])))].sort((a, b) => a - b);
    return { coverage: index.coverage, selectedPages: index.selectedPages, characters: text.length,
      expectedThemes, themeHeadings,
      allocatedThemeHeadingsOnly: themeHeadings.length === expectedThemes.length && themeHeadings.every(value => expectedThemes.includes(value)),
      siblingNamesExcluded: [1, 2, 3].filter(n => n !== number).every(n => !new RegExp('\\bPaper\\s*' + n + '\\b', 'i').test(text)),
      qualificationTopicBodiesExcluded: !snippets.filter(page => [11, 13].includes(page.page)).some(page => /\bThemes?\s+\d|raising finance|business objectives and strategy/i.test(page.text)),
      retainsOverview: snippets.some(page => page.page === overview), retainsSummary: snippets.some(page => page.page === summary),
      retainsDuration120: /Duration:\s*2 hours/.test(text), retainsMarks100: /100 marks/.test(text),
      excludesSiblingCodes: [1, 2, 3].filter(n => n !== number).every(n => !text.includes(`9BS0/0${n}`)),
      literalSnippets: snippets.every(page => pages[page.page - 1].includes(page.text)) };
  };
  return { label: candidate.label, code: candidate.componentCode,
    automatic: inspect(indexDocumentPages(pages, selection)),
    focusedSummary: inspect(indexDocumentPages(pages, { ...selection, sourcePages: [summary] })) };
});
const report = { source: { url: 'https://qualifications.pearson.com/content/dam/pdf/A%20Level/Business%20Studies/2015/specification-and-sample-assessment-materials/9781446914694-gce2015-a-bus-web.pdf', checksum, bytes: bytes.length, physicalPages: pages.length },
  revision: baseline || 'working checkout', candidateCount: discovery.candidates.length, ambiguous: discovery.ambiguous,
  candidates: discovery.candidates.map(candidate => ({ label: candidate.label, code: candidate.componentCode })), papers };
await writeFile(path.join(artifacts, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, artifactReport: path.join(artifacts, 'report.json') }, null, 2));
