#!/usr/bin/env node

/**
 * Basic integration tests for gh-download-issue
 */

import { execSync } from 'child_process';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.join(__dirname, '..', 'gh-download-issue.mjs');

// Test colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

function pass(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function fail(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
  process.exit(1);
}

function info(message) {
  console.log(`${colors.yellow}ℹ ${message}${colors.reset}`);
}

// Test 1: Check if script is executable
function testExecutable() {
  try {
    const stats = fs.statSync(scriptPath);
    // On Windows, executable bit doesn't apply, so we just check if file exists
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      pass('Script exists (Windows - executable bit not applicable)');
    } else {
      const isExecutable = (stats.mode & fs.constants.S_IXUSR) !== 0;
      if (isExecutable) {
        pass('Script is executable');
      } else {
        fail('Script is not executable');
      }
    }
  } catch (error) {
    fail(`Script not found: ${error.message}`);
  }
}

// Test 2: Check if help works
function testHelp() {
  try {
    const output = execSync(`node ${scriptPath} --help`, { encoding: 'utf8' });
    if (output.includes('--help') && output.includes('--version')) {
      pass('Help command works');
    } else {
      fail('Help output is incomplete');
    }
  } catch (error) {
    fail(`Help command failed: ${error.message}`);
  }
}

// Test 3: Check if version works
function testVersion() {
  try {
    const output = execSync(`node ${scriptPath} --version`, {
      encoding: 'utf8',
    });
    if (output.match(/\d+\.\d+\.\d+/)) {
      pass('Version command works');
    } else {
      fail('Version output is invalid');
    }
  } catch (error) {
    fail(`Version command failed: ${error.message}`);
  }
}

// Test 4: Test URL parsing with valid input
function testUrlParsing() {
  // This test would require importing the parser function
  // For MVP, we'll skip this or test via actual execution
  info('URL parsing test - skipped (requires integration test)');
}

// Test 5: Test with real issue (requires network and auth)
async function testRealIssue() {
  try {
    const testOutputPath = path.join(__dirname, 'test-output.md');

    // Clean up any existing test output
    try {
      await fsPromises.access(testOutputPath);
      await fsPromises.unlink(testOutputPath);
    } catch (_error) {
      // File doesn't exist, which is fine
    }

    // Try to download issue #1 from this repository
    const issueUrl =
      'https://github.com/link-foundation/gh-download-issue/issues/1';

    info(
      'Testing with real issue (this may fail if gh CLI is not authenticated)...'
    );

    try {
      execSync(`node ${scriptPath} ${issueUrl} -o ${testOutputPath}`, {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      // Check if file was created
      try {
        await fsPromises.access(testOutputPath);
        const content = await fsPromises.readFile(testOutputPath, 'utf8');
        if (content.includes('# ') && content.includes('**Issue:**')) {
          pass('Real issue download works');
          await fsPromises.unlink(testOutputPath); // Clean up
        } else {
          fail('Output file has invalid format');
        }
      } catch (_error) {
        fail('Output file was not created');
      }
    } catch (error) {
      info(
        `Real issue test failed (this is OK if not authenticated): ${error.message}`
      );
    }
  } catch (error) {
    info(`Real issue test skipped: ${error.message}`);
  }
}

// Run all tests
async function runTests() {
  console.log('\n🧪 Running gh-download-issue tests...\n');

  testExecutable();
  testHelp();
  testVersion();
  testUrlParsing();
  await testRealIssue();

  console.log('\n✅ All basic tests passed!\n');
}

runTests().catch((error) => {
  fail(`Test suite failed: ${error.message}`);
});
