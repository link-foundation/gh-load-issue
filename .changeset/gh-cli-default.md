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
