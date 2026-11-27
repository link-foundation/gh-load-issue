#!/usr/bin/env bash
set -euo pipefail

scratch=$(mktemp -d)
cleanup() {
  node -e 'require("node:fs").rmSync(process.argv[1], { recursive: true })' "$scratch"
}
trap cleanup EXIT
export HUSKY=0
export GITHUB_OUTPUT="$scratch/workflow-output"
git init --quiet --bare --initial-branch=main "$scratch/remote.git"
git init --quiet --initial-branch=main "$scratch/work"
git archive HEAD | tar -xf - -C "$scratch/work"
cd "$scratch/work"
git add .
git -c user.name=Fixture -c user.email=fixture@example.invalid commit --quiet -m 'release trigger'
git remote add origin "$scratch/remote.git"
git push --quiet -u origin main
trigger=$(git rev-parse HEAD)
npm ci --ignore-scripts --no-audit --no-fund
node scripts/version-and-commit.mjs --mode changeset
version_commit=$(git rev-parse HEAD)
test "$version_commit" != "$trigger"
test "$(git log -1 --format=%B)" = "$(node -p 'require("./package.json").version')

Release-Trigger: $trigger"
version=$(node -p 'require("./package.json").version')
test "$version" = "$(node -p 'require("./package-lock.json").packages[""].version')"
grep -Fq "## $version" CHANGELOG.md
bun install --frozen-lockfile --ignore-scripts
git checkout --quiet --detach "$trigger"
node scripts/version-and-commit.mjs --mode changeset
test "$(git rev-parse HEAD)" = "$version_commit"
node scripts/version-and-commit.mjs --mode recover
test "$(git rev-parse HEAD)" = "$version_commit"
test "$(grep -Fxc "commit=$version_commit" "$GITHUB_OUTPUT")" -eq 3
printf 'Verified version %s, retry and recovery at the same commit %s\n' "$version" "$version_commit"
