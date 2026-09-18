import { build } from 'esbuild';
import { readdir } from 'node:fs/promises';
import ts from 'typescript';
import { assertEdgeIdentifiers } from './check-edge-identifiers.mjs';
assertEdgeIdentifiers(ts.sys.readDirectory('supabase/functions', ['.ts'], undefined, ['**/*']));
console.log('Edge Function identifier check passed (including shared modules).');
const directories=(await readdir('supabase/functions',{withFileTypes:true})).filter(d=>d.isDirectory() && d.name!=='_shared');
for(const dir of directories) {
  await build({entryPoints:[`supabase/functions/${dir.name}/index.ts`],bundle:true,write:false,
    format:'esm',platform:'neutral',external:['https://*','http://*'],logLevel:'error'});
}
console.log(`Bundled ${directories.length} Edge Functions successfully (remote runtime imports remain external).`);
