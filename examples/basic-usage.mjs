#!/usr/bin/env bun

/**
 * Basic usage example for gh-load-issue
 *
 * This example demonstrates how to use the gh-load-issue CLI tool
 * to download GitHub issues and convert them to markdown.
 */

import { execSync } from 'child_process';

// Example 1: Download a single issue
console.log('Example 1: Downloading issue #1...');
try {
  execSync('gh-load-issue 1', {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
} catch (error) {
  console.error('Failed to download issue:', error.message);
}

// Example 2: Download multiple issues
console.log('\nExample 2: Downloading multiple issues...');
try {
  execSync('gh-load-issue 1 2 3', {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
} catch (error) {
  console.error('Failed to download issues:', error.message);
}
