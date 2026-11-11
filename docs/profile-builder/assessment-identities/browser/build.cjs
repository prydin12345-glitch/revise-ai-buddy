const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { root, dir, artifacts, fontDir, sharedFontDir, repoRequire, sha256 } = require('./runtime.cjs');

(async () => {
  const preparedFonts = require('./setup-fonts.cjs').verifyFonts();
  const compiled = await repoRequire('esbuild').build({
    absWorkingDir: root, metafile: true, preserveSymlinks: true,
    entryPoints: [path.join(dir, 'view.tsx')], bundle: true,
    outfile: path.join(artifacts, 'bundle.js'), platform: 'browser', format: 'esm', jsx: 'automatic',
    loader: { '.css': 'empty' }, nodePaths: [path.join(root, 'node_modules')],
    tsconfig: path.join(root, 'tsconfig.app.json'),
    plugins: [{ name: 'offline-supabase-guard', setup(build) {
      build.onResolve({ filter: /integrations\/supabase\/client/ }, () => ({ path: 'client', namespace: 'synthetic' }));
      build.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ loader: 'js', contents: `const blocked=()=>{throw Error('Live Supabase access is blocked in this offline verification fixture')};export const supabase={functions:{invoke:blocked},auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-browser-owner'}}}}),getUser:async()=>({data:{user:{id:'synthetic-browser-owner'}}})},from:blocked};` }));
    } }],
  });
  const config = repoRequire('tailwindcss/loadConfig')(path.join(root, 'tailwind.config.ts'));
  const scannedPatterns = config.content.map(pattern => path.resolve(root, pattern));
  config.content = [...scannedPatterns, path.join(dir, 'view.tsx')];
  const cssInput = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8').replace(/^@import url\('https:\/\/fonts.googleapis.com.*$/gm, '');
  const result = await repoRequire('postcss')([repoRequire('postcss-import')(), repoRequire('tailwindcss')(config), repoRequire('autoprefixer')()]).process(cssInput, { from: path.join(root, 'src/index.css') });
  const fonts = ['manrope.css', 'source-serif-4.css'].map(name => fs.readFileSync(path.join(fontDir, name), 'utf8')).join('\n');
  fs.writeFileSync(path.join(artifacts, 'styles.css'), fonts + '\n' + result.css);

  const relative = file => path.relative(root, file).split(path.sep).join('/');
  const bundled = Object.keys(compiled.metafile.inputs).map(file => path.isAbsolute(file) ? file : path.resolve(root, file)).filter(file => fs.existsSync(file) && fs.statSync(file).isFile()).map(relative).sort();
  const scanned = [...fs.globSync(scannedPatterns)].filter(file => fs.statSync(file).isFile()).map(relative).sort();
  const cssDependencies = result.messages.filter(message => message.type === 'dependency' && message.file && fs.existsSync(message.file)).map(message => relative(message.file));
  const configFiles = fs.readdirSync(root).filter(file => /^(?:tsconfig(?:\.[\w-]+)?\.json|(?:vite|vitest|postcss)\.config\.[\w]+)$/.test(file));
  const serverInputs = [...fs.globSync(path.join(root, 'supabase/functions/**/*.{ts,json,jsonc}'))].filter(file => fs.statSync(file).isFile()).map(relative).sort();
  if (fs.existsSync(path.join(root, 'supabase/config.toml'))) serverInputs.push('supabase/config.toml');
  const application = [...new Set([...bundled.filter(file => !file.startsWith('node_modules/') && !file.startsWith('docs/')), ...scanned, ...cssDependencies.filter(file => !file.startsWith('node_modules/') && !file.startsWith('docs/')), 'src/index.css', 'tailwind.config.ts', ...configFiles, 'package.json', 'package-lock.json'])].sort();
  if (application.some(file => file.startsWith('../'))) throw Error('Application inputs escaped the selected checkout. Run the tracked harness inside that checkout.');
  const dependencyInputs = [...new Set([...bundled.filter(file => file.startsWith('node_modules/')), ...cssDependencies.filter(file => file.startsWith('node_modules/'))])].sort();
  const hashes = files => Object.fromEntries(files.map(file => [file, sha256(path.join(root, file))]));
  const localFixtureFiles = ['runtime.cjs', 'build.cjs', 'browser.cjs', 'view.tsx', 'verify-hashes.py', 'setup-fonts.cjs'];
  const sharedFixtureFiles = ['runtime.cjs', 'setup-fonts.cjs', 'fonts-manifest.json'];
  const fixtureInputs = [...localFixtureFiles.map(file => relative(path.join(dir, file))), ...sharedFixtureFiles.map(file => relative(path.join(sharedFontDir, file)))];
  const packages = ['esbuild', 'postcss', 'postcss-import', 'tailwindcss', 'autoprefixer', 'react', 'react-dom', 'react-router-dom', 'unpdf', 'zod'];
  const versions = Object.fromEntries(packages.map(name => [name, JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version]));
  const write = (name, data) => fs.writeFileSync(path.join(artifacts, name), JSON.stringify(data, null, 2) + '\n');
  write('app-source-hashes.json', hashes(application));
  write('server-source-hashes.json', hashes(serverInputs));
  write('dependency-input-hashes.json', hashes(dependencyInputs));
  write('build-manifest.json', {
    schemaVersion: 1, bundledInputs: bundled, tailwindScannedInputs: scanned, serverInputs,
    applicationFileCount: application.length, serverFileCount: serverInputs.length, dependencyInputCount: dependencyInputs.length,
    fixtureInputs: hashes(fixtureInputs),
    bundleSha256: sha256(path.join(artifacts, 'bundle.js')), stylesheetSha256: sha256(path.join(artifacts, 'styles.css')),
    appSourceHashesSha256: sha256(path.join(artifacts, 'app-source-hashes.json')),
    serverSourceHashesSha256: sha256(path.join(artifacts, 'server-source-hashes.json')),
    dependencyInputHashesSha256: sha256(path.join(artifacts, 'dependency-input-hashes.json')),
    fontManifestSha256: sha256(path.join(sharedFontDir, 'fonts-manifest.json')), externalFontInputs: preparedFonts.files,
    runtime: { node: process.version, platform: process.platform, architecture: process.arch, osRelease: os.release(), packages: versions },
    hashPolicy: 'Application, server, config, lockfile, fixture and installed-dependency drift fails this frozen run. Server source pinning does not imply execution of backend endpoints by the browser fixture.',
  });
  console.log(JSON.stringify({ status: 'PASS', action: 'build', applicationFiles: application.length, serverFiles: serverInputs.length, dependencyInputs: dependencyInputs.length, artifactDirectory: artifacts }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
