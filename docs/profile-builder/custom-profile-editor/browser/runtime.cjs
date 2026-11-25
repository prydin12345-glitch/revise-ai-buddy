const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../../..');
const artifacts = path.resolve(process.env.CUSTOM_PROFILE_ARTIFACT_DIR || '/tmp/profile-builder-custom-profile-editor');
if (artifacts !== '/tmp/profile-builder-custom-profile-editor' && !artifacts.startsWith('/tmp/profile-builder-custom-profile-editor/')) throw Error('Use the new custom editor artifact directory or one of its children.');
const fontSource = '/tmp/profile-builder-style-cleanup/fonts';
const fontDir = path.join(artifacts, 'fonts');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const writeJSON = (name, value) => fs.writeFileSync(path.join(artifacts, name), JSON.stringify(value, null, 2) + '\n');
const repoRequire = createRequire(path.join(root, 'package.json'));
fs.mkdirSync(artifacts, { recursive: true });
function verifyInputs() {
  const manifest = JSON.parse(fs.readFileSync(path.join(artifacts, 'build-manifest.json'), 'utf8'));
  const differences = Object.keys(manifest.inputs).filter(file => !fs.existsSync(file) || sha256(file) !== manifest.inputs[file]);
  const outputDifferences = Object.keys(manifest.outputs).filter(file => !fs.existsSync(path.join(artifacts, file)) || sha256(path.join(artifacts, file)) !== manifest.outputs[file]);
  const report = { status: differences.length || outputDifferences.length ? 'FAIL' : 'PASS', inputs: Object.keys(manifest.inputs).length, differences, outputDifferences };
  writeJSON('hash-verification.json', report);
  if (report.status !== 'PASS') throw Error('Build input/output hashes drifted: ' + JSON.stringify(report));
  return report;
}
module.exports = { root, artifacts, fontSource, fontDir, repoRequire, sha256, writeJSON, verifyInputs };
