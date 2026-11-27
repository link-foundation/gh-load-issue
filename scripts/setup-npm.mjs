#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function assertTrustedPublishingRuntime(nodeVersion, npmVersion) {
  const [nodeMajor, nodeMinor] = nodeVersion
    .replace(/^v/, '')
    .split('.')
    .map(Number);
  const [npmMajor, npmMinor, npmPatch] = npmVersion.split('.').map(Number);
  const stableVersions = /^v?\d+\.\d+\.\d+$/;
  if (
    !stableVersions.test(nodeVersion) ||
    !(nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 14)) ||
    !stableVersions.test(npmVersion) ||
    !(
      npmMajor > 11 ||
      (npmMajor === 11 && (npmMinor > 5 || (npmMinor === 5 && npmPatch >= 1)))
    )
  ) {
    throw new Error(
      `npm trusted publishing requires Node.js >=22.14.0 and npm >=11.5.1. Found Node.js ${nodeVersion} and npm ${npmVersion}. Update actions/setup-node before releasing.`
    );
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const npmVersion = execFileSync('npm', ['--version'], {
    encoding: 'utf8',
  }).trim();
  assertTrustedPublishingRuntime(process.version, npmVersion);
  console.log(
    `Trusted publishing runtime: Node.js ${process.version}, npm ${npmVersion}`
  );
}
