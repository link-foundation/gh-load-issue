import assert from 'node:assert/strict';
import { describe, it } from 'test-anywhere';
import { assertTrustedPublishingRuntime } from '../scripts/setup-npm.mjs';
import { checkTrustedPublisher } from '../scripts/npm-preflight.mjs';
import {
  needsChangeset,
  validateChangeset,
} from '../scripts/validate-changeset.mjs';
import {
  ensureGitHubRelease,
  releaseNotes,
} from '../scripts/create-github-release.mjs';

const oidcEnv = {
  ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.invalid?api-version=2.0',
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture-request-token',
  GITHUB_REPOSITORY: 'owner/repo',
};

describe('CI release safeguards', () => {
  it('rejects the runtime that silently failed to upgrade in the October release', () => {
    assert.throws(
      () => assertTrustedPublishingRuntime('v20.20.2', '10.8.2'),
      />=22.14.0.*>=11.5.1/
    );
    assert.throws(
      () => assertTrustedPublishingRuntime('v24.0.0', '11.5.0'),
      /11.5.1/
    );
    assert.doesNotThrow(() =>
      assertTrustedPublishingRuntime('v22.14.0', '11.5.1')
    );
    assert.doesNotThrow(() =>
      assertTrustedPublishingRuntime('v24.22.3', '12.0.0')
    );
  });

  it('requires the registry to accept the OIDC token for this exact package', async () => {
    for (const denied of [false, true]) {
      const requests = [];
      const result = checkTrustedPublisher('@scope/package', {
        env: oidcEnv,
        request: async (url, options) => {
          requests.push([String(url), options]);
          if (requests.length === 1) {
            return { ok: true, json: () => ({ value: 'fixture-identity' }) };
          }
          return {
            ok: !denied,
            status: denied ? 404 : 200,
            json: () => ({ token: 'fixture-publish-token' }),
          };
        },
      });
      if (denied) {
        await assert.rejects(result, /owner\/repo, workflow release.yml/);
      } else {
        await result;
      }
      assert.match(requests[0][0], /audience=npm%3Aregistry.npmjs.org/);
      assert.equal(
        requests[1][0],
        'https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/%40scope%2Fpackage'
      );
      assert.equal(requests[1][1].method, 'POST');
      assert.equal(
        requests[1][1].headers.Authorization,
        'Bearer fixture-identity'
      );
    }
  });

  it('validates release changes with the same parser as Changesets', () => {
    assert.equal(
      needsChangeset([
        'README.md',
        '.gitkeep',
        'tests/test-ci-release.test.mjs',
      ]),
      false
    );
    assert.equal(needsChangeset(['bun.lock']), true);
    assert.equal(needsChangeset(['.github/workflows/release.yml']), true);
    const validate = (content) =>
      validateChangeset('gh-load-issue', 'fixture.md', content);
    assert.doesNotThrow(() =>
      validate('---\r\ngh-load-issue: patch\r\n---\r\n\r\nA fix.\r\n')
    );
    assert.throws(
      () => validate('---\nother: patch\n---\nA fix.\n'),
      /must declare/
    );
    assert.throws(
      () => validate('---\ngh-load-issue: patched\n---\nA fix.\n'),
      /must declare/
    );
    assert.throws(
      () => validate('---\ngh-load-issue: minor\n---\n'),
      /include a description/
    );
  });
});

describe('GitHub release metadata', () => {
  const manifest = { name: 'gh-load-issue', version: '1.0.0' };
  const changelog =
    '# Changelog\r\n\r\n## 1.0.0\r\n\r\n### Minor Changes\r\n\r\n- Feature\r\n  continued\r\n\r\n### Patch Changes\r\n\r\n- Fix\r\n\r\n## 0.9.0\r\n\r\nPrevious release\r\n';
  const release = {
    repository: 'owner/repo',
    commit: 'version-commit',
    trigger: 'trigger-commit',
    manifest,
    changelog,
  };

  it('keeps complete changelog sections together with the PR and npm badge', () => {
    const notes = releaseNotes(changelog, manifest, 21);
    assert.match(notes, /Feature\n {2}continued\n\n### Patch Changes\n\n- Fix/);
    assert.match(notes, /Related Pull Request:\*\* #21/);
    assert.match(notes, /www\.npmjs\.com\/package\/gh-load-issue\/v\/1.0.0/);
    assert.doesNotMatch(notes, /Previous release/);
  });

  it('targets the checked version commit and makes an existing release a safe rerun', () => {
    const calls = [];
    let created = false;
    const run = (_command, args, options) => {
      calls.push(args[1]);
      if (args[1].endsWith('/git/ref/tags/v1.0.0')) {
        if (!created) {
          throw Object.assign(new Error('gh failed'), { stderr: 'HTTP 404' });
        }
        return JSON.stringify({
          object: { type: 'commit', sha: release.commit },
        });
      }
      if (args[1].endsWith('/pulls')) {
        return JSON.stringify([{ title: 'Fix CI', number: 21 }]);
      }
      if (options.input) {
        const body = JSON.parse(options.input);
        assert.equal(body.target_commitish, release.commit);
        assert.match(body.body, /#21/);
        created = true;
      }
      return '{}';
    };
    ensureGitHubRelease(release, run);
    ensureGitHubRelease(release, run);
    assert.equal(calls.length, 5);
  });

  it('fails if the release tag points to an unrelated commit', () => {
    assert.throws(
      () =>
        ensureGitHubRelease(
          release,
          () => '{"object":{"type":"commit","sha":"different-commit"}}'
        ),
      /Tag v1\.0\.0 points to different-commit/
    );
  });
});
