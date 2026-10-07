#!/usr/bin/env bun

import assert from 'node:assert/strict';
import { describe, it } from 'test-anywhere';
import { verifyNpmRelease } from '../scripts/verify-npm-release.mjs';
import { publishToNpm } from '../scripts/publish-to-npm.mjs';

const manifest = { name: 'gh-load-issue', version: '0.4.0' };

function verificationOptions(run) {
  return {
    run,
    smokeTest: () => {},
    wait: async () => {},
    attempts: 2,
    delay: 0,
  };
}

describe('npm release postconditions', () => {
  it('verifies the exact version, latest tag, and installed executable', async () => {
    const commands = [];
    let installed = false;
    await verifyNpmRelease(manifest, {
      ...verificationOptions((_command, args) => {
        commands.push(args);
        return JSON.stringify(manifest.version);
      }),
      smokeTest: (spec, expected) => {
        assert.equal(spec, 'gh-load-issue@0.4.0');
        assert.deepEqual(expected, manifest);
        installed = true;
      },
    });
    assert.equal(installed, true);
    assert.equal(commands[0][1], 'gh-load-issue@0.4.0');
    assert.equal(commands[1][2], 'dist-tags.latest');
    assert.ok(
      commands.every((args) => args.includes('https://registry.npmjs.org'))
    );
  });

  it('rejects a missing published version', async () => {
    await assert.rejects(
      verifyNpmRelease(
        manifest,
        verificationOptions(() => {
          throw new Error('E404: package not found');
        })
      ),
      /E404/
    );
  });

  it('rejects a stale latest tag', async () => {
    await assert.rejects(
      verifyNpmRelease(
        manifest,
        verificationOptions((_command, args) =>
          JSON.stringify(args[2] === 'version' ? '0.4.0' : '0.3.2')
        )
      ),
      /latest.*0.3.2.*0.4.0/
    );
  });

  it('waits for registry propagation before testing the executable', async () => {
    let attempts = 0;
    let waits = 0;
    await verifyNpmRelease(manifest, {
      ...verificationOptions(() => {
        attempts++;
        if (attempts === 1) {
          throw new Error('E404');
        }
        return '"0.4.0"';
      }),
      wait: async () => {
        waits++;
      },
    });
    assert.equal(waits, 1);
    assert.equal(attempts, 3);
  });

  it('rejects a registry artifact whose installed bin cannot start', async () => {
    await assert.rejects(
      verifyNpmRelease(manifest, {
        ...verificationOptions(() => '"0.4.0"'),
        smokeTest: () => {
          throw new Error('Syntax error: "(" unexpected');
        },
      }),
      /Syntax error/
    );
  });
});

describe('npm publication', () => {
  function options(run, verify = async () => {}) {
    return { run, verify, wait: async () => {}, attempts: 2, delay: 0 };
  }

  it('requires registry verification even when the publish command exits zero', async () => {
    const run = (_command, args) => {
      if (args[0] === 'view') {
        throw new Error('E404');
      }
    };
    await assert.rejects(
      publishToNpm(
        manifest,
        options(run, async () => {
          throw new Error('Version missing from npm');
        })
      ),
      /Version missing from npm/
    );
  });

  it('propagates publish command failures after bounded retries', async () => {
    let publishes = 0;
    let verifications = 0;
    await assert.rejects(
      publishToNpm(
        manifest,
        options(
          (_command, args) => {
            if (args[0] === 'view') {
              throw new Error('E404');
            }
            publishes++;
            throw new Error('npm publish failed');
          },
          async () => {
            verifications++;
          }
        )
      ),
      /npm publish failed/
    );
    assert.equal(publishes, 2);
    assert.equal(verifications, 0);
  });

  it('verifies an already published version before reporting success', async () => {
    let verified = false;
    const result = await publishToNpm(
      manifest,
      options(
        () => '"0.4.0"',
        async () => {
          verified = true;
        }
      )
    );
    assert.equal(verified, true);
    assert.equal(result.alreadyPublished, true);
  });

  it('rejects an already published broken executable', async () => {
    await assert.rejects(
      publishToNpm(
        manifest,
        options(
          () => '"0.4.0"',
          async () => {
            throw new Error('Installed executable failed');
          }
        )
      ),
      /Installed executable failed/
    );
  });

  it('does not treat registry connection errors as an unpublished version', async () => {
    let calls = 0;
    await assert.rejects(
      publishToNpm(
        manifest,
        options(() => {
          calls++;
          throw new Error('ECONNREFUSED');
        })
      ),
      /ECONNREFUSED/
    );
    assert.equal(calls, 1);
  });

  it('reports success after publishing and verifying a new version', async () => {
    const commands = [];
    const result = await publishToNpm(
      manifest,
      options((_command, args) => {
        commands.push(args);
        if (args[0] === 'view') {
          throw new Error('E404');
        }
      })
    );
    assert.deepEqual(commands[1], ['run', 'changeset:publish']);
    assert.equal(result.alreadyPublished, false);
  });
});
