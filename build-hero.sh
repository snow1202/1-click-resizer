#!/usr/bin/env bash
# Regenerate the README hero image (media/panel.png) from the static demo
# media/_shot.html. Renders with headless Chrome in a temp dir (Chrome can't read
# macOS-protected Documents directly, so we stage a copy), then copies the PNG
# back. Run after editing the demo — or let publish.sh call it on each release.
#
# Recipe: the demo pins .wrap to 404px so the panel renders narrow and complete;
# window 404x600 @2x → an 808x1200 image framed with even margins.
# Maintainer-only, macOS-only (needs Google Chrome).
set -euo pipefail
cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "❌ Google Chrome not found at $CHROME — skipping hero render."; exit 1; }

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/media" "$STAGE/com.oneclickresize.panel/css"
cp media/_shot.html "$STAGE/media/_shot.html"
cp com.oneclickresize.panel/css/style.css "$STAGE/com.oneclickresize.panel/css/style.css"

echo "→ Rendering hero…"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=404,600 \
  --screenshot="$STAGE/panel.png" "file://$STAGE/media/_shot.html" >/dev/null 2>&1

cp "$STAGE/panel.png" media/panel.png
echo "✅ Updated media/panel.png ($(sips -g pixelWidth -g pixelHeight media/panel.png 2>/dev/null | awk '/pixel/{print $2}' | paste -sd'x' -))"
