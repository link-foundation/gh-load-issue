#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { NPM_REGISTRY, packAndSmokeTest } from './package-smoke-test.mjs';
import { sleep, verifyNpmRelease } from './verify-npm-release.mjs';

const npmError = (error) => `${error.message}\n${error.stderr || ''}`;
const transient =
  /\b(?:E429|E50[0234]|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT)\b/;

async function publishTarball(spec, tarball, { run, wait, attempts, delay }) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(`Publish attempt ${attempt}/${attempts}: ${spec}`);
    try {
      run(
        'npm',
        [
          'publish',
          tarball,
          '--access',
          'public',
          '--provenance',
          '--registry',
          NPM_REGISTRY,
        ],
        { stdio: 'pipe' }
      );
      return false;
    } catch (error) {
      const details = npmError(error);
      if (/\b(?:E401|E403|E404|ENEEDAUTH)\b/.test(details)) {
        throw new Error(
          `npm refused to publish ${spec}. Confirm the trusted publisher allows publishing from release.yml and matches this repository.`,
          { cause: error }
        );
      }
      if (/\b(?:E409|EPUBLISHCONFLICT)\b/.test(details)) {
        return true;
      }
      if (attempt === attempts || !transient.test(details)) {
        throw error;
      }
      console.log(`Transient npm failure while publishing ${spec}. Retrying.`);
      await wait(delay);
    }
  }
  throw new Error('No npm publish attempts configured.');
}

export async function publishToNpm(
  manifest,
  tarball,
  {
    run = execFileSync,
    verify = verifyNpmRelease,
    wait = sleep,
    attempts = 3,
    delay = 10000,
  } = {}
) {
  const spec = `${manifest.name}@${manifest.version}`;
  let alreadyPublished = false;
  try {
    const version = JSON.parse(
      run(
        'npm',
        ['view', spec, 'version', '--json', '--registry', NPM_REGISTRY],
        { encoding: 'utf8', stdio: 'pipe' }
      )
    );
    if (version !== manifest.version) {
      throw new Error(`Unexpected registry version: ${version}`);
    }
    alreadyPublished = true;
  } catch (error) {
    if (!/\bE404\b/.test(npmError(error))) {
      throw error;
    }
  }

  if (!alreadyPublished) {
    alreadyPublished = await publishTarball(spec, tarball, {
      run,
      wait,
      attempts,
      delay,
    });
  }
  await verify(manifest);
  return { alreadyPublished };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    await packAndSmokeTest((tarball, manifest) =>
      publishToNpm(manifest, tarball)
    );
  } catch (error) {
    console.error('Publication failed:', error.message);
    if (process.env.RELEASE_DEBUG === '1') {
      const code = npmError(error.cause || error).match(
        /\b(?:E[A-Z][A-Z_]+|E\d{3})\b/
      )?.[0];
      console.error(`npm error code: ${code || 'unavailable'}`);
    }
    process.exitCode = 1;
  }
}
