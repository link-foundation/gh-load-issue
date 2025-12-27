#!/usr/bin/env bun

/**
 * Test runner for gh-load-issue
 *
 * This file imports all test suites and runs them using test-anywhere.
 * Each runtime (Node.js, Bun, Deno) will execute tests using its native test runner.
 */

// Import all test modules - they will register their tests with test-anywhere
import './test-basic.test.mjs';
import './test-image-extraction.test.mjs';
