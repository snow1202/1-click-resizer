#!/usr/bin/env bash
# Build "1-Click-Resizer-Installer.zip" — a double-clickable macOS installer app
# with the panel (full git clone) embedded. Colleagues: unzip → right-click the
# app → Open → done. The embedded clone keeps auto-updating via the panel's
# updater, so this zip rarely needs rebuilding.
#
# Maintainer-only. Output: dist/1-Click-Resizer-Installer.zip
set -euo pipefail
cd "$(dirname "$0")"

REPO_URL="https://github.com/snow1202/1-click-resizer.git"
APP_NAME="Cài đặt 1-Click Resizer"
OUT_DIR="dist"
PKG_DIR="$OUT_DIR/1-Click Resizer Installer"
APP="$PKG_DIR/$APP_NAME.app"

rm -rf "$OUT_DIR"
mkdir -p "$PKG_DIR"

# --- 1. Stage a clean clone (tracked files + .git only) -------------------------
echo "→ Staging clean clone…"
git clone --quiet --local --no-hardlinks . "$OUT_DIR/stage"
git -C "$OUT_DIR/stage" remote set-url origin "$REPO_URL"
git -C "$OUT_DIR/stage" gc --quiet --aggressive --prune=now

# --- 2. Compile the applet -------------------------------------------------------
echo "→ Compiling installer app…"
cat > "$OUT_DIR/applet.applescript" <<'APPLESCRIPT'
set appPath to POSIX path of (path to me)
try
	do shell script "/bin/bash " & quoted form of (appPath & "Contents/Resources/installer.sh")
	display dialog "✅ Cài đặt 1-Click Resizer thành công!

1. Thoát hẳn Premiere (Cmd+Q) rồi mở lại.
2. Mở panel: Window → Extensions → 1-Click Resizer

Từ nay có bản mới, panel sẽ tự hiện nút '↑ Cập nhật'." buttons {"OK"} default button "OK" with icon note with title "1-Click Resizer"
on error errMsg
	display dialog "❌ Cài đặt gặp lỗi:

" & errMsg buttons {"OK"} default button "OK" with icon stop with title "1-Click Resizer"
end try
APPLESCRIPT
osacompile -o "$APP" "$OUT_DIR/applet.applescript"

# --- 3. Embed the payload --------------------------------------------------------
echo "→ Embedding panel + installer…"
cp -R "$OUT_DIR/stage" "$APP/Contents/Resources/1-click-resizer"
cat > "$APP/Contents/Resources/installer.sh" <<'INSTALLER'
#!/usr/bin/env bash
set -euo pipefail
SRC="$(cd "$(dirname "$0")/1-click-resizer" && pwd)"
DEST="$HOME/Library/Application Support/1-Click Resizer"
EXT_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"

# Allow unsigned CEP panels across Premiere generations.
for v in 9 10 11 12; do
  defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1
done

# First install: copy the embedded clone to a stable home. On re-runs keep the
# existing copy (the in-panel updater keeps it current) and just re-link.
if [ ! -d "$DEST/.git" ]; then
  rm -rf "$DEST"
  mkdir -p "$(dirname "$DEST")"
  cp -R "$SRC" "$DEST"
  xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true
fi

mkdir -p "$EXT_DIR"
ln -sfn "$DEST/com.oneclickresize.panel" "$EXT_DIR/com.oneclickresize.panel"
INSTALLER
chmod +x "$APP/Contents/Resources/installer.sh"

# --- 4. README + zip --------------------------------------------------------------
cat > "$PKG_DIR/ĐỌC TRƯỚC KHI CÀI.txt" <<'TXT'
1-CLICK RESIZER — HƯỚNG DẪN CÀI (macOS)

CÁCH NHANH NHẤT (khuyên dùng) — không gặp lỗi "Move to Trash":
Mở Terminal, dán 1 lệnh sau rồi Enter:

  curl -fsSL https://raw.githubusercontent.com/snow1202/1-click-resizer/main/web-install.sh | bash

Rồi thoát hẳn Premiere (Cmd+Q) → mở lại → Window → Extensions → 1-Click Resizer.

------------------------------------------------------------

HOẶC cài bằng app này:

1. CHUỘT PHẢI vào "Cài đặt 1-Click Resizer" → chọn "Open"
2. NẾU chỉ thấy nút "Move to Trash" (macOS 15 Sequoia trở lên):
   → Vào System Settings → Privacy & Security → kéo xuống dưới
   → bấm "Open Anyway" cạnh tên app → mở lại app.
   (Hoặc dùng lệnh Terminal ở trên cho nhanh.)
3. Đợi hộp thoại "✅ Cài đặt thành công"
4. Thoát hẳn Premiere (Cmd+Q) → mở lại
5. Mở panel: Window → Extensions → 1-Click Resizer

Từ nay về sau KHÔNG cần cài lại: có bản mới, panel tự hiện nút "↑ Cập nhật".
TXT

echo "→ Zipping…"
rm -rf "$OUT_DIR/stage" "$OUT_DIR/applet.applescript"
(cd "$OUT_DIR" && ditto -c -k --sequesterRsrc --keepParent "1-Click Resizer Installer" "1-Click-Resizer-Installer.zip")
echo "✅ Built: $OUT_DIR/1-Click-Resizer-Installer.zip"
