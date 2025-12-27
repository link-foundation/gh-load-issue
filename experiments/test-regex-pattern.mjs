#!/usr/bin/env bun

/**
 * Test script to verify the regex pattern works for all changeset types
 */

// Test the regex pattern with different types of changes
const changesPattern =
  /### (Major|Minor|Patch) Changes\s*\n\s*-\s+(?:([a-f0-9]+):\s+)?(.+?)$/s;

// Test cases
const testCases = [
  {
    name: 'Patch Changes with commit hash',
    input: `### Patch Changes

- abc1234: Fix a bug in the release script`,
    expected: {
      changeType: 'Patch',
      commitHash: 'abc1234',
      description: 'Fix a bug in the release script',
    },
  },
  {
    name: 'Minor Changes with commit hash',
    input: `### Minor Changes

- 2bcef5f: Add support for google/gemini-3-pro model alias
  - Added \`google/gemini-3-pro\` as an alias to \`gemini-3-pro-preview\`
  - Updated README.md with Google Gemini usage examples`,
    expected: {
      changeType: 'Minor',
      commitHash: '2bcef5f',
      description: `Add support for google/gemini-3-pro model alias
  - Added \`google/gemini-3-pro\` as an alias to \`gemini-3-pro-preview\`
  - Updated README.md with Google Gemini usage examples`,
    },
  },
  {
    name: 'Major Changes with commit hash',
    input: `### Major Changes

- def5678: Breaking change to API structure`,
    expected: {
      changeType: 'Major',
      commitHash: 'def5678',
      description: 'Breaking change to API structure',
    },
  },
  {
    name: 'Patch Changes without commit hash',
    input: `### Patch Changes

- Fix a bug in the release script`,
    expected: {
      changeType: 'Patch',
      commitHash: null,
      description: 'Fix a bug in the release script',
    },
  },
  {
    name: 'Minor Changes without commit hash',
    input: `### Minor Changes

- Add new feature for users`,
    expected: {
      changeType: 'Minor',
      commitHash: null,
      description: 'Add new feature for users',
    },
  },
];

console.log('🧪 Testing regex pattern for changeset types\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`Testing: ${testCase.name}`);

  const match = testCase.input.match(changesPattern);

  if (!match) {
    console.log('  ❌ Pattern did not match!');
    console.log(`  Input: ${JSON.stringify(testCase.input)}`);
    failed++;
    continue;
  }

  const [, changeType, commitHash, rawDescription] = match;

  // Handle case where commit hash might be in the description
  let finalCommitHash = commitHash;
  let finalDescription = rawDescription;

  if (!commitHash && rawDescription) {
    const descWithHashMatch = rawDescription.match(/^([a-f0-9]+):\s+(.+)$/s);
    if (descWithHashMatch) {
      [, finalCommitHash, finalDescription] = descWithHashMatch;
    }
  }

  const result = {
    changeType,
    commitHash: finalCommitHash || null,
    description: finalDescription,
  };

  // Compare results
  const changeTypeMatch = result.changeType === testCase.expected.changeType;
  const commitHashMatch = result.commitHash === testCase.expected.commitHash;
  const descriptionMatch = result.description === testCase.expected.description;

  if (changeTypeMatch && commitHashMatch && descriptionMatch) {
    console.log('  ✅ Passed');
    passed++;
  } else {
    console.log('  ❌ Failed');
    console.log(`  Expected: ${JSON.stringify(testCase.expected, null, 2)}`);
    console.log(`  Got:      ${JSON.stringify(result, null, 2)}`);
    failed++;
  }

  console.log();
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
