#!/usr/bin/env bun

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { NPM_REGISTRY, smokeTestPackage } from './package-smoke-test.mjs';

export const sleep = (ms) =>
  new Promise((resolve) => globalThis.setTimeout(resolve, ms));

// Registry propagation can lag behind a successful publish. Retry a finite
// number of times, and fail the release unless consumers can install it.
export async function verifyNpmRelease(
  manifest,
  {
    run = execFileSync,
    smokeTest = smokeTestPackage,
    wait = sleep,
    attempts = 6,
    delay = 10000,
  } = {}
) {
  const { name, version } = manifest;
  const spec = `${name}@${version}`;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const view = (target, field) =>
        JSON.parse(
          run(
            'npm',
            ['view', target, field, '--json', '--registry', NPM_REGISTRY],
            { encoding: 'utf8', stdio: 'pipe' }
          )
        );
      assert.equal(view(spec, 'version'), version);
      const latest = view(name, 'dist-tags.latest');
      assert.equal(
        latest,
        version,
        `npm latest is ${latest}; expected ${version}`
      );
      smokeTest(spec, manifest);
      console.log(`Verified npm registry release: ${spec} (latest)`);
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      console.log(
        `Registry verification ${attempt}/${attempts}: ${error.message}`
      );
      await wait(delay);
    }
  }
}
