import { build } from 'esbuild';
import { readdir } from 'node:fs/promises';
const directories=(await readdir('supabase/functions',{withFileTypes:true})).filter(d=>d.isDirectory() && d.name!=='_shared');
for(const dir of directories) {
  await build({entryPoints:[`supabase/functions/${dir.name}/index.ts`],bundle:true,write:false,
    format:'esm',platform:'neutral',external:['https://*','http://*'],logLevel:'error'});
}
console.log(`Bundled ${directories.length} Edge Functions successfully (remote runtime imports remain external).`);
