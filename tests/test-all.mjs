#!/usr/bin/env node

/**
 * Test runner for gh-download-issue
 *
 * This file imports all test suites and runs them using test-anywhere.
 * Each runtime (Node.js, Bun, Deno) will execute tests using its native test runner.
 */

// Import all test modules - they will register their tests with test-anywhere
import './test-basic.mjs';
import './test-image-extraction.mjs';
