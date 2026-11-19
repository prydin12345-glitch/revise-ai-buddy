const path = require('node:path');
process.env.PROFILE_BUILDER_BROWSER_ARTIFACT_DIR ||= '/tmp/profile-builder-business-page-recovery';
module.exports = {...require('../../assessment-identities/browser/runtime.cjs'), dir: __dirname};
