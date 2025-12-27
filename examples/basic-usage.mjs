#!/usr/bin/env bun

/**
 * Usage examples for gh-load-issue
 *
 * This file demonstrates how to use gh-load-issue as both a CLI tool and a library.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CLI USAGE EXAMPLES
// ============================================================================

console.log('=== CLI Usage Examples ===\n');

// Example 1: Download a single issue using CLI
console.log('Example 1: Downloading issue using CLI...');
try {
  execSync(
    'bun ../gh-load-issue.mjs https://github.com/link-foundation/gh-load-issue/issues/1 -o ./output',
    {
      cwd: __dirname,
      stdio: 'inherit',
    }
  );
} catch (error) {
  console.error('Failed to download issue:', error.message);
}

// ============================================================================
// LIBRARY USAGE EXAMPLES
// ============================================================================

console.log('\n=== Library Usage Examples ===\n');

// Import the library functions
const modulePath = path.join(__dirname, '..', 'gh-load-issue.mjs');
const { loadIssue, parseIssueUrl, extractImagesFromMarkdown } = await import(
  modulePath
);

// Example 2: Parse issue URL
console.log('Example 2: Parsing issue URLs...');
const parsed1 = parseIssueUrl('https://github.com/owner/repo/issues/123');
console.log('Full URL:', parsed1);

const parsed2 = parseIssueUrl('owner/repo#456');
console.log('Short format:', parsed2);

// Example 3: Extract images from markdown content
console.log('\nExample 3: Extracting images from markdown...');
const markdown = `
  Here is some text with images:
  ![screenshot](https://example.com/screenshot.png)
  <img src="https://example.com/photo.jpg" alt="photo" />
`;
const images = extractImagesFromMarkdown(markdown);
console.log('Found images:', images);

// Example 4: Load an issue programmatically
console.log('\nExample 4: Loading issue via library API...');
try {
  const result = await loadIssue({
    issueUrl: 'link-foundation/gh-load-issue#1',
    quiet: true, // Suppress console output
  });

  console.log('Issue loaded successfully!');
  console.log('  - Owner:', result.owner);
  console.log('  - Repo:', result.repo);
  console.log('  - Issue #:', result.issueNumber);
  console.log('  - Title:', result.issue.title);
  console.log('  - State:', result.issue.state);
  console.log('  - Comments:', result.comments.length);
  console.log('  - Markdown length:', result.markdown.length, 'chars');
} catch (error) {
  console.error('Failed to load issue:', error.message);
}

console.log('\n=== Examples complete! ===');
