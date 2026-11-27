#!/usr/bin/env bun

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const run = (command, args) =>
  execFileSync(command, args, { stdio: 'inherit', timeout: 120_000 });

try {
  console.log('Apply pending changesets with the installed Changesets CLI.');
  run('node', [require.resolve('@changesets/cli/bin.js'), 'version']);

  const { version } = readJson('package.json');
  console.log(`Synchronize package-lock.json with version ${version}.`);
  run('npm', [
    'version',
    version,
    '--allow-same-version',
    '--no-git-tag-version',
    '--ignore-scripts',
  ]);
  const lock = readJson('package-lock.json');
  if (lock.version !== version || lock.packages?.['']?.version !== version) {
    throw new Error(`package-lock.json did not record version ${version}.`);
  }

  console.log('Confirm the Bun dependency lock still matches the manifest.');
  run('bun', [
    'install',
    '--lockfile-only',
    '--frozen-lockfile',
    '--ignore-scripts',
  ]);
} catch (error) {
  console.error(`Changesets versioning failed: ${error.message}`);
  if (process.env.RELEASE_DEBUG === '1') {
    console.error(error.stack);
  }
  process.exitCode = 1;
}
