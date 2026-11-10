// This preparatory command downloads only pinned, licensed Google Fonts assets.
// The build and browser verification call verifyFonts() and never fetch fonts.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {fontDir} = require('./runtime.cjs');

const manifestPath = path.join(__dirname, 'fonts-manifest.json');
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function matches(file, entry) {
  return fs.existsSync(file) && fs.statSync(file).isFile()
    && fs.statSync(file).size === entry.bytes
    && hash(fs.readFileSync(file)) === entry.sha256;
}

function verifyFonts(directory = fontDir) {
  const invalid = manifest.files.filter(entry => !matches(path.join(directory, entry.file), entry));
  if (invalid.length) {
    throw new Error('Pinned font files missing or changed: ' + invalid.map(entry => entry.file).join(', ')
      + '. Run node docs/physics-practice-parity/browser/setup-fonts.cjs, or set PHYSICS_FONT_DIR to a directory prepared with that command.');
  }
  return {directory, manifestSha256: hash(manifestBytes), commit: manifest.commit,
    files: Object.fromEntries(manifest.files.map(entry => [entry.file, entry.sha256]))};
}

function setupFonts(directory = fontDir) {
  fs.mkdirSync(directory, {recursive: true});
  for (const entry of manifest.files) {
    const destination = path.join(directory, entry.file);
    if (matches(destination, entry)) continue;
    const temporary = destination + '.tmp-' + process.pid;
    try {
      if (entry.contents !== undefined) {
        fs.writeFileSync(temporary, entry.contents);
      } else {
        const source = 'https://raw.githubusercontent.com/google/fonts/' + manifest.commit + '/' + entry.source;
        // execFile preserves inherited proxy/CA settings and treats URLs as data.
        execFileSync('curl', ['--globoff', '--fail', '--show-error', '--silent', '--location',
          '--proto', '=https', '--max-time', '60', source, '--output', temporary], {stdio: 'inherit'});
      }
      if (!matches(temporary, entry)) throw new Error('Pinned font hash/size mismatch: ' + entry.file);
      fs.renameSync(temporary, destination);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  return verifyFonts(directory);
}

module.exports = {verifyFonts, setupFonts};

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--verify')) throw new Error('Usage: node setup-fonts.cjs [--verify]');
    const report = args.includes('--verify') ? verifyFonts() : setupFonts();
    console.log(JSON.stringify({status: 'PASS', ...report}, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
