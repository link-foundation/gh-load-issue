#!/usr/bin/env bun

import { execFileSync } from 'node:child_process';

const options = { stdio: 'inherit' };
execFileSync('npm', ['exec', '--no', '--', 'changeset', 'version'], options);
execFileSync(
  'npm',
  [
    'install',
    '--package-lock-only',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
  ],
  options
);
execFileSync(
  'bun',
  ['install', '--lockfile-only', '--ignore-scripts'],
  options
);
