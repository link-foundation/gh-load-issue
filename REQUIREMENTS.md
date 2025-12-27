# Requirements

## Goal

`gh-load-issue` is a tool for downloading GitHub issues and converting them to markdown format for offline access, AI processing, and documentation purposes.

## Core Functionality

### Primary Use Cases

1. **AI Processing**: Download issues with all embedded images for AI analysis without "Could not process image" errors
2. **Offline Access**: Create local copies of issues with all data needed for offline viewing
3. **Documentation**: Export issues as markdown for documentation purposes
4. **Backup**: Archive issues before repository changes or migrations
5. **Analysis**: Collect issues for trend analysis or reporting

### Interface Requirements

The tool MUST be available as:

1. **CLI Tool**: Command-line interface with intuitive options

   ```bash
   gh-load-issue <issue-url> [options]
   gh-load-issue owner/repo#123 [options]
   ```

2. **Library**: Importable module for programmatic use

   ```javascript
   import { loadIssue } from 'gh-load-issue';
   const result = await loadIssue('owner/repo#123');
   ```

## Data Requirements

### Content to Download

The tool MUST download all data that a user typically sees on a GitHub issue page:

| Data Type       | Priority | Status      |
| --------------- | -------- | ----------- |
| Issue Title     | Required | Implemented |
| Issue Body      | Required | Implemented |
| Issue State     | Required | Implemented |
| Author          | Required | Implemented |
| Created Date    | Required | Implemented |
| Updated Date    | Required | Implemented |
| Labels          | Required | Implemented |
| Assignees       | Required | Implemented |
| Milestone       | Required | Implemented |
| Comments        | Required | Implemented |
| Embedded Images | Required | Implemented |
| Reactions       | Optional | Planned     |
| Timeline Events | Optional | Planned     |
| Linked PRs      | Optional | Planned     |

### Output Format

1. **Markdown Output** (default)
   - All content MUST be in markdown format (not HTML)
   - Image references MUST point to locally downloaded files
   - Structure MUST be consistent and predictable

2. **JSON Output** (optional)
   - Full structured data for programmatic use
   - Includes metadata about downloads

### Offline Availability

The downloaded issue MUST be fully available offline:

1. **Self-contained folder structure**:

   ```
   issue-123.md              # Main markdown file
   issue-123-images/         # All embedded images
     image-1.png
     image-2.jpg
   issue-123.json            # Optional JSON export
   ```

2. **Local image references**: Markdown MUST reference local images, not remote URLs
3. **No external dependencies**: Viewing the markdown requires no network access

## Technical Requirements

### Authentication

- MUST support GitHub CLI (`gh auth token`) authentication
- MUST support environment variable (`GITHUB_TOKEN`)
- MUST support command-line token (`--token`)
- MUST work without authentication for public issues

### Image Handling

- MUST validate downloaded images by magic bytes
- MUST handle redirects (GitHub S3 signed URLs)
- MUST support: PNG, JPEG, GIF, WebP, BMP, ICO, SVG
- MUST handle both markdown (`![alt](url)`) and HTML (`<img>`) syntax
- MUST gracefully handle failed downloads with warnings

### Error Handling

- MUST provide clear error messages for common issues
- MUST NOT crash on network errors (graceful degradation)
- MUST support verbose mode for debugging

### Performance

- SHOULD download images in parallel where possible
- SHOULD respect GitHub API rate limits
- SHOULD cache authentication tokens

## Quality Assurance

### Testing Requirements

1. **Unit Tests**: Core functions (parsing, extraction, validation)
2. **Integration Tests**: CLI commands and options
3. **E2E Tests**: Real issue downloads with content verification

### Test Coverage

Tests MUST verify:

- Issue metadata extraction
- Comment extraction
- Image download and validation
- Offline availability of output
- Various issue types (with/without images, many comments, etc.)

## Compatibility

- Runtime: Bun >= 1.2.0
- Platforms: Linux, macOS, Windows
- GitHub: Public and private repositories

## Non-Goals

- Real-time sync with GitHub
- Editing or uploading issues back to GitHub
- Supporting other platforms (GitLab, Bitbucket)
