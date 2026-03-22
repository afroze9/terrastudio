#!/usr/bin/env node
// Bundle CLI with esbuild, injecting the version from package.json.
const { execSync } = require('child_process');
const { version } = require('../package.json');

execSync(
  `npx esbuild dist/cli.js --bundle --platform=node --target=node22 --outfile=bundle/cli.cjs --format=cjs --external:fsevents --define:TSTUDIO_VERSION='"${version}"'`,
  { stdio: 'inherit' },
);
