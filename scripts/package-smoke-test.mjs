#!/usr/bin/env bun

// Exercise the npm-installed executable, including its shebang and bin link.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const NPM_REGISTRY = 'https://registry.npmjs.org';
const packageDirectory = fileURLToPath(new URL('../', import.meta.url));

export function smokeTestPackage(packageSpec, { name, version }) {
  const prefix = mkdtempSync(path.join(tmpdir(), 'gh-load-issue-install-'));
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
        '--prefer-online',
        '--registry',
        NPM_REGISTRY,
        packageSpec,
      ],
      { cwd: prefix, stdio: 'pipe' }
    );

    const executable = path.join(prefix, 'bin', name);
    const options = { cwd: prefix, encoding: 'utf8' };
    const installedVersion = execFileSync(executable, ['--version'], options);
    assert.equal(installedVersion.trim(), version);

    const help = execFileSync(executable, ['--help'], options);
    for (const flag of ['--help', '--version', '--use-api']) {
      assert.ok(help.includes(flag), `Installed --help is missing ${flag}`);
    }
    console.log(`Verified installed ${name}@${version}: --version and --help`);
  } finally {
    rmSync(prefix, { recursive: true, force: true });
  }
}

export function packAndSmokeTest() {
  const destination = mkdtempSync(path.join(tmpdir(), 'gh-load-issue-pack-'));
  try {
    const output = execFileSync(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', destination],
      { cwd: packageDirectory, encoding: 'utf8' }
    );
    const [packed] = JSON.parse(output);
    const tarball = path.join(destination, packed.filename);
    console.log(`Testing packed artifact: ${packed.filename}`);
    smokeTestPackage(tarball, packed);
  } finally {
    rmSync(destination, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const packageSpec = process.argv[2];
    if (packageSpec) {
      const manifest = JSON.parse(
        readFileSync(path.join(packageDirectory, 'package.json'), 'utf8')
      );
      smokeTestPackage(packageSpec, manifest);
    } else {
      packAndSmokeTest();
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
