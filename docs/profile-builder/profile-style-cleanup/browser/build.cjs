require('./runtime.cjs');
process.env.PROFILE_BUILDER_FIXTURE_DIR = __dirname;
require('../../assessment-identities/browser/build.cjs');

// Shared builds exclude docs from application hashes. Pin every bundled docs
// input explicitly, including the old view imported by our new entry point.
process.once('beforeExit', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { root, artifacts, sha256 } = require('./runtime.cjs');
  const file = path.join(artifacts, 'build-manifest.json');
  if (!fs.existsSync(file) || process.exitCode) return;
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const reused = [
    'docs/profile-builder/detailed-topics/browser/runtime.cjs',
    ...manifest.bundledInputs.filter(input => input.startsWith('docs/')),
  ];
  for (const input of new Set(reused)) manifest.fixtureInputs[input] = sha256(path.join(root, input));
  const importedView = 'docs/profile-builder/ai-profile-editor/browser/view.tsx';
  if (!manifest.bundledInputs.includes(importedView) || !manifest.fixtureInputs[importedView])
    throw Error('Reused fixture view must be bundled and explicitly hash pinned.');
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
});
