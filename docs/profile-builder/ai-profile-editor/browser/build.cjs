require('./runtime.cjs');
process.env.PROFILE_BUILDER_FIXTURE_DIR = __dirname;
// detailed-topics/build resets the fixture directory, so use its underlying
// shared builder with this entry point while reusing detailed-topic runtime/fonts.
require('../../assessment-identities/browser/build.cjs');
// The shared manifest pins its own helpers; also pin the detailed runtime we reuse.
process.once('beforeExit', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { root, artifacts, sha256 } = require('./runtime.cjs');
  const file = path.join(artifacts, 'build-manifest.json');
  if (!fs.existsSync(file) || process.exitCode) return;
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const input = 'docs/profile-builder/detailed-topics/browser/runtime.cjs';
  manifest.fixtureInputs[input] = sha256(path.join(root, input));
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
});
