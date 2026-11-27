#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { packAndSmokeTest } from './package-smoke-test.mjs';
import { pendingChangesets, validateChangeset } from './validate-changeset.mjs';

const { mode, bumpType, description } = yargs(hideBin(process.argv))
  .option('mode', {
    choices: ['changeset', 'instant', 'recover'],
    demandOption: true,
  })
  .option('bump-type', {
    choices: ['major', 'minor', 'patch'],
    default: process.env.BUMP_TYPE || undefined,
  })
  .option('description', {
    type: 'string',
    default: process.env.DESCRIPTION || '',
  })
  .strict()
  .parse();
const manifest = () => JSON.parse(readFileSync('package.json', 'utf8'));
const capture = (args) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim();
const run = (command, args) =>
  execFileSync(command, args, { stdio: 'inherit' });
const git = (...args) => run('git', args);

async function prepareVersion(trigger, remote) {
  if (remote !== trigger) {
    const parent = capture(['rev-parse', 'origin/main^']);
    const message = capture(['log', '-1', '--format=%B', 'origin/main']);
    const version = JSON.parse(
      capture(['show', 'origin/main:package.json'])
    ).version;
    if (
      mode === 'recover' ||
      parent !== trigger ||
      message !== `${version}\n\nRelease-Trigger: ${trigger}` ||
      version === manifest().version
    ) {
      throw new Error(
        'main advanced after checks started. Run the workflow on the latest main commit.'
      );
    }
    git('checkout', '--detach', remote);
    console.log(`Resuming release of committed version ${version}.`);
    return;
  }

  if (mode === 'recover') {
    return;
  }

  const previousVersion = manifest().version;
  if (mode === 'changeset') {
    const changesets = pendingChangesets();
    if (!changesets.length) {
      throw new Error('No pending changesets to version.');
    }
    for (const file of changesets) {
      validateChangeset(manifest().name, file, readFileSync(file, 'utf8'));
    }
    run('npm', ['run', 'changeset:version']);
  } else {
    if (!bumpType) {
      throw new Error(
        'Select a major, minor, or patch bump for an instant release.'
      );
    }
    run(process.execPath, [
      'scripts/instant-version-bump.mjs',
      '--bump-type',
      bumpType,
      '--description',
      description,
    ]);
  }

  const { version } = manifest();
  if (version === previousVersion) {
    throw new Error(`Release version did not change from ${previousVersion}.`);
  }
  await packAndSmokeTest();
  git('config', 'user.name', 'github-actions[bot]');
  git(
    'config',
    'user.email',
    '41898282+github-actions[bot]@users.noreply.github.com'
  );
  git(
    'add',
    '--all',
    '--',
    'package.json',
    'package-lock.json',
    'bun.lock',
    'CHANGELOG.md',
    '.changeset'
  );
  git('commit', '-m', version, '-m', `Release-Trigger: ${trigger}`);
  git('push', 'origin', 'HEAD:refs/heads/main');
}

try {
  if (capture(['status', '--porcelain'])) {
    throw new Error('Start from a clean checkout before preparing a release.');
  }
  const trigger = capture(['rev-parse', 'HEAD']);
  git('fetch', 'origin', 'refs/heads/main:refs/remotes/origin/main');
  await prepareVersion(trigger, capture(['rev-parse', 'origin/main']));
  const releaseCommit = capture(['rev-parse', 'HEAD']);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `commit=${releaseCommit}\n`);
  }
  console.log(`Release ${manifest().version} from ${releaseCommit}.`);
} catch (error) {
  console.error(`Could not prepare release: ${error.message}`);
  if (process.env.RELEASE_DEBUG === '1') {
    console.error(error.stack);
  }
  process.exitCode = 1;
}
