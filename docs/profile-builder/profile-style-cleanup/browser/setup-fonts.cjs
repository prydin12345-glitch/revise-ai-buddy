// Offline only: verify a prepared cache, then copy its pinned fonts and licenses.
const fs = require('node:fs');
const path = require('node:path');
const { fontDir, sharedFontDir } = require('./runtime.cjs');
const { verifyFonts } = require('../../assessment-identities/browser/setup-fonts.cjs');

function setupFonts() {
  const manifest = JSON.parse(fs.readFileSync(path.join(sharedFontDir, 'fonts-manifest.json'), 'utf8'));
  if (manifest.files.every(({ file }) => fs.existsSync(path.join(fontDir, file)))) return verifyFonts(fontDir);
  const source = path.resolve(process.env.PROFILE_BUILDER_CACHED_FONT_DIR || '/tmp/profile-builder-full-paper-profiles/fonts');
  verifyFonts(source);
  fs.mkdirSync(fontDir, { recursive: true });
  for (const { file } of manifest.files) fs.copyFileSync(path.join(source, file), path.join(fontDir, file));
  return verifyFonts(fontDir);
}

module.exports = { setupFonts, verifyFonts };
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--verify')) throw Error('Usage: node setup-fonts.cjs [--verify]');
    console.log(JSON.stringify({ status: 'PASS', ...(args.includes('--verify') ? verifyFonts(fontDir) : setupFonts()) }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
