#!/usr/bin/env bun

/**
 * Basic integration tests for gh-load-issue
 */

import { describe, it, expect, setDefaultTimeout } from 'test-anywhere';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Set timeout to 30 seconds for real issue download tests (Windows can be slow)
setDefaultTimeout(30000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.join(__dirname, '..', 'gh-load-issue.mjs');

describe('gh-load-issue CLI', () => {
  describe('Script accessibility', () => {
    it('should exist and be accessible', () => {
      const stats = fs.statSync(scriptPath);
      expect(stats.isFile()).toBe(true);
    });

    it('should be executable on non-Windows platforms', () => {
      const stats = fs.statSync(scriptPath);
      const isWindows = process.platform === 'win32';

      if (isWindows) {
        // On Windows, executable bit doesn't apply
        expect(stats.isFile()).toBe(true);
      } else {
        const isExecutable = (stats.mode & fs.constants.S_IXUSR) !== 0;
        expect(isExecutable).toBe(true);
      }
    });
  });

  describe('Help command', () => {
    it('should display help information', () => {
      const output = execFileSync(process.execPath, [scriptPath, '--help'], {
        encoding: 'utf8',
      });
      expect(output).toContain('--help');
      expect(output).toContain('--version');
    });
  });

  describe('Version command', () => {
    it('should display version number', () => {
      const output = execFileSync(process.execPath, [scriptPath, '--version'], {
        encoding: 'utf8',
      });
      expect(output).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('Real issue download', () => {
    it('should download a real issue', async () => {
      const dir = await fsPromises.mkdtemp(
        path.join(tmpdir(), 'gh-load-issue-basic-')
      );
      const testOutputPath = path.join(dir, 'issue.md');
      try {
        const issueUrl =
          'https://github.com/link-foundation/gh-load-issue/issues/1';

        execFileSync(
          process.execPath,
          [scriptPath, issueUrl, '-o', testOutputPath, '--no-download-images'],
          {
            encoding: 'utf8',
            stdio: 'pipe',
          }
        );

        // Check if file was created
        await fsPromises.access(testOutputPath);
        const content = await fsPromises.readFile(testOutputPath, 'utf8');

        expect(content).toContain('# ');
        expect(content).toContain('**Issue:**');
      } finally {
        await fsPromises.rm(dir, { recursive: true, force: true });
      }
    });
  });
});
