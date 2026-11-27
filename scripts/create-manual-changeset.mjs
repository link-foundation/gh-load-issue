#!/usr/bin/env bun

/**
 * Create a changeset file for manual releases
 * Usage: node scripts/create-manual-changeset.mjs --bump-type <major|minor|patch> [--description <description>]
 *
 * IMPORTANT: Update the PACKAGE_NAME constant below to match your package.json
 */

import { execFileSync } from 'node:child_process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const { name: packageName } = JSON.parse(readFileSync('package.json', 'utf8'));

const config = yargs(hideBin(process.argv))
  .option('bump-type', {
    type: 'string',
    default: process.env.BUMP_TYPE || '',
    describe: 'Version bump type: major, minor, or patch',
    choices: ['major', 'minor', 'patch'],
  })
  .option('description', {
    type: 'string',
    default: process.env.DESCRIPTION || '',
    describe: 'Description for the changeset',
  })
  .strict()
  .parse();

try {
  const { bumpType, description: descriptionArg } = config;

  // Use provided description or default based on bump type
  const description = descriptionArg || `Manual ${bumpType} release`;

  if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
    console.error(
      'Usage: node scripts/create-manual-changeset.mjs --bump-type <major|minor|patch> [--description <description>]'
    );
    process.exit(1);
  }

  // Generate a random changeset ID
  const changesetId = randomBytes(4).toString('hex');
  const changesetFile = `.changeset/manual-release-${changesetId}.md`;

  // Create the changeset file with single quotes to match Prettier config
  const content = `---
'${packageName}': ${bumpType}
---

${description}
`;

  writeFileSync(changesetFile, content, 'utf-8');

  console.log(`Created changeset: ${changesetFile}`);
  console.log('Content:');
  console.log(content);

  // Format with Prettier
  console.log('\nFormatting with Prettier...');
  execFileSync(
    'npm',
    ['exec', '--no', '--', 'prettier', '--write', changesetFile],
    { stdio: 'inherit' }
  );

  console.log('\n✅ Changeset created and formatted successfully');
} catch (error) {
  console.error('Error creating changeset:', error.message);
  if (process.env.RELEASE_DEBUG === '1') {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
