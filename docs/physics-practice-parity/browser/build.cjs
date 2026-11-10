const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { root, dir, artifacts, fontDir, repoRequire, sha256 } = require('./runtime.cjs');

(async () => {
  // A supplied cache is accepted only after the same pinned manifest checks.
  const preparedFonts = require('./setup-fonts.cjs').verifyFonts();
  const esbuild = repoRequire('esbuild');
  const compiled = await esbuild.build({
    absWorkingDir: root, metafile: true, preserveSymlinks: true,
    entryPoints: [path.join(dir, 'view.tsx')], bundle: true,
    outfile: path.join(artifacts, 'bundle.js'), platform: 'browser', format: 'esm',
    jsx: 'automatic', loader: { '.css': 'empty' }, nodePaths: [path.join(root, 'node_modules')],
    tsconfig: path.join(root, 'tsconfig.app.json'),
    plugins: [{ name: 'synthetic-client-only', setup(build) {
      build.onResolve({ filter: /^html2canvas$/ }, () => ({ path: 'html2canvas-observer', namespace: 'observer' }));
      build.onLoad({ filter: /.*/, namespace: 'observer' }, () => ({
        loader: 'js', resolveDir: root,
        contents: `import real from ${JSON.stringify(path.join(root, 'node_modules/html2canvas/dist/html2canvas.esm.js'))}; export default async(el,options)=>{window.__pdfCaptures??=[];window.__pdfCaptures.push({text:el.innerText,html:el.innerHTML});return real(el,options);};`,
      }));
      build.onLoad({ filter: /useUserPreferences\.ts$/ }, () => ({ loader: 'ts', contents: 'export const useUserPreferences=()=>({preferences:{preferred_educational_level:"level2",preferred_exam_board:"AQA",curriculum_region:"GB"}});' }));
      build.onResolve({ filter: /integrations\/supabase\/client/ }, () => ({ path: 'client', namespace: 'synthetic' }));
      build.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ loader: 'js', contents: `export const supabase={functions:{invoke:async(name,{body})=>({data:await window.__api(body),error:null})},auth:{getSession:async()=>({data:{session:{user:{id:window.__owner||'browser-owner'}}}}),getUser:async()=>({data:{user:{id:window.__owner||'browser-owner'}}})},from:()=>{throw Error('Live database access is blocked in this verification fixture')}};` }));
    } }],
  });
  const postcss = repoRequire('postcss');
  const config = repoRequire('tailwindcss/loadConfig')(path.join(root, 'tailwind.config.ts'));
  const scannedPatterns = config.content.map(pattern => path.resolve(root, pattern));
  config.content = [...scannedPatterns, path.join(dir, 'view.tsx')];
  const cssInput = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8').replace(/^@import url\('https:\/\/fonts.googleapis.com.*$/gm, '');
  const result = await postcss([repoRequire('postcss-import')(), repoRequire('tailwindcss')(config), repoRequire('autoprefixer')()]).process(cssInput, { from: path.join(root, 'src/index.css') });
  const fonts = ['manrope.css', 'source-serif-4.css'].map(name => fs.readFileSync(path.join(fontDir, name), 'utf8')).join('\n');
  const katexCss = fs.readFileSync(repoRequire.resolve('katex/dist/katex.min.css'), 'utf8').replace(/url\(fonts\//g, 'url(/katex-fonts/');
  fs.writeFileSync(path.join(artifacts, 'styles.css'), fonts + '\n' + katexCss + '\n' + result.css);

  const relative = file => path.relative(root, file).split(path.sep).join('/');
  const bundled = Object.keys(compiled.metafile.inputs).map(file => path.isAbsolute(file) ? file : path.resolve(root, file)).filter(file => fs.existsSync(file) && fs.statSync(file).isFile()).map(relative).sort();
  const scanned = [...fs.globSync(scannedPatterns)].filter(file => fs.statSync(file).isFile()).map(relative).sort();
  const cssDependencies = result.messages.filter(message => message.type === 'dependency' && message.file && fs.existsSync(message.file)).map(message => relative(message.file));
  const configFiles = fs.readdirSync(root).filter(file => /^(?:tsconfig(?:\.[\w-]+)?\.json|(?:vite|vitest|postcss)\.config\.[\w]+)$/.test(file));
  const serverInputs = [...fs.globSync(path.join(root, 'supabase/functions/**/*.{ts,json,jsonc}'))].filter(file => fs.statSync(file).isFile()).map(relative).sort();
  if (fs.existsSync(path.join(root, 'supabase/config.toml'))) serverInputs.push('supabase/config.toml');
  const application = [...new Set([...bundled.filter(file => !file.startsWith('node_modules/') && !file.startsWith('docs/')), ...scanned, ...cssDependencies.filter(file => !file.startsWith('node_modules/') && !file.startsWith('docs/')), 'src/index.css', 'tailwind.config.ts', ...configFiles, 'package.json', 'package-lock.json'])].sort();
  if (application.some(file => file.startsWith('../'))) throw Error('Application inputs escaped the checkout.');
  const katexFontInputs = fs.readdirSync(path.join(root, 'node_modules/katex/dist/fonts')).map(file => 'node_modules/katex/dist/fonts/' + file);
  const dependencyInputs = [...new Set([...bundled.filter(file => file.startsWith('node_modules/')), 'node_modules/katex/dist/katex.min.css', ...katexFontInputs])].sort();
  const hashes = files => Object.fromEntries(files.map(file => [file, sha256(path.join(root, file))]));
  const fixtureFiles = ['runtime.cjs', 'build.cjs', 'browser.cjs', 'view.tsx', 'verify-hashes.py', 'verify-pdfs.py', 'setup-fonts.cjs', 'fonts-manifest.json'];
  const packages = ['esbuild', 'postcss', 'postcss-import', 'tailwindcss', 'autoprefixer', 'react', 'react-dom', 'html2canvas', 'jspdf', 'katex'];
  const versions = Object.fromEntries(packages.map(name => [name, JSON.parse(fs.readFileSync(repoRequire.resolve(name + '/package.json'), 'utf8')).version]));
  const write = (name, data) => fs.writeFileSync(path.join(artifacts, name), JSON.stringify(data, null, 2) + '\n');
  write('app-source-hashes.json', hashes(application));
  write('server-source-hashes.json', hashes(serverInputs));
  write('dependency-input-hashes.json', hashes(dependencyInputs));
  write('build-manifest.json', {
    schemaVersion: 2, bundledInputs: bundled, tailwindScannedInputs: scanned, serverInputs,
    applicationFileCount: application.length, serverFileCount: serverInputs.length, dependencyInputCount: dependencyInputs.length,
    fixtureInputs: Object.fromEntries(fixtureFiles.map(file => [file, sha256(path.join(dir, file))])),
    bundleSha256: sha256(path.join(artifacts, 'bundle.js')), stylesheetSha256: sha256(path.join(artifacts, 'styles.css')),
    appSourceHashesSha256: sha256(path.join(artifacts, 'app-source-hashes.json')),
    serverSourceHashesSha256: sha256(path.join(artifacts, 'server-source-hashes.json')),
    dependencyInputHashesSha256: sha256(path.join(artifacts, 'dependency-input-hashes.json')),
    fontManifestSha256: sha256(path.join(dir, 'fonts-manifest.json')),
    externalFontInputs: preparedFonts.files,
    runtime: { node: process.version, platform: process.platform, architecture: process.arch, osRelease: os.release(), packages: versions },
    hashPolicy: 'Application, server, config, lockfile and fixture drift fails verification. Server sources are pinned separately and are not executed by the browser composition. Installed dependencies are reported separately: current-run changes fail; differences from a historical dependency fingerprint are classified and never establish application parity.',
  });
  console.log(JSON.stringify({ status: 'PASS', action: 'build', applicationFiles: application.length, serverFiles: serverInputs.length, dependencyInputs: dependencyInputs.length, artifactDirectory: artifacts }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
