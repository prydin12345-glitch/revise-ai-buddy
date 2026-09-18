import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Run from any directory. The audit has no network, AI or database operations.
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('node scripts/audit-biology.mjs [--json] [--input path/to/private-draft-audit.json]');
  console.log('No input: check every registered paper/tier/mode template. Input: audit one draft envelope or an array of envelopes. No paid generation.');
  process.exit(0);
}
try {
  let inputPath;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') continue;
    if (args[i] === '--input' && args[i + 1] && !args[i + 1].startsWith('--') && !inputPath) inputPath = args[++i];
    else throw new Error('Unknown or incomplete argument. Use --help.');
  }
  const bundle = await build({ entryPoints: [resolve(root, 'supabase/functions/_shared/biology-paper-audit.ts')],
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
  const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const input = inputPath ? JSON.parse(await readFile(resolve(inputPath), 'utf8')) : null;
  const reports = inputPath ? (Array.isArray(input) ? input : [input]).map(api.auditBiologyDraft) : api.auditBiologyTemplates();
  if (!reports.length) throw new Error('The audit batch is empty.');
  if (args.includes('--json')) console.log(JSON.stringify(reports, null, 2));
  else {
    console.table(reports.map(({ courseId, paperId, tier, mode, status, marks, expectedMarks, parts, expectedParts }) =>
      ({ courseId, paperId, tier, mode, status, marks: marks ?? expectedMarks, parts: parts ?? expectedParts })));
    for (const report of reports) for (const defect of report.defects ?? []) console.log(`${report.packId} ${report.tier}: ${defect.partId} ${defect.code}: ${defect.detail}`);
    console.log(inputPath ? 'Automated checks only. Scientific and rendered-paper review is still required.' : 'Templates checked; no real paper generated and no external rating assigned.');
  }
  if (reports.some(r => r.status === 'blocked')) process.exitCode = 1;
} catch (error) {
  console.error('Biology audit failed: ' + error.message);
  process.exitCode = 1;
}
