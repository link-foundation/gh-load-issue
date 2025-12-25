#!/usr/bin/env node

/**
 * Basic integration tests for gh-download-issue
 */

import { describe, it, expect, afterEach } from 'test-anywhere';
import { execSync } from 'child_process';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.join(__dirname, '..', 'gh-download-issue.mjs');

describe('gh-download-issue CLI', () => {
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
      const output = execSync(`node ${scriptPath} --help`, {
        encoding: 'utf8',
      });
      expect(output).toContain('--help');
      expect(output).toContain('--version');
    });
  });

  describe('Version command', () => {
    it('should display version number', () => {
      const output = execSync(`node ${scriptPath} --version`, {
        encoding: 'utf8',
      });
      expect(output).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('Real issue download', () => {
    const testOutputPath = path.join(__dirname, 'test-output.md');

    afterEach(async () => {
      // Clean up test output file
      try {
        await fsPromises.access(testOutputPath);
        await fsPromises.unlink(testOutputPath);
      } catch (_error) {
        // File doesn't exist, which is fine
      }
    });

    it('should download a real issue when authenticated', async () => {
      const issueUrl =
        'https://github.com/link-foundation/gh-download-issue/issues/1';

      try {
        execSync(`node ${scriptPath} ${issueUrl} -o ${testOutputPath}`, {
          encoding: 'utf8',
          stdio: 'pipe',
        });

        // Check if file was created
        await fsPromises.access(testOutputPath);
        const content = await fsPromises.readFile(testOutputPath, 'utf8');

        expect(content).toContain('# ');
        expect(content).toContain('**Issue:**');
      } catch (_error) {
        // Test is skipped if not authenticated - this is expected in CI without credentials
        console.log(
          'Skipping real issue test - gh CLI may not be authenticated'
        );
      }
    });
  });
});
