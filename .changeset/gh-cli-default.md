---
'gh-load-issue': minor
---

Use gh CLI by default instead of GitHub API for issue fetching

- Added `fetchIssueWithGh` function to fetch issues using gh CLI directly
- Changed default behavior to use gh CLI when available and authenticated
- Added `--use-api` flag to explicitly use GitHub API instead of gh CLI
- Fallback to Octokit API when gh CLI is not available or when token is provided
- Added tests for both gh CLI and API modes
- Both modes produce consistent output format

Release the pending Bun-only launcher fix so npm consumers can run `--version`
and `--help` without the broken shell/JavaScript polyglot from 0.3.2. Bun
`>=1.2.0` is required; Node.js and Deno are no longer supported runtimes.

- Install Bun in release jobs so versioning and publishing can run successfully
- Test the packed npm tarball through its installed bin link before publishing
- Verify the published npm version, `latest` tag, and installed executable before
  reporting publication success or creating a GitHub release
