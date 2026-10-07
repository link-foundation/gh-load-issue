#!/usr/bin/env bun

// Publish using npm OIDC, and report success only after consumer verification.
// Usage: node scripts/publish-to-npm.mjs [--should-pull]
import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { NPM_REGISTRY, packAndSmokeTest } from './package-smoke-test.mjs';
import { sleep, verifyNpmRelease } from './verify-npm-release.mjs';

export async function publishToNpm(
  manifest,
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
    // Authentication and connection errors must not be mistaken for E404.
    if (!`${error.message}\n${error.stderr || ''}`.includes('E404')) {
      throw error;
    }
  }

  if (!alreadyPublished) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      console.log(`Publish attempt ${attempt}/${attempts}: ${spec}`);
      try {
        // execFileSync throws for nonzero exits; command-stream did not.
        run('npm', ['run', 'changeset:publish'], { stdio: 'inherit' });
        break;
      } catch (error) {
        if (attempt === attempts) {
          throw error;
        }
        console.log(`Publish failed: ${error.message}`);
        await wait(delay);
      }
    }
  }

  // Also verify reruns of releases that are already in the registry.
  await verify(manifest);
  return { alreadyPublished };
}

function setOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

async function main() {
  const { shouldPull } = yargs(hideBin(process.argv))
    .option('should-pull', {
      type: 'boolean',
      default: process.env.SHOULD_PULL === 'true',
      describe: 'Pull latest changes before publishing',
    })
    .parse();
  if (shouldPull) {
    execFileSync('git', ['pull', 'origin', 'main'], { stdio: 'inherit' });
  }
  packAndSmokeTest();
  const { name, version } = JSON.parse(readFileSync('./package.json', 'utf8'));
  const result = await publishToNpm({ name, version });
  setOutput('published', 'true');
  setOutput('published_version', version);
  setOutput('already_published', String(result.alreadyPublished));
  console.log(`✅ Verified ${name}@${version} published to npm`);
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error('Publication failed:', error.message);
    process.exitCode = 1;
  });
}
