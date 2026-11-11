const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');

function findRoot(start) {
  let candidate = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(candidate, 'package.json')) && fs.existsSync(path.join(candidate, 'src/index.css'))) return candidate;
    const parent = path.dirname(candidate);
    if (parent === candidate) return undefined;
    candidate = parent;
  }
}
const root = process.env.PROFILE_BUILDER_REPO_ROOT
  ? findRoot(process.env.PROFILE_BUILDER_REPO_ROOT)
  : findRoot(__dirname) || findRoot(process.cwd());
if (!root) throw Error('Cannot locate checkout; set PROFILE_BUILDER_REPO_ROOT to a checkout containing package.json and src/index.css.');
const dir = __dirname;
const artifacts = path.resolve(process.env.PROFILE_BUILDER_BROWSER_ARTIFACT_DIR || path.join(os.tmpdir(), 'profile-builder-assessment-identities'));
if (artifacts === root || artifacts.startsWith(root + path.sep)) throw Error('PROFILE_BUILDER_BROWSER_ARTIFACT_DIR must be outside the checkout.');
const fontDir = path.resolve(process.env.PROFILE_BUILDER_FONT_DIR || path.join(artifacts, 'fonts'));
const sharedFontDir = path.join(root, 'docs/physics-practice-parity/browser');
fs.mkdirSync(artifacts, { recursive: true });
const repoRequire = createRequire(path.join(root, 'package.json'));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function verifyFrozenHashes() {
  const result = require('node:child_process').execFileSync(process.env.PYTHON_EXECUTABLE || 'python3', [path.join(dir, 'verify-hashes.py')], {
    env: { ...process.env, PROFILE_BUILDER_REPO_ROOT: root, PROFILE_BUILDER_BROWSER_ARTIFACT_DIR: artifacts, PROFILE_BUILDER_FONT_DIR: fontDir },
    encoding: 'utf8',
  });
  return JSON.parse(result);
}
module.exports = { root, dir, artifacts, fontDir, sharedFontDir, repoRequire, sha256, verifyFrozenHashes };
