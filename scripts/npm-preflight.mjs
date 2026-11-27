#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { NPM_REGISTRY } from './package-smoke-test.mjs';

export async function checkTrustedPublisher(
  name,
  { env = process.env, request = fetch } = {}
) {
  const {
    ACTIONS_ID_TOKEN_REQUEST_URL,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN,
    GITHUB_REPOSITORY,
  } = env;
  if (!ACTIONS_ID_TOKEN_REQUEST_URL || !ACTIONS_ID_TOKEN_REQUEST_TOKEN) {
    throw new Error(
      'GitHub Actions OIDC is unavailable. Set id-token: write on the release preflight job.'
    );
  }

  const exchange = (url, token, options = {}) =>
    request(url, {
      ...options,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: globalThis.AbortSignal.timeout(15000),
    });

  const oidc = new URL(ACTIONS_ID_TOKEN_REQUEST_URL);
  oidc.searchParams.set('audience', 'npm:registry.npmjs.org');
  const identity = await exchange(oidc, ACTIONS_ID_TOKEN_REQUEST_TOKEN);
  if (!identity.ok) {
    throw new Error(
      `GitHub Actions OIDC request returned HTTP ${identity.status}.`
    );
  }
  const { value } = await identity.json();
  if (typeof value !== 'string' || !value) {
    throw new Error(
      'GitHub Actions OIDC response did not contain an identity token.'
    );
  }

  const endpoint = `${NPM_REGISTRY}/-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(name)}`;
  const authorization = await exchange(endpoint, value, { method: 'POST' });
  if (authorization.status === 404) {
    throw new Error(
      `npm rejected trusted publishing for ${name} (HTTP 404). An npm package owner must configure the GitHub Actions trusted publisher for ${GITHUB_REPOSITORY}, workflow release.yml, with no environment and permission to publish. Then rerun the release.`
    );
  }
  if (!authorization.ok) {
    throw new Error(
      `npm trusted publishing authorization returned HTTP ${authorization.status} for ${name}.`
    );
  }
  const { token } = await authorization.json();
  if (typeof token !== 'string' || !token) {
    throw new Error(
      'npm trusted publishing response did not contain a publish token.'
    );
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const { name } = JSON.parse(readFileSync('package.json', 'utf8'));
  try {
    await checkTrustedPublisher(name);
    console.log(
      `npm accepted the workflow identity for ${name}. Direct publish permission is checked during upload.`
    );
  } catch (error) {
    console.error(`npm preflight failed: ${error.message}`);
    if (process.env.RELEASE_DEBUG === '1') {
      // Only report the error kind. Request headers and token bodies must never enter logs.
      console.error(`npm preflight error type: ${error.name}`);
    }
    process.exitCode = 1;
  }
}
