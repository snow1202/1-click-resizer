#!/usr/bin/env bash
# Publish a new version of 1-Click Resizer: bump the version, sync it into the
# manifest + panel label, commit everything, and push to GitHub. Colleagues'
# panels pick it up automatically (in-panel "Cập nhật" button).
#
# Usage:
#   ./publish.sh                 # bump patch (1.0.0 -> 1.0.1), auto message
#   ./publish.sh 1.1.0           # set an explicit version
#   ./publish.sh "fix rename bug" # bump patch, custom commit message
#   ./publish.sh 1.1.0 "big update"  # explicit version + message
#
# PUBLISH_YES=1 ./publish.sh ... skips the staging confirmation (automation).
# macOS-only (BSD sed) — publishing is a maintainer task on this machine.
set -euo pipefail
cd "$(dirname "$0")"

VJSON="version.json"
MANIFEST="com.oneclickresize.panel/CSXS/manifest.xml"
INDEX="com.oneclickresize.panel/index.html"
SHOT="media/_shot.html"          # README hero demo (its version label + rerender)

# --- Guards: right branch, up to date with origin -----------------------------
branch=$(git symbolic-ref --short -q HEAD) || { echo "❌ Detached HEAD — check out main before publishing."; exit 1; }
[ "$branch" = "main" ] || { echo "❌ You are on '$branch'. Publishing only works from main (the updater pulls origin/main)."; exit 1; }

git fetch origin
if ! git merge-base --is-ancestor "$(git rev-parse origin/main)" HEAD; then
  echo "❌ Local main is behind origin/main — run 'git pull' first, then publish."
  exit 1
fi

# --- Version -------------------------------------------------------------------
cur=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([0-9.]*\)".*/\1/p' "$VJSON")
[ -n "$cur" ] || { echo "❌ Could not read current version from $VJSON"; exit 1; }

new=""
if [ $# -ge 1 ] && printf '%s' "$1" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  new="$1"; shift
fi
if [ -z "$new" ]; then
  IFS=. read -r a b c <<EOF
$cur
EOF
  new="$a.$b.$((c + 1))"
fi
msg="${*:-release v$new}"

# --- Show what will ship, confirm ----------------------------------------------
echo "Publishing v$cur -> v$new …"
if [ -n "$(git status --porcelain)" ]; then
  echo "Files that will be included in this release:"
  git status --short
  if [ "${PUBLISH_YES:-}" != "1" ]; then
    printf "Commit ALL of the above as v%s? [y/N] " "$new"
    read -r ok
    [ "$ok" = "y" ] || [ "$ok" = "Y" ] || { echo "Aborted — nothing committed."; exit 1; }
  fi
fi

# --- Stamp the version into every surface ---------------------------------------
sed -i '' "s/\"version\"[[:space:]]*:[[:space:]]*\"[0-9.]*\"/\"version\": \"$new\"/" "$VJSON"
sed -i '' "s/ExtensionBundleVersion=\"[0-9.]*\"/ExtensionBundleVersion=\"$new\"/" "$MANIFEST"
sed -i '' "s/\(<Extension Id=\"com.oneclickresize.panel.main\" Version=\)\"[0-9.]*\"/\1\"$new\"/" "$MANIFEST"
sed -i '' "s#<b>V[0-9.]*</b>#<b>V$new</b>#" "$INDEX"
sed -i '' "s#<b>V[0-9.]*</b>#<b>V$new</b>#" "$SHOT"

# Verify every stamp landed (sed exits 0 even on zero matches).
verify_fail() { echo "❌ Version stamp failed in $1 — reverting stamps, aborting."; git checkout -- "$VJSON" "$MANIFEST" "$INDEX" "$SHOT"; exit 1; }
grep -q "\"version\": \"$new\"" "$VJSON" || verify_fail "$VJSON"
grep -q "ExtensionBundleVersion=\"$new\"" "$MANIFEST" || verify_fail "$MANIFEST (bundle)"
grep -q "<Extension Id=\"com.oneclickresize.panel.main\" Version=\"$new\"" "$MANIFEST" || verify_fail "$MANIFEST (extension)"
grep -q "<b>V$new</b>" "$INDEX" || verify_fail "$INDEX"
grep -q "<b>V$new</b>" "$SHOT" || verify_fail "$SHOT"

# Rerender the README hero so its version label tracks the release (fail-soft:
# the code ships even if Chrome is unavailable).
./build-hero.sh || echo "⚠️  Hero image not regenerated — run ./build-hero.sh manually once Chrome is available."

# --- Ship ------------------------------------------------------------------------
git add -A
git commit -m "$msg (v$new)"
git push origin main
echo "✅ Published v$new and pushed to GitHub."

# --- Cut a matching GitHub release ------------------------------------------------
# Keeps the Releases page's "Latest" label and the stable
# /releases/latest/download/1-Click-Resizer-Installer.zip URL tracking main every
# time. The installer embeds a self-updating clone, so rebuilding is cheap
# insurance; the release just needs to carry the zip so the latest-download URL
# resolves. Runs AFTER the push, so a release hiccup never blocks the code update.
REPO_SLUG=$(git remote get-url origin | sed -e 's#.*github.com[:/]##' -e 's#\.git$##')
if command -v gh >/dev/null 2>&1; then
  echo "→ Building installer + publishing release v$new to $REPO_SLUG …"
  if ./build-installer.sh \
     && gh release create "v$new" "dist/1-Click-Resizer-Installer.zip" --repo "$REPO_SLUG" \
          --title "1-Click Resizer v$new" --notes "$msg" --latest; then
    echo "✅ Release v$new published — Releases page + latest-download URL now show v$new."
  else
    echo "⚠️  Code IS pushed, but the GitHub release for v$new did not publish."
    echo "    Finish it manually with:"
    echo "    ./build-installer.sh && gh release create v$new dist/1-Click-Resizer-Installer.zip --repo $REPO_SLUG --title \"1-Click Resizer v$new\" --notes \"$msg\" --latest"
  fi
else
  echo "⚠️  gh CLI not found — code pushed, but the Releases page was NOT updated."
fi

# --- Transition mirror: keep the OLD repo fed ------------------------------------
# Releases now live on origin = snow1202/1-click-resizer. Panels installed before
# the move still pull from the previous repo (tungnguyen1202/1-click-resizer), so
# the same commits and tags are pushed there too — otherwise those installs would
# silently stop seeing new versions. Drop this block once everyone has re-run the
# install one-liner and points at the new repo.
#
# macOS Keychain holds one github.com credential per host and it belongs to the
# active account, so the mirror push borrows the other account's token from `gh`
# through a throwaway credential helper — nothing is written to disk or to config.
if git remote get-url legacy >/dev/null 2>&1; then
  echo "→ Mirroring v$new to the legacy repo (pre-move installs) …"
  if git -c credential.helper='!f(){ test "$1" = get && { echo username=tungnguyen1202; echo "password=$(gh auth token --user tungnguyen1202)"; }; };f' \
       push legacy main --quiet \
     && git -c credential.helper='!f(){ test "$1" = get && { echo username=tungnguyen1202; echo "password=$(gh auth token --user tungnguyen1202)"; }; };f' \
       push legacy --tags --quiet; then
    echo "✅ Legacy repo mirrored — pre-move installs keep auto-updating."
  else
    echo "⚠️  Legacy mirror failed — v$new IS live on $REPO_SLUG, only old installs lag."
    echo "    Needs a valid gh login for tungnguyen1202 (gh auth status)."
  fi
fi
