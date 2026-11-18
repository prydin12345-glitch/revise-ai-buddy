import { build } from 'esbuild';
import { readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Run from the checkout root. Bundle every real entry point without executing
// handlers; intersect transitive inputs with this task's backend changes.
const baseline = '23d9350e17f9ec48873857ca26265b9c6aadb101';
const changed = [...new Set([
  ...execFileSync('git', ['diff', '--name-only', baseline], { encoding: 'utf8' }).trim().split('\n'),
  ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n'),
])].filter(file => file.startsWith('supabase/functions/') && file.endsWith('.ts')).sort();
const entryPoints = readdirSync('supabase/functions', { withFileTypes: true })
  .filter(dir => dir.isDirectory() && dir.name !== '_shared')
  .map(dir => `supabase/functions/${dir.name}/index.ts`).sort();
const affected = [];
for (const entryPoint of entryPoints) {
  const result = await build({ entryPoints: [entryPoint], bundle: true, write: false,
    metafile: true, format: 'esm', platform: 'neutral',
    external: ['https://*', 'http://*', 'npm:*'], logLevel: 'error' });
  const inputs = new Set(Object.keys(result.metafile.inputs));
  const changedInputs = changed.filter(file => inputs.has(file));
  if (changedInputs.length) affected.push({ function: entryPoint.split('/')[2], entryPoint, changedInputs });
}
const result = { baseline, method: 'esbuild transitive input graph for all real Edge entry points; handlers are not executed',
  entryPointsChecked: entryPoints.length, changedServerModules: changed, affected };
writeFileSync('docs/profile-builder/business-selection/edge-function-dependencies.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ entryPointsChecked: entryPoints.length, affectedFunctions: affected.map(item => item.function) }));
