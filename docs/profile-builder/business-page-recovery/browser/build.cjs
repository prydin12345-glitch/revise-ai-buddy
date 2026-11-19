require('./runtime.cjs');
process.env.PROFILE_BUILDER_FIXTURE_DIR = __dirname;
require('../../assessment-identities/browser/build.cjs');
