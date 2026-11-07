const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('/workspace/revise-ai-buddy/node_modules/esbuild');
const root='/workspace/revise-ai-buddy',dir=__dirname;
(async()=>{
 const compiled=await esbuild.build({absWorkingDir:root,metafile:true,entryPoints:[dir+'/view.tsx'],bundle:true,outfile:dir+'/bundle.js',platform:'browser',format:'esm',jsx:'automatic',loader:{'.css':'empty'},nodePaths:[root+'/node_modules'],tsconfig:root+'/tsconfig.app.json',plugins:[{name:'synthetic-client-only',setup(b){
 b.onLoad({filter:/useUserPreferences\.ts$/},()=>({loader:'ts',contents:'export const useUserPreferences=()=>({preferences:{preferred_educational_level:"level2",preferred_exam_board:"AQA",curriculum_region:"GB"}});'}));
 b.onResolve({filter:/integrations\/supabase\/client/},()=>({path:'client',namespace:'synthetic'}));
 b.onLoad({filter:/.*/,namespace:'synthetic'},()=>({loader:'js',contents:`export const supabase={functions:{invoke:async(name,{body})=>({data:await window.__api(body),error:null})},auth:{getSession:async()=>({data:{session:{user:{id:window.__owner||'browser-owner'}}}}),getUser:async()=>({data:{user:{id:window.__owner||'browser-owner'}}})},from:()=>{throw Error('Live database access is blocked in this verification fixture')}};`}));
 }}]});
 const postcss=require(root+'/node_modules/postcss');
 const postcssImport=require(root+'/node_modules/postcss-import');
 const tailwind=require(root+'/node_modules/tailwindcss');
 const autoprefixer=require(root+'/node_modules/autoprefixer');
 const cssInput=fs.readFileSync(root+'/src/index.css','utf8').replace(/^@import url\('https:\/\/fonts.googleapis.com.*$/gm,'');
 const result=await postcss([postcssImport(),tailwind({config:root+'/tailwind.config.ts'}),autoprefixer()]).process(cssInput,{from:root+'/src/index.css'});
 const fonts=fs.readFileSync(dir+'/fonts/manrope.css','utf8')+'\n'+fs.readFileSync(dir+'/fonts/source-serif-4.css','utf8');
 fs.writeFileSync(dir+'/styles.css',fonts+'\n'+result.css);
 const crypto=require('node:crypto');
 const tracked=[...new Set([...Object.keys(compiled.metafile.inputs).map(p=>path.isAbsolute(p)?p:path.resolve(root,p)).filter(p=>p.startsWith(root+'/')&&!p.includes('/node_modules/')&&fs.existsSync(p)).map(p=>path.relative(root,p)), 'src/index.css','tailwind.config.ts',...result.messages.filter(m=>m.type==='dependency'&&m.file&&m.file.startsWith(root+'/')&&!m.file.includes('/node_modules/')).map(m=>path.relative(root,m.file))])].sort();
 fs.writeFileSync(dir+'/source-hashes.json',JSON.stringify(Object.fromEntries(tracked.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')])),null,2));
 console.log('Synthetic browser bundle and production Tailwind styles built.');
})().catch(e=>{console.error(e);process.exitCode=1;});
