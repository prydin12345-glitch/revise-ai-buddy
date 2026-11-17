require('./runtime.cjs');
process.env.PROFILE_BUILDER_FIXTURE_DIR = __dirname;
process.env.PROFILE_BUILDER_STALE_WARNING_FIXTURE = '1';
require('../../assessment-identities/browser/build.cjs');
