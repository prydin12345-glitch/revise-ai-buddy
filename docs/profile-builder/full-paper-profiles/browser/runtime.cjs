const path = require('node:path');
process.env.PROFILE_BUILDER_BROWSER_ARTIFACT_DIR ||= '/tmp/profile-builder-full-paper-profiles';
module.exports = {...require('../../assessment-identities/browser/runtime.cjs'), dir: __dirname};
