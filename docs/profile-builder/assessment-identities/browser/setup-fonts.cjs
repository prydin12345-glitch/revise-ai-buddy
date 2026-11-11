// Reuse the repository's pinned, licensed Google Fonts setup; no font binaries are copied here.
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { root, artifacts, fontDir, sharedFontDir } = require('./runtime.cjs');

function run(verify, directory = fontDir) {
  const output = execFileSync(process.execPath, [path.join(sharedFontDir, 'setup-fonts.cjs'), ...(verify ? ['--verify'] : [])], {
    env: { ...process.env, PHYSICS_REPO_ROOT: root, PHYSICS_ARTIFACT_DIR: artifacts, PHYSICS_FONT_DIR: directory },
    encoding: 'utf8',
  });
  return JSON.parse(output);
}
const verifyFonts = directory => run(true, directory);
const setupFonts = directory => run(false, directory);
module.exports = { verifyFonts, setupFonts };
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--verify')) throw Error('Usage: node setup-fonts.cjs [--verify]');
    console.log(JSON.stringify(args.includes('--verify') ? verifyFonts() : setupFonts(), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
