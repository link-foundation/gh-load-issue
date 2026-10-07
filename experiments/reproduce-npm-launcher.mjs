#!/usr/bin/env bun

// Reproduce issue #18 without changing an existing global installation.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const prefix = mkdtempSync(path.join(tmpdir(), 'gh-load-issue-0.3.2-'));
try {
  execFileSync(
    'npm',
    [
      'install',
      '--global',
      '--prefix',
      prefix,
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      'gh-load-issue@0.3.2',
    ],
    { stdio: 'inherit' }
  );
  const executable = path.join(prefix, 'bin', 'gh-load-issue');
  console.log(
    readFileSync(executable, 'utf8').split('\n').slice(0, 3).join('\n')
  );
  for (const flag of ['--version', '--help']) {
    const result = spawnSync(executable, [flag], { encoding: 'utf8' });
    console.log(`${flag}: exit ${result.status}`);
    console.log(result.stderr);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /import: not found|Syntax error/);
  }
} finally {
  rmSync(prefix, { recursive: true, force: true });
}
