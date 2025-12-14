#!/usr/bin/env bun

/**
 * Test runner for gh-download-issue
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

console.log(
  `${colors.blue}=====================================${colors.reset}`
);
console.log(`${colors.blue}   gh-download-issue Test Suite${colors.reset}`);
console.log(
  `${colors.blue}=====================================${colors.reset}\n`
);

// List of test files to run
const tests = ['test-basic.mjs'];

let failed = false;

for (const test of tests) {
  const testPath = path.join(__dirname, test);
  console.log(`${colors.blue}Running ${test}...${colors.reset}`);

  try {
    execSync(`bun ${testPath}`, { stdio: 'inherit' });
    console.log(`${colors.green}✓ ${test} passed${colors.reset}\n`);
  } catch (_error) {
    console.log(`${colors.red}✗ ${test} failed${colors.reset}\n`);
    failed = true;
  }
}

if (failed) {
  console.log(`${colors.red}Some tests failed${colors.reset}`);
  process.exit(1);
} else {
  console.log(`${colors.green}All tests passed!${colors.reset}`);
  process.exit(0);
}
