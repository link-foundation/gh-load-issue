#!/usr/bin/env bun
// gh-load-issue - Download GitHub issues to markdown (CLI and library)

import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import { Octokit } from '@octokit/rest';
import fs from 'fs-extra';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let version = '0.1.0';
try {
  const pkgPath = path.join(__dirname, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    version = (await fs.readJson(pkgPath)).version;
  }
} catch (_e) {
  /* use fallback */
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

// Verbose logging state
let verboseMode = false;

const log = (color, message) =>
  console.log(`${colors[color]}${message}${colors.reset}`);

const logVerbose = (color, message) => {
  if (verboseMode) {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }
};

// Helper function to check if gh CLI is installed and authenticated
async function isGhAvailable() {
  try {
    const { execSync } = await import('child_process');
    execSync('gh --version', { stdio: 'pipe' });
    // Also check if authenticated
    execSync('gh auth status', { stdio: 'pipe' });
    return true;
  } catch (_error) {
    return false;
  }
}

// Helper function to get GitHub token from gh CLI if available
async function getGhToken() {
  try {
    if (!(await isGhAvailable())) {
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

// Fetch issue data using gh CLI (preferred method)
async function fetchIssueWithGh(owner, repo, issueNumber) {
  const { execSync } = await import('child_process');

  // Fetch issue with all required fields
  const issueJson = execSync(
    `gh issue view ${issueNumber} --repo ${owner}/${repo} --json number,title,body,state,author,createdAt,updatedAt,labels,assignees,milestone,comments,url`,
    { encoding: 'utf8', stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 }
  );

  const ghIssue = JSON.parse(issueJson);

  // Transform gh CLI format to match Octokit API format for compatibility
  const issue = {
    number: ghIssue.number,
    title: ghIssue.title,
    body: ghIssue.body,
    state: ghIssue.state.toLowerCase(),
    html_url: ghIssue.url,
    user: {
      login: ghIssue.author.login,
      html_url: `https://github.com/${ghIssue.author.login}`,
    },
    created_at: ghIssue.createdAt,
    updated_at: ghIssue.updatedAt,
    labels: ghIssue.labels.map((l) => ({
      name: l.name,
      color: l.color || '',
      description: l.description || '',
    })),
    assignees: ghIssue.assignees.map((a) => ({
      login: a.login,
      html_url: `https://github.com/${a.login}`,
    })),
    milestone: ghIssue.milestone
      ? {
          title: ghIssue.milestone.title,
          html_url: `https://github.com/${owner}/${repo}/milestone/${ghIssue.milestone.number}`,
        }
      : null,
  };

  // Transform comments to match Octokit format
  const comments = (ghIssue.comments || []).map((c) => ({
    id: c.id,
    body: c.body,
    user: {
      login: c.author.login,
      html_url: `https://github.com/${c.author.login}`,
    },
    created_at: c.createdAt,
    updated_at: c.updatedAt || c.createdAt,
  }));

  return { issue, comments };
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

// Validate image by checking magic bytes (PNG, JPEG, GIF, WebP, BMP, ICO, SVG)
// eslint-disable-next-line complexity
function validateImageBytes(buffer) {
  if (!buffer || buffer.length < 4) {
    return { valid: false, type: null, reason: 'Buffer too small' };
  }
  const b = [...buffer.slice(0, 12)];
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { valid: true, type: 'png' };
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { valid: true, type: 'jpeg' };
  }
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return { valid: true, type: 'gif' };
  }
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    buffer.length >= 12 &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { valid: true, type: 'webp' };
  }
  if (b[0] === 0x42 && b[1] === 0x4d) {
    return { valid: true, type: 'bmp' };
  }
  if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) {
    return { valid: true, type: 'ico' };
  }
  const txt = buffer.slice(0, 100).toString('utf8').trim().toLowerCase();
  if (txt.startsWith('<?xml') || txt.startsWith('<svg')) {
    return { valid: true, type: 'svg' };
  }
  if (
    txt.includes('<!doctype html') ||
    txt.includes('<html') ||
    txt.includes('404')
  ) {
    return {
      valid: false,
      type: 'html',
      reason: 'Received HTML instead of image',
    };
  }

  return { valid: false, type: null, reason: 'Unknown file format' };
}

// Get file extension from image type
function getExtensionForType(type) {
  const extensions = {
    png: '.png',
    jpeg: '.jpg',
    gif: '.gif',
    webp: '.webp',
    bmp: '.bmp',
    ico: '.ico',
    svg: '.svg',
  };
  return extensions[type] || '.bin';
}

// Extract images from markdown content
function extractImagesFromMarkdown(content) {
  const images = [];

  if (!content) {
    return images;
  }

  // Match markdown image syntax: ![alt](url) or ![alt](url "title")
  const markdownImageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;

  while ((match = markdownImageRegex.exec(content)) !== null) {
    images.push({
      original: match[0],
      alt: match[1],
      url: match[2],
      type: 'markdown',
    });
  }

  // Match HTML img tags: <img src="url" ... /> or <img src="url" ... >
  const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*\/?>/gi;
  while ((match = htmlImageRegex.exec(content)) !== null) {
    images.push({
      original: match[0],
      alt: '',
      url: match[1],
      type: 'html',
    });
  }

  return images;
}

// Download image with redirect and authentication support
function downloadImage(url, token, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const headers = {
      'User-Agent': 'gh-load-issue',
      Accept: 'image/*,*/*',
    };

    // Add authorization for GitHub URLs
    if (
      token &&
      (parsedUrl.hostname.includes('github.com') ||
        parsedUrl.hostname.includes('githubusercontent.com') ||
        parsedUrl.hostname.includes('github.githubassets.com'))
    ) {
      headers.Authorization = `Bearer ${token}`;
    }

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers,
    };

    logVerbose('dim', `  Downloading from: ${url}`);

    const req = protocol.request(options, (res) => {
      // Handle redirects
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        logVerbose('dim', `  Following redirect to: ${res.headers.location}`);
        let redirectUrl = res.headers.location;

        // Handle relative redirects
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = new URL(redirectUrl, url).href;
        }

        downloadImage(redirectUrl, token, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// Download all images from content and save to directory
// eslint-disable-next-line complexity
async function downloadImages(content, imageDir, token, quiet = false) {
  const images = extractImagesFromMarkdown(content);
  const imageMap = new Map();
  const results = { downloaded: [], failed: [], skipped: [] };
  if (images.length === 0) {
    return { imageMap, results };
  }
  if (!quiet) {
    log('blue', `📷 Found ${images.length} image(s) to download...`);
  }
  await fs.ensureDir(imageDir);

  let idx = 0;
  for (const img of images) {
    idx++;
    const url = img.url;
    if (imageMap.has(url)) {
      if (!quiet) {
        logVerbose('dim', `  Skipping duplicate: ${url}`);
      }
      results.skipped.push({ url, reason: 'duplicate' });
      continue;
    }
    if (url.startsWith('data:')) {
      if (!quiet) {
        logVerbose('dim', `  Skipping data URL`);
      }
      results.skipped.push({ url, reason: 'data URL' });
      continue;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (!quiet) {
        logVerbose('yellow', `  Skipping non-HTTP URL: ${url}`);
      }
      results.skipped.push({ url, reason: 'non-HTTP URL' });
      continue;
    }
    try {
      if (!quiet) {
        logVerbose(
          'blue',
          `  [${idx}/${images.length}] Downloading: ${url.substring(0, 80)}...`
        );
      }
      const buffer = await downloadImage(url, token);
      const v = validateImageBytes(buffer);
      if (!v.valid) {
        if (!quiet) {
          log(
            'yellow',
            `⚠️  Invalid image (${v.reason}): ${url.substring(0, 60)}...`
          );
        }
        results.failed.push({ url, reason: v.reason });
        continue;
      }
      const ext = getExtensionForType(v.type);
      const filename = `image-${idx}${ext}`;
      const localPath = path.join(imageDir, filename);
      await fs.writeFile(localPath, buffer);
      imageMap.set(url, {
        localPath,
        relativePath: path.join(path.basename(imageDir), filename),
        type: v.type,
        size: buffer.length,
      });
      results.downloaded.push({
        url,
        localPath,
        type: v.type,
        size: buffer.length,
      });
      if (!quiet) {
        logVerbose(
          'green',
          `  ✓ Saved as ${filename} (${v.type}, ${buffer.length} bytes)`
        );
      }
    } catch (e) {
      if (!quiet) {
        log('yellow', `⚠️  Failed to download image: ${e.message}`);
        logVerbose('dim', `     URL: ${url}`);
      }
      results.failed.push({ url, reason: e.message });
    }
  }
  if (!quiet && results.downloaded.length > 0) {
    log('green', `✅ Downloaded ${results.downloaded.length} image(s)`);
  }
  if (!quiet && results.failed.length > 0) {
    log('yellow', `⚠️  Failed to download ${results.failed.length} image(s)`);
  }
  return { imageMap, results };
}

// Replace image URLs in content with local paths
function replaceImageUrls(content, imageMap) {
  let updatedContent = content;

  for (const [originalUrl, imageInfo] of imageMap) {
    // Replace in markdown syntax
    const markdownRegex = new RegExp(
      `(!\\[[^\\]]*\\]\\()${escapeRegex(originalUrl)}((?:\\s+"[^"]*")?\\))`,
      'g'
    );
    updatedContent = updatedContent.replace(
      markdownRegex,
      `$1${imageInfo.relativePath}$2`
    );

    // Replace in HTML img tags
    const htmlRegex = new RegExp(
      `(<img[^>]+src=["'])${escapeRegex(originalUrl)}(["'])`,
      'gi'
    );
    updatedContent = updatedContent.replace(
      htmlRegex,
      `$1${imageInfo.relativePath}$2`
    );
  }

  return updatedContent;
}

// Escape special regex characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Fetch issue data from GitHub API using Octokit (fallback method)
async function fetchIssueWithOctokit(owner, repo, issueNumber, token) {
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

  return { issue, comments };
}

// Fetch issue data - uses gh CLI by default, falls back to Octokit API
// eslint-disable-next-line complexity
async function fetchIssue(
  owner,
  repo,
  issueNumber,
  token,
  useApi = false,
  quiet = false
) {
  if (!quiet) {
    log('blue', `🔍 Fetching issue #${issueNumber} from ${owner}/${repo}...`);
  }

  try {
    let issueData;
    const ghAvailable = await isGhAvailable();
    if (!useApi && ghAvailable) {
      if (!quiet) {
        logVerbose('cyan', '🔑 Using gh CLI for authentication');
      }
      issueData = await fetchIssueWithGh(owner, repo, issueNumber);
    } else if (token) {
      if (!quiet) {
        logVerbose('cyan', '🔑 Using Octokit API with token');
      }
      issueData = await fetchIssueWithOctokit(owner, repo, issueNumber, token);
    } else if (ghAvailable) {
      if (!quiet) {
        logVerbose('cyan', '🔑 Falling back to gh CLI (no token provided)');
      }
      issueData = await fetchIssueWithGh(owner, repo, issueNumber);
    } else {
      if (!quiet) {
        logVerbose('cyan', '🔑 Using Octokit API without authentication');
      }
      issueData = await fetchIssueWithOctokit(
        owner,
        repo,
        issueNumber,
        undefined
      );
    }
    if (!quiet) {
      log(
        'green',
        `✅ Successfully fetched issue with ${issueData.comments.length} comments`
      );
    }
    return issueData;
  } catch (error) {
    if (!quiet) {
      const is404 =
        error.status === 404 || error.message?.includes('not found');
      const is401 = error.status === 401 || error.message?.includes('auth');
      if (is404) {
        log('red', `❌ Issue #${issueNumber} not found in ${owner}/${repo}`);
      } else if (is401) {
        log(
          'red',
          `❌ Auth failed. Run 'gh auth login' or provide a valid token`
        );
      } else {
        log('red', `❌ Failed to fetch issue: ${error.message}`);
      }
    }
    throw error;
  }
}

// Convert issue to markdown format
function issueToMarkdown(issueData, imageMap = null) {
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
    let body = issue.body;
    if (imageMap && imageMap.size > 0) {
      body = replaceImageUrls(body, imageMap);
    }
    markdown += body;
    markdown += '\n\n';
  }

  // Comments
  if (comments && comments.length > 0) {
    markdown += '---\n\n';
    markdown += `## Comments (${comments.length})\n\n`;

    comments.forEach((comment, index) => {
      markdown += `### Comment ${index + 1} by [@${comment.user.login}](${comment.user.html_url})\n\n`;
      markdown += `*Posted on ${new Date(comment.created_at).toLocaleString()}*\n\n`;
      let commentBody = comment.body;
      if (imageMap && imageMap.size > 0) {
        commentBody = replaceImageUrls(commentBody, imageMap);
      }
      markdown += commentBody;
      markdown += '\n\n---\n\n';
    });
  }

  return markdown;
}

// Convert issue to JSON format
function issueToJson(issueData, imageResults = null) {
  const { issue, comments } = issueData;

  return {
    issue: {
      number: issue.number,
      title: issue.title,
      state: issue.state,
      html_url: issue.html_url,
      author: {
        login: issue.user.login,
        html_url: issue.user.html_url,
      },
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      labels: issue.labels.map((l) => ({
        name: l.name,
        color: l.color,
        description: l.description,
      })),
      assignees: issue.assignees.map((a) => ({
        login: a.login,
        html_url: a.html_url,
      })),
      milestone: issue.milestone
        ? {
            title: issue.milestone.title,
            html_url: issue.milestone.html_url,
          }
        : null,
      body: issue.body,
    },
    comments: comments.map((comment) => ({
      id: comment.id,
      author: {
        login: comment.user.login,
        html_url: comment.user.html_url,
      },
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      body: comment.body,
    })),
    images: imageResults || null,
    metadata: {
      downloaded_at: new Date().toISOString(),
      tool_version: version,
    },
  };
}

// ============================================================================
// LIBRARY API - Exported functions for programmatic use
// ============================================================================

/**
 * Load a GitHub issue and return structured data (library API)
 * @param {Object} opts - { issueUrl, token?, downloadImages?, imageDir?, quiet?, useApi? }
 * @returns {Promise<Object>} Issue data with markdown and json representations
 */
export async function loadIssue({
  issueUrl,
  token = null,
  downloadImages = false,
  imageDir = null,
  quiet = true,
  useApi = false,
}) {
  const parsed = parseIssueUrl(issueUrl);
  if (!parsed) {
    throw new Error(`Invalid issue URL: ${issueUrl}`);
  }
  const { owner, repo, issueNumber } = parsed;
  // Only get token if we need to use API and no token is provided
  if (useApi && !token) {
    token = await getGhToken();
  }
  const oldVerbose = verboseMode;
  if (quiet) {
    verboseMode = false;
  }
  const issueData = await fetchIssue(
    owner,
    repo,
    issueNumber,
    token,
    useApi,
    quiet
  );
  let imageMap = null,
    imageResults = null;
  if (downloadImages && imageDir) {
    let content = issueData.issue.body || '';
    issueData.comments.forEach((c) => {
      content += `\n${c.body || ''}`;
    });
    // Get token for image downloads if needed
    const imageToken = token || (await getGhToken());
    const r = await downloadImages(content, imageDir, imageToken, true);
    imageMap = r.imageMap;
    imageResults = r.results;
  }
  verboseMode = oldVerbose;
  return {
    owner,
    repo,
    issueNumber,
    issue: issueData.issue,
    comments: issueData.comments,
    markdown: issueToMarkdown(issueData, imageMap),
    json: issueToJson(issueData, imageResults),
    images: imageResults,
  };
}

// Export utility functions for library use
export {
  parseIssueUrl,
  issueToMarkdown,
  issueToJson,
  extractImagesFromMarkdown,
};

// ============================================================================
// CLI IMPLEMENTATION
// ============================================================================

// Configure CLI arguments
const scriptName = path.basename(process.argv[1] || 'gh-load-issue');

// eslint-disable-next-line complexity, max-lines-per-function, max-statements
async function main() {
  // Check for --help or --version before yargs parsing for faster response
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: ${scriptName} <issue-url> [options]

Positionals:
  issue  GitHub issue URL or short format (owner/repo#123)              [string]

Options:
      --version          Show version number                           [boolean]
  -t, --token            GitHub personal access token (optional for public
                         issues)                                        [string]
  -o, --output           Output directory or file path (default: current
                         directory)                                     [string]
      --download-images  Download embedded images (default: true)      [boolean]
  -f, --format           Output format: markdown, json (default: markdown)
                                                                        [string]
  -v, --verbose          Enable verbose logging                        [boolean]
      --use-api          Use GitHub API instead of gh CLI (default: false)
                                                                       [boolean]
  -h, --help             Show help                                     [boolean]

Examples:
  ${scriptName} https://github.com/owner/repo/issues/123  Download issue #123
  ${scriptName} owner/repo#123                             Download issue #123 using short format
  ${scriptName} owner/repo#123 -o my-issue.md              Save to specific file
  ${scriptName} owner/repo#123 --token ghp_xxx             Use specific GitHub token
  ${scriptName} owner/repo#123 --format json               Export as JSON
  ${scriptName} owner/repo#123 --no-download-images        Skip image download
  ${scriptName} owner/repo#123 --use-api                   Use GitHub API instead of gh CLI`);
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
      describe: 'Output directory or file path (default: current directory)',
    })
    .option('download-images', {
      type: 'boolean',
      describe: 'Download embedded images (default: true)',
      default: true,
    })
    .option('format', {
      alias: 'f',
      type: 'string',
      describe: 'Output format: markdown, json (default: markdown)',
      choices: ['markdown', 'json'],
      default: 'markdown',
    })
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      describe: 'Enable verbose logging',
      default: false,
    })
    .option('use-api', {
      type: 'boolean',
      describe: 'Use GitHub API instead of gh CLI (default: false)',
      default: false,
    })
    .help(false) // Disable yargs built-in help since we handle it manually
    .version(false) // Disable yargs built-in version since we handle it manually
    .example(
      '$0 https://github.com/owner/repo/issues/123',
      'Download issue #123'
    )
    .example('$0 owner/repo#123', 'Download issue #123 using short format')
    .example('$0 owner/repo#123 -o my-issue.md', 'Save to specific file')
    .example('$0 owner/repo#123 --token ghp_xxx', 'Use specific GitHub token')
    .example('$0 owner/repo#123 --format json', 'Export as JSON')
    .example('$0 owner/repo#123 --no-download-images', 'Skip image download')
    .example('$0 owner/repo#123 --use-api', 'Use GitHub API instead of gh CLI');

  const argv = await yargsInstance.parseAsync();

  const { issue: issueInput, output, format, verbose } = argv;
  const downloadImages_flag = argv['download-images'];
  const useApi = argv['use-api'];
  let { token } = argv;

  // Set verbose mode
  verboseMode = verbose;

  // Check and parse issue URL
  if (!issueInput) {
    log('red', '❌ No issue URL provided');
    log(
      'yellow',
      '   Expected: https://github.com/owner/repo/issues/123 or owner/repo#123'
    );
    log('yellow', '   Run with --help for more information');
    process.exit(1);
  }
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

  // If using API mode and no token provided, try to get it from gh CLI
  if (useApi && (!token || token === undefined)) {
    const ghToken = await getGhToken();
    if (ghToken) {
      token = ghToken;
      log('cyan', '🔑 Using GitHub token from gh CLI for API mode');
    }
  }

  // Fetch the issue
  let issueData;
  try {
    issueData = await fetchIssue(owner, repo, issueNumber, token, useApi);
  } catch (_error) {
    process.exit(1);
  }

  // Determine output paths
  let outputDir = process.cwd();
  let outputFilename;

  if (output) {
    // Check if output looks like a file path (has extension) or directory
    const ext = path.extname(output);
    if (ext === '.md' || ext === '.json') {
      outputDir = path.dirname(output);
      outputFilename = path.basename(output, ext);
    } else if (ext) {
      outputDir = path.dirname(output);
      outputFilename = path.basename(output);
    } else {
      // Treat as directory
      outputDir = output;
    }
  }

  // Ensure output directory exists
  await fs.ensureDir(outputDir);

  // Default filename if not specified
  if (!outputFilename) {
    outputFilename = `issue-${issueNumber}`;
  }

  // Download images if enabled
  let imageMap = null;
  let imageResults = null;

  if (downloadImages_flag) {
    const imageDir = path.join(outputDir, `${outputFilename}-images`);

    // Collect all content for image extraction
    let allContent = issueData.issue.body || '';
    for (const comment of issueData.comments) {
      allContent += `\n${comment.body || ''}`;
    }

    // Get token for image downloads if not already available
    let imageToken = token;
    if (!imageToken) {
      imageToken = await getGhToken();
    }

    const { imageMap: downloadedMap, results } = await downloadImages(
      allContent,
      imageDir,
      imageToken
    );

    imageMap = downloadedMap;
    imageResults = results;

    // Clean up empty image directory
    if (results.downloaded.length === 0 && (await fs.pathExists(imageDir))) {
      try {
        const files = await fs.readdir(imageDir);
        if (files.length === 0) {
          await fs.rmdir(imageDir);
        }
      } catch (_error) {
        // Ignore cleanup errors
      }
    }
  }

  // Generate output based on format
  log('blue', `📝 Converting to ${format}...`);

  if (format === 'json') {
    const jsonOutput = issueToJson(issueData, imageResults);
    const outputPath = path.join(outputDir, `${outputFilename}.json`);

    try {
      await fs.writeFile(
        outputPath,
        JSON.stringify(jsonOutput, null, 2),
        'utf8'
      );
      log('green', `✅ Issue saved to: ${outputPath}`);
    } catch (error) {
      log('red', `❌ Failed to write file: ${error.message}`);
      process.exit(1);
    }
  } else {
    // Markdown format
    const markdown = issueToMarkdown(issueData, imageMap);
    const outputPath = path.join(outputDir, `${outputFilename}.md`);

    try {
      await fs.writeFile(outputPath, markdown, 'utf8');
      log('green', `✅ Issue saved to: ${outputPath}`);
    } catch (error) {
      log('red', `❌ Failed to write file: ${error.message}`);
      process.exit(1);
    }
  }

  // Summary
  if (imageResults && imageResults.downloaded.length > 0) {
    const imageDir = path.join(outputDir, `${outputFilename}-images`);
    log('green', `📁 Images saved to: ${imageDir}`);
  }
}

// Only run CLI when invoked directly (not imported as a library)
const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1]
  ? path.resolve(process.cwd(), process.argv[1])
  : null;

// Check if this script is being run directly
const isDirectInvocation =
  invokedPath &&
  (invokedPath === currentFilePath ||
    invokedPath.endsWith('gh-load-issue.mjs') ||
    invokedPath.endsWith('gh-load-issue'));

if (isDirectInvocation) {
  main().catch((error) => {
    log('red', `💥 Script failed: ${error.message}`);
    process.exit(1);
  });
}
