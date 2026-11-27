#!/usr/bin/env bun

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MAX_LINES = 1100;
const files = new Set(
  execFileSync(
    'git',
    [
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      '*.js',
      '*.mjs',
      '*.cjs',
    ],
    { encoding: 'utf8' }
  )
    .split('\0')
    .filter(Boolean)
);
const missing = new Set(
  execFileSync('git', ['ls-files', '-z', '--deleted'], {
    encoding: 'utf8',
  }).split('\0')
);

for (const file of files) {
  if (missing.has(file)) {
    continue;
  }
  const text = readFileSync(file, 'utf8');
  const lines = text
    ? text.split('\n').length - Number(text.endsWith('\n'))
    : 0;
  if (lines > MAX_LINES) {
    console.error(
      `${file} exceeds the ${MAX_LINES}-line limit (${lines} lines).`
    );
    process.exitCode = 1;
  }
}
if (!process.exitCode) {
  console.log(`JavaScript files are within the ${MAX_LINES}-line limit.`);
}
