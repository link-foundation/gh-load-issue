#!/usr/bin/env sh
':'; // # ; exec "$(command -v bun || command -v node)" "$0" "$@"

// Import built-in Node.js modules
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Download use-m dynamically with Windows path fix
const useMCode = await (await fetch('https://unpkg.com/use-m/use.js')).text();

// Patch use-m to handle Windows paths correctly in ESM imports
const patchedUseMCode = useMCode.replace(
  /const module = await import\(modulePath\);/,
  `// Fix Windows paths for ESM imports
  let importPath = modulePath;
  // Convert Windows absolute paths (C:\\...) to file:// URLs
  if (/^[A-Za-z]:[\\\\/]/.test(modulePath)) {
    // Windows path detected - convert backslashes to forward slashes and add file:// protocol
    importPath = 'file:///' + modulePath.replace(/\\\\/g, '/').replace(/^([A-Za-z]):/, '$1:');
  } else if (modulePath.startsWith('/') && !modulePath.startsWith('file://')) {
    // Unix absolute path - ensure it's a proper file:// URL
    importPath = 'file://' + modulePath;
  }
  const module = await import(importPath);`
);

const { use } = eval(patchedUseMCode);

// Import modern npm libraries using use-m
const { Octokit } = await use('@octokit/rest@22.0.0');
const fs = await use('fs-extra@11.3.0');
const { default: yargs } = await use('yargs@17.7.2');
const { hideBin } = await use('yargs@17.7.2/helpers');

// Get version from package.json or fallback
let version = '0.1.0'; // Fallback version

try {
  const packagePath = path.join(__dirname, 'package.json');
  if (await fs.pathExists(packagePath)) {
    const packageJson = await fs.readJson(packagePath);
    version = packageJson.version;
  }
} catch (_error) {
  // Use fallback version if package.json can't be read
}

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

const log = (color, message) =>
  console.log(`${colors[color]}${message}${colors.reset}`);

// Helper function to check if gh CLI is installed
async function isGhInstalled() {
  try {
    const { execSync } = await import('child_process');
    execSync('gh --version', { stdio: 'pipe' });
    return true;
  } catch (_error) {
    return false;
  }
}

// Helper function to get GitHub token from gh CLI if available
async function getGhToken() {
  try {
    if (!(await isGhInstalled())) {
      return null;
    }

    const { execSync } = await import('child_process');
    const token = execSync('gh auth token', {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
    return token;
  } catch (_error) {
    return null;
  }
}

// Parse GitHub issue URL to extract owner, repo, and issue number
function parseIssueUrl(url) {
  // Support both full URLs and short formats like "owner/repo#123"
  const fullUrlMatch = url.match(
    /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/
  );
  if (fullUrlMatch) {
    return {
      owner: fullUrlMatch[1],
      repo: fullUrlMatch[2],
      issueNumber: parseInt(fullUrlMatch[3], 10),
    };
  }

  const shortMatch = url.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
      issueNumber: parseInt(shortMatch[3], 10),
    };
  }

  return null;
}

// Fetch issue data from GitHub API
async function fetchIssue(owner, repo, issueNumber, token) {
  try {
    log('blue', `🔍 Fetching issue #${issueNumber} from ${owner}/${repo}...`);

    const octokit = new Octokit({
      auth: token,
      baseUrl: 'https://api.github.com',
    });

    // Fetch the issue
    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    // Fetch comments
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
    });

    log(
      'green',
      `✅ Successfully fetched issue with ${comments.length} comments`
    );

    return { issue, comments };
  } catch (error) {
    if (error.status === 404) {
      log('red', `❌ Issue #${issueNumber} not found in ${owner}/${repo}`);
    } else if (error.status === 401) {
      log(
        'red',
        `❌ Authentication failed. Please provide a valid GitHub token`
      );
    } else {
      log('red', `❌ Failed to fetch issue: ${error.message}`);
    }
    throw error;
  }
}

// Convert issue to markdown format
function issueToMarkdown(issueData, _commentsData) {
  const { issue, comments } = issueData;
  let markdown = '';

  // Title
  markdown += `# ${issue.title}\n\n`;

  // Metadata
  markdown += `**Issue:** [#${issue.number}](${issue.html_url})  \n`;
  markdown += `**Author:** [@${issue.user.login}](${issue.user.html_url})  \n`;
  markdown += `**State:** ${issue.state}  \n`;
  markdown += `**Created:** ${new Date(issue.created_at).toLocaleString()}  \n`;
  markdown += `**Updated:** ${new Date(issue.updated_at).toLocaleString()}  \n`;

  if (issue.labels && issue.labels.length > 0) {
    const labels = issue.labels.map((label) => `\`${label.name}\``).join(', ');
    markdown += `**Labels:** ${labels}  \n`;
  }

  if (issue.assignees && issue.assignees.length > 0) {
    const assignees = issue.assignees
      .map((a) => `[@${a.login}](${a.html_url})`)
      .join(', ');
    markdown += `**Assignees:** ${assignees}  \n`;
  }

  if (issue.milestone) {
    markdown += `**Milestone:** [${issue.milestone.title}](${issue.milestone.html_url})  \n`;
  }

  markdown += '\n---\n\n';

  // Body
  if (issue.body) {
    markdown += '## Description\n\n';
    markdown += issue.body;
    markdown += '\n\n';
  }

  // Comments
  if (comments && comments.length > 0) {
    markdown += '---\n\n';
    markdown += `## Comments (${comments.length})\n\n`;

    comments.forEach((comment, index) => {
      markdown += `### Comment ${index + 1} by [@${comment.user.login}](${comment.user.html_url})\n\n`;
      markdown += `*Posted on ${new Date(comment.created_at).toLocaleString()}*\n\n`;
      markdown += comment.body;
      markdown += '\n\n---\n\n';
    });
  }

  return markdown;
}

// Configure CLI arguments
const scriptName = path.basename(process.argv[1]);

async function main() {
  // Check for --help or --version before yargs parsing due to use-m async loading issues
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: ${scriptName} <issue-url> [options]

Positionals:
  issue  GitHub issue URL or short format (owner/repo#123)              [string]

Options:
      --version  Show version number                                   [boolean]
  -t, --token    GitHub personal access token (optional for public issues)
                                                                         [string]
  -o, --output   Output file path (default: issue-<number>.md in current
                 directory)                                             [string]
  -h, --help     Show help                                             [boolean]

Examples:
  ${scriptName} https://github.com/owner/repo/issues/123  Download issue #123
  ${scriptName} owner/repo#123                             Download issue #123 using short format
  ${scriptName} owner/repo#123 -o my-issue.md              Save to specific file
  ${scriptName} owner/repo#123 --token ghp_xxx             Use specific GitHub token`);
    process.exit(0);
  }

  if (args.includes('--version')) {
    console.log(version);
    process.exit(0);
  }

  // Create yargs instance with proper configuration
  const yargsInstance = yargs(hideBin(process.argv))
    .scriptName(scriptName)
    .version(version)
    .usage('Usage: $0 <issue-url> [options]')
    .command(
      '$0 [issue]',
      'Download a GitHub issue and convert it to markdown',
      (yargs) => {
        yargs.positional('issue', {
          describe: 'GitHub issue URL or short format (owner/repo#123)',
          type: 'string',
        });
      }
    )
    .option('token', {
      alias: 't',
      type: 'string',
      describe: 'GitHub personal access token (optional for public issues)',
      default: process.env.GITHUB_TOKEN,
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      describe:
        'Output file path (default: issue-<number>.md in current directory)',
    })
    .help(false) // Disable yargs built-in help since we handle it manually
    .version(false) // Disable yargs built-in version since we handle it manually
    .example(
      '$0 https://github.com/owner/repo/issues/123',
      'Download issue #123'
    )
    .example('$0 owner/repo#123', 'Download issue #123 using short format')
    .example('$0 owner/repo#123 -o my-issue.md', 'Save to specific file')
    .example('$0 owner/repo#123 --token ghp_xxx', 'Use specific GitHub token');

  const argv = await yargsInstance.parseAsync();

  const { issue: issueInput, output } = argv;
  let { token } = argv;

  // Check if issue URL was provided
  if (!issueInput) {
    log('red', '❌ No issue URL provided');
    log(
      'yellow',
      '   Expected: https://github.com/owner/repo/issues/123 or owner/repo#123'
    );
    log('yellow', '   Run with --help for more information');
    process.exit(1);
  }

  // Parse the issue URL
  const parsed = parseIssueUrl(issueInput);
  if (!parsed) {
    log('red', '❌ Invalid issue URL or format');
    log(
      'yellow',
      '   Expected: https://github.com/owner/repo/issues/123 or owner/repo#123'
    );
    process.exit(1);
  }

  const { owner, repo, issueNumber } = parsed;

  // If no token provided, try to get it from gh CLI
  if (!token || token === undefined) {
    const ghToken = await getGhToken();
    if (ghToken) {
      token = ghToken;
      log('cyan', '🔑 Using GitHub token from gh CLI');
    }
  }

  // Fetch the issue
  let issueData;
  try {
    issueData = await fetchIssue(owner, repo, issueNumber, token);
  } catch (_error) {
    process.exit(1);
  }

  // Convert to markdown
  log('blue', '📝 Converting to markdown...');
  const markdown = issueToMarkdown(issueData);

  // Determine output file path
  const outputPath =
    output || path.join(process.cwd(), `issue-${issueNumber}.md`);

  // Write to file
  try {
    await fs.writeFile(outputPath, markdown, 'utf8');
    log('green', `✅ Issue saved to: ${outputPath}`);
  } catch (error) {
    log('red', `❌ Failed to write file: ${error.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  log('red', `💥 Script failed: ${error.message}`);
  process.exit(1);
});
