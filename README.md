# gh-load-issue

[![npm version](https://img.shields.io/npm/v/gh-load-issue)](https://www.npmjs.com/package/gh-load-issue)

A CLI tool to download GitHub issues and convert them to markdown - perfect for AI processing and offline analysis. Automatically downloads embedded images to prevent "Could not process image" errors when using with Claude Code CLI.

## Features

- 📥 **Download Issues**: Fetch complete GitHub issues with all comments
- 📷 **Image Downloading**: Automatically download and validate embedded images
- 📝 **Markdown Export**: Convert issues to well-formatted markdown files
- 📊 **JSON Export**: Export structured data for programmatic use
- 🔐 **Smart Authentication**: Automatic GitHub CLI integration or token support
- ⚡ **Simple CLI**: Easy-to-use command-line interface
- 🎯 **Flexible Input**: Support for full URLs or short format (owner/repo#123)
- ✅ **Image Validation**: Validates downloaded images by checking magic bytes

## Quick Start

```bash
# Download issue using full URL
gh-load-issue https://github.com/owner/repo/issues/123

# Download issue using short format
gh-load-issue owner/repo#123

# Save to specific file
gh-load-issue owner/repo#123 -o my-issue.md

# Export as JSON
gh-load-issue owner/repo#123 --format json

# Skip image downloading
gh-load-issue owner/repo#123 --no-download-images

# Use specific GitHub token
gh-load-issue owner/repo#123 --token ghp_xxx
```

## Installation

### Global Installation (Recommended)

Install globally for system-wide access:

```bash
bun install -g gh-load-issue

# After installation, use anywhere:
gh-load-issue --help
```

### Uninstall

Remove the global installation:

```bash
bun uninstall -g gh-load-issue
```

### Local Installation

```bash
# Clone the repository
git clone https://github.com/link-foundation/gh-load-issue.git
cd gh-load-issue

# Make the script executable
chmod +x gh-load-issue.mjs

# Run it
./gh-load-issue.mjs --help
```

## Usage

```
Usage: gh-load-issue <issue-url> [options]

Options:
      --version          Show version number
  -t, --token            GitHub personal access token (optional for public issues)
  -o, --output           Output directory or file path (default: current directory)
      --download-images  Download embedded images (default: true)
  -f, --format           Output format: markdown, json (default: markdown)
  -v, --verbose          Enable verbose logging
  -h, --help             Show help
```

## Image Handling

The tool automatically downloads and validates all images found in issues:

### Supported Image Formats

- PNG, JPEG, GIF, WebP
- BMP, ICO, SVG

### Image Features

- **Automatic Download**: Images in both markdown (`![alt](url)`) and HTML (`<img src>`) syntax are detected
- **Magic Bytes Validation**: Images are validated by content, not just file extension
- **GitHub Authentication**: Uses your GitHub token for private repository images
- **Redirect Handling**: Properly follows S3 signed URLs and other redirects
- **Error Handling**: Gracefully handles missing/expired URLs with warnings
- **Local References**: Markdown is updated to reference downloaded images

### Output Structure

```
issue-123.md              # Issue body and comments in markdown
issue-123-images/         # Directory with downloaded images
  image-1.png
  image-2.jpg
issue-123.json            # Optional JSON export (with --format json)
```

## Authentication

The tool supports multiple authentication methods for accessing private issues:

### 1. GitHub CLI (Recommended)

If you have [GitHub CLI](https://cli.github.com/) installed and authenticated, the script will automatically use your credentials:

```bash
# Authenticate with GitHub CLI (one-time setup)
gh auth login

# Script automatically detects and uses gh CLI authentication
gh-load-issue owner/repo#123  # Works with private issues!
```

### 2. Environment Variable

Set the `GITHUB_TOKEN` environment variable:

```bash
export GITHUB_TOKEN=ghp_your_token_here
gh-load-issue owner/repo#123
```

### 3. Command Line Token

Pass the token directly with `--token`:

```bash
gh-load-issue owner/repo#123 --token ghp_your_token_here
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
gh-load-issue https://github.com/torvalds/linux/issues/123

# Use short format
gh-load-issue torvalds/linux#123

# Download private issue (using GitHub CLI auth)
gh-load-issue myorg/private-repo#456

# Save to specific location
gh-load-issue owner/repo#789 --output ./issues/issue-789.md

# Export as JSON for programmatic use
gh-load-issue owner/repo#123 --format json

# Verbose mode for debugging
gh-load-issue owner/repo#123 --verbose

# Skip image download (faster, text only)
gh-load-issue owner/repo#123 --no-download-images

# Use explicit token
gh-load-issue owner/repo#123 --token ghp_your_token_here
```

## Output Format

### Markdown Output

The generated markdown file includes:

- **Issue Title** - As the main heading
- **Metadata** - Issue number, author, state, dates, labels, assignees, milestone
- **Description** - The issue body content with local image references
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

[Issue body content with local image references]

![screenshot](issue-123-images/image-1.png)

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

### JSON Output

The JSON format includes:

- Full issue data (title, body, state, labels, etc.)
- All comments with metadata
- Image download results (downloaded, failed, skipped)
- Download metadata (timestamp, tool version)

## Requirements

- [Bun](https://bun.sh/) (>=1.2.0) runtime
- For private issues (optional):
  - [GitHub CLI](https://cli.github.com/) (recommended) OR
  - GitHub personal access token (via `--token` or `GITHUB_TOKEN` env var)

## Testing

The project includes a test suite:

```bash
# Run all tests
bun test

# Or run directly
cd tests
./test-all.test.mjs
```

## Use Cases

- **AI Processing**: Download issues with images for AI analysis without "Could not process image" errors
- **Claude Code CLI**: Perfect companion for using issues with Claude Code
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
