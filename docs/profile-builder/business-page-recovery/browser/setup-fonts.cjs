require('./runtime.cjs');
const fonts = require('../../assessment-identities/browser/setup-fonts.cjs');
module.exports = fonts;
if (require.main === module) console.log(JSON.stringify(process.argv.includes('--verify') ? fonts.verifyFonts() : fonts.setupFonts()));
