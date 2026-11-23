const path = require('node:path');
process.env.PROFILE_BUILDER_BROWSER_ARTIFACT_DIR ||= '/tmp/profile-builder-style-cleanup';
module.exports = { ...require('../../detailed-topics/browser/runtime.cjs'), dir: __dirname };
