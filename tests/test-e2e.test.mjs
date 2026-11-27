#!/usr/bin/env bun

/**
 * End-to-end tests for gh-load-issue
 *
 * These tests verify the complete workflow of downloading GitHub issues,
 * including image handling, offline availability, and content verification.
 */

import {
  describe,
  it,
  expect,
  afterEach,
  beforeEach,
  setDefaultTimeout,
} from 'test-anywhere';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Set timeout to 60 seconds for real issue download tests
setDefaultTimeout(60000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.join(__dirname, '..', 'gh-load-issue.mjs');
const runCli = (...args) =>
  execFileSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    timeout: 45000,
  });
let testOutputDir;

beforeEach(async () => {
  testOutputDir = await fsPromises.mkdtemp(
    path.join(tmpdir(), 'gh-load-issue-e2e-')
  );
});
afterEach(async () => {
  await fsPromises.rm(testOutputDir, { recursive: true, force: true });
});

// Test issues - diverse set of real GitHub issues
const TEST_ISSUES = {
  // Simple issue without images (from this repo)
  simple: {
    url: 'https://github.com/link-foundation/gh-load-issue/issues/1',
    shortFormat: 'link-foundation/gh-load-issue#1',
    expectedContent: {
      title: 'Make MVP',
      state: 'closed',
      hasBody: true,
    },
  },
  // Issue with implementation details (from this repo)
  detailed: {
    url: 'https://github.com/link-foundation/gh-load-issue/issues/7',
    shortFormat: 'link-foundation/gh-load-issue#7',
    expectedContent: {
      title: 'Implement gh-download-issue tool',
      state: 'closed',
      hasBody: true,
      bodyContains: ['Image Handling', 'CLI Options', 'Output Structure'],
    },
  },
};

describe('E2E Tests: GitHub Issue Loading', () => {
  describe('Simple Issue Download', () => {
    it('should download a simple issue to markdown', async () => {
      const outputPath = path.join(testOutputDir, 'simple-issue.md');

      runCli(TEST_ISSUES.simple.url, '-o', outputPath, '--no-download-images');

      // Verify file was created
      const exists = fs.existsSync(outputPath);
      expect(exists).toBe(true);

      // Verify content structure
      const content = await fsPromises.readFile(outputPath, 'utf8');

      // Check title is present as H1
      expect(content).toContain('# ');
      expect(content.toLowerCase()).toContain('mvp');

      // Check metadata section
      expect(content).toContain('**Issue:**');
      expect(content).toContain('**Author:**');
      expect(content).toContain('**State:**');
      expect(content).toContain('**Created:**');
    });

    it('should support short format input', async () => {
      const outputPath = path.join(testOutputDir, 'short-format.md');

      runCli(
        TEST_ISSUES.simple.shortFormat,
        '-o',
        outputPath,
        '--no-download-images'
      );

      const exists = fs.existsSync(outputPath);
      expect(exists).toBe(true);
    });
  });

  describe('Detailed Issue Download', () => {
    it('should download an issue with full body content', async () => {
      const outputPath = path.join(testOutputDir, 'detailed-issue.md');

      runCli(
        TEST_ISSUES.detailed.url,
        '-o',
        outputPath,
        '--no-download-images'
      );

      const content = await fsPromises.readFile(outputPath, 'utf8');

      // Verify body content is present
      expect(content).toContain('## Description');

      // Check for expected content sections
      for (const expectedText of TEST_ISSUES.detailed.expectedContent
        .bodyContains) {
        expect(content).toContain(expectedText);
      }
    });
  });

  describe('JSON Output Format', () => {
    it('should export issue as JSON', async () => {
      const outputPath = path.join(testOutputDir, 'issue-json.json');

      runCli(
        TEST_ISSUES.simple.url,
        '-o',
        outputPath,
        '--format',
        'json',
        '--no-download-images'
      );

      const exists = fs.existsSync(outputPath);
      expect(exists).toBe(true);

      const content = await fsPromises.readFile(outputPath, 'utf8');
      const json = JSON.parse(content);

      // Verify JSON structure
      expect(json.issue).not.toBe(undefined);
      expect(json.comments).not.toBe(undefined);
      expect(json.metadata).not.toBe(undefined);

      // Verify issue properties
      expect(json.issue.number).not.toBe(undefined);
      expect(json.issue.title).not.toBe(undefined);
      expect(json.issue.state).not.toBe(undefined);
      expect(json.issue.author).not.toBe(undefined);
      expect(json.issue.body).not.toBe(undefined);
    });

    it('should include metadata in JSON output', async () => {
      const outputPath = path.join(testOutputDir, 'issue-metadata.json');

      runCli(
        TEST_ISSUES.simple.url,
        '-o',
        outputPath,
        '--format',
        'json',
        '--no-download-images'
      );

      const content = await fsPromises.readFile(outputPath, 'utf8');
      const json = JSON.parse(content);

      // Verify metadata
      expect(json.metadata.downloaded_at).not.toBe(undefined);
      expect(json.metadata.tool_version).not.toBe(undefined);
    });
  });

  describe('Output Directory Handling', () => {
    it('should create output directory if it does not exist', async () => {
      const nestedDir = path.join(testOutputDir, 'nested', 'deep', 'dir');
      const outputPath = path.join(nestedDir, 'issue.md');

      runCli(TEST_ISSUES.simple.url, '-o', outputPath, '--no-download-images');

      const exists = fs.existsSync(outputPath);
      expect(exists).toBe(true);
    });

    it('should use default filename when directory is specified', async () => {
      runCli(
        TEST_ISSUES.simple.url,
        '-o',
        testOutputDir,
        '--no-download-images'
      );

      // Should create file with default naming pattern
      const files = await fsPromises.readdir(testOutputDir);
      expect(files).toEqual(['issue-1.md']);
    });
  });

  describe('Markdown Content Verification', () => {
    it('should produce valid markdown structure', async () => {
      const outputPath = path.join(testOutputDir, 'markdown-structure.md');

      runCli(
        TEST_ISSUES.detailed.url,
        '-o',
        outputPath,
        '--no-download-images'
      );

      const content = await fsPromises.readFile(outputPath, 'utf8');

      // Check for proper markdown structure
      const lines = content.split('\n');

      // First non-empty line should be H1 title
      const firstContentLine = lines.find((l) => l.trim().length > 0);
      expect(firstContentLine?.startsWith('# ')).toBe(true);

      // Should have section separators
      expect(content).toContain('---');

      // Should have proper bold formatting for metadata
      expect(content).toMatch(/\*\*\w+:\*\*/);
    });

    it('should not contain raw HTML in body (except embedded img tags)', async () => {
      const outputPath = path.join(testOutputDir, 'no-html.md');

      runCli(TEST_ISSUES.simple.url, '-o', outputPath, '--no-download-images');

      const content = await fsPromises.readFile(outputPath, 'utf8');

      // Should not contain common HTML tags (except img which is allowed)
      expect(content).not.toMatch(/<div[^>]*>/i);
      expect(content).not.toMatch(/<span[^>]*>/i);
      expect(content).not.toMatch(/<p[^>]*>/i);
    });
  });

  describe('Image download', () => {
    it('writes a real local image and suppresses the download when disabled', async () => {
      const image = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR8sAAAAASUVORK5CYII=',
        'base64'
      );
      const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch: () =>
          new globalThis.Response(image, {
            headers: { 'Content-Type': 'image/png' },
          }),
      });
      try {
        const url = new URL('fixture.png', server.url).href;
        const issue = {
          number: 1,
          title: 'Image fixture',
          body: `![fixture](${url})`,
          state: 'open',
          author: { login: 'fixture' },
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          labels: [],
          assignees: [],
          comments: [],
          url: TEST_ISSUES.simple.url,
        };
        const windows = process.platform === 'win32';
        const fixtureScript = path.join(testOutputDir, 'mock-gh.mjs');
        await fsPromises.writeFile(
          fixtureScript,
          `if (process.argv[2] === 'issue') console.log(${JSON.stringify(JSON.stringify(issue))});`
        );
        await fsPromises.writeFile(
          path.join(testOutputDir, windows ? 'gh.cmd' : 'gh'),
          windows
            ? '@echo off\r\n"%BUN_FIXTURE_RUNTIME%" "%BUN_FIXTURE_SCRIPT%" %*\r\n'
            : '#!/bin/sh\nexec "$BUN_FIXTURE_RUNTIME" "$BUN_FIXTURE_SCRIPT" "$@"\n',
          { mode: 0o755 }
        );
        const options = {
          timeout: 15000,
          env: {
            ...process.env,
            PATH: `${testOutputDir}${path.delimiter}${process.env.PATH}`,
            BUN_FIXTURE_RUNTIME: process.execPath,
            BUN_FIXTURE_SCRIPT: fixtureScript,
            GH_TOKEN: '',
            GITHUB_TOKEN: '',
          },
        };
        const run = promisify(execFile);
        const withImages = path.join(testOutputDir, 'with-images.md');
        const withoutImages = path.join(testOutputDir, 'without-images.md');
        await run(
          process.execPath,
          [scriptPath, TEST_ISSUES.simple.url, '-o', withImages],
          options
        );
        await run(
          process.execPath,
          [
            scriptPath,
            TEST_ISSUES.simple.url,
            '-o',
            withoutImages,
            '--no-download-images',
          ],
          options
        );

        const local = await fsPromises.readFile(withImages, 'utf8');
        const untouched = await fsPromises.readFile(withoutImages, 'utf8');
        expect(local).toMatch(/with-images-images[/\\]image-1\.png/);
        expect(local).not.toContain(url);
        assert.deepEqual(
          await fsPromises.readFile(
            path.join(testOutputDir, 'with-images-images', 'image-1.png')
          ),
          image
        );
        expect(untouched).toContain(url);
        expect(
          fs.existsSync(path.join(testOutputDir, 'without-images-images'))
        ).toBe(false);
      } finally {
        server.stop(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error for invalid URL', () => {
      assert.throws(() => runCli('invalid-url'), {
        status: 1,
        stdout: /Invalid issue URL/,
      });
    });

    it('should provide clear error when no URL is provided', () => {
      assert.throws(() => runCli(), {
        status: 1,
        stdout: /No issue URL provided/,
      });
    });
  });
});

describe('CLI Options Verification', () => {
  describe('Help Option', () => {
    it('should display comprehensive help', () => {
      const output = runCli('--help');

      // Check all expected options are documented
      expect(output).toContain('--token');
      expect(output).toContain('--output');
      expect(output).toContain('--format');
      expect(output).toContain('--download-images');
      expect(output).toContain('--verbose');
      expect(output).toContain('--use-api');
      expect(output).toContain('--help');
      expect(output).toContain('--version');
    });
  });

  describe('Version Option', () => {
    it('should display version in semver format', () => {
      const output = runCli('--version');

      // Should match semver pattern
      expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});

describe('Authentication Mode Tests', () => {
  describe('gh CLI Mode (default)', () => {
    it('should download issue using gh CLI by default', async () => {
      const outputPath = path.join(testOutputDir, 'gh-mode.md');

      runCli(TEST_ISSUES.simple.url, '-o', outputPath, '--no-download-images');

      const exists = fs.existsSync(outputPath);
      expect(exists).toBe(true);
    });
  });

  describe('API Mode', () => {
    it('should download issue using API when --use-api is specified', async () => {
      const outputPath = path.join(testOutputDir, 'api-mode.md');

      runCli(
        TEST_ISSUES.simple.url,
        '-o',
        outputPath,
        '--no-download-images',
        '--use-api'
      );

      const exists = fs.existsSync(outputPath);
      expect(exists).toBe(true);
    });

    it('should produce same content in both modes', async () => {
      const ghModePath = path.join(testOutputDir, 'mode-compare-gh.md');
      const apiModePath = path.join(testOutputDir, 'mode-compare-api.md');

      runCli(TEST_ISSUES.simple.url, '-o', ghModePath, '--no-download-images');

      runCli(
        TEST_ISSUES.simple.url,
        '-o',
        apiModePath,
        '--no-download-images',
        '--use-api'
      );

      const ghContent = await fsPromises.readFile(ghModePath, 'utf8');
      const apiContent = await fsPromises.readFile(apiModePath, 'utf8');

      // Both should contain the same issue title
      expect(ghContent.toLowerCase()).toContain('mvp');
      expect(apiContent.toLowerCase()).toContain('mvp');

      // Both should have the same core structure
      expect(ghContent).toContain('**Issue:**');
      expect(apiContent).toContain('**Issue:**');
      expect(ghContent).toContain('**Author:**');
      expect(apiContent).toContain('**Author:**');
    });
  });
});
