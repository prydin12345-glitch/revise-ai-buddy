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
const root = process.env.PHYSICS_REPO_ROOT
  ? findRoot(process.env.PHYSICS_REPO_ROOT)
  : findRoot(__dirname) || findRoot(process.cwd());
if (!root) throw Error('Cannot locate repository: set PHYSICS_REPO_ROOT to a checkout containing package.json and src/index.css.');
const dir = __dirname;
const artifacts = path.resolve(process.env.PHYSICS_ARTIFACT_DIR || path.join(os.tmpdir(), 'physics-practice-parity-artifacts'));
if (artifacts === root || artifacts.startsWith(root + path.sep)) throw Error('PHYSICS_ARTIFACT_DIR must be outside the checkout; generated output must not overwrite historical evidence.');
const fontDir = path.resolve(process.env.PHYSICS_FONT_DIR || path.join(artifacts, 'fonts'));
fs.mkdirSync(artifacts, { recursive: true });
const repoRequire = createRequire(path.join(root, 'package.json'));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
module.exports = { root, dir, artifacts, fontDir, repoRequire, sha256 };
