const fs = require('node:fs');
const path = require('node:path');
const { root, artifacts, fontSource, fontDir, repoRequire, sha256, writeJSON } = require('./runtime.cjs');

(async () => {
  // Read-only reuse: every actual cached file and this manifest are pinned.
  const fontManifestPath = path.join(root, 'docs/physics-practice-parity/browser/fonts-manifest.json');
  const fontManifest = JSON.parse(fs.readFileSync(fontManifestPath, 'utf8'));
  fs.mkdirSync(fontDir, { recursive: true });
  for (const item of fontManifest.files) {
    const source = path.join(fontSource, item.file);
    if (!fs.existsSync(source) || sha256(source) !== item.sha256) throw Error(`Cached font failed verification: ${item.file}`);
    fs.copyFileSync(source, path.join(fontDir, item.file));
  }
  const fixtureFiles = fs.readdirSync(__dirname).filter(file => fs.statSync(path.join(__dirname, file)).isFile()).map(file => path.join(__dirname, file));
  const configFiles = ['package.json', 'package-lock.json', 'tailwind.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'vite.config.ts', 'vitest.config.ts', 'postcss.config.js'].map(file => path.join(root, file)).filter(fs.existsSync);
  const fontFiles = fontManifest.files.flatMap(item => [path.join(fontSource, item.file), path.join(fontDir, item.file)]);
  // Snapshot before compilation, including all Tailwind candidates; verify again at completion.
  const candidates = [...fs.globSync(path.join(root, 'src/**/*.{ts,tsx}')), ...fixtureFiles, ...configFiles, ...fontFiles, fontManifestPath, path.join(root, 'src/index.css')];
  const before = Object.fromEntries([...new Set(candidates)].map(file => [file, sha256(file)]));
  const compiled = await repoRequire('esbuild').build({
    absWorkingDir: root, metafile: true, preserveSymlinks: true,
    entryPoints: [path.join(__dirname, 'view.tsx')], bundle: true, outfile: path.join(artifacts, 'bundle.js'),
    platform: 'browser', format: 'esm', jsx: 'automatic', loader: { '.css': 'empty' },
    tsconfig: path.join(root, 'tsconfig.app.json'), nodePaths: [path.join(root, 'node_modules')],
    plugins: [{ name: 'strict-offline-boundaries', setup(build) {
      build.onResolve({ filter: /integrations\/supabase\/client/ }, () => ({ path: path.join(__dirname, 'offline-client.ts') }));
      build.onResolve({ filter: /(?:^|\/)useUserPreferences$/ }, () => ({ path: 'preferences', namespace: 'synthetic-preferences' }));
      build.onLoad({ filter: /.*/, namespace: 'synthetic-preferences' }, () => ({ loader: 'js', contents: 'export const useUserPreferences=()=>({preferences:{preferred_educational_level:"level2",curriculum_region:"GB"},loading:false,error:null});' }));
    } }],
  });
  const config = repoRequire('tailwindcss/loadConfig')(path.join(root, 'tailwind.config.ts'));
  const patterns = config.content.map(pattern => path.resolve(root, pattern));
  const scanned = [...fs.globSync(patterns)].filter(file => fs.statSync(file).isFile());
  config.content = [...patterns, path.join(__dirname, '*.{ts,tsx}')];
  const inputCSS = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8').replace(/^@import url\('https:\/\/fonts.googleapis.com.*$/gm, '');
  const styled = await repoRequire('postcss')([repoRequire('postcss-import')(), repoRequire('tailwindcss')(config), repoRequire('autoprefixer')()]).process(inputCSS, { from: path.join(root, 'src/index.css') });
  const fontsCSS = ['manrope.css', 'source-serif-4.css'].map(file => fs.readFileSync(path.join(fontDir, file), 'utf8')).join('\n');
  fs.writeFileSync(path.join(artifacts, 'styles.css'), fontsCSS + '\n' + styled.css);
  const bundled = Object.keys(compiled.metafile.inputs).map(file => path.resolve(root, file)).filter(fs.existsSync);
  const dependencies = styled.messages.filter(message => message.type === 'dependency' && message.file).map(message => path.resolve(message.file));
  const buildRuntime = Object.keys(require.cache).filter(file => fs.existsSync(file) && fs.statSync(file).isFile());
  const browserRuntime = [...fs.globSync('/opt/codex/runtimes/cua/lib/node_modules/playwright-core/**/*.{js,json}')];
  const executables = ['/usr/bin/chromium', '/usr/lib/chromium/chromium', path.join(root, 'node_modules/@esbuild/linux-x64/bin/esbuild')].filter(fs.existsSync);
  const inputs = [...new Set([...candidates, ...scanned, ...bundled, ...dependencies, ...buildRuntime, ...browserRuntime, ...executables])].sort();
  const inputHashes = Object.fromEntries(inputs.map(file => [file, sha256(file)]));
  const drift = Object.keys(before).filter(file => before[file] !== inputHashes[file]);
  if (drift.length) throw Error('Concurrent changes during build; rebuild after freeze: ' + drift.join(', '));
  writeJSON('build-manifest.json', {
    schemaVersion: 1, builtAt: new Date().toISOString(), node: process.version,
    inputs: inputHashes, bundledInputs: bundled, tailwindScannedInputs: scanned,
    outputs: Object.fromEntries(['bundle.js', 'styles.css', ...fontManifest.files.map(item => 'fonts/' + item.file)].map(file => [file, sha256(path.join(artifacts, file))])),
    boundary: 'Actual production modal and custom save code, synthetic owned memory persistence; no live client or provider. Hashes include actual bundle inputs, Tailwind inputs, configs, installed dependencies, cached fonts, reused manifest and all harness files.',
  });
  fs.rmSync(path.join(artifacts, 'parent-source-freeze.json'), { force: true });
  console.log(JSON.stringify({ status: 'BUILT_NOT_ACCEPTED', inputCount: inputs.length, artifacts }));
})().catch(error => { console.error(error); process.exitCode = 1; });
