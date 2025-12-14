# gh-download-issue

[![npm version](https://img.shields.io/npm/v/gh-download-issue)](https://www.npmjs.com/package/gh-download-issue)

A CLI tool to download GitHub issues and convert them to markdown - perfect for AI processing and offline analysis.

## Features

- 📥 **Download Issues**: Fetch complete GitHub issues with all comments
- 📝 **Markdown Export**: Convert issues to well-formatted markdown files
- 🔐 **Smart Authentication**: Automatic GitHub CLI integration or token support
- ⚡ **Simple CLI**: Easy-to-use command-line interface
- 🎯 **Flexible Input**: Support for full URLs or short format (owner/repo#123)

## Quick Start

```bash
# Download issue using full URL
gh-download-issue https://github.com/owner/repo/issues/123

# Download issue using short format
gh-download-issue owner/repo#123

# Save to specific file
gh-download-issue owner/repo#123 -o my-issue.md

# Use specific GitHub token
gh-download-issue owner/repo#123 --token ghp_xxx
```

## Installation

### Global Installation (Recommended)

Install globally for system-wide access:

```bash
# Using bun
bun install -g gh-download-issue

# Using npm
npm install -g gh-download-issue

# After installation, use anywhere:
gh-download-issue --help
```

### Uninstall

Remove the global installation:

```bash
# Using bun
bun uninstall -g gh-download-issue

# Using npm
npm uninstall -g gh-download-issue
```

### Local Installation

```bash
# Clone the repository
git clone https://github.com/link-foundation/gh-download-issue.git
cd gh-download-issue

# Make the script executable
chmod +x gh-download-issue.mjs

# Run it
./gh-download-issue.mjs --help
```

## Usage

```
Usage: gh-download-issue <issue-url> [options]

Options:
  -t, --token   GitHub personal access token (optional for public issues)
  -o, --output  Output file path (default: issue-<number>.md in current directory)
  -h, --help    Show help
  -v, --version Show version
```

## Authentication

The tool supports multiple authentication methods for accessing private issues:

### 1. GitHub CLI (Recommended)

If you have [GitHub CLI](https://cli.github.com/) installed and authenticated, the script will automatically use your credentials:

```bash
# Authenticate with GitHub CLI (one-time setup)
gh auth login

# Script automatically detects and uses gh CLI authentication
gh-download-issue owner/repo#123  # Works with private issues!
```

### 2. Environment Variable

Set the `GITHUB_TOKEN` environment variable:

```bash
export GITHUB_TOKEN=ghp_your_token_here
gh-download-issue owner/repo#123
```

### 3. Command Line Token

Pass the token directly with `--token`:

```bash
gh-download-issue owner/repo#123 --token ghp_your_token_here
```

### Authentication Priority

The script uses this fallback chain:

1. `--token` command line argument (highest priority)
2. `GITHUB_TOKEN` environment variable
3. GitHub CLI authentication (if `gh` is installed and authenticated)
4. No authentication (public issues only)

## Examples

```bash
# Basic usage - download a public issue
gh-download-issue https://github.com/torvalds/linux/issues/123

# Use short format
gh-download-issue torvalds/linux#123

# Download private issue (using GitHub CLI auth)
gh-download-issue myorg/private-repo#456

# Save to specific location
gh-download-issue owner/repo#789 --output ./issues/issue-789.md

# Use explicit token
gh-download-issue owner/repo#123 --token ghp_your_token_here
```

## Output Format

The generated markdown file includes:

- **Issue Title** - As the main heading
- **Metadata** - Issue number, author, state, dates, labels, assignees, milestone
- **Description** - The issue body content
- **Comments** - All comments with author and timestamp

Example output structure:

```markdown
# Issue Title

**Issue:** #123
**Author:** @username
**State:** open
**Created:** 1/1/2025, 12:00:00 PM
**Updated:** 1/2/2025, 3:30:00 PM
**Labels:** `bug`, `enhancement`

---

## Description

[Issue body content here]

---

## Comments (2)

### Comment 1 by @user1

_Posted on 1/1/2025, 2:00:00 PM_

[Comment content here]

---

### Comment 2 by @user2

_Posted on 1/2/2025, 3:30:00 PM_

[Comment content here]
```

## Requirements

- [Bun](https://bun.sh/) (>=1.2.0) or [Node.js](https://nodejs.org/) (>=22.17.0) runtime
- For private issues (optional):
  - [GitHub CLI](https://cli.github.com/) (recommended) OR
  - GitHub personal access token (via `--token` or `GITHUB_TOKEN` env var)

## Testing

The project includes a test suite:

```bash
# Run all tests
cd tests
./test-all.mjs

# Run specific test
./test-basic.mjs
```

## Use Cases

- **AI Processing**: Download issues for AI analysis and automated problem-solving
- **Offline Access**: Keep local copies of important issues for reference
- **Documentation**: Export issues as markdown for documentation purposes
- **Backup**: Archive issues before repository changes or migrations
- **Analysis**: Collect issues for trend analysis or reporting

## Rate Limits

- **Unauthenticated**: 60 requests per hour (public issues only)
- **Authenticated**: 5,000 requests per hour (includes private issues)
- Authentication is automatically handled if GitHub CLI is set up

## License

This project is released into the public domain under The Unlicense - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! This is an MVP implementation focusing on core functionality.

## Related Projects

- [gh-pull-all](https://github.com/link-foundation/gh-pull-all) - Sync all repositories from a GitHub organization or user
