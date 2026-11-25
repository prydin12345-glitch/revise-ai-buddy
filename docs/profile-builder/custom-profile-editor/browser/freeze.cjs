const fs = require('node:fs');
const path = require('node:path');
const { artifacts, sha256, writeJSON, verifyInputs } = require('./runtime.cjs');
if (!process.argv.includes('--parent-source-freeze')) throw Error('Only run after the parent confirms that application and harness sources are frozen.');
verifyInputs();
writeJSON('parent-source-freeze.json', {
  confirmedBy: 'parent-source-freeze', confirmedAt: new Date().toISOString(),
  manifestSha256: sha256(path.join(artifacts, 'build-manifest.json')),
});
console.log('Parent source-freeze receipt recorded. Any input drift invalidates it.');
