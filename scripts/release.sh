#!/usr/bin/env bash
# Cut a release: set the version, commit, tag, push. GitHub Actions then
# builds Linux, Windows and macOS and attaches them to a DRAFT release —
# review it on GitHub and press "Publish".
#
#   scripts/release.sh 0.9.0-beta.2
#
# Run it from main, with a clean tree and CHANGELOG.md already describing
# the version.
set -euo pipefail
cd "$(dirname "$0")/.."

v=${1:?usage: scripts/release.sh X.Y.Z[-beta.N]}
[[ $v =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || { echo "Not a version: $v" >&2; exit 1; }
[[ $(git branch --show-current) == main ]] || { echo "Releases are cut from main." >&2; exit 1; }
[[ -z $(git status --porcelain) ]] || { echo "Commit or stash your changes first." >&2; exit 1; }
git rev-parse -q --verify "refs/tags/v$v" >/dev/null && { echo "v$v already exists." >&2; exit 1; }
grep -q "^## $v" CHANGELOG.md || { echo "CHANGELOG.md has no '## $v' section yet." >&2; exit 1; }

npm version "$v" --no-git-tag-version >/dev/null
git add package.json package-lock.json
git diff --cached --quiet || git commit -qm "Mutiny $v"
git tag -a "v$v" -m "Mutiny $v"
git push origin main "v$v"
echo "Tagged v$v — the builds are running: https://github.com/worldmutiny/mutiny/actions"
