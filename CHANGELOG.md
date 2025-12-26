# gh-load-issue

## 0.3.2

### Patch Changes

- Test patch release

## 0.3.1

### Patch Changes

- 7114ace: Rename package contents from gh-download-issue to gh-load-issue
  - Rename main script file from gh-download-issue.mjs to gh-load-issue.mjs
  - Update all references in package.json, README.md, CHANGELOG.md
  - Update all references in scripts, tests, and examples
  - Update User-Agent header in the main script

## 0.3.0

### Minor Changes

- 27e98ee: Add image downloading and validation support
  - Automatically download embedded images from issues and comments
  - Validate images by checking magic bytes (PNG, JPEG, GIF, WebP, BMP, ICO, SVG)
  - Update markdown to reference locally downloaded images
  - Add JSON output format support (--format json)
  - Add --download-images flag (default: true, use --no-download-images to skip)
  - Add --verbose flag for detailed logging
  - Handle GitHub URL redirects and S3 signed URLs
  - Gracefully handle missing/expired image URLs with warnings
  - Create issue-{number}-images/ directory for downloaded images

## 0.2.1

### Patch Changes

- 71a6f48: Fix release formatting script to handle Major/Minor/Patch changes - Previously only handled Patch changes, causing script to fail on Minor and Major releases

## 0.2.0

### Minor Changes

- 89c82c3: Apply CI/CD template from js-ai-driven-development-pipeline-template with automated testing, linting, formatting, and release infrastructure
