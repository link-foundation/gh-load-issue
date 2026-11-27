#!/usr/bin/env bun

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import changesets from '@changesets/parse';

const { default: parseChangeset = changesets } = changesets;

export function needsChangeset(paths) {
  return paths.some(
    (file) =>
      /^(?:(?:package(?:-lock)?\.json|bun\.lock|gh-load-issue\.mjs)$|\.github\/|scripts\/)/.test(
        file
      ) && !file.endsWith('.md')
  );
}

export function validateChangeset(name, filename, contents) {
  let parsed;
  try {
    parsed = parseChangeset(contents);
  } catch {
    throw new Error(
      `${filename} must begin with valid Changesets frontmatter.`
    );
  }
  if (
    !/^---\r?\n/.test(contents) ||
    parsed.releases.length !== 1 ||
    parsed.releases[0].name !== name ||
    !['major', 'minor', 'patch'].includes(parsed.releases[0].type) ||
    !parsed.summary
  ) {
    throw new Error(
      `${filename} must declare one major, minor, or patch bump for ${name} and include a description.`
    );
  }
}

export function pendingChangesets() {
  return readdirSync('.changeset', { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        entry.name !== 'README.md'
    )
    .map((entry) => `.changeset/${entry.name}`);
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    const base = process.env.PR_BASE_SHA;
    const git = (args) =>
      execFileSync('git', args, { encoding: 'utf8' })
        .split('\0')
        .filter(Boolean);
    const changes = base
      ? git(['diff', '--name-only', '-z', base, 'HEAD', '--'])
      : [];
    const present = pendingChangesets();
    const candidates = base
      ? present.filter((file) => changes.includes(file))
      : present;

    if (candidates.length === 0 && (!base || needsChangeset(changes))) {
      throw new Error(
        "Add a changeset by running 'bun run changeset' and commit the result."
      );
    }

    const { name } = JSON.parse(readFileSync('package.json', 'utf8'));
    for (const file of candidates) {
      validateChangeset(name, file, readFileSync(file, 'utf8'));
      console.log(`Validated ${file}`);
    }
    if (candidates.length === 0) {
      console.log(
        'Changeset is optional for documentation, tests, and other non-release changes.'
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
