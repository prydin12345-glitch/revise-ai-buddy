const path = require('node:path');
process.env.PROFILE_BUILDER_BROWSER_ARTIFACT_DIR ||= '/tmp/profile-builder-ai-profile-editor';
module.exports = { ...require('../../detailed-topics/browser/runtime.cjs'), dir: __dirname };
