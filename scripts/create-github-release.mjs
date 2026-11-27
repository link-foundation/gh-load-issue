#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function releaseNotes(changelog, { name, version }, prNumber) {
  const lines = changelog.replace(/\r\n/g, '\n').split('\n');
  const start = lines.indexOf(`## ${version}`);
  if (start === -1) {
    throw new Error(`CHANGELOG.md is missing the ${version} heading.`);
  }
  const end = lines.findIndex(
    (line, index) => index > start && line.startsWith('## ')
  );
  const notes = lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim();
  if (!notes) {
    throw new Error(`CHANGELOG.md has an empty ${version} entry.`);
  }
  const pr = prNumber ? `\n\n**Related Pull Request:** #${prNumber}` : '';
  const npmBadge = `[![npm version](https://img.shields.io/badge/npm-${version}-blue.svg)](https://www.npmjs.com/package/${name}/v/${version})`;
  return `${notes}${pr}\n\n---\n\n${npmBadge}\n`;
}

export function ensureGitHubRelease(
  { repository, commit, trigger, manifest, changelog },
  run = execFileSync
) {
  const tag = `v${manifest.version}`;
  const api = (route, args = [], options = {}) =>
    run('gh', ['api', `repos/${repository}/${route}`, ...args], {
      encoding: 'utf8',
      ...options,
    });

  const lookup = (route) => {
    try {
      return JSON.parse(api(route));
    } catch (error) {
      if (!String(error.stderr).includes('HTTP 404')) {
        throw error;
      }
      return null;
    }
  };
  const taggedCommit = lookup(`commits/${tag}`);
  if (taggedCommit && taggedCommit.sha !== commit) {
    throw new Error(
      `Tag ${tag} points to ${taggedCommit.sha}, expected ${commit}.`
    );
  }
  if (taggedCommit && lookup(`releases/tags/${tag}`)) {
    console.log(`GitHub Release ${tag} already exists.`);
    return;
  }
  const prs = JSON.parse(api(`commits/${trigger}/pulls`));
  const pr = prs.find(({ title }) => !title.includes('version packages'));
  api('releases', ['--method', 'POST', '--input', '-'], {
    input: JSON.stringify({
      tag_name: tag,
      target_commitish: commit,
      name: manifest.version,
      body: releaseNotes(changelog, manifest, pr?.number),
    }),
  });
  console.log(`Created GitHub Release ${tag} from ${commit}.`);
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const {
    GITHUB_REPOSITORY: repository,
    RELEASE_COMMIT: commit,
    GITHUB_SHA: trigger,
  } = process.env;
  if (!repository || !commit || !trigger) {
    throw new Error(
      'Set GITHUB_REPOSITORY, RELEASE_COMMIT, and GITHUB_SHA to create a GitHub release.'
    );
  }
  ensureGitHubRelease({
    repository,
    commit,
    trigger,
    manifest: JSON.parse(readFileSync('package.json', 'utf8')),
    changelog: readFileSync('CHANGELOG.md', 'utf8'),
  });
}
